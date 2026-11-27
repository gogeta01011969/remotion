import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,cpSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import catalog from '../public/assets/audio/catalog.json';
import {buildComparisonAudio,comparisonAudioCues,effectSamples,selectedMusic,musicCredit} from '../src/pipeline/comparison-audio';
import {comparisonAudioSettings} from '../src/pipeline/comparison-audio-settings';
import {compileSizeComparison,defaultSizeEpisode} from '../src/pipeline/size-comparison';
import {prepareSilentInput} from '../src/shorts/silent';
import {shortSchema,shortDuration,briefSchema} from '../src/shorts/schema';
import {compileStory} from '../src/shorts/motion';
import {verifyVideo} from '../src/pipeline/automation-run';
import {finalizePreparedVideo} from '../src/pipeline/render-prepared';
import {normalizeComparisonGeneration} from '../src/pipeline/comparison-ideas';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import diameter from '../comparisons/examples/diameter.json';

// Exercise every catalog entry without coupling tests to its hash bucket/order.
function musicRunIds(){
 const ids=new Map<string,string>();
 for(let i=0;i<1000&&ids.size<catalog.length;i++){const id=`audio-library-${i}`;ids.set(selectedMusic(id).id,id);}
 assert.equal(ids.size,catalog.length,'Every bundled track must be selectable');
 return [...ids.values()];
}

