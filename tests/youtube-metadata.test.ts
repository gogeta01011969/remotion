import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildSimpleComparison} from '../src/pipeline/simple-comparison';
import {ensureYouTubeMetadata,cachedYouTubeCopy} from '../src/pipeline/youtube-metadata';
import {makeYouTubeMetadata} from '../src/pipeline/youtube';
import {budgetClient,automationConfigSchema,jobSchema,ledgerSchema,saveLedger} from '../src/pipeline/topic-automation';
import {prepareYouTubeJob,sendYouTubeJob} from '../src/pipeline/youtube-job';

const data=()=>buildSimpleComparison({metric:'speed',unit:'km/h',objects:[{name:'Road scooter',value:45},{name:'Bugatti Chiron',value:490},{name:'Thrust SSC',value:1228}]},{id:'metadata-test',topic:'Compare recognizable land vehicles by speed'});
const draft={title:'Scooter vs Bugatti vs Thrust SSC: How Fast Can They Go?',description:'Compare a road scooter, Bugatti Chiron and Thrust SSC on one speed scale. Watch the bars reveal how far apart these land vehicles really are. Which gap surprised you?',tags:['land vehicle speed','speed comparison','Bugatti Chiron','Thrust SSC'],hashtags:['#Shorts','#SpeedComparison','#LandVehicles']};
const config={privacy:'private' as const,madeForKids:false,containsSyntheticMedia:true};
const temporary=()=>mkdtempSync(path.join(tmpdir(),'youtube-copy-'));

