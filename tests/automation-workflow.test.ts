import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {runAutomationWorkflow} from '../src/pipeline/automation-workflow';
import {UnworkableTopicError} from '../src/pipeline/generation-errors';
import {createAutomationVideo,digest} from '../src/pipeline/automation-run';
import {automationConfigSchema,jobSchema,reserveTopic,ledgerSchema} from '../src/pipeline/topic-automation';
import {sizeDatasetSchema} from '../src/shorts/size-data';

function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'automatic-topic-workflow-'));
 const config=automationConfigSchema.parse({niche:'Silent comparison workflow reliability',allowedMetrics:['height'],assetProvider:'unused'});
 const current=jobSchema.parse({id:'short-first-topic',topic:'Everyday objects with missing evidence',metric:'height',scopeKey:'everyday-object-heights',entityKeys:['Cup','Fridge'],family:'everyday-objects',selectionMode:'automatic',status:'reserved',attempts:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 const queue=Array.from({length:3},(_,i)=>({topic:`Independent tower height comparison ${i}`,metric:'height' as const,family:'landmarks' as const,angle:'familiar-to-extreme' as const,depth:'accessible' as const,scopeKey:`tower-group-${i}`,entityKeys:Array.from({length:8},(_,n)=>`Tower group ${i} item ${n}`),whyInteresting:'A distinct group of documented towers provides a familiar height comparison.'}));
 const ledger=ledgerSchema.parse({version:1,jobs:[current],queue});const job=ledger.jobs[0];
 const usage=()=>({stageRequests:0,reportedTokens:0,accountedTokens:0,limits:{stageRequests:12,reportedTokens:65000}});
 const options={root,stateFile:path.join(root,'state.json'),ledger,job,config,archiveTarget:'github' as const,client:{chat:async()=>{throw Error('Unexpected model request');}},groqConfig:{apiKey:'test',researchModel:'test',scriptModel:'test',motionModel:'test'},log:()=>{},usage,onJob:(_job:typeof job)=>{}};
 const data=sizeDatasetSchema.parse({template:'size-comparison',id:'test-data',title:'Supported comparison data',metric:'height',unit:'m',basis:'Synthetic complete-object heights for lifecycle testing.',context:'Synthetic fixture only',items:[1,2,3,4].map((value,i)=>({id:`object-${i}`,label:`Measured subject ${i}`,value,color:'#AABBCC',sourceIds:['s1'],visual:{kind:'box',widthToHeight:1,depthToHeight:1}})),sources:[{id:'s1',title:'Synthetic measurement fixture',url:'https://example.com/test'}]});
 return {root,config,ledger,job,options,data};
}

test('an unworkable automatic topic is skipped and only the verified replacement reaches delivery',async()=>{
 const f=fixture();let creates=0,builds=0;const jobs:string[]=[];
 try{
  const result=await runAutomationWorkflow({...f.options,onJob:job=>jobs.push(job.id)},{createVideo:options=>{
   creates++;
   return createAutomationVideo(options,{generateData:async()=>{if(creates===1)throw new UnworkableTopicError('Only one verified object after bounded research.');return f.data;},planImages:async data=>data,build:async(root,job)=>{builds++;for(const [file,content] of [[`out/shorts/${job.id}/${job.id}.mp4`,'synthetic-video'],[`public/shorts/${job.id}/video.json`,'{}']]){const target=path.join(root,file);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,content);}},verify:(root,id)=>{const file=path.join(root,`out/shorts/${id}/${id}.mp4`),props=path.join(root,`public/shorts/${id}/video.json`);return {file,props,sha256:digest(file),info:{}};},fingerprint:()=> 'test-source'});
  }});
  assert.equal(result.status,'rendered');assert.equal(creates,2);assert.equal(builds,1);assert.notEqual(result.id,f.job.id);
  assert.equal(f.job.status,'skipped-unworkable');assert.equal(f.ledger.jobs[1].status,'rendered');assert.equal(result.attempts.length,2);
  assert.equal(jobs.at(-1),result.id);assert.ok('videoPath' in result&&result.videoPath?.includes(result.id));
  const output=path.join(f.root,'output.txt');
  mkdirSync(path.join(f.root,'.automation'),{recursive:true});writeFileSync(path.join(f.root,'.automation/state.json'),readFileSync(f.options.stateFile));
  const resolved=spawnSync(process.execPath,['--import',path.resolve('node_modules/tsx/dist/loader.mjs'),path.resolve('.github/scripts/active-job.ts')],{cwd:f.root,encoding:'utf8',env:{...process.env,CREATED_JOB_ID:result.id,SELECTED_JOB_ID:f.job.id,GITHUB_OUTPUT:output}});
  assert.equal(resolved.status,0,resolved.stderr);assert.match(readFileSync(output,'utf8'),new RegExp(`job_id=${result.id}`));assert.doesNotMatch(readFileSync(output,'utf8'),new RegExp(`job_id=${f.job.id}`));
 }finally{rmSync(f.root,{recursive:true,force:true});}
});

