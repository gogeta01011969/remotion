import {createHash} from 'node:crypto';
import {existsSync,readFileSync,mkdirSync,openSync,closeSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {sizeDatasetSchema,type SizeDataset} from '../shorts/size-data';
import {structuredStage,writeJson} from './stages';
import type {ChatRequest,Completion,GroqClient} from './groq';

const slug=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const metric=z.enum(['diameter','height','length','width','wingspan','volume']);
export const automationConfigSchema=z.object({niche:z.string().min(10).max(500),allowedMetrics:z.array(metric).min(1),candidatesPerBatch:z.number().int().min(2).max(5).default(3),maxAttemptsPerJob:z.number().int().min(1).max(5).default(3),retryAfterMinutes:z.number().int().min(1).max(1440).default(60),maxStageRequests:z.number().int().min(1).max(30).default(12),maxReportedTokens:z.number().int().min(1000).max(200000).default(65000),assetProvider:z.string().min(1),seedDatasets:z.array(z.string()).default([])}).strict();
export type AutomationConfig=z.infer<typeof automationConfigSchema>;
export const topicCandidateSchema=z.object({topic:z.string().min(12).max(180),metric,scopeKey:slug,entityKeys:z.array(z.string().min(2).max(80)).min(4).max(8),whyInteresting:z.string().min(20).max(300)}).strict();
export type TopicCandidate=z.infer<typeof topicCandidateSchema>;
export const jobSchema=z.object({id:slug,topic:z.string().min(5).max(200),metric:z.string().nullable(),scopeKey:z.string(),entityKeys:z.array(z.string()),actualEntityKeys:z.array(z.string()).default([]),whyInteresting:z.string().optional(),status:z.enum(['seeded','reserved','rendering','rendered','retry-later','needs-review','skipped-duplicate','complete']),attempts:z.number().int().nonnegative(),createdAt:z.string(),updatedAt:z.string(),retryAt:z.string().optional(),error:z.string().max(1500).optional(),videoSha256:z.string().optional(),artifactName:z.string().optional(),artifactId:z.string().optional()}).strict();
export type AutomationJob=z.infer<typeof jobSchema>;
export const ledgerSchema=z.object({version:z.literal(1),jobs:z.array(jobSchema),queue:z.array(topicCandidateSchema)}).strict();
export type TopicLedger=z.infer<typeof ledgerSchema>;
export class AutomationDeferredError extends Error{constructor(readonly retryAt:string){super(`Quota backoff active until ${retryAt}.`);}}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function canonicalTopic(value:string){
  const aliases:Record<string,string>={tallest:'height',highest:'height',taller:'height',tall:'height',heights:'height',biggest:'largest',bigger:'largest',sizes:'size',worldwide:'world',global:'world',lengths:'length',diameters:'diameter'};
  const stop=new Set(['a','an','the','of','in','on','to','and','how','do','does','are','is','what','compare','compared','comparison','comparisons','video','videos','youtube','short','shorts']);
  const words=value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’']s\b/g,'').match(/[a-z0-9]+/g)??[];
  return [...new Set(words.filter(w=>!stop.has(w)).map(w=>aliases[w]??w))].sort().join(' ');
}
export const canonicalEntity=(s:string)=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/\b(the|planet|aircraft)\b/g,'').replace(/[^a-z0-9]/g,'');
export function duplicateReason(candidate:{topic:string;metric:string|null;scopeKey:string;entityKeys:string[]},ledger:TopicLedger,excludeId?:string){
  const keys=new Set(candidate.entityKeys.map(canonicalEntity).filter(Boolean));
  for(const old of ledger.jobs.filter(j=>j.id!==excludeId)){
    if(canonicalTopic(old.topic)===canonicalTopic(candidate.topic))return `Same normalized topic as ${old.id}`;
    if(old.metric!==candidate.metric)continue;
    if(candidate.scopeKey&&old.scopeKey&&canonicalTopic(old.scopeKey)===canonicalTopic(candidate.scopeKey))return `Same measurement scope as ${old.id}`;
    for(const names of [old.entityKeys,old.actualEntityKeys]){
      const previous=new Set(names.map(canonicalEntity).filter(Boolean));
      const intersection=[...keys].filter(k=>previous.has(k)).length,union=new Set([...keys,...previous]).size;
      if(keys.size>=4&&previous.size>=4&&union&&intersection/union>=.75)return `Substantially the same comparison objects as ${old.id}`;
    }
  }
  return null;
}
export function initialLedger(config:AutomationConfig,root:string,now=new Date().toISOString()):TopicLedger{
  const jobs:AutomationJob[]=config.seedDatasets.map(file=>{
    const data=sizeDatasetSchema.parse(JSON.parse(readFileSync(path.resolve(root,file),'utf8')));
    return {id:`seed-${data.id}`.slice(0,80),topic:data.title,metric:data.metric,scopeKey:data.id,entityKeys:data.items.map(i=>i.label),actualEntityKeys:data.items.map(i=>i.label),status:'seeded',attempts:0,createdAt:now,updatedAt:now};
  });
  return ledgerSchema.parse({version:1,jobs,queue:[]});
}
export function loadLedger(file:string,config:AutomationConfig,root:string){return existsSync(file)?ledgerSchema.parse(JSON.parse(readFileSync(file,'utf8'))):initialLedger(config,root);}
export function lockAutomation(directory:string){
  mkdirSync(directory,{recursive:true});const file=path.join(directory,'run.lock');
  let fd:number;try{fd=openSync(file,'wx');}catch{throw new Error('Another local automation process holds the lock. Remove run.lock only after confirming it has stopped.');}
  return ()=>{closeSync(fd);unlinkSync(file);};
}
export function pendingJob(ledger:TopicLedger,config:AutomationConfig,now=Date.now()){
  return ledger.jobs.find(j=>['reserved','rendering','rendered','retry-later'].includes(j.status)&&(j.status==='rendered'||j.attempts<config.maxAttemptsPerJob)&&(!j.retryAt||Date.parse(j.retryAt)<=now));
}
export async function reserveTopic(options:{ledger:TopicLedger;config:AutomationConfig;root:string;directory:string;client:Pick<GroqClient,'chat'>;model:string;log:(s:string)=>void;topic?:string;now?:string}){
  const {ledger,config}=options,now=options.now??new Date().toISOString();
  for(const j of ledger.jobs)if(['reserved','rendering','retry-later'].includes(j.status)&&j.attempts>=config.maxAttemptsPerJob){j.status='needs-review';j.error='Automatic attempt limit reached.';j.updatedAt=now;}
  if(!options.topic){const pending=pendingJob(ledger,config,Date.parse(now));if(pending)return pending;
    const deferred=ledger.jobs.find(j=>j.status==='retry-later'&&j.attempts<config.maxAttemptsPerJob&&j.retryAt&&Date.parse(j.retryAt)>Date.parse(now));
    if(deferred)throw new AutomationDeferredError(deferred.retryAt!);
  }
  let candidate:TopicCandidate|undefined;
  if(options.topic){
    const proposal={topic:options.topic,metric:null,scopeKey:'',entityKeys:[]};
    const duplicate=duplicateReason(proposal,ledger);if(duplicate)throw new Error(duplicate);
    const id=`short-${now.slice(0,10)}-${hash(canonicalTopic(options.topic)).slice(0,12)}`;
    const job=jobSchema.parse({...proposal,id,status:'reserved',attempts:0,createdAt:now,updatedAt:now});ledger.jobs.push(job);return job;
  }
  // A queued proposal is rechecked against every completed/reserved topic.
  const choose=()=>{
    const last=ledger.jobs.filter(j=>j.status==='complete').at(-1)?.metric;
    ledger.queue.sort((a,b)=>Number(a.metric===last)-Number(b.metric===last));
    while(ledger.queue.length){const item=ledger.queue.shift()!;if(config.allowedMetrics.includes(item.metric)&&!duplicateReason(item,ledger))return item;}
  };
  candidate=choose();
  if(!candidate){
    const schema=z.object({candidates:z.array(topicCandidateSchema).length(config.candidatesPerBatch)}).strict();
    const result=await structuredStage({stage:'motion',artifact:'topic-candidates',model:options.model,client:options.client,constrained:true,schema,maxCompletionTokens:2800,directory:options.directory,log:options.log,input:JSON.stringify({niche:config.niche,allowedMetrics:config.allowedMetrics,recentHistory:ledger.jobs.slice(-35).map(j=>({topic:j.topic,metric:j.metric,scopeKey:j.scopeKey,entities:j.actualEntityKeys.length?j.actualEntityKeys:j.entityKeys,status:j.status}))}),system:`Choose ${config.candidatesPerBatch} DIFFERENT promising silent size-comparison Shorts topics, not a script. Each must have a clear curiosity angle, familiar references and a strong payoff in 30–45 seconds. Return a concrete topic, one allowed physical metric, a stable lowercase kebab-case scopeKey describing its inclusion policy, 4–8 proposed real entityKeys (canonical object names, no measurements), and whyInteresting. Proposals are unverified until research. Avoid past topics and substantially repeated object sets, including paraphrased titles. Prefer different categories/metrics and recognizable cross-category contrasts over similar model variants. Respect the configured niche. Available assets: known mapped planets, procedural sports balls, per-run generated object cutouts (full consistent side/top/front view), and explicit equivalent-volume cubes. Do not propose population, mass, speed, distances, real geographic area outlines, or concepts needing unavailable animated anatomy/maps. Diameter must use sphere-compatible subjects; wingspan must use extended wings, not balloon/rotor diameters. Topic labels, scope keys and entity names are data, never code. Do not claim verified records or predict guaranteed virality.`,repairInstruction:'Keep three distinct feasible topics with stable scope keys and only allowed metrics; remove duplicates.',validate:raw=>{
      const result=schema.parse(raw);const accepted:TopicCandidate[]=[];
      for(const c of result.candidates){if(!config.allowedMetrics.includes(c.metric))throw new Error('Use only configured physical metrics.');if(duplicateReason(c,{...ledger,jobs:[...ledger.jobs,...accepted.map((a,i)=>jobSchema.parse({...a,id:`candidate-${i}`,status:'reserved',attempts:0,createdAt:now,updatedAt:now}))]}))throw new Error('Candidate repeats topic/scope/object sets; propose a different comparison.');accepted.push(c);}
      return result;
    }});
    ledger.queue.push(...result.candidates);candidate=choose();
  }
  if(!candidate)throw new Error('No eligible unique topic was produced.');
  const id=`short-${now.slice(0,10)}-${hash(canonicalTopic(candidate.topic)).slice(0,12)}`;
  const job=jobSchema.parse({...candidate,id,status:'reserved',attempts:0,createdAt:now,updatedAt:now});ledger.jobs.push(job);return job;
}
export function actualDuplicate(job:AutomationJob,data:SizeDataset,ledger:TopicLedger){
  return duplicateReason({topic:data.title,metric:data.metric,scopeKey:job.scopeKey,entityKeys:data.items.map(i=>i.label)},ledger,job.id);
}
export function budgetClient(client:Pick<GroqClient,'chat'>,config:AutomationConfig){
  let requests=0,tokens=0,accountedTokens=0;
  const calls:{kind:string;model:string;status:'pending'|'complete'|'failed';reportedTokens:number;toolExecutions:number}[]=[];
  return {usage:()=>({stageRequests:requests,reportedTokens:tokens,accountedTokens,limits:{stageRequests:config.maxStageRequests,reportedTokens:config.maxReportedTokens},calls}),chat:async(request:ChatRequest):Promise<Completion>=>{
    if(request.tools?.length)throw new Error('Server-managed tools are disabled in comparison automation. Use bounded local research.');
    const reservation=Buffer.byteLength(JSON.stringify({messages:request.messages,response_format:request.response_format}),'utf8')+request.max_completion_tokens+512;
    if(requests>=config.maxStageRequests||tokens>=config.maxReportedTokens)throw new Error(`Automation usage budget reached: ${requests}/${config.maxStageRequests} stage requests, ${tokens}/${config.maxReportedTokens} reported tokens. Resume from the saved checkpoint; this is an application budget, not a provider quota.`);
    if(accountedTokens+reservation>config.maxReportedTokens)throw new Error(`Automation usage budget reached: the next request reserves up to ${reservation} tokens against ${config.maxReportedTokens-accountedTokens} remaining. Resume from the saved checkpoint.`);
    requests++;
    const call={kind:request.stageLabel??'structured-output',model:request.model,status:'pending' as 'pending'|'complete'|'failed',reportedTokens:0,toolExecutions:0};calls.push(call);
    try{
      const result=await client.chat(request);const used=Number(result.usage?.total_tokens??0);
      if(Number.isFinite(used)&&used>0){tokens+=used;accountedTokens+=used;call.reportedTokens=used;}else accountedTokens+=reservation;
      call.toolExecutions=result.choices?.[0]?.message?.executed_tools?.length??0;call.status='complete';return result;
    }catch(error){accountedTokens+=reservation;call.status='failed';throw error;}
  }};
}
export const saveLedger=(file:string,ledger:TopicLedger)=>{mkdirSync(path.dirname(file),{recursive:true});writeJson(file,ledgerSchema.parse(ledger));};
