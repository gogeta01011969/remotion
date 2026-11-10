import {readFileSync,mkdirSync,appendFileSync} from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {automationConfigSchema,loadLedger,saveLedger,lockAutomation,reserveTopic,budgetClient,AutomationDeferredError} from '../src/pipeline/topic-automation';
import {createAutomationVideo,stageCheckpoint,restoreCheckpoint,cleanupJob,confirmArchive} from '../src/pipeline/automation-run';
import {GroqClient,loadGroqConfig} from '../src/pipeline/groq';
import {writeJson} from '../src/pipeline/stages';

async function main(){
  const {values}=parseArgs({options:{config:{type:'string',default:'automation/config.json'},topic:{type:'string'},resume:{type:'string'},'select-only':{type:'boolean'},'archive-confirmed':{type:'string'},package:{type:'boolean'},cleanup:{type:'boolean'},restore:{type:'string'},help:{type:'boolean'}}});
  if(values.help){console.log('npm run automate -- [--topic "..."] [--select-only] [--resume job-id]\nCI: --package / --restore directory / --archive-confirmed artifact-id / --cleanup with --resume job-id');return;}
  const root=process.cwd(),dir=path.join(root,'.automation');mkdirSync(dir,{recursive:true});const release=lockAutomation(dir);
  const resultFile=path.join(root,'out/automation/result.json');mkdirSync(path.dirname(resultFile),{recursive:true});
  try{
    const config=automationConfigSchema.parse(JSON.parse(readFileSync(path.resolve(values.config!),'utf8'))),stateFile=path.join(dir,'state.json'),ledger=loadLedger(stateFile,config,root);
    const output=(value:Record<string,unknown>)=>{writeJson(resultFile,value);console.log(JSON.stringify(value));if(process.env.GITHUB_OUTPUT){if(typeof value.id==='string')appendFileSync(process.env.GITHUB_OUTPUT,`job_id=${value.id}\n`);if(typeof value.status==='string')appendFileSync(process.env.GITHUB_OUTPUT,`status=${value.status}\n`);}};
    if([values.package,values.cleanup,values.restore,values['archive-confirmed']].filter(Boolean).length>1)throw new Error('Choose one checkpoint/archive/cleanup operation.');
    if(values.package||values.cleanup||values.restore||values['archive-confirmed']){
      const job=ledger.jobs.find(j=>j.id===values.resume);if(!job)throw new Error('Provide --resume with an existing job ID.');
      if(values.package)output({status:'packaged',id:job.id,checkpointPath:stageCheckpoint(root,job.id)});
      if(values.restore){restoreCheckpoint(root,job.id,path.resolve(values.restore));output({status:'restored',id:job.id});}
      if(values.cleanup){cleanupJob(root,job.id,ledger);output({status:'cleaned',id:job.id});}
      if(values['archive-confirmed']){confirmArchive(job,values['archive-confirmed']);saveLedger(stateFile,ledger);output({status:'complete',id:job.id,artifactId:job.artifactId});}
      return;
    }
    let job=values.resume?ledger.jobs.find(j=>j.id===values.resume):undefined;if(values.resume&&!job)throw new Error('Unknown resume ID.');
    if(values.topic&&values.resume)throw new Error('A resumed job retains its saved topic.');
    // Configuration/key lookup is deferred for checkpoint-only operations.
    const groqConfig=loadGroqConfig(),client=budgetClient(new GroqClient({apiKey:groqConfig.apiKey,onRetry:line=>console.error(line)}),config);
    job??=await reserveTopic({ledger,config,root,directory:path.dirname(resultFile),client,model:groqConfig.scriptModel,log:line=>console.error(line),topic:values.topic});
    saveLedger(stateFile,ledger);output({status:job.status,id:job.id,topic:job.topic});
    const summary=()=>{if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`### Comparison job ${job!.id}\n\nTopic: ${job!.topic.replace(/[\r\n]/g,' ')}\n\nStatus: ${job!.status}\n${job!.error?`\nError: ${job!.error.replace(/[\r\n]/g,' ')}\n`:''}`);};
    if(!values['select-only']){
      const archiveTarget=process.env.AUTOMATION_ARCHIVE_TARGET==='github'?'github':'local';
      try{
        const result=await createAutomationVideo({root,stateFile,ledger,job,config,client,groqConfig,archiveTarget,log:line=>console.error(line)});
        output(result);
      }catch(error){
        output({status:job.status,id:job.id,topic:job.topic,error:job.error});
        throw error;
      }finally{
        writeJson(path.join(root,'out/comparisons',job.id,'automation-usage.json'),client.usage());
        summary();
      }
    }
    else summary();
  }finally{release();}
}
main().catch(error=>{if(error instanceof AutomationDeferredError){const result={status:'deferred',retryAt:error.retryAt};mkdirSync('out/automation',{recursive:true});writeJson('out/automation/result.json',result);console.log(JSON.stringify(result));return;}console.error(error instanceof Error?error.message:error);process.exitCode=1;});
