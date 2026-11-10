import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {defaultInput, getTimeline, videoSchema} from '../src/config';

test('timeline accounts for overlap and exactly preserves requested duration', () => {
  for (const fps of [12, 24, 30, 60]) {
    for (const count of [1, 3, 8]) {
      for (const durationSeconds of [9, 15.37, 120]) {
        const input = {...defaultInput, fps, durationSeconds, scenes: Array.from({length: count}, (_, i) => ({...defaultInput.scenes[i % 3], weight: i % 2 ? 0.5 : 5}))};
        const timeline = getTimeline(input);
        assert.equal(timeline.sceneFrames.reduce((a, b) => a + b, 0) - (count - 1) * timeline.transitionFrames, Math.round(fps * durationSeconds));
        assert.ok(timeline.sceneFrames.every(n => Number.isInteger(n) && n > timeline.transitionFrames));
      }
    }
  }
});

test('JSON input rejects invalid render settings and accepts defaults', () => {
  assert.deepEqual(videoSchema.parse(defaultInput), defaultInput);
  for (const change of [{scenes: []}, {width: 1921}, {fps: 0}, {durationSeconds: 0}, {particleCount: 101}, {colors: {...defaultInput.colors, ink: 'invalid'}}]) {
    assert.equal(videoSchema.safeParse({...defaultInput, ...change}).success, false);
  }
});
