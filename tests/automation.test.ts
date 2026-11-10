import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {automationConfigSchema,ledgerSchema,jobSchema,canonicalTopic,duplicateReason,reserveTopic,saveLedger,lockAutomation,budgetClient,AutomationDeferredError,type TopicLedger} from '../src/pipeline/topic-automation';
import {createAutomationVideo,digest,confirmArchive,cleanupJob,stageCheckpoint,restoreCheckpoint,runPaths} from '../src/pipeline/automation-run';
import {GitHubStateStore} from '../src/pipeline/github-state';
import {cutoutBackend,cutoutMethod,removalCommand} from '../src/pipeline/background-removal';
import {sizeDatasetSchema} from '../src/shorts/size-data';
const now='2026-11-10T00:00:00.000Z';
const config=automationConfigSchema.parse({niche:'Silent physical comparisons',allowedMetrics:['height','wingspan','volume'],assetProvider:'unused.json'});
const job=()=>jobSchema.parse({id:'short-test-123',topic:'A new synthetic height ladder',metric:'height',scopeKey:'synthetic-ladder',entityKeys:['one','two','three','four'],status:'reserved',attempts:0,createdAt:now,updatedAt:now});
const empty=():TopicLedger=>({version:1,jobs:[],queue:[]});
const data=()=>sizeDatasetSchema.parse({template:'size-comparison',id:'synthetic-data',title:'A useful synthetic comparison',metric:'height',unit:'m',basis:'Synthetic test dimensions only',context:'Lifecycle test',items:[1,2,4,8].map((value,i)=>({id:`item-${i}`,label:`Reference ${i}`,value,color:'#AABBCC',sourceIds:['s1'],visual:{kind:'box',widthToHeight:1,depthToHeight:1}})),sources:[{id:'s1',title:'Synthetic source',url:'https://example.com'}]});
const proposals=[
 {topic:'How tall are iconic towers compared?',metric:'height',scopeKey:'iconic-structure-heights',entityKeys:['Eiffel','Burj','Shanghai','Skytree'],whyInteresting:'Use familiar landmarks to make extreme heights relatable.'},
 {topic:'Which flying objects have the widest wings?',metric:'wingspan',scopeKey:'extended-flight-wings',entityKeys:['Bee','Albatross','Cessna','A380'],whyInteresting:'A familiar flying animal connects to giant aircraft wings.'},
 {topic:'How much can familiar containers hold?',metric:'volume',scopeKey:'nominal-storage-capacity',entityKeys:['Bottle','Drum','IBC','Cargo'],whyInteresting:'Show surprising differences using equivalent-capacity cubes.'}
];
test('de-duplication catches rewritten titles, stable scopes and reordered near-identical object sets',()=>{
  assert.equal(canonicalTopic('World’s tallest statues'),canonicalTopic('Compare the highest statues in the world'));
  const old={...job(),topic:'World’s tallest statues',entityKeys:['a','b','c','d','e','f','g','h'],status:'complete' as const};
  const ledger={...empty(),jobs:[old]};
  assert.ok(duplicateReason({...old,topic:'Compare the highest statues in the world'},ledger));
  assert.ok(duplicateReason({...old,topic:'Different title',entityKeys:[],scopeKey:old.scopeKey},ledger));
  assert.ok(duplicateReason({...old,topic:'A very different title',scopeKey:'other',entityKeys:['g','f','e','d','c','b','a','x']},ledger));
  assert.equal(duplicateReason({...old,topic:'Truly different subjects',scopeKey:'different',entityKeys:['new1','new2','new3','new4']},ledger),null);
});
test('topic proposals are queued, rotated and reserved without repeating model calls',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'topic-queue-'));let calls=0;const ledger=empty();
  try{
    const options={ledger,config,root,directory:root,now,model:'test',log:()=>{},client:{chat:async()=>{calls++;return {choices:[{message:{content:JSON.stringify({candidates:proposals})}}]};}}};
    const first=await reserveTopic(options);assert.equal(first.metric,'height');first.status='complete';
    const second=await reserveTopic(options);assert.equal(second.metric,'wingspan');assert.equal(calls,1);assert.notEqual(first.id,second.id);
    const resumed=await reserveTopic(options);assert.equal(resumed.id,second.id);assert.equal(calls,1);
    await assert.rejects(()=>reserveTopic({...options,topic:first.topic}),/Same normalized topic/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('quota backoff avoids generating another automatic topic and stage budgets stop new requests',async()=>{
  const ledger={...empty(),jobs:[{...job(),status:'retry-later' as const,retryAt:'2026-11-11T00:00:00.000Z'}]};let calls=0;
  const client={chat:async()=>{calls++;return {usage:{total_tokens:2000},choices:[{message:{content:'{}'}}]};}};
  await assert.rejects(()=>reserveTopic({ledger,config,root:'.',directory:'.',now,client,model:'test',log:()=>{}}),AutomationDeferredError);assert.equal(calls,0);
  const budget=budgetClient(client,{...config,maxStageRequests:1,maxReportedTokens:1000});const request={model:'test',messages:[],max_completion_tokens:10,temperature:0};
  await budget.chat(request);await assert.rejects(()=>budget.chat(request),/budget/);assert.equal(calls,1);assert.equal(budget.usage().reportedTokens,2000);
});
test('actual researched object-set duplicates stop before asset creation or rendering',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'actual-duplicate-')),current=job(),old={...job(),id:'short-old-123',topic:'Earlier useful comparison',scopeKey:'older-scope',status:'complete' as const,actualEntityKeys:data().items.map(i=>i.label)};
  const ledger={...empty(),jobs:[old,current]};let builds=0;
  try{
    const result=await createAutomationVideo({root,stateFile:path.join(root,'state.json'),ledger,job:current,config,archiveTarget:'github',client:{chat:async()=>{throw new Error('unexpected API');}},groqConfig:{apiKey:'test',researchModel:'test',scriptModel:'test',motionModel:'test'},log:()=>{}},{generateData:async()=>data(),build:async()=>{builds++;}});
    assert.equal(result.status,'skipped-duplicate');assert.equal(builds,0);
  }finally{rmSync(root,{recursive:true,force:true});}
});
function lifecycle(root:string){
  const current=job(),ledger={...empty(),jobs:[current]};let builds=0,generations=0;
  const file=path.join(root,'out/shorts',current.id,`${current.id}.mp4`),props=path.join(root,'public/shorts',current.id,'video.json');
  const options={root,stateFile:path.join(root,'state.json'),ledger,job:current,config,archiveTarget:'github' as const,client:{chat:async()=>{throw new Error('unexpected API');}},groqConfig:{apiKey:'test',researchModel:'test',scriptModel:'test',motionModel:'test'},log:()=>{}};
  const dependencies={generateData:async()=>{generations++;return data();},build:async()=>{builds++;mkdirSync(path.dirname(file),{recursive:true});mkdirSync(path.dirname(props),{recursive:true});writeFileSync(file,'synthetic-video');writeFileSync(props,'{}');},verify:()=>({file,props,sha256:digest(file),info:{}}),fingerprint:()=> 'source-version'};
  return {current,ledger,options,dependencies,counts:()=>({builds,generations})};
}
test('archive failure resumes a verified render without new generation; completion precedes cleanup',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'archive-lifecycle-')),run=lifecycle(root);
  try{
    const result=await createAutomationVideo(run.options,run.dependencies);assert.equal(result.status,'rendered');
    assert.throws(()=>cleanupJob(root,run.current.id,run.ledger),/Archive confirmation/);
    const staged=stageCheckpoint(root,run.current.id);assert.ok(existsSync(path.join(staged,'checkpoint.json')));
    const second=await createAutomationVideo(run.options,run.dependencies);assert.equal(second.status,'rendered');assert.deepEqual(run.counts(),{builds:1,generations:1});
    confirmArchive(run.current,'123456');saveLedger(run.options.stateFile,run.ledger);cleanupJob(root,run.current.id,run.ledger);
    assert.ok(!existsSync(path.join(root,'out/shorts',run.current.id)));
    assert.ok(existsSync(path.join(root,'out/automation/delivery',run.current.id,`${run.current.id}.mp4`)));
    assert.equal(ledgerSchema.parse(JSON.parse(readFileSync(run.options.stateFile,'utf8'))).jobs[0].status,'complete');
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('failure state is resumable and archive-only runs refuse missing or changed checkpoints',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'retry-lifecycle-')),run=lifecycle(root);
  try{
    await assert.rejects(()=>createAutomationVideo(run.options,{...run.dependencies,generateData:async()=>{throw new Error('HTTP 429 quota');}}),/quota/);
    assert.equal(run.current.status,'retry-later');assert.ok(run.current.retryAt);
    run.current.status='rendered';run.current.videoSha256='old';const before=run.current.attempts;
    await assert.rejects(()=>createAutomationVideo(run.options,run.dependencies),/checkpoint restored/);assert.equal(run.current.status,'needs-review');assert.equal(run.current.attempts,before);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('checkpoints restore only their own generated paths and cleanup rejects symlink ancestors',()=>{
  const root=mkdtempSync(path.join(tmpdir(),'checkpoint-target-')),source=mkdtempSync(path.join(tmpdir(),'checkpoint-source-'));
  try{
    const id=job().id;mkdirSync(path.join(source,'out/comparisons',id),{recursive:true});writeFileSync(path.join(source,'out/comparisons',id,'safe.json'),'{}');
    mkdirSync(path.join(source,'src'));writeFileSync(path.join(source,'src','untrusted.ts'),'bad');writeFileSync(path.join(source,'checkpoint.json'),JSON.stringify({version:1,jobId:id}));
    restoreCheckpoint(root,id,source);assert.ok(existsSync(path.join(root,'out/comparisons',id,'safe.json')));assert.ok(!existsSync(path.join(root,'src/untrusted.ts')));
    assert.throws(()=>runPaths(root,'../../private'),/Invalid/);
    rmSync(path.join(root,'out'),{recursive:true});symlinkSync(source,path.join(root,'out'));assert.throws(()=>runPaths(root,id),/symlinks/);
  }finally{rmSync(root,{recursive:true,force:true});rmSync(source,{recursive:true,force:true});}
});
test('local automation locking prevents overlapping workers',()=>{
  const root=mkdtempSync(path.join(tmpdir(),'automation-lock-'));try{const unlock=lockAutomation(root);assert.throws(()=>lockAutomation(root),/holds the lock/);unlock();lockAutomation(root)();}finally{rmSync(root,{recursive:true,force:true});}
});
test('Linux selects only local CPU cutout backends and preserves explicit macOS compatibility',()=>{
  assert.equal(cutoutBackend('auto','linux'),'rembg');assert.equal(cutoutBackend('auto','darwin'),'vision');assert.throws(()=>cutoutBackend('vision','linux'),/macOS/);
  assert.throws(()=>cutoutMethod('rembg','withoutbg'),/Only local/);
  assert.deepEqual(removalCommand('/repo','python','/repo/batch.json','isnet-general-use').args,['/repo/scripts/remove-image-background.py','--batch','/repo/batch.json','--model','isnet-general-use']);
});
test('GitHub state bootstrap is atomic and saves use optimistic SHA checks',async()=>{
  const calls:{url:string;method:string;body:any}[]=[];
  const store=new GitHubStateStore({repository:'owner/repo',token:'secret-token',baseCommit:'a'.repeat(40),fetcher:async(url,init)=>{
    const route=String(url).replace('https://api.github.com/repos/owner/repo',''),method=init?.method??'GET',body=init?.body?JSON.parse(String(init.body)):null;calls.push({url:route,method,body});assert.ok(!String(init?.body).includes('secret-token'));
    if(route.startsWith('/git/ref/'))return Response.json({}, {status:404});
    if(route.startsWith('/git/commits/')&&method==='GET')return Response.json({tree:{sha:'tree0'}});
    if(route==='/git/blobs')return Response.json({sha:'blob1'});
    if(route==='/git/trees')return Response.json({sha:'tree1'});
    if(route==='/git/commits')return Response.json({sha:'commit1'});
    if(route==='/git/refs')return Response.json({});
    return Response.json({content:{sha:'blob2'}});
  }});
  const loaded=await store.load();assert.equal(loaded.ledger,null);const snapshot=await store.save(empty(),loaded.snapshot);assert.equal(snapshot.sha,'blob1');assert.equal(calls.at(-1)!.url,'/git/refs');
  await store.save(empty(),snapshot);assert.equal(calls.at(-1)!.body.sha,'blob1');
  const conflict=new GitHubStateStore({repository:'owner/repo',token:'secret',baseCommit:'a'.repeat(40),fetcher:async()=>Response.json({}, {status:409})});
  await assert.rejects(()=>conflict.save(empty(),{sha:'old',exists:true}),/not reset or overwritten/);
});
test('an existing state branch with a missing ledger fails closed instead of forgetting history',async()=>{
  let calls=0;const store=new GitHubStateStore({repository:'owner/repo',token:'secret',baseCommit:'a'.repeat(40),fetcher:async()=>++calls===1?Response.json({}):Response.json({}, {status:404})});
  await assert.rejects(()=>store.load(),/not reset or overwritten/);assert.equal(calls,2);
});
