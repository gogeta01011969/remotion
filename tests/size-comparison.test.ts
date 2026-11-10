import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {sizeDatasetSchema, sizeSample} from '../src/shorts/size-data';
import {compileSizeComparison,defaultSizeEpisode} from '../src/pipeline/size-comparison';
import {previewInput} from '../src/shorts/defaults';
import {compileStory, sampleActor} from '../src/shorts/motion';
import {briefSchema} from '../src/shorts/schema';
import {planComparisonStory} from '../src/pipeline/comparison-story';
import {sampleSizeShots} from '../src/shorts/size-shots';
import {placeSizeLabels} from '../src/shorts/size-labels';
import space from '../comparisons/solar-system.json';
import spaceEpisode from '../comparisons/solar-system.en.json';
import sports from '../comparisons/sports-balls.json';
import sportsEpisode from '../comparisons/sports-balls.en.json';

test('true linear diameters and pair framing hold throughout every camera zoom', () => {
  for (const dataset of [space, sports]) {
    for (let frame = 0; frame <= 600; frame++) {
      const sample = sizeSample(dataset.items, frame / 600 * (dataset.items.length - 1));
      for (let i = 1; i < dataset.items.length; i++) assert.ok(Math.abs(sample.bodies[i].diameter / sample.bodies[0].diameter - dataset.items[i].value / dataset.items[0].value) < 1e-8);
    }
    for (let i = 0; i < dataset.items.length; i++) {
      const sample = sizeSample(dataset.items, i);
      for (const body of sample.bodies.slice(Math.max(0, i - 1), i + 1)) {
        assert.ok(body.x - body.diameter / 2 >= 39.99);
        assert.ok(body.x + body.diameter / 2 <= 860.01);
        assert.ok(body.diameter <= 600.01);
      }
    }
  }
});

test('tiny references stay subpixel instead of being enlarged to a misleading dot', () => {
  const items = [1, 10, 1000, 1000000].map(value => ({value}));
  const sample = sizeSample(items, 3);
  assert.ok(sample.bodies[0].diameter < .001);
  assert.equal(sample.bodies[0].diameter / sample.bodies[3].diameter, .000001);
});

test('measurements require common units, order, valid ranges and traceable sources', () => {
  for (const update of [
    {...space, unit: 'mixed'},
    {...space, items: space.items.map((item, i) => i ? item : {...item, value: 0})},
    {...space, items: [...space.items].reverse()},
    {...space, items: space.items.map((item, i) => i ? item : {...item, sourceIds: ['missing']})},
    {...space, items: space.items.map((item, i) => i ? item : {...item, range: {min: 4000, max: 5000}})},
  ]) assert.equal(sizeDatasetSchema.safeParse(update).success, false);
  const ball = sports.items.find(i=>i.id==='cricket')!;
  assert.ok(Math.abs(ball.value - 226.5 / Math.PI) < 1e-10);
  assert.ok(Math.abs(sports.items.find(i=>i.id==='football')!.value - 690 / Math.PI) < 1e-10);
});

test('one compiler accepts space and sports without subject branches and preserves narration', () => {
  for (const [data, episode] of [[space, spaceEpisode], [sports, sportsEpisode]] as const) {
    const before = JSON.stringify({data, episode});
    const brief = compileSizeComparison(data, episode);
    assert.equal(brief.actors.length, 1);
    assert.equal(brief.actors[0].kind, 'size-comparison');
    assert.deepEqual(brief.scenes.map(s => s.cues), episode.scenes.map(s => s.cues));
    assert.equal(brief.language, 'en');
    assert.equal(brief.voice, 'Daniel');
    assert.equal(brief.scenes.every(s => !s.spokenCues), true);
    assert.equal(JSON.stringify({data, episode}), before);
    const input = previewInput(brief), compiled = compileStory(input);
    const frames = [0, 42, 220, 500, input.scenes.reduce((n, s) => n + s.durationInFrames, 0) - 1];
    const forward = frames.map(f => sampleActor(compiled, 'sizes', f));
    assert.deepEqual([...frames].reverse().map(f => sampleActor(compiled, 'sizes', f)).reverse(), forward);
    for (let i = 1; i < compiled.starts.length; i++) {
      const cut = compiled.starts[i];
      assert.equal(sampleActor(compiled, 'sizes', cut - 1).phase, sampleActor(compiled, 'sizes', cut).phase);
    }
  }
  assert.throws(() => compileSizeComparison(space, sportsEpisode), /story plan/);
  assert.throws(() => compileSizeComparison(space, {...spaceEpisode, scenes: spaceEpisode.scenes.map(s => ({...s, durationSeconds: 3}))}), /30–45/);
  const invalid = compileSizeComparison(space, spaceEpisode);
  invalid.scenes[0].motion[0].keyframes[1].value = 100;
  assert.equal(briefSchema.safeParse(invalid).success, false);
});

