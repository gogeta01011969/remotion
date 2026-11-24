import {spawn,spawnSync} from 'node:child_process';
import {statSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,writeFileSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import mass from '../comparisons/examples/mass.json';
import {YouTubeClient,loadYouTubeConfig,makeYouTubeMetadata,type YouTubeConfig} from '../src/pipeline/youtube';
import {prepareYouTubeJob,sendYouTubeJob} from '../src/pipeline/youtube-job';
import {jobSchema,ledgerSchema,saveLedger} from '../src/pipeline/topic-automation';

const channelId='UC'+'a'.repeat(22),videoId='abcdefghijk';
const config:YouTubeConfig={clientId:'test-client',clientSecret:'test-secret',refreshToken:'test-refresh',channelId,privacy:'private',madeForKids:false,containsSyntheticMedia:true,notifySubscribers:false};
const data={title:'Which animal lives longer?',context:'Compare documented lifespans.',basis:'Typical lifespan in years.',sources:[{title:'Reference',url:'https://example.com/research'}],items:[{label:'Mouse',visual:{kind:'cutout',attribution:'AI-generated illustrative cutout.',referenceUrls:['https://example.com/research']}}]};
const metadata=()=>makeYouTubeMetadata(data,config);
const json=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});
const uploaded=()=>json({id:videoId,snippet:{channelId},status:{privacyStatus:'private'}},201);
function mockClient(handler:(url:string,init:RequestInit)=>Promise<Response>|Response){
  return new YouTubeClient(config,{sleep:async()=>{},fetcher:async(input,init)=>{
    const url=String(input);
    if(url==='https://oauth2.googleapis.com/token'){assert.ok(String(init?.body).includes('grant_type=refresh_token'));return json({access_token:'test-access-token'});}
    if(url.includes('/channels?'))return json({items:[{id:channelId,snippet:{title:'Test channel'}}]});
    return handler(url,init!);
  }});
}
function videoFile(bytes=8){const root=mkdtempSync(path.join(tmpdir(),'youtube-client-')),file=path.join(root,'video.mp4');writeFileSync(file,Buffer.alloc(bytes,9));return {root,file};}

