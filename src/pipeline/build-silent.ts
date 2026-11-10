import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {type Brief, shortDuration} from '../shorts/schema';
import {prepareSilentInput} from '../shorts/silent';
import {compileStory, motionReport} from '../shorts/motion';
import {renderPrepared} from './render-prepared';

export async function buildSilent(brief:Brief,root:string,prepareOnly:boolean) {
  const assetDir=path.join(root,'public','shorts',brief.id), outputDir=path.join(root,'out','shorts',brief.id);
  [assetDir,outputDir].forEach(dir=>mkdirSync(dir,{recursive:true}));
  const input=prepareSilentInput(brief);
  compileStory(input);
  writeFileSync(path.join(assetDir,'video.json'),JSON.stringify(input,null,2)+'\n');
  writeFileSync(path.join(outputDir,'motion-report.json'),JSON.stringify(motionReport(input),null,2)+'\n');
  let from=0;
  const timing=input.scenes.map(scene=>{const item={title:scene.title,from,duration:scene.durationInFrames/input.fps,presentation:'silent',notes:scene.captions};from+=item.duration;return item;});
  writeFileSync(path.join(outputDir,'timing-report.json'),JSON.stringify(timing,null,2)+'\n');
  const srtTime=(frames:number)=>{const ms=Math.round(frames/input.fps*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
  let offset=0,index=0;const subtitles:string[]=[];
  input.scenes.forEach(scene=>{scene.captions.forEach(cue=>subtitles.push(`${++index}\n${srtTime(offset+cue.from)} --> ${srtTime(offset+cue.from+cue.duration)}\n${cue.text}\n`));offset+=scene.durationInFrames;});
  writeFileSync(path.join(outputDir,'captions.srt'),subtitles.join('\n'));
  writeFileSync(path.join(outputDir,'youtube.txt'),`${brief.topic}\n\n${brief.description}\n\nSilent visual story. No narration or soundtrack.\n\nResearch:\n${brief.sources.map(s=>`${s.title}: ${s.url}`).join('\n')}\n`);
  console.log(`Prepared silent visual story: ${shortDuration(input)/input.fps}s; ${subtitles.length} brief notes. No speech service required.`);
  if(prepareOnly)return;
  await renderPrepared({input,root,outputDir,id:brief.id});
  // Remove obsolete audio left by a previous narrated version of this episode.
  [path.join(assetDir,'soundtrack.wav'),...['narration.wav','mix.wav'].map(file=>path.join(outputDir,file))].forEach(file=>rmSync(file,{force:true}));
}
