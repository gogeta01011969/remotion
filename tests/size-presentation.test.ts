import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import {resolveSizeEnvironment} from '../src/shorts/size-environment';
import {textEntrance,sizeTextTiming} from '../src/shorts/size-text-motion';
import {fitText,fitNoteText,type MeasureText} from '../src/shorts/text-metrics';
import {placeSizeLabels} from '../src/shorts/size-labels';
import {compileSizeComparison} from '../src/pipeline/size-comparison';
import {prepareSilentInput} from '../src/shorts/silent';
import space from '../comparisons/solar-system.json';
import sports from '../comparisons/sports-balls.json';
import episode from '../comparisons/solar-system.en.json';

test('backgrounds follow episode metadata and support explicit choice across changing object materials',()=>{
  const planets=sizeDatasetSchema.parse(space),balls=sizeDatasetSchema.parse(sports);
  assert.equal(resolveSizeEnvironment(planets),'space');
  assert.equal(resolveSizeEnvironment(balls),'sports');
  assert.equal(resolveSizeEnvironment({...balls,environment:'studio'}),'studio');
  assert.equal(resolveSizeEnvironment({...balls,environment:'space'}),'space');
  assert.equal(resolveSizeEnvironment({...balls,items:balls.items.map(i=>({...i,material:'plain'}))}),'sports');
  assert.equal(resolveSizeEnvironment({...balls,items:[planets.items[0],...balls.items.slice(1)]}),'sports');
  const renamed={...balls,items:balls.items.map(i=>({...i,label:'A different name'}))};
  assert.equal(resolveSizeEnvironment(renamed),'sports');
  assert.equal(sizeDatasetSchema.safeParse({...sports,environment:'arbitrary-image-url'}).success,false);
});

test('text enters and exits in a bounded reading slot without springs or seek-dependent state',()=>{
  for(const fps of [24,30,60]){
    const duration=8*fps,from=Math.round(.2*fps),enter=Math.round(.45*fps);
    assert.equal(textEntrance(from,from,enter,duration,fps).opacity,0);
    assert.equal(textEntrance(from+enter,from,enter,duration,fps).opacity,1);
    assert.equal(textEntrance(duration-1,from,enter,duration,fps).opacity,0);
    const samples=Array.from({length:duration},(_,frame)=>textEntrance(frame,from,enter,duration,fps));
    for(const sample of samples){assert.ok(sample.opacity>=0&&sample.opacity<=1);assert.ok(sample.offsetY>=0&&sample.offsetY<=10);}
    for(const frame of [duration-3,44,12,0,100])assert.deepEqual(textEntrance(frame,from,enter,duration,fps),samples[frame]);
  }
});

test('reference changes restart only the readout entrance at the measured visual keyframe',()=>{
  const changed=JSON.parse(JSON.stringify(episode));
  changed.scenes.at(-1).references=[{at:0,itemId:'earth'},{at:.58,itemId:'moon'}];
  const input=prepareSilentInput(compileSizeComparison(space,changed)),scene=input.scenes.at(-1)!;
  const at=Math.round(.58*(scene.durationInFrames-1));
  assert.equal(sizeTextTiming(scene,at-1,'sizes').referenceChangedAt,0);
  assert.equal(sizeTextTiming(scene,at,'sizes').referenceChangedAt,at);
  assert.equal(sizeTextTiming(scene,scene.durationInFrames-1,'sizes').referenceChangedAt,at);
});

test('glyph-aware fitting and label layout reserve enough room for wide names and short notes',()=>{
  const measure:MeasureText=(text,size,_weight,spacing=0)=>Array.from(text).reduce((w,c)=>w+(c==='W'?.95:c==='i'?.24:.55)*size,0)+Math.max(0,text.length-1)*spacing;
  const wide='W'.repeat(24),narrow='i'.repeat(24);
  assert.ok(fitText(wide,82,836,750,measure)<fitText(narrow,82,836,750,measure));
  assert.ok(measure(wide,fitText(wide,82,836,750,measure),750)<=836.001);
  const items=[wide,narrow,'A long reference label','Football'].map(label=>({label}));
  const bodies=[{x:70,diameter:80,opacity:1},{x:210,diameter:120,opacity:1},{x:370,diameter:140,opacity:1},{x:700,diameter:420,opacity:1}];
  const labels=placeSizeLabels(items,bodies,3,0,measure);
  assert.ok(labels.some(l=>l.index===3)&&labels.some(l=>l.index===0));
  for(const label of labels){
    assert.ok(measure(label.text,label.fontSize,label.index===3?650:500)<=label.width);
    assert.ok(label.x-label.width/2>=24&&label.x+label.width/2<=860);
    for(const other of labels)if(label!==other&&label.y===other.y)assert.ok(Math.abs(label.x-other.x)>=(label.width+other.width)/2+19.99);
  }
  assert.equal(fitNoteText('One shared scale.',851,measure),30);
  assert.ok(fitNoteText('W'.repeat(240),851,measure)<30);
});