test('YouTube credentials use public production settings and reject ambiguous config',()=>{
  const env={YOUTUBE_CLIENT_ID:'client',YOUTUBE_CLIENT_SECRET:'secret',YOUTUBE_REFRESH_TOKEN:'refresh',YOUTUBE_CHANNEL_ID:channelId};
  const parsed=loadYouTubeConfig('unused',env);assert.equal(parsed.privacy,'public');assert.equal(parsed.containsSyntheticMedia,false);
  assert.equal(makeYouTubeMetadata(data,parsed).status.privacyStatus,'public');
  assert.equal(makeYouTubeMetadata(data,parsed).status.containsSyntheticMedia,false);
  assert.equal(loadYouTubeConfig('unused',{...env,YOUTUBE_PRIVACY_STATUS:'private'}).privacy,'public','Environment settings cannot override production privacy.');
  assert.throws(()=>loadYouTubeConfig('unused',{...env,YOUTUBE_MADE_FOR_KIDS:'yes'}),/true or false/);
  assert.throws(()=>loadYouTubeConfig('unused',{...env,YOUTUBE_CHANNEL_ID:'wrong-channel'}));
  assert.equal(loadYouTubeConfig('unused',{...env,YOUTUBE_CONTAINS_SYNTHETIC_MEDIA:'true'}).containsSyntheticMedia,false);
});
test('upload metadata preserves sources and credit, and rejects oversized descriptions before transfer',()=>{
  const result=metadata();assert.equal(result.status.privacyStatus,'private');assert.equal(result.status.containsSyntheticMedia,true);assert.equal(result.status.selfDeclaredMadeForKids,false);
  assert.ok(result.snippet.description.includes(data.sources[0].url));assert.ok(result.snippet.description.includes(data.items[0].visual.attribution));
  assert.throws(()=>makeYouTubeMetadata({...data,context:'界'.repeat(2000)},config),/5,000/);
  assert.throws(()=>makeYouTubeMetadata({...data,title:'a'.repeat(101)},config));
});
test('uploads use one resumable session with correct chunk offsets and explicit private metadata',async()=>{
  const run=videoFile(8*1024*1024+12);const calls:{method:string;range:unknown;size:number}[]=[];let posts=0;
  const client=mockClient((url,init)=>{
    const headers=init.headers as Record<string,string>;
    if(init.method==='POST'){posts++;assert.ok(url.includes('notifySubscribers=false'));assert.equal(JSON.parse(String(init.body)).status.privacyStatus,'private');return new Response(null,{status:200,headers:{location:'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test'}});}
    calls.push({method:init.method!,range:headers['Content-Range'],size:(init.body as Uint8Array).byteLength});
    if(calls.length===1)return new Response(null,{status:308,headers:{range:`bytes=0-${8*1024*1024-1}`}});
    return uploaded();
  });
  try{
    const result=await client.upload(run.file,metadata());assert.equal(result.videoId,videoId);assert.equal(posts,1);
    assert.deepEqual(calls.map(c=>c.range),[`bytes 0-8388607/8388620`,`bytes 8388608-8388619/8388620`]);assert.deepEqual(calls.map(c=>c.size),[8388608,12]);
  }finally{rmSync(run.root,{recursive:true,force:true});}
});
test('an interrupted final response is resolved by a status probe, without starting a duplicate upload',async()=>{
  const run=videoFile();let posts=0,puts=0;
  const client=mockClient((_url,init)=>{
    if(init.method==='POST'){posts++;return new Response(null,{status:200,headers:{location:'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test'}});}
    puts++;if(puts===1)throw new Error('Socket failed after server accepted the bytes; secret must not be logged.');
    assert.equal((init.headers as Record<string,string>)['Content-Range'],'bytes */8');assert.equal(init.body,undefined);return uploaded();
  });
  try{assert.equal((await client.upload(run.file,metadata())).videoId,videoId);assert.equal(posts,1);assert.equal(puts,2);}finally{rmSync(run.root,{recursive:true,force:true});}
});
test('a transient server failure probes the session and resumes from its acknowledged byte offset',async()=>{
  const run=videoFile();let puts=0,posts=0;
  const client=mockClient((_url,init)=>{
    if(init.method==='POST'){posts++;return new Response(null,{status:200,headers:{location:'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test'}});}
    puts++;if(puts===1)return json({error:'temporary'},503);
    if(puts===2)return new Response(null,{status:308,headers:{range:'bytes=0-3'}});
    assert.equal((init.headers as Record<string,string>)['Content-Range'],'bytes 4-7/8');return uploaded();
  });
  try{assert.equal((await client.upload(run.file,metadata())).videoId,videoId);assert.equal(posts,1);assert.equal(puts,3);}finally{rmSync(run.root,{recursive:true,force:true});}
});
test('wrong channels, unsafe session hosts and uncertain initiation do not send video bytes',async()=>{
  const run=videoFile();let videoRequests=0;
  try{
    const wrong=new YouTubeClient(config,{fetcher:async input=>String(input).includes('/token')?json({access_token:'test'}):json({items:[{id:'UC'+'b'.repeat(22)}]})});
    await assert.rejects(()=>wrong.upload(run.file,metadata()),/does not match/);
    const unsafe=mockClient((_url,init)=>{videoRequests++;assert.equal(init.method,'POST');return new Response(null,{status:200,headers:{location:'https://untrusted.example/upload'}});});
    await assert.rejects(()=>unsafe.upload(run.file,metadata()),/unexpected upload session/);assert.equal(videoRequests,1);
    let initiations=0;const uncertain=mockClient(()=>{initiations++;throw new Error('Private response');});
    await assert.rejects(()=>uncertain.upload(run.file,metadata()),/initiation outcome is uncertain/);assert.equal(initiations,1);
  }finally{rmSync(run.root,{recursive:true,force:true});}
});
test('exhausted transfer retries never start another session and errors do not expose raw provider messages',async()=>{
  const run=videoFile();let posts=0,puts=0;
  const client=mockClient((_url,init)=>{if(init.method==='POST'){posts++;return new Response(null,{status:200,headers:{location:'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=private-session'}});}puts++;return json({error:{message:'secret-content'}},503);});
  try{
    await assert.rejects(()=>client.upload(run.file,metadata()),/three recoveries/);assert.equal(posts,1);assert.equal(puts,3);
    const denied=mockClient(()=>json({error:{message:'test-secret private-session',errors:[{reason:'quotaExceeded'}]}},403));
    await assert.rejects(()=>denied.upload(run.file,metadata()),error=>String(error).includes('quotaExceeded')&&!String(error).includes('test-secret'));
  }finally{rmSync(run.root,{recursive:true,force:true});}
});

