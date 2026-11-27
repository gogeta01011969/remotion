import {spawnSync} from 'node:child_process';
import {readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {shortDuration, type ShortInput} from '../shorts/schema';

function run(command: string, args: string[]) {
  const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:16*1024*1024});
  if(result.error||result.status!==0)throw new Error(`${command} failed: ${result.error?.message??result.stderr}`);
  return result.stdout;
}

export function finalizePreparedVideo({input,root,outputDir,id,picture}:{input:ShortInput;root:string;outputDir:string;id:string;picture:string}) {
  const finalPath=path.join(outputDir,`${id}.mp4`);
  const mux=()=>{
    const audio=input.audio?['-i',path.join(root,'public',input.audio),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-ac','2']:['-map','0:v:0','-c:v','copy','-an'];
    run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',picture,...audio,'-t',String(shortDuration(input)/input.fps),'-movflags','+faststart',finalPath]);
    return JSON.parse(run('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels:format=duration','-of','json',finalPath]));
  };
  const audioValid=(metadata:{streams:{codec_type:string;codec_name:string;sample_rate?:string;channels?:number}[]})=>{
    const streams=metadata.streams.filter(s=>s.codec_type==='audio');
    return input.audio?streams.length===1&&streams[0].codec_name==='aac'&&(input.audioPurpose!=='background'||streams[0].sample_rate==='48000'&&streams[0].channels===2):streams.length===0;
  };
  let metadata;
  try{
    metadata=mux();
    if(!audioValid(metadata))throw new Error('Audio verification failed.');
  }catch(error){
    // Recover only optional background audio. Broken picture encodes still fail verification below.
    if(input.audioPurpose!=='background')throw error;
    console.warn('Optional soundtrack could not be added; exporting and uploading without sound.');
    const {audio:unusedAudio,audioPurpose:unusedPurpose,...muted}=input;
    input=muted;
    const assetDir=path.join(root,'public/shorts',id),planPath=path.join(outputDir,'audio-plan.json');
    rmSync(path.join(assetDir,'background-mix.wav'),{force:true});
    let plan:Record<string,unknown>={version:1,profile:'calm-curiosity',durationFrames:shortDuration(input),fps:input.fps};
    try{const saved=JSON.parse(readFileSync(planPath,'utf8'));if(saved&&typeof saved==='object'&&!Array.isArray(saved))plan=saved;}catch{/* A missing optional report must not block recovery. */}
    for(const key of ['credit','mixSha256','trackId','integratedLufs','truePeakDb'])delete plan[key];
    writeFileSync(planPath,JSON.stringify({...plan,status:'fallback-muted',cues:[],warning:'Optional soundtrack could not be added; exported without audio.'},null,2)+'\n');
    writeFileSync(path.join(assetDir,'video.json'),JSON.stringify(input,null,2)+'\n');
    metadata=mux();
  }
  const videos=metadata.streams.filter((s:{codec_type:string})=>s.codec_type==='video'),video=videos[0];
  if(videos.length!==1||video.codec_name!=='h264'||video.width!==1080||video.height!==1920||video.r_frame_rate!==`${input.fps}/1`||Number(video.nb_frames)!==shortDuration(input)||Math.abs(Number(metadata.format.duration)-shortDuration(input)/input.fps)>.1||!audioValid(metadata))throw new Error('Final export failed media verification.');
  writeFileSync(path.join(outputDir,'verification.json'),JSON.stringify(metadata,null,2)+'\n');
  return input;
}

// Both silent and narrated workflows share the same encoder and verification.
export async function renderPrepared({input,root,outputDir,id}:{input:ShortInput;root:string;outputDir:string;id:string}) {
  console.log('Bundling and rendering vertical video…');
  const {audio:unusedAudio,audioPurpose:unusedPurpose,...visualInput}=input;
  const serveUrl=await bundle({entryPoint:path.join(root,'src','index.ts'),publicDir:path.join(root,'public')});
  const composition=await selectComposition({serveUrl,id:'WhatIfShort',inputProps:visualInput});
  const picture=path.join(outputDir,'picture.mp4'), finalPath=path.join(outputDir,`${id}.mp4`);
  let lastProgress=-1;
  const concurrency=Number(process.env.RENDER_CONCURRENCY??3);
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8)throw new Error('RENDER_CONCURRENCY must be 1–8.');
  await renderMedia({serveUrl,composition,inputProps:visualInput,codec:'h264',crf:18,pixelFormat:'yuv420p',muted:true,outputLocation:picture,concurrency,onProgress:({progress})=>{
    const step=Math.floor(progress*10);if(step>lastProgress){console.log(`  Render ${step*10}%`);lastProgress=step;}
  }});
  input=finalizePreparedVideo({input,root,outputDir,id,picture});
  await renderStill({serveUrl,composition,inputProps:visualInput,output:path.join(outputDir,'thumbnail.png'),frame:45,imageFormat:'png'});
  rmSync(picture,{force:true});
  console.log(`Ready: ${path.relative(root,finalPath)}`);
  return input;
}
