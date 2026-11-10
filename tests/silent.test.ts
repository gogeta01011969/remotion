import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {compileSizeComparison} from '../src/pipeline/size-comparison';
import {prepareSilentInput} from '../src/shorts/silent';
import {briefSchema,shortSchema,shortDuration} from '../src/shorts/schema';
import {compileStory,sampleActor} from '../src/shorts/motion';
import {footballPanels,golfDimple} from '../src/shorts/object-materials';
import data from '../comparisons/sports-balls.json';
import episode from '../comparisons/sports-balls.en.json';

test('silent preparation has optional brief notes, no audio, and no voice dependency',()=>{
  const brief=compileSizeComparison(data,episode);
  brief.voice='A deliberately unavailable voice';
  const input=prepareSilentInput(brief);
  assert.equal(input.presentation,'silent');
  assert.equal(input.audio,undefined);
  assert.equal(shortDuration(input),30*30);
  assert.equal(input.scenes.reduce((n,s)=>n+s.captions.length,0),0);
  assert.equal(input.scenes[1].captions.length,0);
  const compiled=compileStory(input);
  const withNote=structuredClone(brief);withNote.scenes[0].cues=['Compare sizes.'];
  const alternate=compileStory(prepareSilentInput(withNote));
  for(const frame of [0,100,240,700,899])assert.deepEqual(sampleActor(compiled,'sizes',frame),sampleActor(alternate,'sizes',frame));
});

test('silent contracts reject audio, speech metadata and unreadable transcript fragments',()=>{
  const brief=compileSizeComparison(data,episode),input=prepareSilentInput(brief);
  assert.equal(shortSchema.safeParse({...input,audio:'shorts/old/soundtrack.wav'}).success,false);
  const tooFast=structuredClone(input);tooFast.scenes[0].captions=[{text:'A readable note needs time.',from:0,duration:1}];
  assert.equal(shortSchema.safeParse(tooFast).success,false);
  const spoken=structuredClone(brief);spoken.scenes[0].spokenCues=['A voice-over.'];
  assert.equal(briefSchema.safeParse(spoken).success,false);
  const transcript=structuredClone(brief);transcript.scenes[0].cues=['This is an entire long spoken sentence that should not be used as an on-screen subtitle.'];
  assert.equal(briefSchema.safeParse(transcript).success,false);
  const missingMap=JSON.parse(JSON.stringify(data));missingMap.items[0].material='ocean';
  assert.throws(()=>compileSizeComparison(missingMap,episode),/surface map/);
});

test('the football material has a complete symmetric 32-panel spherical construction',()=>{
  const faces=footballPanels();
  assert.equal(faces.length,32);assert.equal(faces.filter(f=>f.black).length,12);
  assert.equal(faces.filter(f=>!f.black).length,20);
  for(const f of faces){assert.ok(Math.abs(Math.hypot(...f.normal)-1)<1e-10);assert.ok(f.plane>.5&&f.plane<1);}
  for(const f of faces)assert.ok(faces.some(other=>Math.hypot(...other.normal.map((n,i)=>n+f.normal[i]))<1e-10&&other.black===f.black));
});

test('golf relief is bounded, continuous across the longitude wrap and absent outside dimples',()=>{
  let recessed=0,flat=0;
  for(let row=1;row<50;row++)for(let col=0;col<100;col++){
    const lat=row/50*Math.PI,lon=col/100*2*Math.PI;
    const depth=golfDimple(lat,lon);
    assert.ok(Number.isFinite(depth)&&depth>=0&&depth<=1);
    assert.ok(Math.abs(depth-golfDimple(lat,lon+2*Math.PI))<1e-10);
    if(depth>.1)recessed++;if(depth===0)flat++;
  }
  assert.ok(recessed>500&&flat>500);
});
