import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,rmSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildSimpleComparison} from '../src/pipeline/simple-comparison';
import {generateComparisonData} from '../src/pipeline/comparison-run';
import {ensureComparisonImages} from '../src/pipeline/comparison-images';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import {compileSizeComparison,defaultSizeEpisode} from '../src/pipeline/size-comparison';
import {makeYouTubeMetadata} from '../src/pipeline/youtube';
import {reserveTopic,automationConfigSchema,ledgerSchema} from '../src/pipeline/topic-automation';

const options={id:'simple-test',topic:'How tall are everyday objects compared with famous structures?'};
const plan={title:'How small is a mug beside a skyscraper?',metric:'height',unit:'m',basis:'Approximate typical heights; buildings include spires.',background:'architecture',objects:[{name:'Burj Khalifa',value:828,country:'United Arab Emirates',appearance:'Silver tiered tower with a slender spire.'},{name:'Coffee mug',value:.1,condition:'Typical mug'},{name:'Refrigerator',value:1.8,condition:'Typical full-size model'}]};
const config={apiKey:'unused',researchModel:'test',scriptModel:'test',motionModel:'test'};

test('generic everyday subjects become approximate render inputs without research IDs or invented sources',()=>{
 const original=structuredClone(plan),data=buildSimpleComparison(plan,options);
 assert.deepEqual(plan,original);assert.equal(data.dataQuality,'estimated');assert.equal(data.items.length,3);
 assert.deepEqual(data.items.map(i=>i.value),[.1,1.8,828]);assert.deepEqual(data.sources,[]);
 assert.ok(data.items.every(i=>i.approximate&&i.sourceIds.length===0&&i.visual?.kind==='cutout'&&i.visual.generation?.prompt));
 assert.equal(data.items.at(-1)!.country,'United Arab Emirates');assert.equal(data.environment,'architecture');assert.equal(data.title,plan.title);
 assert.deepEqual(buildSimpleComparison(plan,options),data);
 assert.equal(sizeDatasetSchema.safeParse({...data,dataQuality:'sourced'}).success,false);
});
test('optional model junk is defaulted or ignored; invalid individual records do not reject a usable comparison',()=>{
 const data=buildSimpleComparison({...plan,title:null,background:'random-pattern',basis:null,extra:'unused',objects:[{name:'Coffee mug',value:'0.10',label:'Wrong alias',country:null},{name:'Fridge',value:'1.8',condition:42},{name:'Fridge',value:2},{name:'Impossible',value:-1},{name:'Broken',value:'unknown'}]},options);
 assert.equal(data.items.length,2);assert.ok(data.items.every(i=>i.displayLabel===undefined));assert.equal(data.environment,'architecture');
});
test('essential dimension and numeric mistakes remain bounded hard failures',()=>{
 assert.throws(()=>buildSimpleComparison({...plan,unit:'kg'},options),/compatible/);
 assert.throws(()=>buildSimpleComparison({...plan,metric:'area',unit:'m2'},options),/outline/);
 assert.throws(()=>buildSimpleComparison({...plan,objects:[{name:'Bad',value:-1},{name:'Other',value:NaN}]},options),/at least two/);
 assert.throws(()=>buildSimpleComparison({...plan,metric:'temperature',unit:'K',objects:[{name:'Bad',value:-10},{name:'Other',value:100}]},options),/at least two/);
});
test('all automatic measurements have simple working plans, including undated approximate populations',()=>{
 const units={diameter:'km',height:'m',length:'m',width:'m',wingspan:'m',volume:'L',mass:'kg',count:'count',speed:'km/h',duration:'year',energy:'J',power:'W',temperature:'C'} as const;
 for(const [metric,unit] of Object.entries(units)){
  const data=buildSimpleComparison({metric,unit,objects:[{name:'Reference A',value:metric==='temperature'?-20:1},{name:'Reference B',value:8}]},{...options,topic:metric==='count'?'Approximate worldwide animal populations':options.topic});
  assert.equal(data.items.length,2);assert.ok(data.items.every(i=>i.approximate));assert.equal(data.asOf,undefined);
  if(metric==='count')assert.equal(data.countBasis,'population');
 }
});
test('the default path needs one plan request, no browsing or concept rounds, and no extra image-planning request',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'simple-comparison-'));let calls=0;
 try{
  // Historical failures must not send the new default flow back into research.
  writeFileSync(path.join(root,'research-web.json'),'invalid old checkpoint');
  writeFileSync(path.join(root,'research-measurements.json'),JSON.stringify({measurements:[]}));
  const request={...options,root,directory:root,topicBrief:{proposedObjects:['An off-topic provisional suggestion']},log:()=>{}};
  const data=await generateComparisonData(request,{config,webFetch:async()=>{throw Error('No browsing');},client:{chat:async r=>{
   calls++;assert.equal(r.stageLabel,'comparison-plan');assert.equal(JSON.parse(r.messages[1].content).suggestions,undefined);return {choices:[{message:{content:JSON.stringify(plan)}}]};
  }}});
  assert.equal(calls,1);assert.equal(existsSync(path.join(root,'idea-plan.json')),false);
  const noRequests={chat:async()=>{throw Error('No additional request');}};
  assert.deepEqual(await ensureComparisonImages(data,{directory:root,client:noRequests,model:'test',log:()=>{}}),data);
  assert.deepEqual(await generateComparisonData(request,{client:noRequests}),data);
  assert.equal(JSON.parse(readFileSync(path.join(root,'comparison-plan.json'),'utf8')).webResearch,false);
  assert.equal(existsSync(path.join(root,'quality-warnings.json')),false);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('estimated video descriptions disclose approximations without fabricated research citations',()=>{
 const data=buildSimpleComparison({...plan,metric:'volume',unit:'L',objects:[{name:'Bottle',value:1},{name:'Bathtub',value:150}]},options);
 const brief=compileSizeComparison(data,defaultSizeEpisode(data));
 assert.match(brief.description,/Approximate illustrative values estimated by AI/);assert.deepEqual(brief.sources,[]);
 assert.doesNotMatch(data.context,/documented|verified/);
});
test('topic selection accepts simple useful proposals and skips broken entries without a full-batch repair',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'simple-topic-'));let calls=0;
 try{
  const config=automationConfigSchema.parse({niche:'Meaningful silent comparisons',allowedMetrics:['height'],assetProvider:'unused'});
  const ledger=ledgerSchema.parse({version:1,jobs:[],queue:[]});
  const result=await reserveTopic({root,directory:root,config,ledger,model:'test',log:()=>{},client:{chat:async()=>{calls++;return {choices:[{message:{content:JSON.stringify({candidates:[{topic:'Bad topic',metric:'unsupported'},{topic:options.topic,metric:'height',entityKeys:['Coffee mug','Skyscraper']}]})}}]};}}});
  assert.equal(calls,1);assert.equal(result.topic,options.topic);assert.equal(result.entityKeys.length,2);assert.ok(result.scopeKey);assert.ok(result.family);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('YouTube metadata preserves approximate disclosure without claiming source verification',()=>{
 const data=buildSimpleComparison(plan,options);
 const metadata=makeYouTubeMetadata(data,{privacy:'private',madeForKids:false,containsSyntheticMedia:true});
 assert.match(metadata.snippet.description,/Approximate illustrative values estimated by AI/);
 assert.doesNotMatch(metadata.snippet.description,/Sources:|based on the sources below/);
 assert.equal(metadata.status.privacyStatus,'private');
});

test('automatic topic proposals do not need a premature object list',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'simple-topic-only-'));
 try{
  const config=automationConfigSchema.parse({niche:'Meaningful silent comparisons',allowedMetrics:['height'],assetProvider:'unused'});
  const ledger=ledgerSchema.parse({version:1,jobs:[],queue:[]});
  const job=await reserveTopic({root,directory:root,config,ledger,model:'test',log:()=>{},client:{chat:async()=>({choices:[{message:{content:JSON.stringify({candidates:[{topic:options.topic,metric:'height',whyInteresting:'Everyday references make immense buildings relatable.'}]})}}]})}});
  assert.equal(job.topic,options.topic);assert.deepEqual(job.entityKeys,[]);
 }finally{rmSync(root,{recursive:true,force:true});}
});
