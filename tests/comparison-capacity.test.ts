import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import mass from '../comparisons/examples/mass.json';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import {requireComparisonCount} from '../src/shorts/comparison-limits';
import {comparisonObjectTiming} from '../src/shorts/comparison-timing';
import {quantityLabelLayout} from '../src/shorts/quantity-bars';
import {compileSizeComparison,defaultSizeEpisode} from '../src/pipeline/size-comparison';
import {prepareSilentInput} from '../src/shorts/silent';
import {ensureComparisonImages} from '../src/pipeline/comparison-images';
import {comparisonGenerationSchema} from '../src/pipeline/comparison-ideas';
import {generateComparisonData} from '../src/pipeline/comparison-run';
import {verifiedMeasurements} from '../src/pipeline/bounded-research';
import {editorialFixture,ideaFixture} from './helpers/comparison-editorial';

const dataset=(count:number,extreme=false)=>sizeDatasetSchema.parse({...mass,metric:extreme?'height':'mass',unit:extreme?'m':'kg',items:Array.from({length:count},(_,i)=>({...mass.items[i%4],id:`reference-${i}`,label:`Reference ${i}`,value:extreme?10**(-12+42*i/(count-1)):i+1}))});
test('eight is a planning target while two through fifteen supported objects remain valid',()=>{
  for(let n=0;n<=20;n++)if(n>=2&&n<=15)assert.doesNotThrow(()=>requireComparisonCount(n));else assert.throws(()=>requireComparisonCount(n),/2–15 verified objects/);
  assert.equal(dataset(4).items.length,4);
  for(const count of [2,3,4,7,8,15,16]){
    const data=count===16?{...dataset(15),items:[...dataset(15).items,{...dataset(15).items[0],id:'sixteenth'}]}:dataset(count);
    const {items:objectRoles,...rest}=editorialFixture({...data,items:data.items.slice(0,15)});
    assert.equal(comparisonGenerationSchema('mass').safeParse({...data,items:data.items.map(({visual,...item})=>item),editorial:{...rest,objectRoles}}).success,count<=15);
  }
});
test('two through fifteen subjects compile at all output frame rates with settled focus and a final overview',()=>{
  for(const extreme of [false,true])for(let count=2;count<=15;count++){
    const data=dataset(count,extreme),episode=defaultSizeEpisode(data),brief=compileSizeComparison(data,episode);
    for(const fps of [24,30,60]){
      const input=prepareSilentInput(brief,fps),frames=input.scenes.reduce((sum,s)=>sum+s.durationInFrames,0);
      assert.ok(frames<=90*fps);assert.equal(input.scenes.length,count);
    }
    for(let i=0;i<count;i++){
      const t=comparisonObjectTiming(data,i);assert.ok(t.readingSeconds>=2&&t.readingSeconds<=3);
      assert.equal(episode.scenes[i].durationSeconds,t.detailSeconds+(i===count-1?4:0));
    }
    const actor=brief.actors[0];assert.equal(actor.kind,'size-comparison');
    if(actor.kind==='size-comparison')assert.equal(actor.shots?.at(-1)?.visible.length,count);
  }
});
test('dense chart label rows remain inside the stage without colliding with neighboring labels',()=>{
  for(let count=8;count<=15;count++){
    const labels=Array.from({length:count},(_,i)=>quantityLabelLayout(count,i,130+730*(i+.5)/count));
    for(const label of labels){assert.ok(label.x-label.width/2>=100);assert.ok(label.x+label.width/2<=900);assert.ok(label.nameTop+70<1190);}
    for(let i=0;i<count;i++)for(let j=i+1;j<count;j++)if(labels[i].row===labels[j].row)assert.ok(labels[i].x+labels[i].width/2<labels[j].x-labels[j].width/2);
  }
});
test('fifteen image briefs use small batches and reuse successful batches after an interrupted plan',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'comparison-fifteen-')),data=dataset(15);let calls=0,fail=true;
  const client={chat:async(request:any)=>{
    calls++;const input=JSON.parse(request.messages[1].content);assert.ok(input.objects.length<=5);
    if(calls===2&&fail)throw new Error('Synthetic provider interruption');
    return {choices:[{message:{content:JSON.stringify({images:input.objects.map((i:any)=>({id:i.id,prompt:`Full isolated realistic side profile of ${i.label}, preserving the complete silhouette and all distinctive details against a neutral plain background.`}))})}}]};
  }};
  try{
    await assert.rejects(()=>ensureComparisonImages(data,{directory,model:'test',log:()=>{},client}),/provider interruption/);
    fail=false;
    const result=await ensureComparisonImages(data,{directory,model:'test',log:()=>{},client});
    assert.equal(calls,4);assert.equal(result.items.length,15);assert.ok(result.items.every(i=>i.visual?.kind==='cutout'&&i.visual.generation));
    assert.deepEqual(result.items.map(i=>i.value),data.items.map(i=>i.value));
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('seven saved verified measurements proceed to selection without repeating research or inventing an eighth',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'seven-supported-')),data=dataset(7),ideas=ideaFixture();let requests=0,researchCalls=0;
  const options={topic:'Synthetic mass comparison',id:'seven-verified',root:directory,directory,log:()=>{}};
  for(const concept of ideas.concepts){concept.metric='mass';concept.unit='kg';concept.visualApproach='quantity-bars';}
  const records=data.items.map(item=>({candidate:item.label,sourceId:data.sources[0].id,quote:`${item.label} has a measured mass of ${item.value} kg in the documented configuration.`,sourceValue:item.value,sourceUnit:'kg',conversion:'direct',qualifier:'Documented configuration',value:item.value,unit:'kg'}));
  try{
    writeFileSync(path.join(directory,'idea-plan.json'),JSON.stringify(ideas));
    writeFileSync(path.join(directory,'research-measurements.json'),JSON.stringify({measurements:records}));
    writeFileSync(path.join(directory,'research.json'),JSON.stringify({topic:options.topic,model:'test',notes:JSON.stringify({measurementBasis:data.basis,gaps:['An eighth candidate has no supported measurement.']}).padEnd(110,' '),sources:[...data.sources,{id:'secondary',title:'Second opened fixture source',url:'https://example.com/secondary'}],searched:true,toolExecutions:7}));
    const facts=verifiedMeasurements(directory),{items:objectRoles,...editorial}=editorialFixture(data);
    const result=await generateComparisonData(options,{
      config:{apiKey:'test',researchModel:'test',scriptModel:'test',motionModel:'test'},
      research:async()=>{researchCalls++;throw new Error('Reuse saved research');},
      client:{chat:async request=>{
        requests++;assert.equal(JSON.parse(request.messages[1].content).verifiedMeasurements.length,7);
        return {choices:[{message:{content:JSON.stringify({...data,editorial:{...editorial,objectRoles},items:data.items.map((item,i)=>({id:item.id,label:item.label,color:item.color,evidenceId:facts[i].evidenceId}))})}}]};
      }},
    });
    assert.equal(researchCalls,0);assert.equal(requests,1);assert.equal(result.items.length,7);
    assert.deepEqual(result.items.map(i=>i.value),data.items.map(i=>i.value));
    assert.equal(prepareSilentInput(compileSizeComparison(result,defaultSizeEpisode(result))).scenes.length,7);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
