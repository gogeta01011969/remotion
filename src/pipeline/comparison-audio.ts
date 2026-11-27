import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import catalog from '../../public/assets/audio/catalog.json';
import {shortDuration,type ShortInput} from '../shorts/schema';
import {compileStory,resolveAnchor} from '../shorts/motion';
import {comparisonAudioSettings as settings,type SoundtrackProfile} from './comparison-audio-settings';

const rate=48000;
export type AudioCue={kind:'whoosh'|'tap';frame:number;durationFrames:number};
export type AudioPlan={version:1;status:'disabled'|'mixed'|'fallback-muted';profile:SoundtrackProfile;trackId?:string;credit?:string;durationFrames:number;fps:number;cues:AudioCue[];musicLufs?:number;effectPeakDb?:number;truePeakDb?:number;integratedLufs?:number;mixSha256?:string;warning?:string};
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export function selectedMusic(id:string){return catalog[createHash('sha256').update(id).digest().readUInt32LE(0)%catalog.length];}
export function comparisonAudioCues(input:ShortInput):AudioCue[]{
  const actor=input.actors.find(a=>a.kind==='size-comparison');if(!actor)return [];
  const story=compileStory(input),duration=shortDuration(input),arrivals:{index:number;frame:number;travel:number}[]=[];
  input.scenes.forEach((scene,index)=>{
    if(!index)return;
    const growth=actor.quantityTiming?.[index]?.growthSeconds;
    const arrival=growth===undefined?scene.motion.find(m=>m.actor===actor.id&&m.property==='phase')?.keyframes.find(k=>k.value===index):undefined;
    const travel=growth===undefined?(arrival?resolveAnchor(arrival.at,scene):0):Math.round(growth*input.fps);
    if(travel>0)arrivals.push({index,frame:story.starts[index]+travel,travel});
  });
  const lastScene=input.scenes.at(-1)!,phase=lastScene.motion.find(m=>m.actor===actor.id&&m.property==='phase');
  const overview=phase?.keyframes.find(k=>k.value===input.scenes.length);
  const overviewFrame=overview?story.starts.at(-1)!+resolveAnchor(overview.at,lastScene):duration-3*input.fps;
  const whooshFrames=Math.round(.18*input.fps),tapFrames=Math.round(.24*input.fps);
  const cues:AudioCue[]=[];
  const choices=[arrivals[0],...arrivals.slice(1).sort((a,b)=>b.travel-a.travel||a.frame-b.frame).slice(0,1)].filter(Boolean);
  for(const a of choices.sort((a,b)=>a.frame-b.frame)){
    const frame=Math.max(0,a.frame-whooshFrames);
    if(overviewFrame-frame>=settings.minimumCueGapSeconds*input.fps&&cues.every(c=>Math.abs(frame-c.frame)>=settings.minimumCueGapSeconds*input.fps))cues.push({kind:'whoosh',frame,durationFrames:whooshFrames});
  }
  if(overviewFrame>=0&&overviewFrame+tapFrames<=duration)cues.push({kind:'tap',frame:overviewFrame,durationFrames:tapFrames});
  return cues;
}
function ffmpeg(args:string[],maxBuffer=64*1024*1024){
  const result=spawnSync('ffmpeg',['-hide_banner','-nostdin','-y',...args],{maxBuffer,timeout:120000});
  if(result.error||result.status!==0)throw new Error('Background audio processing failed.');
  return result;
}
function wav(samples:Float32Array){
  const data=Buffer.alloc(samples.length*2),head=Buffer.alloc(44);
  for(let i=0;i<samples.length;i++)data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),i*2);
  head.write('RIFF');head.writeUInt32LE(36+data.length,4);head.write('WAVEfmt ',8);head.writeUInt32LE(16,16);head.writeUInt16LE(1,20);head.writeUInt16LE(2,22);head.writeUInt32LE(rate,24);head.writeUInt32LE(rate*4,28);head.writeUInt16LE(4,32);head.writeUInt16LE(16,34);head.write('data',36);head.writeUInt32LE(data.length,40);
  return Buffer.concat([head,data]);
}
// Fixed-seed, band-limited effects: no downloaded packs or voice samples.
export function effectSamples(kind:AudioCue['kind'],seconds:number){
  const n=Math.round(seconds*rate),samples=new Float32Array(n);let seed=42,previous=0,maximum=0;
  for(let i=0;i<n;i++){
    const t=i/rate,p=i/Math.max(1,n-1),envelope=Math.sin(Math.PI*p)**2;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    previous=.8*previous+.2*(seed/4294967296*2-1);
    const value=kind==='whoosh'?previous*envelope:(Math.sin(2*Math.PI*440*t)+.3*Math.sin(2*Math.PI*660*t))*envelope*Math.exp(-10*p);
    samples[i]=value;maximum=Math.max(maximum,Math.abs(value));
  }
  const gain=10**(settings.effectPeakDb/20)/Math.max(maximum,1e-12);
  for(let i=0;i<n;i++)samples[i]*=gain;
  return samples;
}
export function audioLevels(filename:string){
  const result=ffmpeg(['-i',filename,'-af','loudnorm=I=-24:TP=-3:LRA=7:print_format=json','-f','null','-']);
  const match=result.stderr.toString().match(/\{\s*"input_i"[\s\S]*?\}/);
  if(!match)throw new Error('Could not measure background audio levels.');
  const levels=JSON.parse(match[0]),integratedLufs=Number(levels.input_i),truePeakDb=Number(levels.input_tp);
  if(!Number.isFinite(integratedLufs)||!Number.isFinite(truePeakDb))throw new Error('Background audio is empty or nonfinite.');
  return {integratedLufs,truePeakDb};
}
export function buildComparisonAudio(input:ShortInput,options:{root:string;id:string;outputDir:string;profile:SoundtrackProfile;log:(line:string)=>void}){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.id)||options.id.length>60)throw new Error('Invalid comparison audio ID.');
  const durationFrames=shortDuration(input),seconds=durationFrames/input.fps;
  const plan:AudioPlan={version:1,status:'disabled',profile:options.profile,durationFrames,fps:input.fps,cues:[]};
  const assetDir=path.join(options.root,'public/shorts',options.id),target=path.join(assetDir,'background-mix.wav'),raw=path.join(assetDir,'background-raw.wav');
  mkdirSync(options.outputDir,{recursive:true});mkdirSync(assetDir,{recursive:true});
  const finish=()=>{writeFileSync(path.join(options.outputDir,'audio-plan.json'),JSON.stringify(plan,null,2)+'\n');return plan;};
  if(options.profile==='off'){rmSync(target,{force:true});return finish();}
  try{
    if(!input.actors.some(a=>a.kind==='size-comparison')||seconds>90||seconds<1)throw new Error('Unsupported comparison soundtrack.');
    const track=selectedMusic(options.id),source=path.join(options.root,'public',track.file);
    if(!existsSync(source)||digest(readFileSync(source))!==track.sha256)throw new Error('Music asset is missing or changed.');
    // Normalize the bed before adding effects; never boost the final mix to a speech/music mastering level.
    const decoded=ffmpeg(['-v','error','-i',source,'-t',String(Math.min(95,Math.ceil(seconds)+2)),'-af',`loudnorm=I=${settings.musicLufs}:TP=-6:LRA=7`,'-ar',String(rate),'-ac','2','-f','f32le','pipe:1']).stdout;
    const musicFrames=decoded.length/8;
    if(!Number.isInteger(musicFrames)||musicFrames<rate)throw new Error('Music asset is too short.');
    const count=Math.round(seconds*rate),samples=new Float32Array(count*2),crossfade=Math.min(Math.round(settings.loopCrossfadeSeconds*rate),Math.floor(musicFrames/4)),period=musicFrames-crossfade;
    for(let i=0;i<count;i++){
      const index=i%period,blend=i>=period&&index<crossfade?index/crossfade:1;
      const fade=Math.min(1,i/(rate*settings.fadeInSeconds),(count-1-i)/(rate*settings.fadeOutSeconds));
      for(let channel=0;channel<2;channel++){
        const start=decoded.readFloatLE((index*2+channel)*4);
        const value=blend===1?start:decoded.readFloatLE(((period+index)*2+channel)*4)*(1-blend)+start*blend;
        samples[i*2+channel]=value*Math.max(0,fade);
      }
    }
    const cues=comparisonAudioCues(input);
    for(const cue of cues){
      const sound=effectSamples(cue.kind,cue.durationFrames/input.fps),start=Math.round(cue.frame/input.fps*rate);
      for(let i=0;i<sound.length&&start+i<count;i++)for(let channel=0;channel<2;channel++)samples[(start+i)*2+channel]+=sound[i];
    }
    writeFileSync(raw,wav(samples));
    ffmpeg(['-v','error','-i',raw,'-af','aresample=192000,alimiter=limit=0.668344:level=false:latency=1,aresample=48000','-t',String(seconds),'-ac','2','-c:a','pcm_s16le',target]);
    const levels=audioLevels(target);
    if(levels.truePeakDb>settings.truePeakCeilingDb||levels.integratedLufs>-21||levels.integratedLufs<-38)throw new Error('Background audio levels need review.');
    Object.assign(plan,{status:'mixed',trackId:track.id,credit:`Music: ${track.title} by ${track.creator} (CC0). ${track.source}`,cues,musicLufs:settings.musicLufs,effectPeakDb:settings.effectPeakDb,...levels,mixSha256:digest(readFileSync(target))});
  }catch{
    rmSync(target,{force:true});plan.status='fallback-muted';plan.warning='Optional soundtrack unavailable; exported without audio.';options.log(plan.warning);
  }finally{rmSync(raw,{force:true});}
  return finish();
}
export function musicCredit(root:string,id:string){
  try{const plan=JSON.parse(readFileSync(path.join(root,'out/shorts',id,'audio-plan.json'),'utf8')) as AudioPlan;const track=catalog.find(t=>t.id===plan.trackId);const mix=path.join(root,'public/shorts',id,'background-mix.wav');return plan.status==='mixed'&&track&&digest(readFileSync(mix))===plan.mixSha256?`Music: ${track.title} by ${track.creator} (CC0). ${track.source}`:undefined;}catch{return;}
}
