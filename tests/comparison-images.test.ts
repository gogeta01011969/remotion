import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import {ensureComparisonImages,cloudflareObjectPrompt} from '../src/pipeline/comparison-images';
import {assetRequests} from '../src/pipeline/comparison-run';
import {comparisonGenerationSchema} from '../src/pipeline/comparison-ideas';

function balls(){return sizeDatasetSchema.parse({template:'size-comparison',id:'image-policy',title:'Real sports-ball surfaces',metric:'diameter',unit:'m',context:'Image policy regression',items:['Table tennis','Baseball','Soccer','Basketball'].map((label,i)=>({id:`ball-${i}`,label,value:[.04,.073,.216,.239][i],material:'plain',color:'#FFFFFF',sourceIds:['s1']})),sources:[{id:'s1',title:'Synthetic fixture specifications',url:'https://example.com/balls'}]});}
test('plain ball plans receive one generated texture per object, preserve measurements, and cannot skip asset creation',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'required-ball-images-'));let calls=0;
  try{
    const data=balls(),result=await ensureComparisonImages(data,{directory:root,model:'test',log:()=>{},client:{chat:async request=>{
      calls++;const input=JSON.parse(request.messages[1].content);
      return {choices:[{message:{content:JSON.stringify({images:input.objects.map((item:{id:string;label:string})=>({id:item.id,prompt:`Authentic ${item.label} surface with realistic material, conventional colors, accurate functional seams, panels and stitching; seamless equirectangular texture, no text.`}))})}}]};
    }}});
    assert.equal(calls,1);assert.deepEqual(result.items.map(i=>i.value),data.items.map(i=>i.value));
    assert.equal(assetRequests(result).objects.length,4);
    for(const item of result.items){assert.equal(item.visual?.kind,'sphere');assert.ok(item.visual?.generation?.prompt.includes(item.label));assert.equal(item.appearance,undefined);}
    const resumed=await ensureComparisonImages(result,{directory:root,model:'test',log:()=>{},client:{chat:async()=>{throw new Error('Do not repeat image planning');}}});
    assert.equal(resumed,result);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('generated-object schema requires an image and generation brief even for supported planets or sports balls',()=>{
  const visual=comparisonGenerationSchema('diameter').shape.items.element.shape.visual;
  assert.equal(visual.isOptional(),false);
  assert.equal(visual.safeParse({kind:'sphere',texture:'ball.png',attribution:'Pending',referenceUrls:['https://example.com']}).success,false);
});
test('Cloudflare briefs enforce surface-map format and real-object identity within the prompt size limit',()=>{
  const prompt=cloudflareObjectPrompt('Baseball','sphere','x'.repeat(2000));
  assert.ok(prompt.includes('Subject: Baseball'));assert.ok(prompt.includes('equirectangular'));
  assert.ok(prompt.includes('No isolated circular ball'));assert.ok(prompt.length<=2000);
  assert.ok(cloudflareObjectPrompt('Tower','cutout','Accurate complete tower').includes('No cropping'));
});
test('source planning errors cannot silently fall back to plain materials',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'required-image-no-fallback-'));
  try{
    await assert.rejects(()=>ensureComparisonImages(balls(),{directory:root,model:'test',log:()=>{},client:{chat:async()=>{throw new Error('HTTP 429 quota');}}}),/429/);
    assert.equal(assetRequests(balls()).objects.length,0);
  }finally{rmSync(root,{recursive:true,force:true});}
});
