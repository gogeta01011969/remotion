import {mockResearch} from './helpers/mock-research';
import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {sizeDatasetSchema,objectExtent,sizePose,formatSize,formatRatio} from '../src/shorts/size-data';
import {sampleSizeShots} from '../src/shorts/size-shots';
import {planComparisonStory} from '../src/pipeline/comparison-story';
import {compileSizeComparison,defaultSizeEpisode} from '../src/pipeline/size-comparison';
import {prepareComparisonAssets,inspectComparisonImage} from '../src/pipeline/comparison-assets';
import {assetRequests,applyAssetManifest,runAssetProvider,generateComparisonData} from '../src/pipeline/comparison-run';
import {fixturePng} from './helpers/png';
import type {ChatRequest,Completion} from '../src/pipeline/groq';
import {ideaFixture,editorialFixture} from './helpers/comparison-editorial';

const source={id:'reviewed',title:'Fixture dimensions (synthetic test objects)',url:'https://example.com/fixture'};
const calibration={pixelWidth:200,pixelHeight:300,bounds:{x:20,y:30,width:80,height:240},coverage:.5,sha256:'a'.repeat(64)};
const cutout={kind:'cutout' as const,src:'object.png',view:'orthographic' as const,attribution:'Synthetic fixture',referenceUrls:[source.url],calibration};
const dataset=(metric='height',unit='m')=>({template:'size-comparison',id:'arbitrary-subject',title:'Per-run arbitrary objects',context:'Synthetic geometry validation',metric,unit,basis:'Common occupied extent, bases excluded',items:[1,2,8,64].map((value,i)=>({id:`new-object-${i}`,label:`New object ${i}`,value,color:'#AABBCC',sourceIds:[source.id],visual:{...cutout}})),sources:[source]});
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a)),`${a} != ${b}`);

test('arbitrary identities and aspect ratios use the requested linear measurement',()=>{
  for(const metric of ['height','length','width','wingspan'] as const){
    const raw=dataset(metric);if(metric==='wingspan')raw.items.forEach(i=>i.visual.view='top' as 'orthographic');
    raw.items.forEach((item,i)=>item.visual.calibration={...calibration,pixelWidth:300,bounds:{x:0,y:0,width:30+i*70,height:240}});
    const data=sizeDatasetSchema.parse(raw),plan=planComparisonStory(data);
    for(let frame=0;frame<=100;frame++){
      const sample=sampleSizeShots(data.items,plan.shots,frame/100*3,metric);
      for(let i=0;i<4;i++){
        const body=sample.bodies[i];close(body.y+body.height/2,860);
        const dimension=metric==='height'?'height':'width';
        close(body[dimension]/sample.bodies[0][dimension],data.items[i].value/data.items[0].value);
      }
    }
    plan.shots.forEach(shot=>{
      const sample=sizePose(data.items,shot.focus,shot.reference,metric);
      for(const index of [shot.focus,shot.reference]){
        const b=sample.bodies[index];assert.ok(b.x-b.width/2>=39.99&&b.x+b.width/2<=860.01&&b.height<=600.01);
      }
    });
    assert.equal(compileSizeComparison(data,defaultSizeEpisode(data)).actors[0].kind,'size-comparison');
  }
});

test('area uses occupied alpha coverage; volume uses depth and shape fraction',()=>{
  const area=sizeDatasetSchema.parse({...dataset('area','m2'),items:dataset('area','m2').items.map(i=>({...i,visual:{...i.visual,projection:'equal-area'}}))});
  area.items.forEach(item=>{const extent=objectExtent(item,'area');close(extent.width*extent.height*calibration.coverage,item.value);});
  close(objectExtent(area.items[1],'area').height/objectExtent(area.items[0],'area').height,Math.sqrt(2));
  const volume=sizeDatasetSchema.parse({...dataset('volume','m3'),items:dataset().items.map(i=>({...i,visual:{...i.visual,volumeProfile:{depthToHeight:.4,solidFraction:.6}}}))});
  volume.items.forEach(item=>{const extent=objectExtent(item,'volume');close(extent.width*extent.height*(extent.height*.4)*.6,item.value);});
  close(objectExtent(volume.items[2],'volume').height/objectExtent(volume.items[0],'volume').height,2);
  const boxes=sizeDatasetSchema.parse({...dataset('volume','L'),items:dataset().items.map(i=>({...i,visual:{kind:'box',widthToHeight:2,depthToHeight:.5}}))});
  boxes.items.forEach(item=>{const e=objectExtent(item,'volume');close(e.width*e.height*e.height*.5,item.value);});
});

