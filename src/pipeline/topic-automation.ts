import {comparisonLimits} from '../shorts/comparison-limits';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,mkdirSync,openSync,closeSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {sizeDatasetSchema,type SizeDataset} from '../shorts/size-data';
import {structuredStage,writeJson} from './stages';
import type {ChatRequest,Completion,GroqClient} from './groq';
import {automatedMetricNames,familyIds,angleIds,depthIds,comparisonFamilies,horizonBrief,horizonPriority,topicFamily} from './comparison-horizon';

const slug=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const metric=z.enum(automatedMetricNames);
export const automationConfigSchema=z.object({niche:z.string().min(10).max(500),allowedMetrics:z.array(metric).min(1),enabledFamilies:z.array(z.enum(familyIds)).min(1).default(familyIds),enabledAngles:z.array(z.enum(angleIds)).min(1).default(angleIds),candidatesPerBatch:z.number().int().min(2).max(5).default(3),maxTopicsPerRun:z.number().int().min(1).max(3).default(3),maxAttemptsPerJob:z.number().int().min(1).max(5).default(3),retryAfterMinutes:z.number().int().min(1).max(1440).default(60),maxStageRequests:z.number().int().min(1).max(30).default(12),maxReportedTokens:z.number().int().min(1000).max(200000).default(65000),assetProvider:z.string().min(1),seedDatasets:z.array(z.string()).default([])}).strict();
export type AutomationConfig=z.infer<typeof automationConfigSchema>;
const horizonFields={family:z.enum(familyIds).optional(),angle:z.enum(angleIds).optional(),depth:z.enum(depthIds).optional()};
export const topicCandidateSchema=z.object({topic:z.string().min(12).max(180),metric,scopeKey:slug,entityKeys:z.array(z.string().min(2).max(80)).max(comparisonLimits.maximum).default([]),whyInteresting:z.string().min(20).max(300),...horizonFields}).strict();

