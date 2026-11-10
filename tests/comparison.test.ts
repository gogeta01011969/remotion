import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {comparisonSample, ratioLabel} from '../src/shorts/mechanics';
import {compileComparisons, validateDirection, type ComparisonDirection} from '../src/pipeline/direction';
import {compileStory, sampleActor} from '../src/shorts/motion';
import {previewInput} from '../src/shorts/defaults';
import {briefSchema} from '../src/shorts/schema';
import baseline from '../shorts/half-gravity.json';

const script = {
  title: baseline.topic, description: baseline.description, assumptions: ['Ignore air resistance.'],
  scenes: baseline.scenes.map(s => ({title: s.title, cues: s.cues, visualIntent: 'Compare identical objects under two gravitational accelerations.', sourceIds: ['s1']})),
};
const direction: ComparisonDirection = {renderer: 'comparison', gravityRatio: 0.5, referenceLabel: 'NORMAL GRAVITY', changedLabel: 'HALF GRAVITY', scenes: ['launch', 'force', 'fall', 'launch'].map((mode, i) => ({mode: mode as 'launch' | 'force' | 'fall', focus: i === 3 ? 'time' : 'height', heading: 'A fair comparison', takeaway: 'Keep the initial conditions identical.', actionCue: 0}))};

test('half gravity preserves mass while halving weight, with identical initial force', () => {
  assert.equal(comparisonSample('force', .5, 0).force, 1);
  assert.equal(comparisonSample('force', .5, 1).force, .5);
});
test('equal-height falls obey the square-root time relation', () => {
  const sample = comparisonSample('fall', .5, .5);
  assert.ok(Math.abs(sample.changedTime / sample.normalTime - Math.SQRT2) < 1e-10);
  assert.equal(sample.normal, .5);
  assert.equal(sample.changed, .25);
  assert.equal(comparisonSample('fall', .5, 1).normal, 1);
  assert.equal(comparisonSample('fall', .5, 1).changed, 1);
  assert.equal(ratioLabel(Math.SQRT2), '1.4×');
});
test('equal-speed jumps double apex and airtime under half gravity', () => {
  const sample = comparisonSample('launch', .5, .5);
  assert.equal(sample.changedHeight / sample.normalHeight, 2);
  assert.equal(sample.changedTime / sample.normalTime, 2);
  assert.equal(sample.normal, 0); // Normal-gravity ball has landed.
  assert.equal(sample.changed, sample.changedHeight); // Half-gravity ball is at its apex.
  for (const ratio of [.15, .5, 1, 2, 3]) {
    assert.equal(comparisonSample('launch', ratio, 1).normal, 0);
    assert.equal(comparisonSample('launch', ratio, 1).changed, 0);
  }
});
test('direction compiles supported, isolated modules while retaining narration', () => {
  const plan = compileComparisons(script, validateDirection(direction, script) as ComparisonDirection);
  const brief = briefSchema.parse({...baseline, ...plan});
  assert.deepEqual(brief.scenes.map(s => s.cues), script.scenes.map(s => s.cues));
  const preview = previewInput(brief);
  const compiled = compileStory(preview);
  const firstEnd = preview.scenes[0].durationInFrames - 1;
  assert.equal(sampleActor(compiled, 'experiment-1', firstEnd).phase, 1);
  const secondEnd = firstEnd + preview.scenes[1].durationInFrames;
  assert.equal(sampleActor(compiled, 'experiment-1', secondEnd).opacity, 0);
  assert.equal(sampleActor(compiled, 'experiment-2', secondEnd).opacity, 1);
  assert.equal(plan.actors.every(a => a.kind === 'comparison'), true);
  assert.equal(plan.actors[3].kind === 'comparison' && plan.actors[3].metric, 'time');
  assert.throws(() => validateDirection({...direction, scenes: direction.scenes.map(s => ({...s, actionCue: 9}))}, script));
  const unsupported = structuredClone(script); unsupported.scenes[3].cues = ['You could clear any ceiling.'];
  assert.throws(() => validateDirection(direction, unsupported), /beyond the comparison renderer/);
});
