import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import mass from '../comparisons/examples/mass.json';
import {normalizeComparisonGeneration,planComparisonIdeas,validateConceptSelection} from '../src/pipeline/comparison-ideas';
import {comparisonWarningSink} from '../src/pipeline/comparison-warnings';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import {compileSizeComparison,defaultSizeEpisode} from '../src/pipeline/size-comparison';
import {prepareSilentInput} from '../src/shorts/silent';
import {ideaFixture} from './helpers/comparison-editorial';

const fixture=()=>({...mass,items:mass.items.slice(0,2)});
test('cosmetic and optional editorial problems become persisted warnings without changing measurements',()=>{
  const root=mkdtempSync(path.join(tmpdir(),'comparison-guidelines-'));
  try{
    const raw={...fixture(),subject:'structures',environment:'unavailable-preset',editorial:{viewerQuestion:'Short question'},items:fixture().items.map(item=>({...item,color:'blue',material:'shiny-metal',country:''}))};
    const normalized=sizeDatasetSchema.parse(normalizeComparisonGeneration(raw,comparisonWarningSink(root,()=>{})));
    assert.deepEqual(normalized.items.map(i=>i.value),raw.items.map(i=>i.value));assert.deepEqual(normalized.items.map(i=>i.sourceIds),raw.items.map(i=>i.sourceIds));
    assert.equal(normalized.editorial,undefined);assert.ok(normalized.items.every(i=>!i.country));
    const brief=compileSizeComparison(normalized,defaultSizeEpisode(normalized));
    for(const fps of [24,30,60])assert.equal(prepareSilentInput(brief,fps).scenes.length,2);
    assert.ok(JSON.parse(readFileSync(path.join(root,'quality-warnings.json'),'utf8')).warnings.length>=3);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('a usable concept is accepted on the first request despite missing optional planning details',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'comparison-concept-guidelines-'));let calls=0;
  const concept={...ideaFixture().concepts[0],candidates:['Tower A','Tower B'],background:undefined,openingCandidate:'unknown',payoffCandidate:'unknown',audiencePromise:'',openingIdea:undefined,payoffIdea:undefined,feasibilityNotes:undefined};
  try{
    const result=await planComparisonIdeas({topic:'Compare two towers by height',id:'quality-concept',root,directory:root,log:()=>{}},{config:{apiKey:'test',researchModel:'test',scriptModel:'test',motionModel:'test'},client:{chat:async()=>{calls++;return {choices:[{message:{content:JSON.stringify({schemaVersion:1,selectedId:'unknown',selectionReason:'',concepts:[concept]})}}]};}}});
    assert.equal(calls,1);assert.equal(result.concepts.length,1);assert.equal(result.selectedId,result.concepts[0].id);assert.equal(result.concepts[0].background?.environment,'architecture');
    assert.equal(result.concepts[0].openingCandidate,'Tower A');assert.equal(result.concepts[0].payoffCandidate,'Tower B');
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('material numerical, source and asset-safety errors still block comparisons',()=>{
  const raw=fixture();
  for(const broken of [
    {...raw,unit:'m'},
    {...raw,items:raw.items.map((item,i)=>i?item:{...item,value:-100})},
    {...raw,items:raw.items.map((item,i)=>i?item:{...item,sourceIds:['unopened-source']})},
    {...raw,items:raw.items.map((item,i)=>i?item:{...item,visual:{kind:'cutout',src:'../../credentials.png',view:'side',attribution:'Unsafe path',referenceUrls:['https://example.com']}})},
  ])assert.equal(sizeDatasetSchema.safeParse(normalizeComparisonGeneration(broken)).success,false);
  assert.equal(sizeDatasetSchema.safeParse(normalizeComparisonGeneration({...raw,items:raw.items.slice(0,1)})).success,false);
  const data=sizeDatasetSchema.parse(raw);assert.throws(()=>validateConceptSelection(data,ideaFixture().concepts[0]),/metric and unit/);
});
