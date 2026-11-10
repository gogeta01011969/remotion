import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import {sampleSizeShots} from '../src/shorts/size-shots';
import {overviewTiming,sizePresentationOffset,detailTextOpacity} from '../src/shorts/size-presentation';
import {compileSizeComparison,defaultSizeEpisode} from '../src/pipeline/size-comparison';
import {prepareSilentInput} from '../src/shorts/silent';
import {compileStory,sampleActor} from '../src/shorts/motion';
import space from '../comparisons/solar-system.json';
import balls from '../comparisons/sports-balls.json';

test('the final object gets its own held detail pose before the separate overview zoom',()=>{
  for(const raw of [space,balls]){
    const data=sizeDatasetSchema.parse(raw),episode=defaultSizeEpisode(data),brief=compileSizeComparison(data,episode),input=prepareSilentInput(brief);
    const actor=input.actors[0];if(actor.kind!=='size-comparison')throw new Error('Missing comparison actor');
    const n=data.items.length,shots=actor.shots!,last=input.scenes.at(-1)!,compiled=compileStory(input),start=compiled.starts.at(-1)!;
    assert.equal(shots.length,n+1);assert.equal(shots[n-1].role,'detail');assert.equal(shots[n-1].reference,n-2);
    assert.equal(shots[n].role,'overview');assert.equal(shots[n].visible.length,n);
    assert.equal(episode.scenes.at(-1)!.durationSeconds,8);
    const frame=(progress:number)=>start+Math.round(progress*(last.durationInFrames-1));
    for(const progress of [.2,.3,.42]){
      const state=sampleActor(compiled,'sizes',frame(progress));assert.equal(state.shot,n-1);assert.equal(state.phase,n-1);
    }
    const overview=sampleActor(compiled,'sizes',frame(.8));assert.equal(overview.shot,n);assert.equal(overview.phase,n);
    const detail=sampleSizeShots(data.items,shots,n-1,data.metric),wide=sampleSizeShots(data.items,shots,overview.phase,data.metric);
    assert.ok(wide.scale<detail.scale);assert.ok(wide.bodies.every(b=>b.opacity===1));
    for(const b of wide.bodies)assert.ok(b.x-b.width/2>=39.99&&b.x+b.width/2<=860.01);
    const seekFrames=[frame(.3),frame(.6),frame(.9),frame(.1)];
    assert.deepEqual(seekFrames.map(f=>sampleActor(compiled,'sizes',f)),seekFrames.slice().reverse().map(f=>sampleActor(compiled,'sizes',f)).reverse());
  }
});

test('the ending is text-free and has a smooth pre-zoom text exit',()=>{
  assert.equal(detailTextOpacity(true,.3),1);assert.equal(detailTextOpacity(true,overviewTiming.zoomStart),0);
  for(let i=0;i<=100;i++){const opacity=detailTextOpacity(true,i/100);assert.ok(opacity>=0&&opacity<=1);}
  assert.equal(detailTextOpacity(false,.8),1);
});

test('overview silhouettes and detail presentation bounds center vertically without pose jumps',()=>{
  const data=sizeDatasetSchema.parse(balls),brief=compileSizeComparison(data,defaultSizeEpisode(data)),actor=brief.actors[0];
  if(actor.kind!=='size-comparison')throw new Error('Missing comparison actor');
  const shots=actor.shots!,index=shots.length-1,sample=sampleSizeShots(data.items,shots,index,data.metric);
  const offset=sizePresentationOffset(data,shots,index,false),top=Math.min(...sample.bodies.map(b=>b.y-b.height/2));
  const actorTop=actor.state.y-575;
  assert.equal(actorTop+offset+(top+860)/2,960);
  const detailOffset=sizePresentationOffset(data,shots,index-1,false);
  assert.equal(actorTop+detailOffset+(-37+1120)/2,960);
  for(let i=1;i<shots.length-1;i++)assert.ok(Math.abs(sizePresentationOffset(data,shots,i-1e-7,false)-sizePresentationOffset(data,shots,i+1e-7,false))<1e-5);
});
