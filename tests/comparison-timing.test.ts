import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import mass from '../comparisons/examples/mass.json';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import {defaultSizeEpisode,compileSizeComparison} from '../src/pipeline/size-comparison';
import {comparisonObjectTiming,comparisonSceneTiming} from '../src/shorts/comparison-timing';
import {prepareSilentInput} from '../src/shorts/silent';
import {compileStory,sampleActor} from '../src/shorts/motion';
import {structureSchema,comparisonStructureSchema} from '../src/shorts/structure';

const dataset=(count:number,metric='mass',values=Array.from({length:count},(_,i)=>i+1))=>sizeDatasetSchema.parse({...mass,metric,unit:metric==='height'?'m':'kg',items:values.map((value,i)=>({...mass.items[i%4],id:`reference-${i}`,label:`Reference ${i}`,value}))});
test('duration grows with subject count while settled holds remain within two to three seconds',()=>{
  let previous=0;
  for(let count=4;count<=8;count++){
    const data=dataset(count),episode=defaultSizeEpisode(data),input=prepareSilentInput(compileSizeComparison(data,episode));
    const seconds=input.scenes.reduce((sum,s)=>sum+s.durationInFrames,0)/input.fps;
    assert.ok(seconds>previous);previous=seconds;
    for(let i=0;i<count;i++){
      const timing=comparisonObjectTiming(data,i);
      assert.ok(timing.readingSeconds>=2&&timing.readingSeconds<=3);
      assert.equal(episode.scenes[i].durationSeconds,timing.detailSeconds+(i===count-1?4:0));
    }
  }
});
test('arrival time responds smoothly to scale, while the settled reading window stays bounded',()=>{
  const data=dataset(4,'height',[1,2,2000,10000]),episode=defaultSizeEpisode(data);
  const close=comparisonObjectTiming(data,1),large=comparisonObjectTiming(data,2);
  assert.ok(large.transitionSeconds>close.transitionSeconds);
  for(let i=0;i<4;i++){
    const timing=comparisonSceneTiming(episode.scenes[i].durationSeconds,comparisonObjectTiming(data,i).transitionSeconds,i===3);
    assert.ok(timing.detailSeconds-timing.arrivalSeconds>=2&&timing.detailSeconds-timing.arrivalSeconds<=3);
  }
  const near=comparisonObjectTiming(dataset(4,'height',[1,3,4,5]),1);
  assert.ok(near.transitionSeconds>close.transitionSeconds&&near.transitionSeconds<large.transitionSeconds);
  assert.equal(comparisonObjectTiming(dataset(4,'height',[1,2,2e8,1e20]),2).transitionSeconds,5);
});
test('every physical-size subject has a two-to-three-second settled hold at 24, 30 and 60 FPS, including the last',()=>{
  for(const fps of [24,30,60])for(const values of [[1,2,3,4],[1,2,2000,10000],[1,2,2e8,1e20]]){
    const data=dataset(4,'height',values),episode=defaultSizeEpisode(data),input=prepareSilentInput(compileSizeComparison(data,episode),fps),compiled=compileStory(input);
    for(let i=0;i<4;i++){
      const transition=comparisonObjectTiming(data,i).transitionSeconds,start=compiled.starts[i];
      const timing=comparisonSceneTiming(episode.scenes[i].durationSeconds,transition,i===3);
      const arrived=start+Math.ceil(transition*fps),end=i===3?start+Math.round(timing.zoomStart*(input.scenes[i].durationInFrames-1)):start+input.scenes[i].durationInFrames;
      assert.ok(end-arrived>=2*fps-1&&end-arrived<=3*fps+1);
      for(let frame=arrived;frame<end;frame++){
        const state=sampleActor(compiled,'sizes',frame);
        assert.equal(state.phase,i);assert.equal(state.shot,i);assert.equal(state.scale,1);
      }
    }
    const lastStart=compiled.starts.at(-1)!,lastDetail=comparisonObjectTiming(data,3).detailSeconds;
    assert.equal(sampleActor(compiled,'sizes',lastStart+(lastDetail+1)*fps).phase,4);
    for(let i=1;i<4;i++)assert.equal(sampleActor(compiled,'sizes',compiled.starts[i]-1).phase,sampleActor(compiled,'sizes',compiled.starts[i]).phase);
  }
});
test('shorter comparison structures do not loosen the general timed-story contract',()=>{
  const beats={beats:Array.from({length:4},(_,i)=>({name:`object-${i}`,durationSeconds:6}))};
  assert.equal(comparisonStructureSchema.safeParse(beats).success,true);
  assert.equal(structureSchema.safeParse(beats).success,false);
});

test('scale strongly separates close, moderate and extreme arrival times without extending settled focus',()=>{
  const arrival=(span:number)=>comparisonObjectTiming(dataset(4,'height',[1,span,span+1,span+2]),1);
  assert.equal(arrival(1.1).transitionSeconds,.35);
  assert.equal(arrival(10).transitionSeconds,2.55);
  assert.equal(arrival(100).transitionSeconds,4.85);
  assert.equal(arrival(1000).transitionSeconds,5);
  for(const span of [1,1.1,2,10,100,1000]){
    const timing=arrival(span);assert.ok(timing.readingSeconds>=2&&timing.readingSeconds<=3);
  }
  const extreme=dataset(8,'height',Array.from({length:8},(_,i)=>10**(-12+i*4)));
  const input=prepareSilentInput(compileSizeComparison(extreme,defaultSizeEpisode(extreme)));
  assert.ok(input.scenes.reduce((sum,s)=>sum+s.durationInFrames,0)/input.fps<=60);
});
