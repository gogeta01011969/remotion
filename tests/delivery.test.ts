import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {layoutDirectedCues, makeCaptionChunks} from '../src/shorts/delivery';
import {shortSchema, briefSchema} from '../src/shorts/schema';
import {previewInput} from '../src/shorts/defaults';
import {compileStory} from '../src/shorts/motion';
import {validateScript, type Research} from '../src/pipeline/contracts';
import {compileSacredSymbol, validateDirection, type Direction} from '../src/pipeline/direction';
import {validateMotion} from '../src/pipeline/workflow';
import original from './fixtures/om-hinglish.json';
import directionData from './fixtures/om-hinglish-direction.json';
import template from '../shorts/structures/sacred-symbol-60.json';
import {structureSchema} from '../src/shorts/structure';
import {promptsFor} from '../src/pipeline/prompts';

const research: Research = {topic: 'Why is Om sacred?', model: 'fixture', searched: true, toolExecutions: 4, notes: 'The source-grounded philosophical teaching distinguishes the soundless fourth from deep sleep, and uses waking, dreams and dreamless sleep as familiar experiences. ', sources: [1,2,3,4].map(n => ({id: `s${n}`, title: `Source ${n}`, url: `https://example.org/text-${n}`}))};
const structure = {...structureSchema.parse(template), hook: undefined};

test('directed narration preserves explicit pauses and rejects overflow or unplanned dead air', () => {
  const delivery = {rates: [160,155], pausesAfterMs: [500,100], maxEndHoldMs: 1500};
  const positions = layoutDirectedCues([60,90], 210, 30, delivery);
  assert.deepEqual(positions, [{from:1,duration:60},{from:76,duration:90}]);
  assert.equal(positions[1].from - (positions[0].from + positions[0].duration), 15);
  assert.deepEqual(delivery.rates, [160,155]);
  assert.throws(() => layoutDirectedCues([120,120],210,30,delivery), /speech was not accelerated or cut/);
  assert.throws(() => layoutDirectedCues([10],300,30,{pausesAfterMs:[0],maxEndHoldMs:500}), /unplanned hold/);
  assert.throws(() => layoutDirectedCues([60,90],210,30,{pausesAfterMs:[0],maxEndHoldMs:1500}), /every cue/);
});

test('phrase captions preserve every word and continuously cover measured parent audio', () => {
  const text = 'Text ise Turiya se jodta hai: koi nayi sleep stage nahi, balki teenon states se pare awareness.';
  for (const fps of [24,30,60]) {
    const chunks = makeCaptionChunks(text, 11, fps*6, fps);
    assert.ok(chunks.length > 1);
    assert.equal(chunks.map(c => c.text).join(' '),text);
    assert.equal(chunks[0].from,11);
    chunks.forEach((chunk,i) => {assert.ok(chunk.duration >= fps*.55);if(i) assert.equal(chunk.from,chunks[i-1].from+chunks[i-1].duration);});
    assert.equal(chunks.at(-1)!.from+chunks.at(-1)!.duration,11+fps*6);
  }
  assert.equal(makeCaptionChunks('A few fast words go here',0,20,30).length,1);
  assert.deepEqual(makeCaptionChunks('Om samajhna hai? Sound ke baad bhi suno.',0,90,30).map(c => c.text), ['Om samajhna hai?', 'Sound ke baad bhi suno.']);
});

test('delivery survives the motion handoff and phrase display does not change motion cue anchors', () => {
  const draft = {...original, scenes: original.scenes.map((scene,i) => ({...scene, delivery: i === 0 ? {rates:[160],pausesAfterMs:[0],maxEndHoldMs:1500} : undefined}))};
  const script = validateScript(draft,research,'mythology',structure,'hinglish');
  const direction = validateDirection(directionData,script) as Extract<Direction,{renderer:'sacred-symbol'}>;
  const plan = compileSacredSymbol(script,direction);
  const request = {id:'delivery-test',topic:research.topic,genre:'mythology' as const,language:'hinglish' as const,captionMode:'phrase' as const,structure};
  const brief = validateMotion(plan,script,research,request);
  assert.deepEqual(brief.scenes[0].delivery,script.scenes[0].delivery);
  const preview = previewInput(brief);
  const before = compileStory(preview);
  const phrased = structuredClone(preview);
  phrased.scenes.forEach(scene => scene.captions.forEach(caption => {caption.chunks=makeCaptionChunks(caption.text,caption.from,caption.duration,phrased.fps);}));
  shortSchema.parse(phrased);
  assert.deepEqual(compileStory(phrased),before);
  const changed = structuredClone(plan); changed.scenes[0].delivery!.rates![0]=190;
  assert.throws(() => validateMotion(changed,script,research,request),/verbatim/);
  const incomplete = structuredClone(brief); incomplete.scenes[0].delivery!.pausesAfterMs=[];
  assert.throws(() => briefSchema.parse(incomplete),/every narration cue|Too small/);
  const badChunk = structuredClone(phrased); badChunk.scenes[0].captions[0].chunks![0].text='Changed words';
  assert.throws(() => shortSchema.parse(badChunk),/preserve their full parent text/);
  assert.ok(promptsFor('mythology',undefined,'hinglish').script.includes('RETENTION AND DELIVERY'));
});
