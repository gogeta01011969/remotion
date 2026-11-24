import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,chmodSync,mkdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {CloudflareImageRejectedError,generateCloudflareImage} from '../src/pipeline/cloudflare-images';
import {buildSimpleComparison} from '../src/pipeline/simple-comparison';
import {assetRequests,applyAssetManifest} from '../src/pipeline/comparison-run';
import {prepareComparisonAssets} from '../src/pipeline/comparison-assets';
import {defaultSizeEpisode,compileSizeComparison} from '../src/pipeline/size-comparison';
import {makeYouTubeMetadata} from '../src/pipeline/youtube';
import {fixturePng} from './helpers/png';

const data=()=>buildSimpleComparison({title:'Which is faster: a scooter or Eurostar train?',metric:'speed',unit:'km/h',objects:[{name:'Road scooter',value:30},{name:'Race bike',value:100},{name:'Speed car',value:250},{name:'Eurostar train',value:320}]},{id:'rejection-test',topic:'Synthetic vehicle-speed image recovery test'});

test('Cloudflare moderation refusal is typed and never retried or rewritten',async()=>{
 let calls=0;
 await assert.rejects(()=>generateCloudflareImage({model:'flux-2-klein-4b',steps:4,prompt:'A passenger train'}, {accountId:'test',apiToken:'test'},async()=>{calls++;return new Response(JSON.stringify({success:false,errors:[{code:3030,message:'Your output has been flagged'}]}),{status:400});}),CloudflareImageRejectedError);
 assert.equal(calls,1);
});

test('explicit rejected objects may be omitted; missing, conflicting and unrelated manifest entries still fail',()=>{
 const source=data(),assets=source.items.slice(0,3).map(i=>({id:i.id,src:`${i.id}.png`}));
 const next=applyAssetManifest(source,{assets,skipped:[{id:source.items[3].id,reason:'provider-rejected',code:3030}]});
 assert.equal(next.items.length,3);assert.equal(next.items.at(-1)!.label,'Speed car');assert.doesNotMatch(next.title,/Eurostar/);
 assert.equal(source.items.length,4);
 assert.throws(()=>applyAssetManifest(source,{assets}),/exactly one/);
 assert.throws(()=>applyAssetManifest(source,{assets,skipped:[{id:assets[0].id,reason:'provider-rejected',code:3030}]}),/exactly one/);
 assert.throws(()=>applyAssetManifest(source,{assets,skipped:[{id:'unknown',reason:'provider-rejected',code:3030}]}),/exactly one/);
 assert.throws(()=>applyAssetManifest(source,{assets:assets.slice(0,1),skipped:source.items.slice(1).map(i=>({id:i.id,reason:'provider-rejected',code:3030}))}),/at least two/);
});

test('real provider subprocess finishes a reduced comparison, caches the refusal and compiles accurate render/upload inputs',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'provider-rejection-'));
 try{
  const raw=fixturePng(24,24,(x,y)=>x>4&&x<20&&y>4&&y<20?[80,160,200,255]:[0,0,0,0]);
  writeFileSync(path.join(root,'sample.png'),raw);
  const calls=path.join(root,'calls.txt'),preload=path.join(root,'mock-fetch.mjs'),python=path.join(root,'mock-python');
  writeFileSync(preload,`import fs from 'node:fs';globalThis.fetch=async(_url,request)=>{const prompt=request.body.get('prompt');fs.appendFileSync(${JSON.stringify(calls)},prompt+'\\n');if(process.env.TEST_PROVIDER_DENIED)return new Response(JSON.stringify({success:false,errors:[{code:10000,message:'Authentication failed'}]}),{status:401});if(prompt.startsWith('Subject: Eurostar train.'))return new Response(JSON.stringify({success:false,errors:[{code:3030,message:'Your output has been flagged'}]}),{status:400});return new Response(JSON.stringify({result:{image:fs.readFileSync(${JSON.stringify(path.join(root,'sample.png'))}).toString('base64')}}),{headers:{'cf-ai-neurons':'104.2'}});};`);
  writeFileSync(python,`#!${process.execPath}\nconst fs=require('fs');const file=process.argv[process.argv.indexOf('--batch')+1];for(const pair of JSON.parse(fs.readFileSync(file)))fs.copyFileSync(pair.input,pair.output);`);chmodSync(python,0o755);
  const assets=path.join(root,'assets');mkdirSync(assets);
  const request=path.join(root,'request.json'),manifest=path.join(root,'asset-manifest.json');
  writeFileSync(request,JSON.stringify({...assetRequests(data()),outputDirectory:assets}));
  const args=['--import','tsx','--import',preload,'scripts/cloudflare-asset-provider.ts','--background-removal','rembg','--python',python,request,manifest];
  const env={...process.env,CLOUDFLARE_ACCOUNT_ID:'test-no-network',CLOUDFLARE_API_TOKEN:'test-no-network'};
  const first=spawnSync(process.execPath,args,{encoding:'utf8',timeout:30000,env});
  assert.equal(first.status,0,first.stderr);assert.match(first.stdout,/omitting the object/);
  const result=JSON.parse(readFileSync(manifest,'utf8'));assert.equal(result.assets.length,3);assert.equal(result.skipped.length,1);
  const repeated=spawnSync(process.execPath,args,{encoding:'utf8',timeout:30000,env});assert.equal(repeated.status,0,repeated.stderr);
  assert.equal(readFileSync(calls,'utf8').trim().split('\n').length,4,'Resume must reuse both successful images and the rejected-image receipt');
  assert.equal(JSON.parse(readFileSync(path.join(assets,'generation-summary.json'),'utf8')).newNeuronsThisInvocation,0);
  const prepared=prepareComparisonAssets(applyAssetManifest(data(),result),{root,assetRoot:assets,runId:'rejection-test'});
  const brief=compileSizeComparison(prepared,defaultSizeEpisode(prepared));assert.equal(brief.scenes.length,3);assert.doesNotMatch(JSON.stringify(brief),/Eurostar/);
  const metadata=makeYouTubeMetadata(prepared,{privacy:'private',madeForKids:false,containsSyntheticMedia:true});assert.doesNotMatch(JSON.stringify(metadata),/Eurostar/);
  // Other provider failures must not be silently treated as image moderation.
  const denied=path.join(root,'denied');mkdirSync(denied);writeFileSync(request,JSON.stringify({...assetRequests(data()),outputDirectory:denied}));rmSync(manifest);
  const failure=spawnSync(process.execPath,args,{encoding:'utf8',timeout:30000,env:{...env,TEST_PROVIDER_DENIED:'true'}});
  assert.equal(failure.status,1);assert.match(failure.stderr,/HTTP 401/);assert.equal(existsSync(manifest),false);
 }finally{rmSync(root,{recursive:true,force:true});}
});
