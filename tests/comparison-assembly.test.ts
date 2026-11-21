import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {assembleVerifiedComparison} from '../src/pipeline/comparison-assembly';
import {generateComparisonData} from '../src/pipeline/comparison-run';
import {type VerifiedMeasurement,validateResearchFacts} from '../src/pipeline/bounded-research';
import {finalizeComparisonPresentation} from '../src/pipeline/comparison-presentation';
import {ideaFixture} from './helpers/comparison-editorial';
import {sizeDatasetSchema,type SizeDataset} from '../src/shorts/size-data';

const sources=[{id:'s1',title:'Synthetic verified measurements',url:'https://example.com/data'}];
const records=(unit:string,n=8):VerifiedMeasurement[]=>Array.from({length:n},(_,i)=>({candidate:`Measured object ${i}`,evidenceId:`fact-valid-${i}`,sourceId:'s1',quote:`Measured object ${i} has a documented value of ${i+1} ${unit}.`,sourceValue:i+1,sourceUnit:unit as 'm',conversion:'direct',qualifier:'Documented measurement',value:i+1,unit}));
const concept=(metric:'height'|'diameter'|'length'|'width'|'wingspan'|'volume'|'mass'|'count'|'speed'|'duration'|'energy'|'power'|'temperature',unit:SizeDataset['unit'])=>({...ideaFixture().concepts[0],metric,unit,measurementBasis:'One consistent documented measurement basis.'});
const research={topic:'Synthetic measured objects',model:'fixture',notes:'Synthetic verified source records for regression testing only. These are not real object measurements.',sources,searched:true as const,toolExecutions:1};

test('all automated metrics assemble directly from verified facts, retaining values, identities and source IDs',()=>{
 const metrics={diameter:'m',height:'m',length:'m',width:'m',wingspan:'m',volume:'L',mass:'kg',count:'count',speed:'km/h',duration:'year',energy:'J',power:'W',temperature:'C'} as const;
 for(const [metric,unit] of Object.entries(metrics)){
  const facts=records(unit);
  const data=assembleVerifiedComparison({id:'assembled-test',topic:'Documented objects',concept:concept(metric as keyof typeof metrics,unit),research,facts});
  assert.deepEqual(data.items.map(i=>[i.label,i.value,i.sourceIds]),facts.map(f=>[f.candidate,f.value,[f.sourceId]]));assert.equal(data.items.length,8);assert.equal(new Set(data.items.map(i=>i.id)).size,8);
  assert.deepEqual(data,assembleVerifiedComparison({id:'assembled-test',topic:'Documented objects',concept:concept(metric as keyof typeof metrics,unit),research,facts}));
 }
});
test('large researched sets keep fifteen supported objects including both endpoints; no object is invented',()=>{
 const facts=records('m',18),data=assembleVerifiedComparison({id:'large-set',topic:'Height examples',concept:concept('height','m'),research,facts});
 assert.equal(data.items.length,15);assert.equal(data.items[0].value,1);assert.equal(data.items.at(-1)!.value,18);assert.ok(data.items.every(i=>facts.some(f=>f.value===i.value&&f.candidate===i.label)));
 assert.throws(()=>assembleVerifiedComparison({id:'missing-source',topic:'Examples',concept:concept('height','m'),research:{...research,sources:[]},facts}),/opened source/);
});
test('a saved researched topic recovers locally despite drafts with invented evidence IDs and no usable items',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'local-evidence-assembly-'));let calls=0;
 try{
  const ideas=ideaFixture();for(const c of ideas.concepts){c.metric='diameter';c.unit='m';c.visualApproach='textured-spheres';}
  writeFileSync(path.join(root,'idea-plan.json'),JSON.stringify(ideas));writeFileSync(path.join(root,'research.json'),JSON.stringify(research));
  const facts=records('m');writeFileSync(path.join(root,'research-measurements.json'),JSON.stringify({measurements:facts.map(({evidenceId,...fact})=>fact)}));
  for(let i=1;i<=3;i++)writeFileSync(path.join(root,`comparison-data-attempt-${i}.json`),JSON.stringify({content:JSON.stringify({unit:'wrong',items:[{evidenceId:'invented-fact',label:'Wrong object'}]})}));
  const options={root,directory:root,id:'local-recovery',topic:research.topic,log:()=>{}};
  const result=await generateComparisonData(options,{research:async()=>{throw Error('Do not repeat saved research');},config:{apiKey:'unused',researchModel:'test',scriptModel:'test',motionModel:'test'},client:{chat:async()=>{calls++;throw Error('Do not ask an LLM to reassemble verified facts');}}});
  assert.equal(calls,0);assert.equal(result.items.length,8);assert.deepEqual(result.items.map(i=>i.value),facts.map(f=>f.value));assert.ok(result.items.every(i=>i.visual?.kind==='sphere'));
  assert.equal(JSON.parse(readFileSync(path.join(root,'dataset-assembly.json'),'utf8')).modelRequests,0);
  assert.deepEqual(await generateComparisonData(options,{client:{chat:async()=>{throw Error('No model call on resume');}}}),result);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('dated counts preserve source precision and can show distinct supported years per object',()=>{
 const facts=records('count',2).map((f,i)=>({...f,asOf:['2022','2024'][i]}));
 const data=finalizeComparisonPresentation(assembleVerifiedComparison({id:'dated-counts',topic:'Animal population estimates',concept:{...concept('count','count'),measurementBasis:'Documented population estimates in the defined region, dated per object.'},research,facts}));
 assert.equal(data.countBasis,'population');assert.equal(data.asOf,undefined);assert.deepEqual(data.items.map(i=>i.conditionLabel),['2022 estimate','2024 estimate']);
 assert.equal(sizeDatasetSchema.safeParse({...data,items:data.items.map(({asOf,...i})=>i)}).success,false);
});
test('invalid optional research metadata is omitted without rejecting an otherwise verified numerical fact',()=>{
 const quote='Measured object 0 has an overall height of 1 metres, measured from the base.';
 const {value,unit,evidenceId,...fact}=records('m',1)[0];
 const clean=validateResearchFacts({measurements:[{...fact,country:null,asOf:'2024-99-99',quote}],gaps:[]},[{...sources[0],text:quote}],concept('height','m'),['Measured object 0'],{skipInvalid:true});
 assert.equal(clean.measurements.length,1);assert.equal(clean.measurements[0].value,1);assert.equal(clean.measurements[0].country,undefined);assert.equal(clean.measurements[0].asOf,undefined);
});

test('planet-style diameter records may derive from a quoted radius locally but cannot silently relabel it',()=>{
 const quote='Measured world has a mean radius of 2400 km under the documented convention.';
 const record={candidate:'Measured world',sourceId:'s1',quote,sourceValue:2400,sourceUnit:'km',conversion:'radius-to-diameter'};
 const pages=[{...sources[0],text:quote}];
 const result=validateResearchFacts({measurements:[record],gaps:[]},pages,concept('diameter','km'),['Measured world']);
 assert.equal(result.measurements[0].value,4800);assert.equal(result.measurements[0].sourceValue,2400);
 assert.throws(()=>validateResearchFacts({measurements:[{...record,conversion:'direct'}],gaps:[]},pages,concept('diameter','km'),['Measured world']),/radius-only/);
});