export type TopicCandidate=z.infer<typeof topicCandidateSchema>;
export const jobSchema=z.object({id:slug,topic:z.string().min(5).max(200),metric:z.string().nullable(),scopeKey:z.string(),entityKeys:z.array(z.string()),actualEntityKeys:z.array(z.string()).default([]),whyInteresting:z.string().optional(),...horizonFields,selectionMode:z.enum(['automatic','manual']).optional(),status:z.enum(['seeded','reserved','rendering','rendered','retry-later','needs-review','skipped-duplicate','skipped-unworkable','complete']),attempts:z.number().int().nonnegative(),createdAt:z.string(),updatedAt:z.string(),retryAt:z.string().optional(),error:z.string().max(1500).optional(),videoSha256:z.string().optional(),artifactName:z.string().optional(),artifactId:z.string().optional(),youtube:z.object({status:z.enum(['uploading','uploaded','needs-review']),intentId:z.string(),channelId:z.string(),videoSha256:z.string(),metadataSha256:z.string(),requestedAt:z.string(),privacy:z.enum(['private','unlisted','public']),videoId:z.string().optional(),url:z.string().url().optional(),uploadedAt:z.string().optional(),error:z.string().max(300).optional()}).strict().optional()}).strict();
export type AutomationJob=z.infer<typeof jobSchema>;
export const ledgerSchema=z.object({version:z.literal(1),providerBackoff:z.object({retryAt:z.iso.datetime(),reason:z.string().max(1500)}).optional(),jobs:z.array(jobSchema),queue:z.array(topicCandidateSchema)}).strict();
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
  return ledger.jobs.find(j=>['reserved','rendering','rendered','retry-later'].includes(j.status)&&j.attempts<config.maxAttemptsPerJob&&(!j.retryAt||Date.parse(j.retryAt)<=now));
}
export async function reserveTopic(options:{ledger:TopicLedger;config:AutomationConfig;root:string;directory:string;client:Pick<GroqClient,'chat'>;model:string;log:(s:string)=>void;topic?:string;now?:string;freshOnly?:boolean}){
  const {ledger,config}=options,now=options.now??new Date().toISOString();
  for(const j of ledger.jobs)if(['reserved','rendering','rendered','retry-later'].includes(j.status)&&j.attempts>=config.maxAttemptsPerJob){j.status='needs-review';j.error=`Automatic attempt limit reached. Previous error: ${j.error??'Run interrupted or delivery not confirmed.'}`.slice(0,1500);delete j.retryAt;j.updatedAt=now;}
  // A deferred job pauses only itself. Due jobs get bounded retries; otherwise
  // choose a fresh topic rather than replaying another job's saved backoff.
  const pending=!options.topic&&!options.freshOnly?pendingJob(ledger,config,Date.parse(now)):undefined;
  if(pending?.status==='rendered')return pending;
  if(ledger.providerBackoff&&Date.parse(ledger.providerBackoff.retryAt)>Date.parse(now))throw new AutomationDeferredError(ledger.providerBackoff.retryAt);
  if(pending)return pending;
  let candidate:TopicCandidate|undefined;
  if(options.topic){
    const proposal={topic:options.topic,metric:null,scopeKey:'',entityKeys:[]};
    const duplicate=duplicateReason(proposal,ledger);if(duplicate)throw new Error(duplicate);
    const id=`short-${now.slice(0,10)}-${hash(canonicalTopic(options.topic)).slice(0,12)}`;
    const job=jobSchema.parse({...proposal,id,selectionMode:'manual',status:'reserved',attempts:0,createdAt:now,updatedAt:now});ledger.jobs.push(job);return job;
  }
  // A queued proposal is rechecked against every completed/reserved topic.
  const choose=()=>{
    const completed=ledger.jobs.filter(j=>j.status==='complete'||j.status==='seeded');
    ledger.queue.sort((a,b)=>horizonPriority(a,completed)-horizonPriority(b,completed)||Math.min(comparisonLimits.targetMinimum+2,b.entityKeys.length)-Math.min(comparisonLimits.targetMinimum+2,a.entityKeys.length));
    while(ledger.queue.length){const item=ledger.queue.shift()!,family=comparisonFamilies.find(f=>f.id===topicFamily(item));if(family&&family.metrics.includes(item.metric)&&config.allowedMetrics.includes(item.metric)&&config.enabledFamilies.includes(family.id)&&(!item.angle||config.enabledAngles.includes(item.angle))&&!duplicateReason(item,ledger))return item;}
  };
  candidate=choose();
  if(!candidate){
    const candidateShape=z.object({topic:z.string(),metric,whyInteresting:z.string().optional()});
    const schema=z.object({candidates:z.array(candidateShape)});
    const horizon=horizonBrief(config.allowedMetrics);horizon.families=horizon.families.filter(f=>config.enabledFamilies.includes(f.id));horizon.angles=horizon.angles.filter(a=>config.enabledAngles.includes(a.id));
    if(!horizon.families.length)throw new Error('No enabled subject family supports the configured measurements.');
    const result=await structuredStage({stage:'motion',artifact:'topic-candidates',maxAttempts:2,model:options.model,client:options.client,constrained:false,compactSchema:true,schema,maxCompletionTokens:2800,directory:options.directory,log:options.log,
      input:JSON.stringify({niche:config.niche,allowedMetrics:config.allowedMetrics,availableSubjects:horizon.families.map(({id,subjects,metrics})=>({id,subjects,metrics})),recentHistory:ledger.jobs.slice(-12).map(j=>({topic:j.topic,metric:j.metric,objects:(j.actualEntityKeys.length?j.actualEntityKeys:j.entityKeys).slice(0,8)}))}),
      system:`Suggest ${config.candidatesPerBatch} different engaging silent English YouTube comparison Shorts. Return candidates, each with topic, metric and whyInteresting. Choose the video idea only; object selection happens in the next request. Prefer broad enough pools for 8–15 recognizable items, but do not output object lists, records or exact figures. Choose recognizable real objects, familiar anchors, surprising contrasts and a clear payoff. Aim for 8–15 meaningful objects rather than minor variants; fewer are fine for a good focused matchup. Approximate values from general knowledge are acceptable, including typical everyday objects; no browsing, source tables or citations are required. Prefer reliable familiar facts over obscure or disputed records. Every object must belong to the proposed topic: spacecraft do not belong in land-vehicle comparisons. Use familiar generic objects when unsure of a model; never invent named products, agencies or record projects. Avoid past topics and near-identical object sets. Choose only allowed measurements and available subjects. Spheres support diameter; cutouts support height, length, width or wingspan; equivalent-volume cubes support capacity; sequential bars support mass, count, speed, duration, energy, power and temperature. Keep each comparison on one meaningful common measurement. Distinguish wingspan from length, energy from power, and elapsed time from calendar dates. No fictional objects, geographic outline acquisition, arbitrary generated code or narration-dependent stories. Vary the subjects across the batch.`,
      repairInstruction:'Return at least one fresh meaningful topic with an allowed metric.',validate:raw=>{
        const entries=raw&&typeof raw==='object'&&'candidates' in raw&&Array.isArray(raw.candidates)?raw.candidates:[];
        const accepted:TopicCandidate[]=[];
        for(const entry of entries){
          if(!entry||typeof entry!=='object'||typeof entry.topic!=='string'||!config.allowedMetrics.includes(entry.metric))continue;
          const inferred=topicFamily({topic:entry.topic,metric:entry.metric,family:entry.family});
          const family=horizon.families.find(f=>f.id===inferred&&f.metrics.includes(entry.metric))??horizon.families.find(f=>f.metrics.includes(entry.metric));
          if(!family)continue;
          const proposal=topicCandidateSchema.safeParse({topic:entry.topic.trim().slice(0,180),metric:entry.metric,
            scopeKey:slug.safeParse(entry.scopeKey).success?entry.scopeKey:`topic-${hash(canonicalTopic(entry.topic)).slice(0,16)}`,
            entityKeys:[...new Set((Array.isArray(entry.entityKeys)?entry.entityKeys:[]).filter((name:unknown)=>typeof name==='string'&&name.trim().length>=2).map((name:string)=>name.trim().slice(0,80)))].slice(0,comparisonLimits.maximum),
            whyInteresting:typeof entry.whyInteresting==='string'&&entry.whyInteresting.length>=20?entry.whyInteresting.slice(0,300):'Recognizable objects reveal a meaningful and surprising comparison.',
            family:family.id,angle:config.enabledAngles.includes(entry.angle)?entry.angle:config.enabledAngles[0],depth:depthIds.includes(entry.depth)?entry.depth:'accessible'});
          if(!proposal.success)continue;
          const c=proposal.data;
          const history={...ledger,jobs:[...ledger.jobs,...accepted.map((a,i)=>jobSchema.parse({...a,id:`candidate-${i}`,status:'reserved',attempts:0,createdAt:now,updatedAt:now}))]};
          if(!duplicateReason(c,history))accepted.push(c);
          if(accepted.length===config.candidatesPerBatch)break;
        }
        if(!accepted.length)throw new Error('Choose a fresh meaningful topic with an allowed metric.');
        return {candidates:accepted};
      }});
    ledger.queue.push(...result.candidates);candidate=choose();
  }
  if(!candidate)throw new Error('No eligible unique topic was produced.');
  const id=`short-${now.slice(0,10)}-${hash(canonicalTopic(candidate.topic)).slice(0,12)}`;
  const job=jobSchema.parse({...candidate,selectionMode:'automatic',family:topicFamily(candidate),angle:candidate.angle??'familiar-to-extreme',depth:candidate.depth??'accessible',id,status:'reserved',attempts:0,createdAt:now,updatedAt:now});ledger.jobs.push(job);return job;
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
