import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,rmSync} from 'node:fs';
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
import {editorialFixture} from './helpers/comparison-editorial';

const dataset=(count:number,extreme=false)=>sizeDatasetSchema.parse({...mass,metric:extreme?'height':'mass',unit:extreme?'m':'kg',items:Array.from({length:count},(_,i)=>({...mass.items[i%4],id:`reference-${i}`,label:`Reference ${i}`,value:extreme?10**(-12+42*i/(count-1)):i+1}))});
test('new comparison count policy accepts only eight through fifteen and retains readable legacy data',()=>{
  for(let n=0;n<=20;n++)if(n>=8&&n<=15)assert.doesNotThrow(()=>requireComparisonCount(n));else assert.throws(()=>requireComparisonCount(n),/8–15 supported objects/);
  assert.equal(dataset(4).items.length,4);
  for(const count of [4,7,16]){
    const data=count===16?{...dataset(15),items:[...dataset(15).items,{...dataset(15).items[0],id:'sixteenth'}]}:dataset(count);
    const {items:objectRoles,...rest}=editorialFixture({...data,items:data.items.slice(0,15)});
    assert.equal(comparisonGenerationSchema('mass').safeParse({...data,editorial:{...rest,objectRoles}}).success,false);
  }
});
test('eight through fifteen subjects compile at all output frame rates with settled focus and a final overview',()=>{
  for(const extreme of [false,true])for(let count=8;count<=15;count++){
    const data=dataset(count,extreme),episode=defaultSizeEpisode(data),brief=compileSizeComparison(data,episode);
    for(const fps of [24,30,60]){
      const input=prepareSilentInput(brief,fps),frames=input.scenes.reduce((sum,s)=>sum+s.durationInFrames,0);
      assert.ok(frames<=60*fps);assert.equal(input.scenes.length,count);
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
