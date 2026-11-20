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
test('default video duration grows with object count instead of redistributing a fixed total',()=>{
  const durations=[];
  for(let count=4;count<=8;count++){
    const data=dataset(count),episode=defaultSizeEpisode(data),input=prepareSilentInput(compileSizeComparison(data,episode));
    const seconds=input.scenes.reduce((sum,s)=>sum+s.durationInFrames,0)/input.fps;
    assert.equal(seconds,count*5+4);durations.push(seconds);
    assert.ok(episode.scenes.slice(0,-1).every(s=>s.durationSeconds===5));
    assert.equal(episode.scenes.at(-1)!.durationSeconds,9);
  }
  assert.deepEqual(durations,[24,29,34,39,44]);
});
test('large scale transitions get extra travel time without taking away reading time',()=>{
  const data=dataset(4,'height',[1,2,2000,10000]),episode=defaultSizeEpisode(data);
  assert.equal(comparisonObjectTiming(data,1).transitionSeconds,1);
  assert.equal(comparisonObjectTiming(data,2).transitionSeconds,2);
  for(let i=0;i<4;i++){
    const timing=comparisonSceneTiming(episode.scenes[i].durationSeconds,comparisonObjectTiming(data,i).transitionSeconds,i===3);
    assert.equal(timing.detailSeconds-timing.arrivalSeconds,4);
  }
  assert.equal(episode.scenes[2].durationSeconds,6);
  const enormous=dataset(4,'height',[1,2,2e8,1e20]);
  assert.equal(comparisonObjectTiming(enormous,2).transitionSeconds,3);
});
test('every physical-size subject has the same settled hold at 24, 30 and 60 FPS, including the last',()=>{
  for(const fps of [24,30,60])for(const values of [[1,2,3,4],[1,2,2000,10000],[1,2,2e8,1e20]]){
    const data=dataset(4,'height',values),episode=defaultSizeEpisode(data),input=prepareSilentInput(compileSizeComparison(data,episode),fps),compiled=compileStory(input);
    for(let i=0;i<4;i++){
      const transition=comparisonObjectTiming(data,i).transitionSeconds,start=compiled.starts[i];
      const timing=comparisonSceneTiming(episode.scenes[i].durationSeconds,transition,i===3);
      const arrived=start+transition*fps,end=i===3?start+Math.round(timing.zoomStart*(input.scenes[i].durationInFrames-1)):start+input.scenes[i].durationInFrames;
      assert.ok(Math.abs(end-arrived-4*fps)<=1);
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
