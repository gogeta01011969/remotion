import {spawnSync} from 'node:child_process';
import {rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {shortDuration, type ShortInput} from '../shorts/schema';

function run(command: string, args: string[]) {
  const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:16*1024*1024});
  if(result.error||result.status!==0)throw new Error(`${command} failed: ${result.error?.message??result.stderr}`);
  return result.stdout;
}

// Both silent and narrated workflows share the same encoder and verification.
export async function renderPrepared({input,root,outputDir,id}:{input:ShortInput;root:string;outputDir:string;id:string}) {
  console.log('Bundling and rendering vertical video…');
  const serveUrl=await bundle({entryPoint:path.join(root,'src','index.ts'),publicDir:path.join(root,'public')});
  const composition=await selectComposition({serveUrl,id:'WhatIfShort',inputProps:input});
  const picture=path.join(outputDir,'picture.mp4'), finalPath=path.join(outputDir,`${id}.mp4`);
  let lastProgress=-1;
  const concurrency=Number(process.env.RENDER_CONCURRENCY??3);
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8)throw new Error('RENDER_CONCURRENCY must be 1–8.');
  await renderMedia({serveUrl,composition,inputProps:input,codec:'h264',crf:18,pixelFormat:'yuv420p',muted:true,outputLocation:picture,concurrency,onProgress:({progress})=>{
    const step=Math.floor(progress*10);if(step>lastProgress){console.log(`  Render ${step*10}%`);lastProgress=step;}
  }});
  const audio = input.audio ? ['-i',path.join(root,'public',input.audio),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-ac','2'] : ['-map','0:v:0','-c:v','copy','-an'];
  run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',picture,...audio,'-t',String(shortDuration(input)/input.fps),'-movflags','+faststart',finalPath]);
  await renderStill({serveUrl,composition,inputProps:input,output:path.join(outputDir,'thumbnail.png'),frame:45,imageFormat:'png'});
  const metadata=JSON.parse(run('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate:format=duration','-of','json',finalPath]));
  const video=metadata.streams.find((s:{codec_type:string})=>s.codec_type==='video');
  const audioStreams=metadata.streams.filter((s:{codec_type:string})=>s.codec_type==='audio');
  if(!video||video.codec_name!=='h264'||video.width!==1080||video.height!==1920||video.r_frame_rate!==`${input.fps}/1`||Math.abs(Number(metadata.format.duration)-shortDuration(input)/input.fps)>.1|| (input.audio ? audioStreams.length!==1||audioStreams[0].codec_name!=='aac' : audioStreams.length!==0))throw new Error('Final export failed media verification.');
  writeFileSync(path.join(outputDir,'verification.json'),JSON.stringify(metadata,null,2)+'\n');
  rmSync(picture,{force:true});
  console.log(`Ready: ${path.relative(root,finalPath)}`);
}