test('all unsuitable topics end honestly with no video and never exceed the topic cap',async()=>{
 const f=fixture();let creates=0;
 try{
  const result=await runAutomationWorkflow(f.options,{createVideo:options=>{creates++;return createAutomationVideo(options,{generateData:async()=>{throw new UnworkableTopicError('No supported measurements');}});}});
  assert.equal(result.status,'no-video');assert.equal(creates,3);assert.equal(result.attempts.length,3);assert.ok(f.ledger.jobs.every(j=>j.status==='skipped-unworkable'));assert.ok(!('videoPath' in result));
  const next=await reserveTopic({...f.options,directory:f.root,model:'test',freshOnly:true});assert.ok(!result.attempts.some(a=>a.id===next.id));
 }finally{rmSync(f.root,{recursive:true,force:true});}
});

test('manual topics never silently change scope and shared budgets stop further attempts',async()=>{
 for(const manual of [true,false]){
  const f=fixture();let selections=0;
  try{
   if(manual)f.job.selectionMode='manual';
   const result=await runAutomationWorkflow({...f.options,usage:()=>({...f.options.usage(),stageRequests:9})},{reserve:async()=>{selections++;throw Error('Must not select another topic');},createVideo:options=>createAutomationVideo(options,{generateData:async()=>{throw new UnworkableTopicError('Insufficient evidence');}})});
   assert.equal(result.status,'no-video');assert.equal(selections,0);assert.equal(result.attempts.length,1);assert.ok('reason' in result&&result.reason?.includes(manual?'scope':'budget'));
  }finally{rmSync(f.root,{recursive:true,force:true});}
 }
});

test('provider-wide quota pauses the workflow without spending on a replacement topic',async()=>{
 const f=fixture();let creates=0;
 try{
  const first=await runAutomationWorkflow(f.options,{createVideo:options=>{creates++;return createAutomationVideo(options,{generateData:async()=>{throw Error('HTTP 429 tokens per day. Please try again in 15m.');}});}});
  assert.equal(first.status,'retry-later');assert.ok(f.ledger.providerBackoff);
  const again=await runAutomationWorkflow(f.options,{createVideo:async()=>{creates++;throw Error('No request should be made during provider backoff');}});
  assert.equal(again.status,'retry-later');assert.equal(creates,1);assert.equal(f.ledger.jobs.length,1);
  await assert.rejects(()=>reserveTopic({...f.options,directory:f.root,model:'test',freshOnly:true}),/Quota backoff/);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});

test('fatal system errors still stop before delivery while network outages are deferred',async()=>{
 for(const transient of [false,true]){
  const f=fixture();
  try{
   const run=()=>runAutomationWorkflow(f.options,{createVideo:options=>createAutomationVideo(options,{generateData:async()=>{throw Error(transient?'GroqCloud network request timed out':'Asset path escapes its input directory');}})});
   if(transient)assert.equal((await run()).status,'retry-later');else await assert.rejects(run,/Asset path escapes/);
   assert.ok(f.ledger.jobs.every(j=>j.status!=='rendered'&&j.status!=='complete'));
  }finally{rmSync(f.root,{recursive:true,force:true});}
 }
});

test('missing automatic checkpoints can be abandoned and legacy automatic jobs retain fallback eligibility',async()=>{
 const f=fixture();let creates=0;
 try{
  delete f.job.selectionMode;delete f.job.family;f.job.status='needs-review';f.job.error='Saved checkpoint is missing or unusable. Automatic recovery stopped.';f.job.attempts=1;
  const result=await runAutomationWorkflow(f.options,{createVideo:options=>{creates++;return createAutomationVideo(options,{generateData:async()=>{throw new UnworkableTopicError('Unsupported topic');}});}});
  assert.equal(result.status,'no-video');assert.equal(creates,2);assert.equal(f.job.status,'skipped-unworkable');assert.equal(result.attempts.length,3);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});

test('CLI explicitly reports exhausted content as no video rather than a failed run or a fake delivery',()=>{
 const f=fixture();
 try{
  f.job.attempts=f.config.maxAttemptsPerJob;
  mkdirSync(path.join(f.root,'automation'),{recursive:true});mkdirSync(path.join(f.root,'.automation'),{recursive:true});
  writeFileSync(path.join(f.root,'automation/config.json'),JSON.stringify({...f.config,maxTopicsPerRun:1}));
  writeFileSync(path.join(f.root,'.automation/state.json'),JSON.stringify(f.ledger));
  const summary=path.join(f.root,'summary.md'),output=path.join(f.root,'output.txt');
  const run=spawnSync(process.execPath,['--import',path.resolve('node_modules/tsx/dist/loader.mjs'),path.resolve('scripts/automate.ts'),'--resume',f.job.id],{cwd:f.root,encoding:'utf8',timeout:30000,env:{...process.env,GROQCLOUD_API_KEY:'unused-offline-test',GITHUB_STEP_SUMMARY:summary,GITHUB_OUTPUT:output}});
  assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(readFileSync(path.join(f.root,'out/automation/result.json'),'utf8')).status,'no-video');assert.match(readFileSync(summary,'utf8'),/No finished video was produced/);assert.match(readFileSync(output,'utf8'),/status=no-video/);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