test('one size-zoom template is used for every distribution while numerical evidence stays topic-specific', () => {
  const dataset = (values: number[]) => ({...sports, title:'Unrelated objects', items:values.map((value,i)=>({...sports.items[0],id:`item-${i}`,label:`Object ${i}`,value}))});
  assert.equal(planComparisonStory(space).strategy,'size-progression');
  const ballPlan=planComparisonStory(sports);
  assert.equal(ballPlan.strategy,'size-progression');
  assert.ok(Math.abs(ballPlan.evidence.closestPair.difference-(sports.items.find(i=>i.id==='baseball')!.value-sports.items.find(i=>i.id==='cricket')!.value))<1e-10);
  assert.deepEqual(ballPlan.shots.map(s=>s.layout),[...sports.items.map(()=>'zoom'),'zoom']);
  assert.equal(planComparisonStory(dataset([10,10.5,11,11.5])).strategy,'size-progression');
  const equal=planComparisonStory(dataset([10,10,11,12]));
  assert.equal(equal.strategy,'size-progression');
  assert.equal(equal.evidence.closestPair.difference,0);
  assert.equal(planComparisonStory(dataset([10,15,22,32])).strategy,'size-progression');
  assert.equal(planComparisonStory(dataset([1,5,20,100])).strategy,'size-progression');
  assert.equal(planComparisonStory(dataset([1,1.05,1.1,100])).strategy,'size-progression');
  const renamed={...sports,title:'A completely different topic',items:sports.items.map((item,i)=>({...item,label:`Object ${i}`}))};
  assert.deepEqual(planComparisonStory(renamed).shots,ballPlan.shots);
  const rescaled={...sports,unit:'m',items:sports.items.map(({range,...item})=>({...item,value:item.value/1000,range:range?{min:range.min/1000,max:range.max/1000}:undefined}))};
  assert.deepEqual(planComparisonStory(rescaled).shots,ballPlan.shots);
  const uncertain=structuredClone(sports);
  uncertain.items.find(i=>i.id==='cricket')!.range={min:71,max:74};
  assert.equal(planComparisonStory(uncertain).evidence.closestPair.rangesOverlap,true);
});

test('every adaptive shot and transition preserves true ratios, shared baselines and deterministic seeks', () => {
  for(const dataset of [space,sports]){
    const plan=planComparisonStory(dataset);
    for(let f=0;f<=400;f++){
      const phase=f/400*(plan.shots.length-1), sample=sampleSizeShots(dataset.items,plan.shots,phase);
      for(let i=0;i<sample.bodies.length;i++){
        assert.ok(Math.abs(sample.bodies[i].diameter/sample.bodies[0].diameter-dataset.items[i].value/dataset.items[0].value)<1e-8);
        assert.ok(Math.abs(sample.bodies[i].y+sample.bodies[i].diameter/2-860)<1e-7);
      }
      assert.deepEqual(sampleSizeShots(dataset.items,plan.shots,phase),sample);
    }
    plan.shots.forEach((shot,index)=>{
      const sample=sampleSizeShots(dataset.items,plan.shots,index);
      for(const i of shot.layout==='zoom' ? [Math.max(0,shot.focus-1),shot.focus] : shot.visible){
        assert.ok(sample.bodies[i].x-sample.bodies[i].diameter/2>=39.99);
        assert.ok(sample.bodies[i].x+sample.bodies[i].diameter/2<=860.01);
      }
      if(shot.layout==='overlay')assert.equal(sample.bodies[shot.focus].x,sample.bodies[shot.reference].x);
    });
  }
});

