import {musicCredit} from './comparison-audio';
import {cachedYouTubeCopy} from './youtube-metadata';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {saveLedger,type AutomationJob,type TopicLedger} from './topic-automation';
import {verifyVideo} from './automation-run';
import {sizeDatasetSchema} from '../shorts/size-data';
import {writeJson} from './stages';
import {makeYouTubeMetadata,youtubeMetadataSchema,type YouTubeConfig,type YouTubeClient} from './youtube';

const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
type Context={root:string;ledger:TopicLedger;stateFile:string;job:AutomationJob;config:YouTubeConfig;client:Pick<YouTubeClient,'checkChannel'|'upload'>;verify?:typeof verifyVideo};
const manifestFile=(root:string,id:string)=>{
  if(!/^short-[a-z0-9-]+$/.test(id)||id.length>80)throw new Error('Invalid upload job ID.');
  return path.join(root,'.automation',`youtube-upload-${id}.json`);
};
export function youtubeJobMetadata(root:string,job:AutomationJob,config:YouTubeConfig){
  // Validate the ID before using any per-job path.
  manifestFile(root,job.id);
  const data=sizeDatasetSchema.parse(JSON.parse(readFileSync(path.join(root,'out/comparisons',job.id,'dataset.json'),'utf8')));
  return makeYouTubeMetadata(data,config,cachedYouTubeCopy(data,path.join(root,'out/comparisons',job.id)),musicCredit(root,job.id));
}
export async function prepareYouTubeJob(context:Context){
  const {root,ledger,stateFile,job,config,client}=context;
  if(job.youtube?.status==='uploaded')return {status:'already-uploaded',url:job.youtube.url};
  if(job.youtube)throw new Error('This job has an earlier upload intent. Inspect YouTube Studio before any manual retry; automatic duplicate uploads are blocked.');
  if(!['rendered','complete'].includes(job.status))throw new Error('YouTube upload requires a verified rendered/archived job.');
  const verified=(context.verify??verifyVideo)(root,job.id),metadata=youtubeJobMetadata(root,job,config);
  if(job.videoSha256!==verified.sha256)throw new Error('Video no longer matches the verified delivery hash. No upload started.');
  await client.checkChannel();
  const intentId=randomUUID(),metadataSha256=hash(JSON.stringify(metadata));
  writeJson(manifestFile(root,job.id),{intentId,videoSha256:verified.sha256,metadataSha256,metadata});
  job.youtube={status:'uploading',intentId,videoSha256:verified.sha256,metadataSha256,channelId:config.channelId,privacy:config.privacy,requestedAt:new Date().toISOString()};
  saveLedger(stateFile,ledger);
  return {status:'prepared',privacy:config.privacy};
}
export async function sendYouTubeJob(context:Context){
  const {root,ledger,stateFile,job,config,client}=context;
  if(job.youtube?.status==='uploaded')return {status:'already-uploaded',url:job.youtube.url};
  if(job.youtube?.status!=='uploading')throw new Error('Prepare and persist an upload intent before sending a video.');
  try{
    const manifest=JSON.parse(readFileSync(manifestFile(root,job.id),'utf8')) as {intentId:string;videoSha256:string;metadataSha256:string;metadata:unknown};
    const metadata=youtubeMetadataSchema.parse(manifest.metadata),metadataSha256=hash(JSON.stringify(metadata));
    const verified=(context.verify??verifyVideo)(root,job.id);
    if(manifest.intentId!==job.youtube.intentId||verified.sha256!==job.youtube.videoSha256||verified.sha256!==manifest.videoSha256||metadataSha256!==job.youtube.metadataSha256||metadataSha256!==manifest.metadataSha256||config.channelId!==job.youtube.channelId||metadata.status.privacyStatus!==job.youtube.privacy||config.privacy!==job.youtube.privacy)throw new Error('Video, metadata, privacy or channel changed after upload intent was saved. No new upload started.');
    const result=await client.upload(verified.file,metadata);
    job.youtube={...job.youtube,status:'uploaded',videoId:result.videoId,url:result.url,privacy:result.privacy,uploadedAt:new Date().toISOString()};
    saveLedger(stateFile,ledger);
    writeJson(path.join(root,'out/comparisons',job.id,'youtube-upload.json'),{...result,videoSha256:verified.sha256,uploadedAt:job.youtube.uploadedAt});
    return {status:'uploaded',...result};
  }catch(error){
    job.youtube={...job.youtube,status:'needs-review',error:'Upload was not confirmed. Inspect YouTube Studio before restarting this job.'};
    saveLedger(stateFile,ledger);throw error;
  }
}