function jobFixture(){
  const root=mkdtempSync(path.join(tmpdir(),'youtube-job-')),job=jobSchema.parse({id:'short-youtube-test',topic:'Synthetic upload test',metric:'mass',scopeKey:'upload-test',entityKeys:[],status:'rendered',videoSha256:'f'.repeat(64),attempts:1,createdAt:'2026-11-20T00:00:00Z',updatedAt:'2026-11-20T00:00:00Z'});
  const ledger=ledgerSchema.parse({version:1,queue:[],jobs:[job]}),stateFile=path.join(root,'.automation/state.json'),dir=path.join(root,'out/comparisons',job.id);
  mkdirSync(dir,{recursive:true});writeFileSync(path.join(dir,'dataset.json'),JSON.stringify(mass));saveLedger(stateFile,ledger);
  const active=ledger.jobs[0],file=path.join(root,'video.mp4');writeFileSync(file,'test-video');
  const verify=()=>({file,props:'unused',sha256:'f'.repeat(64),info:{}});
  return {root,job:active,ledger,stateFile,config,verify};
}
test('upload intent is saved before sending; successful uploads are idempotent after local video cleanup',async()=>{
  const run=jobFixture();let sends=0;
  const client={checkChannel:async()=>({id:channelId,title:'Test'}),upload:async()=>{sends++;assert.equal(ledgerSchema.parse(JSON.parse(readFileSync(run.stateFile,'utf8'))).jobs[0].youtube?.status,'uploading');return {videoId,channelId,privacy:'private' as const,url:`https://www.youtube.com/shorts/${videoId}`};}};
  const context={...run,client};
  try{
    assert.equal((await prepareYouTubeJob(context)).status,'prepared');assert.equal(sends,0);
    assert.equal((await sendYouTubeJob(context)).status,'uploaded');assert.equal(sends,1);
    rmSync(path.join(run.root,'video.mp4'));
    assert.equal((await prepareYouTubeJob(context)).status,'already-uploaded');assert.equal((await sendYouTubeJob(context)).status,'already-uploaded');assert.equal(sends,1);
    assert.equal(ledgerSchema.parse(JSON.parse(readFileSync(run.stateFile,'utf8'))).jobs[0].youtube?.videoId,videoId);
  }finally{rmSync(run.root,{recursive:true,force:true});}
});
test('ambiguous or changed upload jobs are held for review rather than automatically reposted',async()=>{
  for(const changed of [false,true]){
    const run=jobFixture();let sends=0;
    const client={checkChannel:async()=>({id:channelId,title:'Test'}),upload:async()=>{sends++;throw new Error('Uncertain completion');}};
    const context={...run,client};
    try{
      await prepareYouTubeJob(context);
      if(changed)run.job.youtube!.videoSha256='different';
      await assert.rejects(()=>sendYouTubeJob(context),changed?/changed after/:/Uncertain completion/);
      assert.equal(sends,changed?0:1);assert.equal(run.job.youtube?.status,'needs-review');
      await assert.rejects(()=>prepareYouTubeJob(context),/earlier upload intent/);
      await assert.rejects(()=>sendYouTubeJob(context),/Prepare and persist/);
    }finally{rmSync(run.root,{recursive:true,force:true});}
  }
});