test('the shared progression rejects out-of-order episodes and invalid references', () => {
  const brief=compileSizeComparison(sports,sportsEpisode);
  assert.deepEqual(brief.scenes.map(s=>s.title),sportsEpisode.scenes.map(s=>s.heading));
  assert.equal(brief.structure?.beats[0].name,'table-tennis');
  const outdated=structuredClone(sportsEpisode);outdated.scenes[0].itemId='cricket';
  assert.throws(()=>compileSizeComparison(sports,outdated),/story plan/);
  const wrongReference=JSON.parse(JSON.stringify(sportsEpisode));
  wrongReference.scenes[1].references=[{at:0,itemId:'unknown'}];
  assert.throws(()=>compileSizeComparison(sports,wrongReference),/already visible/);
  const invalid=structuredClone(brief);
  const actor=invalid.actors[0];
  if(actor.kind==='size-comparison')actor.shots![0].visible=[7];
  assert.equal(briefSchema.safeParse(invalid).success,false);
  assert.equal(sizeDatasetSchema.safeParse({...space,items:space.items.map((item,i)=>i?item:{...item,appearance:'../../external'})}).success,false);
});

test('silent reference changes follow visual time independently of note timing', () => {
  const changed=JSON.parse(JSON.stringify(spaceEpisode));
  changed.scenes.at(-1).references=[{at:0,itemId:'earth'},{at:.58,itemId:'moon'}];
  const brief=compileSizeComparison(space,changed);
  const input=previewInput(brief), compiled=compileStory(input);
  const scene=input.scenes.at(-1)!, start=compiled.starts.at(-1)!;
  const change=start+Math.round(.58*(scene.durationInFrames-1));
  assert.equal(scene.captions.length,0);
  assert.equal(sampleActor(compiled,'sizes',change-1).reference,space.items.findIndex(i=>i.id==='earth'));
  assert.equal(sampleActor(compiled,'sizes',change).reference,0);
  const invalid=JSON.parse(JSON.stringify(spaceEpisode));
  invalid.scenes[3].references=[{at:0,itemId:'unknown'}];
  assert.throws(()=>compileSizeComparison(space,invalid),/already visible/);
});

test('the final zoom includes its named starting reference and labels fit the safe text rows',()=>{
  for(const dataset of [space,sports]){
    const plan=planComparisonStory(dataset),i=plan.shots.length-1,shot=plan.shots[i];
    const sample=sampleSizeShots(dataset.items,plan.shots,i);
    assert.equal(shot.reference,0);
    for(const index of [shot.focus,shot.reference]){
      const b=sample.bodies[index];
      assert.ok(b.x-b.diameter/2>=39.99&&b.x+b.diameter/2<=860.01);
    }
    const labels=placeSizeLabels(dataset.items,sample.bodies,shot.focus,shot.reference);
    assert.ok(labels.some(l=>l.index===shot.focus));assert.ok(labels.some(l=>l.index===shot.reference));
    for(const label of labels){
      assert.ok(label.x-label.width/2>=23.99&&label.x+label.width/2<=860.01);
      assert.ok(label.y<1030);
      for(const other of labels)if(label!==other&&label.y===other.y)assert.ok(Math.abs(label.x-other.x)>=(label.width+other.width)/2+19.99);
    }
    const long=dataset.items.map(item=>({...item,label:'A very long object label'}));
    const crowded=placeSizeLabels(long,sample.bodies,shot.focus,shot.reference);
    assert.ok(crowded.some(l=>l.index===shot.focus)&&crowded.some(l=>l.index===shot.reference));
  }
});

test('a new dataset alone produces a complete silent episode using the common template',()=>{
  for(const dataset of [space,sports]){
    const episode=defaultSizeEpisode(dataset),brief=compileSizeComparison(dataset,episode),input=previewInput(brief);
    assert.equal(episode.scenes.length,dataset.items.length);
    assert.deepEqual(episode.scenes.map(s=>s.itemId),dataset.items.map(item=>item.id));
    assert.equal(input.presentation,'silent');assert.equal(input.audio,undefined);
    const seconds=input.scenes.reduce((n,s)=>n+s.durationInFrames,0)/input.fps;
    assert.ok(seconds>=30&&seconds<=45);
  }
});

test('silent comparison inputs enforce names and stats without explanatory cues',()=>{
  const edited=JSON.parse(JSON.stringify(sportsEpisode));edited.scenes[0].cues=['This is an explainer.'];
  assert.throws(()=>compileSizeComparison(sports,edited),/names and stats only/);
  for(const dataset of [sports,space]){
    const episode=defaultSizeEpisode(dataset);
    assert.equal(episode.scenes.reduce((n,s)=>n+s.durationSeconds,0),30);
    assert.equal(episode.scenes.length,8);
    assert.ok(episode.scenes.every(s=>s.cues.length===0)&&episode.scenes.slice(0,-1).every(s=>s.durationSeconds<=4)&&episode.scenes.at(-1)!.durationSeconds===8);
  }
});
