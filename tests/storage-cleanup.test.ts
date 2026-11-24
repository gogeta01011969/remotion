import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {artifactStoragePolicy,planArtifactCleanup,GitHubArtifactCleaner,type ManagedArtifact} from '../src/pipeline/artifact-cleanup';
import {compactLedger,ledgerSchema,jobSchema} from '../src/pipeline/topic-automation';
import {cleanupJob,runPaths} from '../src/pipeline/automation-run';
const now=Date.parse('2026-11-24T12:00:00Z');
const item=(id:number,name:string,hours=1,size=1024):ManagedArtifact=>({id,name,created_at:new Date(now-hours*3600000).toISOString(),size_in_bytes:size,workflow_run:{id:100+id}});
const job=(id:string)=>jobSchema.parse({id,topic:'A synthetic comparison',metric:'height',scopeKey:id,entityKeys:[],status:'complete',attempts:1,createdAt:'2026-11-24T00:00:00Z',updatedAt:'2026-11-24T00:00:00Z'});

test('uploaded video/checkpoint artifacts are deleted; failed recovery is bounded and unrelated artifacts are untouched',()=>{
 const artifacts=[item(1,'short-short-done'),item(2,'checkpoint-short-done'),item(3,'checkpoint-short-retry',5),item(4,'checkpoint-short-retry',1),item(5,'short-short-old',73),item(6,'automation-result-123-1',25),item(7,'linux-smoke-321-1',25),item(8,'someone-elses-artifact',500),item(9,'checkpoint-short-running',80)];
 const plan=planArtifactCleanup(artifacts,new Set(['short-done']),new Set([109]),now);
 assert.deepEqual(plan.removals.map(r=>r.artifact.id).sort((a,b)=>a-b),[1,2,3,5,6,7]);
 assert.equal(plan.remainingArtifacts,2); // Latest retry and an active run; unrelated artifacts are outside this policy.
});
test('managed storage is capped without touching an active run',()=>{
 const artifacts=Array.from({length:25},(_,i)=>item(i+1,`short-short-job-${i}`,i+1,10*1048576));
 const plan=planArtifactCleanup(artifacts,new Set(),new Set([101]),now);
 assert.ok(plan.remainingBytes<=artifactStoragePolicy.maximumBytes);assert.ok(plan.remainingArtifacts<=20);
 assert.ok(!plan.removals.some(r=>r.artifact.id===1));
});
test('GitHub artifact cleanup deletes only planned IDs and tolerates a concurrent deletion',async()=>{
 const deleted:number[]=[];
 const cleaner=new GitHubArtifactCleaner({repository:'owner/repo',token:'test-secret',fetcher:async(url,init)=>{
  const route=new URL(String(url));
  if(init?.method==='DELETE'){deleted.push(Number(route.pathname.split('/').at(-1)));return new Response(null,{status:404});}
  if(route.pathname.endsWith('/runs'))return Response.json({workflow_runs:[]});
  return Response.json({artifacts:[item(1,'short-short-uploaded'),item(2,'another-product',1000)]});
 }});
 const result=await cleaner.clean({uploaded:new Set(['short-uploaded']),now});assert.deepEqual(deleted,[1]);assert.equal(result.removedArtifacts,1);
 const denied=new GitHubArtifactCleaner({repository:'owner/repo',token:'test-secret',fetcher:async()=>new Response('test-secret',{status:403})});
 await assert.rejects(()=>denied.clean({uploaded:new Set()}),error=>String(error).includes('HTTP 403')&&!String(error).includes('test-secret'));
});
test('uploaded local jobs remove all video copies while unresolved uploads remain recoverable',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'complete-job-cleanup-')),current=job('short-cleanup');
 try{
  const ledger=ledgerSchema.parse({version:1,jobs:[current],queue:[]}),active=ledger.jobs[0];
  for(const directory of [...runPaths(root,current.id),'out/automation/delivery/'+current.id,'out/automation/checkpoint','.automation/restored']){
   const resolved=path.isAbsolute(directory)?directory:path.join(root,directory);mkdirSync(resolved,{recursive:true});writeFileSync(path.join(resolved,'video.mp4'),'fixture');
  }
  for(const directory of ['out/automation/checkpoint','.automation/restored'])writeFileSync(path.join(root,directory,'checkpoint.json'),JSON.stringify({jobId:current.id}));
  const intent={status:'uploading' as const,intentId:'test',channelId:'UC'+'a'.repeat(22),videoSha256:'f'.repeat(64),metadataSha256:'a'.repeat(64),requestedAt:'2026-11-24T00:00:00Z',privacy:'public' as const};
  active.youtube=intent;
  writeFileSync(path.join(root,'.automation',`youtube-upload-${current.id}.json`),'{}');
  assert.throws(()=>cleanupJob(root,current.id,ledger),/unresolved/);assert.ok(existsSync(path.join(root,'out/shorts',current.id)));
  active.youtube={...intent,status:'uploaded',videoId:'abcdefghijk'};
  cleanupJob(root,current.id,ledger);
  for(const directory of [...runPaths(root,current.id),path.join(root,'out/automation/delivery',current.id),path.join(root,'out/automation/checkpoint'),path.join(root,'.automation/restored')])assert.equal(existsSync(directory),false);
  assert.equal(existsSync(path.join(root,'.automation',`youtube-upload-${current.id}.json`)),false);
  assert.equal(ledger.jobs[0].youtube?.videoId,'abcdefghijk');
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('ledger compaction bounds terminal history and preserves pending jobs and ambiguous intents',()=>{
 const terminal=Array.from({length:400},(_,i)=>({...job(`short-old-${i}`),updatedAt:new Date(now-i*3600000).toISOString()}));
 const pending={...job('short-pending'),status:'retry-later' as const};
 const uncertain={...job('short-uncertain'),updatedAt:'2000-01-01T00:00:00Z',youtube:{status:'uploading',intentId:'test',channelId:'UC'+'a'.repeat(22),videoSha256:'f'.repeat(64),metadataSha256:'a'.repeat(64),requestedAt:'2000-01-01T00:00:00Z',privacy:'public'}};
 const ledger=ledgerSchema.parse({version:1,jobs:[...terminal,pending,uncertain],queue:[]});
 compactLedger(ledger);assert.equal(ledger.jobs.length,202);assert.ok(ledger.jobs.some(j=>j.id==='short-uncertain'));assert.ok(ledger.jobs.some(j=>j.id==='short-pending'));assert.ok(Buffer.byteLength(JSON.stringify(ledger))<=512*1024);
});

test('GitHub artifact cleanup examines later pages before deleting artifacts',async()=>{
 const pages:number[]=[],deleted:number[]=[];
 const cleaner=new GitHubArtifactCleaner({repository:'owner/repo',token:'test',fetcher:async(url,init)=>{
  const parsed=new URL(String(url));
  if(init?.method==='DELETE'){deleted.push(Number(parsed.pathname.split('/').at(-1)));return new Response(null,{status:204});}
  if(parsed.pathname.endsWith('/runs'))return Response.json({workflow_runs:[]});
  const page=Number(parsed.searchParams.get('page'));pages.push(page);
  return Response.json({artifacts:page===1?Array.from({length:100},(_,i)=>item(i+1,`unrelated-${i}`)): [item(501,'short-short-page-two')]});
 }});
 await cleaner.clean({uploaded:new Set(['short-page-two']),now});assert.deepEqual(pages,[1,2]);assert.deepEqual(deleted,[501]);
});

test('production topic-policy migration clears obsolete queued ideas without clearing published history',async()=>{
 const {reserveTopic,automationConfigSchema}=await import('../src/pipeline/topic-automation');
 const root=mkdtempSync(path.join(tmpdir(),'topic-policy-migration-'));let calls=0;
 try{
  const history=job('short-published');
  const ledger=ledgerSchema.parse({version:1,jobs:[history],queue:[{topic:'Obscure variant height comparison',metric:'height',scopeKey:'old-narrow-topic',entityKeys:[],whyInteresting:'Old queued topic before general-audience instructions.'}]});
  const config=automationConfigSchema.parse({niche:'Relatable comparisons for a general audience',topicPolicyVersion:2,allowedMetrics:['height'],assetProvider:'unused'});
  const selected=await reserveTopic({root,directory:root,ledger,config,model:'test',log:()=>{},client:{chat:async()=>{calls++;return {choices:[{message:{content:JSON.stringify({candidates:[{topic:'Familiar objects beside iconic landmarks',metric:'height',whyInteresting:'Recognizable anchors make the scale differences relatable.'}]})}}]};}}});
  assert.equal(calls,1);assert.equal(selected.topic,'Familiar objects beside iconic landmarks');assert.equal(ledger.topicPolicyVersion,2);assert.ok(ledger.jobs.some(j=>j.id===history.id));
 }finally{rmSync(root,{recursive:true,force:true});}
});
