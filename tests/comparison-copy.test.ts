import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {comparisonDisplayNames,comparisonMeasurementLabel} from '../src/shorts/comparison-copy';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import mass from '../comparisons/examples/mass.json';
import {ensureComparisonImages} from '../src/pipeline/comparison-images';

const fixture=()=>sizeDatasetSchema.parse({...mass,subject:'animals',items:mass.items.map((item,i)=>({...item,label:['House mouse','Domestic cat','Horse','Asian elephant'][i]}))});
test('display names simplify redundant qualifiers while keeping research identities and distinctions',()=>{
  const data=fixture(),original=data.items.map(i=>i.label);
  assert.deepEqual(comparisonDisplayNames(data),['Mouse','Cat','Horse','Asian elephant']);
  assert.deepEqual(data.items.map(i=>i.label),original);
  const collision={...data,items:data.items.map((i,n)=>({...i,label:n===0?'Mouse':i.label}))};
  collision.items[1].label='House mouse';
  assert.deepEqual(comparisonDisplayNames(collision).slice(0,2),['Mouse','House mouse']);
  assert.equal(comparisonDisplayNames({...data,subject:'generic'})[0],'House mouse');
  assert.equal(comparisonDisplayNames({...data,subject:'generic',items:[{...data.items[0],label:'iPhone'}]})[0],'iPhone');
  assert.equal(sizeDatasetSchema.safeParse({...data,items:data.items.map((i,n)=>n?i:{...i,displayLabel:'Tiger'})}).success,false);
});
test('measurement copy uses audience language and omits an irrelevant study date',()=>{
  const data={...fixture(),metric:'duration' as const,unit:'year' as const,basis:'Typical lifespan in years',asOf:'2023-12-31'};
  assert.equal(comparisonMeasurementLabel(data),'Lifespan (years)');
  assert.equal(comparisonMeasurementLabel({...data,metric:'power',unit:'W'}),'Power (W)');
  assert.equal(comparisonMeasurementLabel({...data,metric:'count',unit:'count',countBasis:'population'}),'Population · 2023');
  assert.equal(comparisonMeasurementLabel({...data,metric:'count',unit:'count',countBasis:'fixed'}),'Count');
});
test('new quantity subjects receive image briefs using researched identities, with no measurement changes',async()=>{
  const data=fixture();let calls=0;const directory=mkdtempSync(path.join(tmpdir(),'comparison-copy-'));
  try{
  const result=await ensureComparisonImages(data,{directory,model:'test',log:()=>{},client:{chat:async request=>{
    calls++;const input=JSON.parse(request.messages[1].content);
    assert.equal(input.objects[0].label,'House mouse');
    return {choices:[{message:{content:JSON.stringify({images:input.objects.map((i:{id:string;label:string})=>({id:i.id,prompt:`Accurate full-body side view of ${i.label}, matching the actual species and natural colors, consistent neutral lighting, no text or scenery.`}))})}}]};
  }}});
  assert.equal(calls,1);assert.ok(result.items.every(i=>i.visual?.kind==='cutout'&&i.visual.generation));
  assert.deepEqual(result.items.map(i=>i.value),data.items.map(i=>i.value));
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('canonical identities can exceed screen-label limits and display names can omit middle words',()=>{
  const original=fixture();
  const data=sizeDatasetSchema.parse({...original,items:original.items.map((item,i)=>i?item:{...item,label:'Bugatti Chiron Super Sport 300+',displayLabel:'Bugatti Chiron 300+'})});
  assert.equal(data.items[0].label,'Bugatti Chiron Super Sport 300+');
  assert.equal(comparisonDisplayNames(data)[0],'Bugatti Chiron 300+');
  for(const displayLabel of ['Bugatti Chiron 400+','Chiron Bugatti','Fastest car'])assert.equal(sizeDatasetSchema.safeParse({...data,items:data.items.map((item,i)=>i?item:{...item,displayLabel})}).success,false);
});
