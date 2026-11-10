import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {defaultShort, previewInput} from '../src/shorts/defaults';
import {briefSchema, shortDuration, shortSchema} from '../src/shorts/schema';
import {compileStory, resolveAnchor, sampleActor, sampleTrack} from '../src/shorts/motion';
import earth from '../shorts/earth-stops.json';
import gravity from '../shorts/half-gravity.json';

test('two topics use the same contract and compiler', () => {
  for (const brief of [earth, gravity]) {
    assert.ok(briefSchema.safeParse(brief).success);
    const input = previewInput(brief);
    assert.equal(shortDuration(input) / input.fps, 42);
    const story = compileStory(input);
    assert.ok(input.actors.every(a => story.tracks[a.id]));
  }
});

test('sampling is seek independent and the compiler does not mutate input', () => {
  const input = defaultShort;
  const before = JSON.stringify(input);
  const compiled = compileStory(input);
  const expected = sampleActor(compiled, 'earth', 300);
  for (const frame of [900, 0, 600, 300, 700, 5]) sampleActor(compiled, 'earth', frame);
  assert.deepEqual(sampleActor(compiled, 'earth', 300), expected);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(compileStory({...input, topic: 'An entirely different topic label'}).tracks, compiled.tracks);
});

test('a stopped property holds across frames while another actor continues', () => {
  const compiled = compileStory(defaultShort);
  const start = compiled.starts[2];
  const scene = defaultShort.scenes[2];
  const stoppedAt = start + resolveAnchor({cue: 0, offset: 0.6}, scene);
  const end = start + scene.durationInFrames - 1;
  assert.equal(sampleActor(compiled, 'earth', stoppedAt).phase, sampleActor(compiled, 'earth', end).phase);
  assert.ok(sampleActor(compiled, 'air', end).phase > sampleActor(compiled, 'air', stoppedAt).phase);
});

test('properties persist into subsequent scenes without explicit reset', () => {
  const compiled = compileStory(defaultShort);
  const index = 3;
  const before = sampleActor(compiled, 'earth', compiled.starts[index] - 1).phase;
  const after = sampleActor(compiled, 'earth', compiled.starts[index] + 100).phase;
  assert.equal(before, after);
});

test('hold and acceleration interpolation have explicit predictable behavior', () => {
  assert.equal(sampleTrack([{frame: 0, value: 0, easing: 'hold'}, {frame: 100, value: 100, easing: 'hold'}], 99), 0);
  assert.equal(sampleTrack([{frame: 0, value: 0, easing: 'linear'}, {frame: 100, value: 100, easing: 'accelerate'}], 50), 25);
  assert.equal(sampleTrack([{frame: 0, value: 0, easing: 'linear'}, {frame: 100, value: 100, easing: 'hold'}], 100), 100);
});

test('rejects unsupported assets, unknown objects/properties and missing cues', () => {
  assert.equal(shortSchema.safeParse({...defaultShort, audio: '../secret.wav'}).success, false);
  assert.equal(briefSchema.safeParse({...earth, actors: [{...earth.actors[0], kind: 'image'}]}).success, false);
  for (const mutation of [
    {actor: 'missing'}, {property: 'unsupported'}, {keyframes: [{at: {cue: 4, offset: 0}, value: 0}, {at: 'end', value: 1}]},
  ]) {
    const copy = structuredClone(earth);
    Object.assign(copy.scenes[0].motion[0], mutation);
    assert.equal(briefSchema.safeParse(copy).success, false);
  }
  const copy = structuredClone(earth);
  copy.scenes[0].motion[0].actor = 'hook'; // Text cannot spin like a planet.
  assert.equal(briefSchema.safeParse(copy).success, false);
  const ignoredState = structuredClone(earth);
  Object.assign(ignoredState.actors[1].state, {phase: 4});
  assert.equal(briefSchema.safeParse(ignoredState).success, false);
});

test('the measured compiler rejects keys that collide after frame rounding', () => {
  const input = structuredClone(defaultShort);
  input.scenes[0].motion[0].keyframes = [
    {at: 'start', value: 0, easing: 'linear'},
    {at: {cue: 0, offset: 0.001}, value: 1, easing: 'linear'},
    {at: {cue: 0, offset: 0.002}, value: 2, easing: 'linear'},
  ];
  assert.throws(() => compileStory(input), /same or reversed frame/);
});

test('rejects duplicate actor IDs/tracks, reversed keys, invalid captions and durations', () => {
  assert.equal(briefSchema.safeParse({...earth, actors: [earth.actors[0], ...earth.actors]}).success, false);
  const duplicate = structuredClone(earth);
  duplicate.scenes[0].motion.push(duplicate.scenes[0].motion[0]);
  assert.equal(briefSchema.safeParse(duplicate).success, false);
  const reversed = structuredClone(earth);
  reversed.scenes[0].motion[0].keyframes.reverse();
  assert.equal(briefSchema.safeParse(reversed).success, false);
  assert.equal(shortSchema.safeParse({...defaultShort, scenes: defaultShort.scenes.map(s => ({...s, durationInFrames: 30}))}).success, false);
  const input = structuredClone(defaultShort);
  input.scenes[0].captions[0].duration = 10000;
  assert.equal(shortSchema.safeParse(input).success, false);
});

test('text, camera movement and decoration alone cannot pass as subject animation', () => {
  const input = structuredClone(earth);
  input.scenes[0].motion = [{actor: 'camera', property: 'scale', keyframes: [{at: 'start', value: 1, easing: 'linear'}, {at: 'end', value: 1.5, easing: 'smooth'}]}];
  assert.equal(briefSchema.safeParse(input).success, false);
});