test('one budgeted request writes relevant metadata from final objects and reuses it without altering the video',async()=>{
 const root=temporary(),source=data(),original=structuredClone(source);let calls=0;
 try{
  const budget=budgetClient({chat:async request=>{calls++;assert.equal(request.stageLabel,'youtube-metadata');assert.equal(request.max_completion_tokens,1400);assert.equal(request.tools,undefined);const input=JSON.parse(request.messages[1].content);assert.equal(input.video.objectCount,3);assert.equal(input.video.approximate,true);assert.match(input.video.visualStyle,/bars/);assert.deepEqual(input.objects.map((i:any)=>i.name),source.items.map(i=>i.label));return {usage:{total_tokens:850},choices:[{message:{content:JSON.stringify({...draft,status:{privacyStatus:'public'}})}}]};}},automationConfigSchema.parse({niche:'Silent comparisons with readable metadata',allowedMetrics:['speed'],assetProvider:'unused'}));
  const options={directory:root,client:budget,model:'test',log:()=>{}};
  const copy=await ensureYouTubeMetadata(source,options);
  assert.deepEqual(copy,draft);assert.equal(calls,1);assert.equal(budget.usage().stageRequests,1);assert.equal(budget.usage().reportedTokens,850);
  assert.deepEqual(await ensureYouTubeMetadata(source,options),draft);assert.equal(calls,1);
  const metadata=makeYouTubeMetadata(source,config,cachedYouTubeCopy(source,root));
  assert.equal(metadata.snippet.title,draft.title);assert.match(metadata.snippet.description,/Compare a road scooter/);assert.match(metadata.snippet.description,/Approximate illustrative values estimated by AI/);
  assert.match(metadata.snippet.description,/#Shorts #SpeedComparison #LandVehicles/);assert.equal(metadata.status.privacyStatus,'private');assert.deepEqual(source,original);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('changed final objects invalidate the cache and cannot reintroduce stale copy',async()=>{
 const root=temporary();let calls=0;
 try{
  const options={directory:root,model:'test',log:()=>{},client:{chat:async()=>{calls++;return {choices:[{message:{content:JSON.stringify(draft)}}]};}}};
  await ensureYouTubeMetadata(data(),options);
  const changed=data();changed.items=changed.items.slice(0,2);
  assert.equal(cachedYouTubeCopy(changed,root),undefined);
  await ensureYouTubeMetadata(changed,{...options,client:{chat:async request=>{calls++;assert.equal(JSON.parse(request.messages[1].content).objects.some((i:any)=>i.name==='Thrust SSC'),false);return {choices:[{message:{content:JSON.stringify({...draft,title:'Scooter vs Bugatti: how big is the speed gap?',description:'Compare the speed of a road scooter and Bugatti Chiron.'})}}]};}}});
  assert.equal(calls,2);assert.doesNotMatch(cachedYouTubeCopy(changed,root)!.title,/Thrust/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('quota, budget and malformed copy fall back once and never block or repeatedly call Groq',async()=>{
 for(const mode of ['quota','budget','malformed']){
  const root=temporary();let calls=0;
  try{
   const options={directory:root,model:'test',log:()=>{},client:{chat:async()=>{calls++;if(mode!=='malformed')throw Error(mode==='quota'?'HTTP 429 tokens per day':'Automation usage budget reached');return {choices:[{message:{content:'not JSON'}}]};}}};
   const source=data(),copy=await ensureYouTubeMetadata(source,options);
   assert.equal(copy.title,source.title);assert.match(copy.description,/Measurement basis:/);assert.equal(JSON.parse(readFileSync(path.join(root,'youtube-metadata.json'),'utf8')).status,'fallback');
   await ensureYouTubeMetadata(source,options);assert.equal(calls,1);
   assert.equal(makeYouTubeMetadata(source,config,copy).status.privacyStatus,'private');
  }finally{rmSync(root,{recursive:true,force:true});}
 }
});

test('optional metadata defects are normalized locally without extra model requests',async()=>{
 const root=temporary();let calls=0;
 try{
  const copy=await ensureYouTubeMetadata(data(),{directory:root,model:'test',log:()=>{},client:{chat:async()=>{calls++;return {choices:[{message:{content:JSON.stringify({title:'x'.repeat(101),description:draft.description,tags:['speed comparison','SPEED COMPARISON',null,...Array.from({length:20},(_,i)=>'keyword '+i)],hashtags:['Shorts','#shorts','#Viral','#SpeedComparison','#LandVehicles','#UnrelatedFourth'],extra:'ignored'})}}]};}}});
  assert.equal(copy.title,data().title);assert.equal(copy.description,draft.description);assert.equal(copy.tags.filter(t=>t.toLowerCase()==='speed comparison').length,1);assert.equal(copy.tags.length,10);assert.deepEqual(copy.hashtags,['#Shorts','#SpeedComparison','#LandVehicles']);assert.equal(calls,1);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('upload preparation freezes generated metadata; sending uses the frozen copy without any Groq request',async()=>{
 const root=temporary();let calls=0;let received:any;
 try{
  const job=jobSchema.parse({id:'short-metadata-test',topic:'Original topic',metric:'speed',scopeKey:'test-speed',entityKeys:[],status:'rendered',attempts:1,createdAt:'2026-11-24T00:00:00Z',updatedAt:'2026-11-24T00:00:00Z',videoSha256:'f'.repeat(64)});
  const ledger=ledgerSchema.parse({version:1,queue:[],jobs:[job]}),active=ledger.jobs[0],directory=path.join(root,'out/comparisons',job.id);mkdirSync(directory,{recursive:true});writeFileSync(path.join(directory,'dataset.json'),JSON.stringify(data()));
  const {sizeDatasetSchema}=await import('../src/shorts/size-data');const source=sizeDatasetSchema.parse(data());
  await ensureYouTubeMetadata(source,{directory,model:'test',log:()=>{},client:{chat:async()=>{calls++;return {choices:[{message:{content:JSON.stringify(draft)}}]};}}});
  const channelId='UC'+'a'.repeat(22),fullConfig={...config,clientId:'test',clientSecret:'test',refreshToken:'test',channelId,notifySubscribers:false};
  const stateFile=path.join(root,'.automation/state.json');saveLedger(stateFile,ledger);
  const context={root,ledger,stateFile,job:active,config:fullConfig,verify:()=>({file:'unused',props:'unused',sha256:'f'.repeat(64),info:{}}),client:{checkChannel:async()=>({id:channelId,title:'test'}),upload:async(_file:string,metadata:any)=>{received=metadata;return {videoId:'abcdefghijk',url:'https://www.youtube.com/shorts/abcdefghijk',privacy:'private' as const,channelId};}}};
  assert.equal((await prepareYouTubeJob(context)).status,'prepared');
  assert.equal((await sendYouTubeJob(context)).status,'uploaded');
  assert.equal(calls,1);assert.equal(received.snippet.title,draft.title);assert.deepEqual(received.snippet.tags,draft.tags);assert.equal(received.status.privacyStatus,'private');
 }finally{rmSync(root,{recursive:true,force:true});}
});