function fixture(metric:'height'|'speed'|'temperature'='height',n=8,fps=30){
 const data={template:'size-comparison',id:'audio-fixture',title:'Synthetic comparison audio fixture',metric,unit:metric==='speed'?'km/h':metric==='temperature'?'C':'m',basis:'Synthetic measurements for audio testing only.',context:'Synthetic fixture',sources:[{id:'s1',title:'Synthetic reference',url:'https://example.com/test'}],items:Array.from({length:n},(_,i)=>({id:`item-${i}`,label:`Reference ${i}`,value:metric==='temperature'?i*10-20:i+1,color:'#AABBCC',sourceIds:['s1'],visual:{kind:'box',widthToHeight:1,depthToHeight:1}}))};
 const brief=compileSizeComparison(data,defaultSizeEpisode(data));return {brief,input:prepareSilentInput(brief,fps)};
}
test('music is enabled by default and existing mapped-sphere inputs remain supported',()=>{
 assert.equal(comparisonAudioSettings.enabled,true);
 assert.ok(sizeDatasetSchema.safeParse(normalizeComparisonGeneration(diameter)).success);
 const {input}=fixture();assert.equal(input.audio,undefined);
 assert.equal(shortSchema.safeParse({...input,audio:'shorts/test/background.wav'}).success,false);
 assert.equal(shortSchema.safeParse({...input,audioPurpose:'background'}).success,false);
 assert.equal(shortSchema.safeParse({...input,audio:'shorts/test/background.wav',audioPurpose:'background'}).success,true);
 assert.deepEqual(compileStory(input),compileStory(shortSchema.parse({...input,audio:'shorts/test/background.wav',audioPurpose:'background'})));
});
test('frame-based cues are deterministic, sparse and contained for all supported comparison timings',()=>{
 for(const metric of ['height','speed','temperature'] as const)for(const n of [2,8,15])for(const fps of [24,30,60]){
  const {input}=fixture(metric,n,fps),before=structuredClone(input),cues=comparisonAudioCues(input);
  assert.deepEqual(cues,comparisonAudioCues(input));assert.deepEqual(input,before);assert.ok(cues.length<=3);assert.equal(cues.filter(c=>c.kind==='tap').length,1);
  cues.forEach((cue,i)=>{assert.ok(cue.frame>=0&&cue.frame+cue.durationFrames<=shortDuration(input));if(i)assert.ok(cue.frame-cues[i-1].frame>=3*fps);});
 }
});
test('procedural effects are repeatable, quiet and have smooth endpoints',()=>{
 for(const kind of ['whoosh','tap'] as const){
  const a=effectSamples(kind,.2);assert.deepEqual(a,effectSamples(kind,.2));assert.ok(Math.max(...a.map(Math.abs))<=.100001);assert.equal(Math.abs(a[0]),0);assert.ok(Math.abs(a.at(-1)!)<1e-8);
 }
 assert.ok(catalog.length>=10&&catalog.length<=15);
 assert.equal(new Set(catalog.map(t=>t.id)).size,catalog.length);
 assert.equal(new Set(catalog.map(t=>t.sha256)).size,catalog.length,'Tracks must be distinct recordings');
 for(const id of musicRunIds())assert.deepEqual(selectedMusic(id),selectedMusic(id));
});
test('real mixes have the exact duration, safe levels and matching provenance; missing/changed assets fall back to muted',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'comparison-soundtrack-'));
 try{
  mkdirSync(path.join(root,'public/assets'),{recursive:true});cpSync('public/assets/audio',path.join(root,'public/assets/audio'),{recursive:true});
  const {input}=fixture('height',8),before=structuredClone(input);
  for(const [index,id] of musicRunIds().entries()){
   const outputDir=path.join(root,'out/shorts',id),plan=buildComparisonAudio(input,{root,id,outputDir,profile:'calm-curiosity',log:()=>{}});
   assert.equal(plan.status,'mixed',JSON.stringify(plan));assert.ok(plan.truePeakDb!<=-3);assert.ok(plan.integratedLufs!<=-21&&plan.integratedLufs!>=-30);assert.ok(plan.cues.length>=1&&plan.cues.length<=3);assert.deepEqual(input,before);assert.ok(musicCredit(root,id));
   const mix=path.join(root,'public/shorts',id,'background-mix.wav');
   const probe=spawnSync('ffprobe',['-v','error','-show_entries','stream=sample_rate,channels:format=duration','-of','json',mix],{encoding:'utf8'});assert.equal(probe.status,0);
   const info=JSON.parse(probe.stdout);assert.equal(info.streams[0].sample_rate,'48000');assert.equal(info.streams[0].channels,2);assert.ok(Math.abs(Number(info.format.duration)-shortDuration(input)/input.fps)<.001);
   const initialHash=plan.mixSha256;
   if(index===0)assert.equal(buildComparisonAudio(input,{root,id,outputDir,profile:'calm-curiosity',log:()=>{}}).mixSha256,initialHash);
   const track=catalog.find(t=>t.id===plan.trackId)!;writeFileSync(path.join(root,'public',track.file),'changed asset');
   const fallback=buildComparisonAudio(input,{root,id,outputDir,profile:'calm-curiosity',log:()=>{}});assert.equal(fallback.status,'fallback-muted');assert.equal(existsSync(mix),false);assert.equal(musicCredit(root,id),undefined);
   cpSync(path.join('public',track.file),path.join(root,'public',track.file));
  }
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('automation validates a declared AAC mix and rejects undeclared or missing audio',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'background-aac-validation-')),id='short-audio-check';
 try{
  const {input,brief}=fixture('height',2);
  for(const directory of [`public/shorts/${id}`,`out/shorts/${id}`,`out/comparisons/${id}`])mkdirSync(path.join(root,directory),{recursive:true});
  const props=path.join(root,`public/shorts/${id}/video.json`),video=path.join(root,`out/shorts/${id}/${id}.mp4`),total=shortDuration(input)/input.fps;
  writeFileSync(path.join(root,`out/comparisons/${id}/brief.json`),JSON.stringify(briefSchema.parse({...brief,id})));
  const made=spawnSync('ffmpeg',['-v','error','-y','-f','lavfi','-i',`color=c=black:s=1080x1920:r=30:d=${total}`,'-f','lavfi','-i',`sine=frequency=440:sample_rate=48000:duration=${total}`,'-af','volume=0.01','-c:v','libx264','-preset','ultrafast','-crf','35','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-t',String(total),video],{encoding:'utf8',timeout:30000});assert.equal(made.status,0,made.stderr);
  const extracted=spawnSync('ffmpeg',['-v','error','-y','-i',video,'-vn','-ar','48000','-ac','2',path.join(root,`public/shorts/${id}/background-mix.wav`)]);assert.equal(extracted.status,0);
  writeFileSync(props,JSON.stringify({...input,audio:`shorts/${id}/background-mix.wav`,audioPurpose:'background'}));assert.ok(verifyVideo(root,id));
  writeFileSync(props,JSON.stringify(input));assert.throws(()=>verifyVideo(root,id),/media checks/);
  const muted=path.join(root,'muted.mp4');const stripped=spawnSync('ffmpeg',['-v','error','-y','-i',video,'-c:v','copy','-an',muted]);assert.equal(stripped.status,0);cpSync(muted,video);
  writeFileSync(props,JSON.stringify({...input,audio:`shorts/${id}/background-mix.wav`,audioPurpose:'background'}));assert.throws(()=>verifyVideo(root,id),/media checks/);
  const withAudio=finalizePreparedVideo({input:{...input,audio:`shorts/${id}/background-mix.wav`,audioPurpose:'background'},root,id,outputDir:path.join(root,`out/shorts/${id}`),picture:muted});
  assert.equal(withAudio.audioPurpose,'background');assert.ok(verifyVideo(root,id));
  // Exercise the real export fallback for both a missing and an unreadable optional soundtrack.
  for(const corrupt of [false,true]){
   const mix=path.join(root,`public/shorts/${id}/background-mix.wav`);
   rmSync(mix,{force:true});if(corrupt)writeFileSync(mix,'invalid audio');
   writeFileSync(path.join(root,`out/shorts/${id}/audio-plan.json`),JSON.stringify({status:'mixed',credit:'stale credit',trackId:'overworld',mixSha256:'old'}));
   const effective=finalizePreparedVideo({input:{...input,audio:`shorts/${id}/background-mix.wav`,audioPurpose:'background'},root,id,outputDir:path.join(root,`out/shorts/${id}`),picture:muted});
   assert.equal(effective.audio,undefined);assert.equal(effective.audioPurpose,undefined);assert.ok(verifyVideo(root,id));assert.equal(musicCredit(root,id),undefined);assert.equal(existsSync(mix),false);
   const report=JSON.parse(readFileSync(path.join(root,`out/shorts/${id}/audio-plan.json`),'utf8'));assert.equal(report.status,'fallback-muted');assert.equal(report.credit,undefined);
  }
  // A missing required narration asset still fails rather than silently losing the story.
  assert.throws(()=>finalizePreparedVideo({input:{...input,audio:'missing-narration.wav'},root,id,outputDir:path.join(root,`out/shorts/${id}`),picture:muted}),/ffmpeg failed/);
  assert.throws(()=>finalizePreparedVideo({input,root,id,outputDir:path.join(root,`out/shorts/${id}`),picture:path.join(root,'missing-picture.mp4')}),/ffmpeg failed/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
