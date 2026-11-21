import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {cutoutEdgeCount,framingRepairPrompt,reviewCutoutFraming} from '../src/pipeline/cutout-framing';
import {cloudflareObjectPrompt} from '../src/pipeline/comparison-images';
import {fixturePng} from './helpers/png';
const calibration={pixelWidth:100,pixelHeight:100,bounds:{x:30,y:0,width:40,height:100},coverage:.5,sha256:'a'.repeat(64)};

test('a usable edge-touching cutout continues with a warning when repair is unavailable or fails',async()=>{
  for(const retry of [undefined,async()=>{throw new Error('Provider unavailable');}]){
    const warnings:string[]=[];
    assert.deepEqual(await reviewCutoutFraming({label:'Tree',calibration,retry,warn:m=>warnings.push(m)}),calibration);
    assert.ok(warnings.some(m=>m.includes('possible clipping')));
  }
});
test('framing retry is optional, attempted once, and a repaired cutout needs no edge warning',async()=>{
  const warnings:string[]=[];let requests=0;
  const fixed={...calibration,bounds:{x:30,y:10,width:40,height:80}};
  const result=await reviewCutoutFraming({label:'Tree',calibration,retry:async()=>{requests++;return fixed;},warn:m=>warnings.push(m)});
  assert.equal(requests,1);assert.equal(cutoutEdgeCount(result),0);assert.equal(warnings.length,0);
  await reviewCutoutFraming({label:'Tree',calibration:fixed,retry:async()=>{throw new Error('Should not regenerate a clean asset');},warn:m=>warnings.push(m)});
  const prompt=framingRepairPrompt('Identity details '.repeat(200));
  assert.ok(prompt.startsWith('FRAMING:'));assert.ok(prompt.includes('ALL FOUR sides'));assert.ok(prompt.length<=2048);
});
test('Cloudflare provider resumes a cached edge-touching asset into a usable manifest without another provider request',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'cutout-framing-'));
  try{
    const raw=fixturePng(24,24,(x,y)=>x>7&&x<17?[80,180,90,255]:[0,0,0,0]);
    const rawHash=createHash('sha256').update(raw).digest('hex');
    const method='rembg-2.0.87/isnet-general-use/CPU/'+createHash('sha256').update(readFileSync('scripts/remove-image-background.py')).digest('hex').slice(0,12);
    const visual={kind:'cutout',src:'tree.png',view:'front',attribution:'Synthetic test asset',referenceUrls:['https://example.com/tree'],generation:{prompt:'Synthetic tall tree for a local framing regression test.'}};
    writeFileSync(path.join(directory,'tree.jpg'),raw);writeFileSync(path.join(directory,'tree.png'),raw);
    writeFileSync(path.join(directory,'tree.jpg.report.json'),JSON.stringify({model:'flux-2-klein-4b',steps:4,prompt:cloudflareObjectPrompt('Tree','cutout',visual.generation.prompt,'front'),width:1024,height:1024,actualNeurons:104.2,elapsedSeconds:1}));
    writeFileSync(path.join(directory,'tree.png.receipt.json'),JSON.stringify({rawHash,method}));
    writeFileSync(path.join(directory,'tree.png.framing-repair.json'),JSON.stringify({rawHash,attempted:true}));
    const request=path.join(directory,'request.json'),manifest=path.join(directory,'asset-manifest.json');
    writeFileSync(request,JSON.stringify({outputDirectory:directory,objects:[{id:'tree',label:'Tree',visual}]}));
    const run=spawnSync(process.execPath,['--import','tsx','scripts/cloudflare-asset-provider.ts','--background-removal','rembg',request,manifest],{encoding:'utf8',timeout:30000,env:{...process.env,CLOUDFLARE_ACCOUNT_ID:'test-no-network',CLOUDFLARE_API_TOKEN:'test-no-network'}});
    assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/Reusing Tree generation/);assert.doesNotMatch(run.stdout,/Retrying|Generating Tree/);
    assert.equal(JSON.parse(readFileSync(manifest,'utf8')).assets.length,1);
    assert.ok(JSON.parse(readFileSync(path.join(directory,'quality-warnings.json'),'utf8')).warnings.some((m:string)=>m.includes('image edge')));
    assert.equal(JSON.parse(readFileSync(path.join(directory,'generation-summary.json'),'utf8')).newNeuronsThisInvocation,0);
    // A genuinely unusable asset still fails rather than rendering an empty object.
    const empty=fixturePng(24,24,()=>[0,0,0,0]);writeFileSync(path.join(directory,'tree.png'),empty);
    const invalid=spawnSync(process.execPath,['--import','tsx','scripts/cloudflare-asset-provider.ts','--background-removal','rembg',request,manifest],{encoding:'utf8',timeout:30000,env:{...process.env,CLOUDFLARE_ACCOUNT_ID:'test-no-network',CLOUDFLARE_API_TOKEN:'test-no-network'}});
    assert.equal(invalid.status,1);assert.match(invalid.stderr,/completely transparent/);
    // Exercise the actual retry, receipt updates and checkpoint reuse without
    // network or an installed background-removal model.
    const preload=path.join(directory,'mock-fetch.mjs'),python=path.join(directory,'mock-python');
    const repaired=fixturePng(24,24,(x,y)=>x>7&&x<17&&y>3&&y<21?[80,180,90,255]:[0,0,0,0]);
    writeFileSync(preload,`import fs from 'node:fs';globalThis.fetch=async()=>{fs.appendFileSync(${JSON.stringify(path.join(directory,'requests.txt'))},'request\\n');return new Response(JSON.stringify({result:{image:fs.readFileSync(${JSON.stringify(path.join(directory,'repair.png'))}).toString('base64')}}),{status:200,headers:{'cf-ai-neurons':'104.2'}});};`);
    writeFileSync(python,`#!${process.execPath}\nconst fs=require('fs');const batch=process.argv[process.argv.indexOf('--batch')+1];for(const pair of JSON.parse(fs.readFileSync(batch)))fs.copyFileSync(pair.input,pair.output);`);chmodSync(python,0o755);
    for(const [bytes,expectWarning] of [[empty,true],[repaired,false]] as const){
      writeFileSync(path.join(directory,'tree.png'),raw);writeFileSync(path.join(directory,'repair.png'),bytes);
      rmSync(path.join(directory,'tree.png.framing-repair.json'));rmSync(path.join(directory,'quality-warnings.json'),{force:true});
      const args=['--import','tsx','--import',preload,'scripts/cloudflare-asset-provider.ts','--background-removal','rembg','--python',python,request,manifest];
      const env={...process.env,CLOUDFLARE_ACCOUNT_ID:'test-no-network',CLOUDFLARE_API_TOKEN:'test-no-network'};
      const retry=spawnSync(process.execPath,args,{encoding:'utf8',timeout:30000,env});
      assert.equal(retry.status,0,retry.stderr);assert.match(retry.stdout,/Retrying Tree framing/);
      assert.equal(retry.stdout.includes('possible clipping'),expectWarning);
      const summary=JSON.parse(readFileSync(path.join(directory,'generation-summary.json'),'utf8'));
      assert.equal(summary.newNeuronsThisInvocation,104.2);assert.equal(summary.totalReportedNeurons,208.4);
      const resumed=spawnSync(process.execPath,args,{encoding:'utf8',timeout:30000,env});
      assert.equal(resumed.status,0,resumed.stderr);assert.doesNotMatch(resumed.stdout,/Retrying|Generating Tree/);
      assert.equal(JSON.parse(readFileSync(path.join(directory,'generation-summary.json'),'utf8')).newNeuronsThisInvocation,0);
    }
    assert.equal(readFileSync(path.join(directory,'requests.txt'),'utf8').trim().split('\n').length,2);

  }finally{rmSync(directory,{recursive:true,force:true});}
});
