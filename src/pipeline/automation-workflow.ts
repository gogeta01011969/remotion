import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {createAutomationVideo,type AutomationRunOptions} from './automation-run';
import {reserveTopic,saveLedger,type AutomationJob} from './topic-automation';
import {writeJson} from './stages';
import {quotaDeferral} from './quota-retry';
import {AutomationDeferredError} from './topic-automation';
import {UnworkableTopicError} from './generation-errors';

type Usage={stageRequests:number;reportedTokens:number;accountedTokens:number;limits:{stageRequests:number;reportedTokens:number}};
type Attempt={id:string;topic:string;status:string;reason?:string};
export const automaticallySelected=(job:AutomationJob)=>job.selectionMode==='automatic'||(!job.selectionMode&&Boolean(job.scopeKey&&job.entityKeys.length));

// One invocation, one shared provider budget, and at most one delivered MP4.
// A skipped topic is never represented as a successful video.
export async function runAutomationWorkflow(options:AutomationRunOptions&{usage:()=>Usage;onJob:(job:AutomationJob)=>void},dependencies:{createVideo?:typeof createAutomationVideo;reserve?:typeof reserveTopic}={}){
  const attempts:Attempt[]=[];let current=options.job;
  const directory=path.join(options.root,'out/automation');mkdirSync(directory,{recursive:true});
  const save=()=>writeJson(path.join(directory,'attempts.json'),{maxTopics:options.config.maxTopicsPerRun,attempts});
  const noVideo=(reason:string)=>({status:'no-video' as const,id:current.id,topic:current.topic,reason,attempts});
  const backoff=options.ledger.providerBackoff;
  if(backoff&&Date.parse(backoff.retryAt)>Date.now()&&!['rendered','complete'].includes(current.status)){
    current.status='retry-later';current.retryAt=backoff.retryAt;current.error=backoff.reason;saveLedger(options.stateFile,options.ledger);save();
    return {status:'retry-later' as const,id:current.id,retryAt:backoff.retryAt,deferredBy:'provider-backoff',reason:backoff.reason,attempts};
  }
  for(let index=0;index<options.config.maxTopicsPerRun;index++){
    options.onJob(current);
    let result:Awaited<ReturnType<typeof createAutomationVideo>>;
    if(current.status!=='complete'&&(current.attempts>=options.config.maxAttemptsPerJob||/Saved checkpoint is missing or unusable/.test(current.error??''))){
      const reason=current.error??'Saved job exhausted its automatic attempts.';
      current.status='skipped-unworkable';current.error=reason;delete current.retryAt;saveLedger(options.stateFile,options.ledger);
      result={status:'skipped-unworkable',id:current.id,reason};
    }else result=await (dependencies.createVideo??createAutomationVideo)({...options,job:current});
    const reason='reason' in result?result.reason:undefined;
    attempts.push({id:current.id,topic:current.topic,status:result.status,...(reason?{reason}:{})});save();
    if(result.status!=='skipped-unworkable'&&result.status!=='skipped-duplicate')return {...result,attempts};
    if(!automaticallySelected(current))return noVideo('The requested topic could not produce a supported comparison. Its scope was preserved; no substitute topic or video was published.');
    if(index+1>=options.config.maxTopicsPerRun)return noVideo('No workable topic completed within this run’s topic limit. The next trigger can select fresh candidates.');
    const usage=options.usage();
    if(usage.limits.stageRequests-usage.stageRequests<6||usage.limits.reportedTokens-usage.accountedTokens<25000)return noVideo('Insufficient remaining shared budget for another complete topic-to-video attempt. Skipped topics will not block the next trigger.');
    options.log(`Skipping unworkable/duplicate topic ${current.id}; selecting another topic within the same shared budget.`);
    try{
      current=await (dependencies.reserve??reserveTopic)({ledger:options.ledger,config:options.config,root:options.root,directory,client:options.client,model:options.groqConfig.scriptModel,log:options.log,freshOnly:true});
    }catch(error){
      if(error instanceof UnworkableTopicError)return noVideo('No supported alternative topic could be selected within the bounded attempt.');
      const message=error instanceof Error?error.message:String(error);
      const retryAt=error instanceof AutomationDeferredError?error.retryAt:quotaDeferral(message);
      if(retryAt){
        if(!/Automation usage budget/i.test(message))options.ledger.providerBackoff={retryAt,reason:message.slice(0,1500)};
        saveLedger(options.stateFile,options.ledger);
        return {status:'retry-later' as const,id:current.id,retryAt,reason:message,attempts};
      }
      throw error;
    }
    saveLedger(options.stateFile,options.ledger);options.onJob(current);
  }
  return noVideo('No video produced.');
}
