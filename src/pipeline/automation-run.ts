import {createHash} from 'node:crypto';
import {existsSync,readFileSync,mkdirSync,cpSync,rmSync,readdirSync,lstatSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {generateComparisonData} from './comparison-run';
import {briefSchema,shortSchema,shortDuration} from '../shorts/schema';
import {redact,type GroqClient,loadGroqConfig} from './groq';
import {writeJson} from './stages';
import {actualDuplicate,saveLedger,type AutomationJob,type AutomationConfig,type TopicLedger} from './topic-automation';
import {sizeDatasetSchema} from '../shorts/size-data';
import {quotaDeferral,repairLegacyMillisecondBackoff} from './quota-retry';
import {ensureComparisonImages} from './comparison-images';

export const digest=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
function treeFiles(dir:string):string[]{if(!existsSync(dir))return [];const stat=lstatSync(dir);if(stat.isSymbolicLink())throw new Error('Generated archives cannot contain symlinks.');return stat.isDirectory()?readdirSync(dir).sort().flatMap(name=>treeFiles(path.join(dir,name))):[dir];}
export function sourceFingerprint(root:string){
  const h=createHash('sha256');
  for(const file of [...treeFiles(path.join(root,'src')),...treeFiles(path.join(root,'scripts')),...treeFiles(path.join(root,'public/assets')),path.join(root,'package-lock.json'),path.join(root,'requirements-linux.txt'),path.join(root,'comparisons/cloudflare-linux.provider.json')])if(existsSync(file))h.update(path.relative(root,file)).update(readFileSync(file));
  return h.digest('hex');
}
export function runPaths(root:string,id:string){
  if(!/^short-[a-z0-9-]+$/.test(id)||id.length>80)throw new Error('Invalid automation job ID.');
  for(const base of ['out','out/comparisons','out/shorts','public','public/comparisons','public/shorts'])if(existsSync(path.join(root,base))&&lstatSync(path.join(root,base)).isSymbolicLink())throw new Error('Generated directory ancestors must not be symlinks.');
  return ['out/comparisons','out/shorts','public/comparisons','public/shorts'].map(base=>path.join(root,base,id));
}
export function verifyVideo(root:string,id:string){
  const file=path.join(root,'out/shorts',id,`${id}.mp4`),props=path.join(root,'public/shorts',id,'video.json');
  const input=shortSchema.parse(JSON.parse(readFileSync(props,'utf8')));
  const brief=briefSchema.parse(JSON.parse(readFileSync(path.join(root,'out/comparisons',id,'brief.json'),'utf8')));
  if(brief.id!==id||input.topic!==brief.topic||input.presentation!=='silent')throw new Error('Unexpected rendered job or audio mode.');
  const result=spawnSync('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames:format=duration','-of','json',file],{encoding:'utf8',timeout:30000});
  if(result.error||result.status!==0)throw new Error('Final video is missing or FFprobe verification failed.');
  const info=JSON.parse(result.stdout),videos=info.streams.filter((s:{codec_type:string})=>s.codec_type==='video'),video=videos[0];
  if(videos.length!==1||video.codec_name!=='h264'||video.width!==1080||video.height!==1920||video.r_frame_rate!==`${input.fps}/1`||Number(video.nb_frames)!==shortDuration(input)||Math.abs(Number(info.format.duration)-shortDuration(input)/input.fps)>.1||info.streams.some((s:{codec_type:string})=>s.codec_type==='audio'))throw new Error('Final video did not pass Shorts media checks.');
  return {file,props,sha256:digest(file),info};
}
export function copySafe(source:string,target:string){
  if(!existsSync(source))return;treeFiles(source);mkdirSync(path.dirname(target),{recursive:true});cpSync(source,target,{recursive:true,dereference:false});
}
export function stageCheckpoint(root:string,id:string){
  const dest=path.join(root,'out/automation/checkpoint');rmSync(dest,{recursive:true,force:true});mkdirSync(dest,{recursive:true});
  for(const source of runPaths(root,id))copySafe(source,path.join(dest,path.relative(root,source)));
  writeJson(path.join(dest,'checkpoint.json'),{version:1,jobId:id});return dest;
}
export function restoreCheckpoint(root:string,id:string,from:string){
  treeFiles(from);
  const manifest=JSON.parse(readFileSync(path.join(from,'checkpoint.json'),'utf8'));
  if(manifest.version!==1||manifest.jobId!==id)throw new Error('Checkpoint belongs to another job.');
  // Ignore all archive paths except the four generated directories for this ID.
  for(const target of runPaths(root,id))copySafe(path.join(from,path.relative(root,target)),target);
}
export function cleanupJob(root:string,id:string,ledger:TopicLedger){
  if(ledger.jobs.find(j=>j.id===id)?.status!=='complete')throw new Error('Archive confirmation is required before cleanup.');
  for(const folder of runPaths(root,id))rmSync(folder,{recursive:true,force:true});
  // Final delivery and the durable ledger remain available.
}
export function confirmArchive(job:AutomationJob,artifactId:string){
  if(job.status!=='rendered'||!job.videoSha256)throw new Error('Only a verified rendered job can be confirmed as archived.');
  if(!/^[1-9][0-9]*$/.test(artifactId))throw new Error('A successful Actions artifact ID is required.');
  job.status='complete';job.artifactId=artifactId;job.updatedAt=new Date().toISOString();
}
async function build(root:string,job:AutomationJob,config:AutomationConfig){
  const dir=path.join(root,'out/comparisons',job.id),env={...process.env};delete env.GITHUB_TOKEN;delete env.GH_TOKEN;
  const result=spawnSync(process.execPath,['--import','tsx','scripts/compare.ts','--data',path.join(dir,'dataset.raw.json'),'--id',job.id,'--asset-root',path.join(dir,'assets'),'--asset-provider',path.resolve(root,config.assetProvider)],{cwd:root,env,encoding:'utf8',timeout:35*60000,maxBuffer:8*1024*1024});
  const log=String(result.stdout??'')+String(result.stderr??'');
  const secrets=[process.env.GROQCLOUD_API_KEY,process.env.CLOUDFLARE_API_TOKEN,process.env.CLOUDFARE_API_TOKEN,process.env.GITHUB_TOKEN].filter(Boolean) as string[];
  const safe=redact(log,secrets);await import('node:fs').then(fs=>fs.writeFileSync(path.join(dir,'automation-build.log'),safe));
  if(result.error||result.status!==0)throw new Error(result.error?.message??safe.slice(-3000));
  const lines=String(result.stdout).trim().split('\n');let completed=false;
  for(const line of lines.reverse()){try{if(JSON.parse(line).status==='complete'){completed=true;break;}}catch{/* Progress logs are not stage results. */}}
  if(!completed)throw new Error('Comparison command stopped without a complete MP4 (assets may be missing).');
}
export type AutomationRunOptions={root:string;stateFile:string;ledger:TopicLedger;job:AutomationJob;config:AutomationConfig;client:Pick<GroqClient,'chat'>;groqConfig:ReturnType<typeof loadGroqConfig>;archiveTarget:'local'|'github';log:(s:string)=>void};
export async function createAutomationVideo(options:AutomationRunOptions,dependencies:{generateData?:typeof generateComparisonData;planImages?:typeof ensureComparisonImages;build?:typeof build;verify?:typeof verifyVideo;fingerprint?:(root:string)=>string}={}){
  const {root,job,ledger,config,stateFile}=options;
  if(job.status==='complete')return {status:'complete',id:job.id,artifactId:job.artifactId};
  if(repairLegacyMillisecondBackoff(job,config.retryAfterMinutes)){saveLedger(stateFile,ledger);options.log(`Corrected a legacy millisecond retry date for ${job.id}: ${job.retryAt}`);}
  if(job.status==='retry-later'&&job.retryAt&&Date.parse(job.retryAt)>Date.now())return {status:'retry-later',id:job.id,retryAt:job.retryAt,deferredBy:'saved-backoff',reason:'Saved backoff is still active; no generation or API calls were made.'};
  if(job.attempts>=config.maxAttemptsPerJob&&job.status!=='rendered')throw new Error('Job attempt limit reached; review the saved failure instead of spending more API quota.');
  const archiveOnly=job.status==='rendered';
  const dir=path.join(root,'out/comparisons',job.id);mkdirSync(dir,{recursive:true});
  job.status='rendering';if(!archiveOnly)job.attempts++;job.updatedAt=new Date().toISOString();delete job.error;delete job.retryAt;saveLedger(stateFile,ledger);
  try{
    const rawFile=path.join(dir,'dataset.raw.json');
    if(archiveOnly&&!existsSync(rawFile))throw new Error('Rendered job needs its checkpoint restored before archival; no new API calls were made.');
    let data=archiveOnly?sizeDatasetSchema.parse(JSON.parse(readFileSync(rawFile,'utf8'))):await (dependencies.generateData??generateComparisonData)({topic:job.topic,id:job.id,directory:dir,root,log:options.log,topicBrief:{family:job.family,angle:job.angle,depth:job.depth,whyInteresting:job.whyInteresting,proposedObjects:job.entityKeys}},{client:options.client,config:options.groqConfig});
    if(!config.allowedMetrics.includes(data.metric as AutomationConfig['allowedMetrics'][number]))throw new Error('This metric needs an asset provider not enabled for unattended runs.');
    if(job.metric&&job.metric!==data.metric)throw new Error('The researched metric changed from the reserved topic; review the comparison scope.');
    const duplicate=actualDuplicate(job,data,ledger);
    if(duplicate){job.status='skipped-duplicate';job.error=duplicate;saveLedger(stateFile,ledger);return {status:job.status,id:job.id,reason:duplicate};}
    if(!archiveOnly)data=await (dependencies.planImages??ensureComparisonImages)(data,{directory:dir,client:options.client,model:options.groqConfig.motionModel,log:options.log});
    job.metric=data.metric;job.actualEntityKeys=data.items.map(i=>i.label);saveLedger(stateFile,ledger);
    if(!archiveOnly)writeJson(rawFile,data);
    const fingerprint=(dependencies.fingerprint??sourceFingerprint)(root),receiptFile=path.join(dir,'automation-render.json');
    let cached=false;
    if(existsSync(receiptFile)){
      const r=JSON.parse(readFileSync(receiptFile,'utf8'));
      cached=r.rawSha===digest(rawFile)&&r.sourceSha===fingerprint&&Array.isArray(r.files)&&r.files.every((f:{path:string;sha:string})=>!f.path.split('/').includes('..')&&['public/comparisons/','public/shorts/','out/comparisons/'].some(prefix=>f.path.startsWith(prefix+job.id+'/'))&&existsSync(path.join(root,f.path))&&digest(path.join(root,f.path))===f.sha);
      if(cached){try{cached=(dependencies.verify??verifyVideo)(root,job.id).sha256===r.videoSha;}catch{cached=false;}}
    }
    if(archiveOnly&&!cached)throw new Error('Rendered checkpoint no longer matches the source/assets; review before regenerating.');
    if(!cached)await (dependencies.build??build)(root,job,config);
    const verified=(dependencies.verify??verifyVideo)(root,job.id);
    const files=[...treeFiles(path.join(root,'public/comparisons',job.id)),verified.props,path.join(dir,'dataset.json'),path.join(dir,'brief.json')].filter(f=>existsSync(f)).map(file=>({path:path.relative(root,file),sha:digest(file)}));
    writeJson(receiptFile,{rawSha:digest(rawFile),sourceSha:fingerprint,videoSha:verified.sha256,files});
    const delivery=path.join(root,'out/automation/delivery',job.id);mkdirSync(delivery,{recursive:true});
    copySafe(path.join(root,'out/shorts',job.id),delivery);copySafe(verified.props,path.join(delivery,'video.json'));
    for(const name of ['dataset.json','research.json','research-plan.json','research-web.json','research-measurements.json','research-receipt.json','idea-plan.json','editorial-plan.json','background-plan.json','measurements.json','asset-manifest.json'])copySafe(path.join(dir,name),path.join(delivery,name));
    writeJson(path.join(delivery,'delivery.json'),{id:job.id,topic:job.topic,videoSha256:verified.sha256,sourceSha:fingerprint});
    job.videoSha256=verified.sha256;job.artifactName=`short-${job.id}`;job.status=options.archiveTarget==='github'?'rendered':'complete';job.updatedAt=new Date().toISOString();saveLedger(stateFile,ledger);
    return {status:job.status,id:job.id,videoPath:path.join(delivery,`${job.id}.mp4`),deliveryPath:delivery};
  }catch(error){
    const secrets=[process.env.GROQCLOUD_API_KEY,process.env.CLOUDFLARE_API_TOKEN,process.env.CLOUDFARE_API_TOKEN,process.env.GITHUB_TOKEN].filter(Boolean) as string[];
    const message=redact(error instanceof Error?error.message:String(error),secrets).slice(-1500);
    const quotaRetryAt=quotaDeferral(message,Date.now(),config.retryAfterMinutes);
    if(quotaRetryAt){
      if(!archiveOnly)job.attempts--;
      job.status='retry-later';job.error=message;job.updatedAt=new Date().toISOString();job.retryAt=quotaRetryAt;saveLedger(stateFile,ledger);
      return {status:'retry-later',id:job.id,retryAt:job.retryAt,reason:message};
    }
    const retry=/429|rate.limit|quota|budget|timeout|timed out|network|HTTP 5\d\d/i.test(message)&&job.attempts<config.maxAttemptsPerJob;
    job.status=retry?'retry-later':'needs-review';job.error=message;job.updatedAt=new Date().toISOString();if(retry)job.retryAt=new Date(Date.now()+config.retryAfterMinutes*60000).toISOString();saveLedger(stateFile,ledger);throw new Error(message);
  }
}