test('ambiguous dimensions, misleading views and unsafe asset references fail validation',()=>{
  for(const raw of [
    {...dataset(),unit:'m2'}, {...dataset('area','m')}, {...dataset('volume','m2')}, {...dataset(),basis:undefined},
    dataset('area','m2'),dataset('volume','L'),
    {...dataset(),items:dataset().items.map(i=>({...i,visual:{...i.visual,src:'../private.png'}}))},
    {...dataset(),items:dataset().items.map(i=>({...i,visual:{...i.visual,src:'https://example.com/object.png'}}))},
    {...dataset(),items:dataset().items.map(i=>({...i,visual:{...i.visual,src:'script.svg'}}))},
  ])assert.equal(sizeDatasetSchema.safeParse(raw).success,false);
  const raw=dataset();raw.items.forEach(i=>delete (i.visual as {calibration?:unknown}).calibration);
  assert.throws(()=>compileSizeComparison(raw,defaultSizeEpisode(raw)),/calibrate/);
});

test('per-run image preparation measures padding, freezes assets and rejects photos and empty images',()=>{
  const root=mkdtempSync(path.join(tmpdir(),'comparison-assets-'));
  try{
    mkdirSync(path.join(root,'assets'));const file=path.join(root,'assets/object.png');
    const bytes=fixturePng(200,300,(x,y)=>x>=20&&x<100&&y>=30&&y<270?[130,170,220,255]:[0,0,0,0]);writeFileSync(file,bytes);
    const raw=dataset();raw.items.forEach(i=>delete (i.visual as {calibration?:unknown}).calibration);
    const data=prepareComparisonAssets(raw,{root,assetRoot:path.join(root,'assets'),runId:'fixture-run'});
    const visual=data.items[0].visual!;assert.equal(visual.kind,'cutout');if(visual.kind!=='cutout')return;
    assert.deepEqual(visual.calibration?.bounds,calibration.bounds);close(visual.calibration!.coverage,1);
    assert.ok(existsSync(path.join(root,'public',visual.src)));assert.deepEqual(inspectComparisonImage(path.join(root,'public',visual.src),true),visual.calibration);
    assert.equal(data.items[0].id,'new-object-0');assert.equal(assetRequests(data).objects.length,4);
    const repeat=prepareComparisonAssets(data,{root,assetRoot:path.join(root,'assets'),runId:'fixture-run'});assert.deepEqual(repeat,data);
    writeFileSync(file,fixturePng(10,10,()=>[255,255,255,255]));assert.throws(()=>inspectComparisonImage(file,true),/transparent background/);
    writeFileSync(file,fixturePng(10,10,()=>[0,0,0,0]));assert.throws(()=>inspectComparisonImage(file,true),/completely transparent/);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('provider manifests are complete and a trusted local provider is invoked without a shell',()=>{
  const data=sizeDatasetSchema.parse(dataset());
  assert.throws(()=>applyAssetManifest(data,{assets:[]}),/exactly one/);
  const root=mkdtempSync(path.join(tmpdir(),'comparison-provider-'));
  try{
    const script=path.join(root,'provider.cjs'),config=path.join(root,'provider.json');
    writeFileSync(script,`const fs=require('fs');const request=JSON.parse(fs.readFileSync(process.argv[2]));for(const o of request.objects)fs.writeFileSync(o.id+'.png',Buffer.from('${fixturePng(16,32,(x,y)=>x>2&&x<13&&y>2&&y<29?[100,180,200,255]:[0,0,0,0]).toString('base64')}','base64'));fs.writeFileSync(process.argv[3],JSON.stringify({assets:request.objects.map(o=>({id:o.id,src:o.id+'.png'}))}));`);
    writeFileSync(config,JSON.stringify({command:process.execPath,args:['{projectRoot}/provider.cjs']}));
    const supplied=runAssetProvider(data,{configFile:config,directory:root,assetRoot:root,root});
    writeFileSync(script,"throw new Error('Provider should have been reused.');");
    assert.deepEqual(runAssetProvider(data,{configFile:config,directory:root,assetRoot:root,root}),supplied);
    const prepared=prepareComparisonAssets(supplied,{root,assetRoot:root,runId:'provider-run'});
    assert.equal(compileSizeComparison(prepared,defaultSizeEpisode(prepared)).scenes.length,4);
    const visual=supplied.items[0].visual!;assert.equal(visual.kind,'cutout');if(visual.kind==='cutout'){assert.equal(visual.src,'new-object-0.png');assert.equal(visual.calibration,undefined);}
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('prompt research produces per-run asset requests and resumes without repeating AI stages',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'comparison-prompt-')),calls:ChatRequest[]=[];
  const raw=dataset();raw.items.forEach(i=>{delete (i.visual as {calibration?:unknown}).calibration;Object.assign(i.visual,{generation:{prompt:'Reference-based full object, orthographic view, transparent background.'}});i.sourceIds=['s1'];i.visual.referenceUrls=['https://example.com/one'];});
  raw.sources=[{id:'s1',title:'Opened primary reference',url:'https://example.com/one'}];
  const client={chat:async(request:ChatRequest):Promise<Completion>=>{
    calls.push(request);
    if(request.tools)return {choices:[{message:{content:'Reviewed values, common endpoints, and object references. '+ 'Each synthetic test object uses a consistent dimension, a documented source, and a supported orthographic view. '.repeat(5),executed_tools:[{type:'browser_search'},{name:'browser.open',search_results:{results:[{url:'https://example.com/one',content:'Primary one\nValues'}]}},{name:'browser.open',search_results:{results:[{url:'https://example.com/two',content:'Primary two\nViews'}]}}]}}]};
    const input=JSON.parse(request.messages[1].content);
    return {choices:[{message:{content:JSON.stringify(input.selectedConcept?{...raw,environment:'studio',editorial:editorialFixture(raw)}:ideaFixture())}}]};
  }};
  const options={topic:'Compare arbitrary new objects',id:'prompt-run',root,directory:root,log:()=>{}};
  const dependencies={client,research:mockResearch(client),config:{apiKey:'test-key',researchModel:'test-research',motionModel:'test-motion',scriptModel:'test-script'}};
  try{
    const data=await generateComparisonData(options,dependencies);assert.equal(calls.length,3);assert.equal(assetRequests(data).objects.length,4);
    assert.equal(data.environment,'architecture');assert.equal(data.backgroundReason,ideaFixture().concepts[0].background!.reason);
    for(const call of calls.slice(1))assert.equal(JSON.parse(call.messages[1].content).selectedConcept.viewerQuestion,data.editorial!.viewerQuestion);
    assert.equal(JSON.parse(readFileSync(path.join(root,'editorial-plan.json'),'utf8')).payoff.itemId,data.items.at(-1)!.id);
    assert.deepEqual(await generateComparisonData(options,dependencies),data);assert.equal(calls.length,3);
    await assert.rejects(()=>generateComparisonData({...options,topic:'A different topic'},dependencies),/different request/);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('microscopic quantities retain nonzero values and large ratios remain readable',()=>{
  assert.notEqual(formatSize(1e-12),'0');
  assert.notEqual(formatSize(.001),'0');
  assert.ok(formatRatio(1e15).length<15);
});
