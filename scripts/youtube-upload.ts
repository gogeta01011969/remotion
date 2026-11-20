import {appendFileSync,readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {YouTubeClient,loadYouTubeConfig} from '../src/pipeline/youtube';
import {ledgerSchema,lockAutomation} from '../src/pipeline/topic-automation';
import {prepareYouTubeJob,sendYouTubeJob,youtubeJobMetadata} from '../src/pipeline/youtube-job';
import {verifyVideo} from '../src/pipeline/automation-run';

async function main(){
  const {values}=parseArgs({options:{job:{type:'string'},check:{type:'boolean'},prepare:{type:'boolean'},send:{type:'boolean'},'dry-run':{type:'boolean'},help:{type:'boolean'}}});
  if(values.help){console.log('npm run youtube:check\nnpm run youtube:upload -- --job short-... --dry-run\nCI upload: --job short-... --prepare, persist .automation/state.json, then --job short-... --send.\nPreparation and dry runs do not upload videos.');return;}
  if([values.check,values.prepare,values.send,values['dry-run']].filter(Boolean).length!==1)throw new Error('Choose --check, --dry-run, --prepare or --send.');
  const config=loadYouTubeConfig(),client=new YouTubeClient(config);
  if(values.check){const channel=await client.checkChannel();console.log(`YouTube connection verified: ${channel.title} (${channel.id}). Upload privacy: ${config.privacy}. No video uploaded.`);return;}
  if(!values.job)throw new Error('Provide --job with the generated automation job ID.');
  const root=process.cwd(),directory=path.join(root,'.automation');mkdirSync(directory,{recursive:true});const release=lockAutomation(directory);
  try{
    const stateFile=path.join(directory,'state.json'),ledger=ledgerSchema.parse(JSON.parse(readFileSync(stateFile,'utf8'))),job=ledger.jobs.find(j=>j.id===values.job);
    if(!job)throw new Error('Unknown upload job ID.');
    const context={root,stateFile,ledger,job,config,client};
    let result:Record<string,unknown>;
    if(values['dry-run']){const verified=verifyVideo(root,job.id);const metadata=youtubeJobMetadata(root,job,config);result={status:'dry-run',videoSha256:verified.sha256,channelId:config.channelId,metadata};}
    else result=values.prepare?await prepareYouTubeJob(context):await sendYouTubeJob(context);
    console.log(JSON.stringify(result));
    if(process.env.GITHUB_OUTPUT){appendFileSync(process.env.GITHUB_OUTPUT,`status=${result.status}\n`);if(result.url)appendFileSync(process.env.GITHUB_OUTPUT,`youtube_url=${result.url}\n`);}
    if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`### YouTube upload\n\nJob: ${job.id}\n\nStatus: ${result.status}\n\n${result.url?`Video: ${result.url}\n`:`Requested privacy: ${config.privacy}\n`}`);
  }finally{release();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'YouTube upload failed.');if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'### YouTube upload needs review\n\nNo confirmed upload result. Inspect YouTube Studio before retrying; the video artifact is retained.\n');process.exitCode=1;});