test('desktop authorization checks OAuth state and PKCE, preserves local settings and never prints tokens',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'youtube-oauth-')),clientFile=path.join(root,'client.json'),envFile=path.join(root,'settings.env'),preload=path.join(root,'mock-google.mjs');
  writeFileSync(clientFile,JSON.stringify({installed:{client_id:'desktop-fixture',client_secret:'desktop-secret'}}));
  writeFileSync(envFile,'GROQCLOUD_API_KEY=keep-existing-fixture-value\n');
  writeFileSync(preload,`globalThis.fetch=async(url,init)=>{
    if(url==='https://oauth2.googleapis.com/token'){
      const body=new URLSearchParams(init.body);
      if(body.get('code')!=='fixture-code'||body.get('code_verifier')?.length!==43||!body.get('redirect_uri')?.startsWith('http://127.0.0.1:'))throw new Error('Invalid authorization exchange');
      return Response.json({access_token:'fixture-access-private',refresh_token:'fixture-refresh-private'});
    }
    if(String(url).startsWith('https://www.googleapis.com/youtube/v3/channels?'))return Response.json({items:[{id:${JSON.stringify(channelId)},snippet:{title:'Fixture channel'}}]});
    throw new Error('Unexpected network request in OAuth fixture');
  };`);
  const child=spawn(process.execPath,['--import','tsx','--import',preload,'scripts/youtube-auth.ts','--client',clientFile,'--env-file',envFile],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
  let output='',errors='',requested=false;
  try{
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('OAuth loopback fixture timed out')),15000);
      child.stderr.on('data',chunk=>{errors+=String(chunk);});
      child.stdout.on('data',chunk=>{
        output+=String(chunk);const match=output.match(/https:\/\/accounts\.google\.com\/[^\s]+/);
        if(!match||requested)return;requested=true;
        void (async()=>{
          const authorization=new URL(match[0]);
          assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
          assert.equal(authorization.searchParams.get('access_type'),'offline');
          assert.ok(authorization.searchParams.get('scope')?.includes('youtube.upload'));
          const callback=new URL(authorization.searchParams.get('redirect_uri')!);
          callback.search=new URLSearchParams({state:'wrong-state',code:'fixture-code'}).toString();
          assert.equal((await fetch(callback)).status,400);
          callback.searchParams.set('state',authorization.searchParams.get('state')!);
          assert.equal((await fetch(callback)).status,200);
        })().catch(error=>{clearTimeout(timer);reject(error);});
      });
      child.on('error',error=>{clearTimeout(timer);reject(error);});
      child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(`OAuth fixture exit ${code}: ${errors}`));});
    });
    const saved=readFileSync(envFile,'utf8');assert.ok(saved.includes('GROQCLOUD_API_KEY=keep-existing-fixture-value'));
    assert.ok(saved.includes('YOUTUBE_REFRESH_TOKEN="fixture-refresh-private"'));assert.ok(saved.includes(channelId));
    assert.equal(statSync(envFile).mode&0o777,0o600);
    assert.ok(!output.includes('fixture-refresh-private'));assert.ok(!output.includes('fixture-access-private'));assert.ok(!output.includes('desktop-secret'));
  }finally{child.kill();rmSync(root,{recursive:true,force:true});}
});

test('a changed delivered video is rejected before authorizing an upload intent',async()=>{
  const run=jobFixture();let requests=0;
  const client={checkChannel:async()=>{requests++;return {id:channelId,title:'Test'};},upload:async()=>{throw new Error('No upload permitted');}};
  try{
    run.job.videoSha256='changed';
    await assert.rejects(()=>prepareYouTubeJob({...run,client}),/verified delivery hash/);
    assert.equal(requests,0);assert.equal(run.job.youtube,undefined);
  }finally{rmSync(run.root,{recursive:true,force:true});}
});

test('Actions reads enabled/public settings without credentials or environment overrides',()=>{
  const root=mkdtempSync(path.join(tmpdir(),'youtube-hardcoded-settings-'));
  try{
    const env={...process.env,GITHUB_OUTPUT:path.join(root,'outputs.txt'),GITHUB_STEP_SUMMARY:path.join(root,'summary.md'),YOUTUBE_UPLOAD_ENABLED:'false',YOUTUBE_PRIVACY_STATUS:'private'};
    for(const key of ['YOUTUBE_CLIENT_ID','YOUTUBE_CLIENT_SECRET','YOUTUBE_REFRESH_TOKEN','YOUTUBE_CHANNEL_ID'])delete (env as NodeJS.ProcessEnv)[key];
    const result=spawnSync(process.execPath,['--import',path.resolve('node_modules/tsx/dist/loader.mjs'),path.resolve('scripts/youtube-upload.ts'),'--settings'],{cwd:root,env,encoding:'utf8',timeout:30000});
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(JSON.parse(result.stdout),{uploadEnabled:true,privacy:'public',containsSyntheticMedia:false});
    assert.equal(readFileSync(env.GITHUB_OUTPUT,'utf8'),'enabled=true\nprivacy=public\n');
    assert.match(readFileSync(env.GITHUB_STEP_SUMMARY,'utf8'),/Uploads: enabled/);
    assert.match(readFileSync(env.GITHUB_STEP_SUMMARY,'utf8'),/Privacy: public/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
