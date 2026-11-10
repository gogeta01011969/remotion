import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import template from '../shorts/structures/sacred-symbol-60.json';
import {layoutTimedCues, structureSchema} from '../src/shorts/structure';
import {validateScript, type Research, type Script} from '../src/pipeline/contracts';
import {compileSacredSymbol, validateDirection, type Direction} from '../src/pipeline/direction';
import {validateMotion} from '../src/pipeline/workflow';
import {previewInput} from '../src/shorts/defaults';
import {shortSchema} from '../src/shorts/schema';
import {compileStory, sampleActor} from '../src/shorts/motion';
import {structuredStage} from '../src/pipeline/stages';
import {detectGenre} from '../src/shorts/genres';

const structure = structureSchema.parse(template);
const topic = 'Why is the Om symbol sacred?';
const research: Research = {topic, model: 'fixture', notes: 'The Mandukya Upanishad links the syllable Om with the Self and waking, dreaming, deep sleep and the fourth. '.repeat(2), sources: [{id: 's1', title: 'Text', url: 'https://example.org/mandukya'}, {id: 's2', title: 'Commentary', url: 'https://example.edu/mandukya'}], searched: true, toolExecutions: 3};
const script: Script = {title: 'Om and Experience', description: 'A sourced illustration of the Mandukya Upanishad teaching, rather than a claim about acoustic measurements.', assumptions: ['The associations are a traditional philosophical teaching.'], scenes: [
  [template.hook],
  ['One small syllable carries a surprisingly large question about experience.', 'Can a sound help us understand the life inside us?'],
  ['The Mandukya Upanishad uses Om as a way to contemplate and understand the inner Self.', 'It relates the sound A to waking, when attention meets the ordinary world outside.', 'U represents dreaming, where your experience turns toward an inner world of images and impressions.', 'M corresponds to deep sleep, without the familiar dream scenes or our ordinary everyday desires.', 'Together, these connect a familiar syllable with the different ways we experience life and contemplate our Self.'],
  ['But the teaching does not stop with those three sounds.', 'The fourth is soundless, pointing beyond waking, dreaming, and deep sleep.', 'Tradition invites contemplation of that quiet aspect, rather than another audible syllable.'],
  ['When the sound ends, what do you notice in silence?'],
].map((cues, i) => ({title: structure.beats[i].name, cues, visualIntent: 'The symbol and illustrative sound-state associations reveal the philosophical teaching.', sourceIds: ['s1']}))};
const direction: Extract<Direction, {renderer: 'sacred-symbol'}> = {renderer: 'sacred-symbol', symbol: 'om', reference: 'Mandukya Upanishad', associations: [{sound: 'A', cue: 1, meaning: 'Waking'}, {sound: 'U', cue: 2, meaning: 'Dreaming'}, {sound: 'M', cue: 3, meaning: 'Deep sleep'}], scenes: ['reveal', 'resonate', 'states', 'silence', 'reflect'].map((mode, i) => ({mode: mode as 'reveal', heading: structure.beats[i].name}))};

test('timed structure uses exact section boundaries and rejects silent overflow', () => {
  assert.deepEqual(structure.beats.map(b => b.durationSeconds), [3, 9, 28, 15, 5]);
  assert.throws(() => structureSchema.parse({...template, beats: template.beats.map(b => ({...b, durationSeconds: 20}))}), /30–60/);
  assert.throws(() => layoutTimedCues([85, 85], 90), /does not fit/);
  for (const [budget, durations] of [[90, [80]], [270, [90, 100]], [840, [130, 140, 150, 130, 130]]] as [number, number[]][]) {
    const positions = layoutTimedCues(durations, budget);
    assert.equal(positions[0].from, 1);
    positions.forEach((p, i) => {assert.ok(p.from + p.duration <= budget); if(i) assert.ok(p.from >= positions[i-1].from + positions[i-1].duration);});
  }
});

test('timed script preserves the supplied hook, budgets and ending without old short-form constraints', () => {
  assert.equal(detectGenre(topic), 'mythology');
  validateScript(script, research, 'mythology', structure);
  assert.throws(() => validateScript(script, research, 'mythology')); // old 30–45-second contract
  const shortened = structuredClone(script); shortened.scenes[2].cues = ['A is waking and U is dreaming.', 'M represents deep sleep.'];
  assert.throws(() => validateScript(shortened, research, 'mythology', structure), /Explanation|Write|Invalid input/);
  const wrongHook = structuredClone(script); wrongHook.scenes[0].cues = ['Why is Om sacred?'];
  assert.throws(() => validateScript(wrongHook, research, 'mythology', structure), /hook verbatim|Invalid input/);
  const wrongEnding = structuredClone(script); wrongEnding.scenes[4].cues = ['The final sound ends here, leaving us with a moment of silence.'];
  assert.throws(() => validateScript(wrongEnding, research, 'mythology', structure), /thoughtful question/);
});

test('sacred-symbol compilation preserves narration and exact 60-second render inputs', () => {
  validateDirection(direction, script);
  const plan = compileSacredSymbol(script, direction);
  const brief = validateMotion(plan, script, research, {id: 'timed-symbol', topic, genre: 'mythology', structure});
  const input = previewInput(brief);
  assert.deepEqual(input.scenes.map(s => s.durationInFrames), [90,270,840,450,150]);
  assert.deepEqual(brief.scenes.map(s => s.cues), script.scenes.map(s => s.cues));
  const timeline = compileStory(input);
  assert.deepEqual(timeline.starts.map(n => n / 30), [0,3,12,40,55]);
  direction.associations.forEach((association, i) => {
    const cue = input.scenes[2].captions[association.cue];
    const frame = timeline.starts[2] + cue.from + Math.round(cue.duration * .4);
    const phase = sampleActor(timeline, 'sacred-symbol', frame).phase - 2;
    assert.ok(phase >= .09 + i * .30 && phase <= .28 + i * .30, `Association ${association.sound} follows its spoken cue`);
  });
  const final = sampleActor(timeline, 'sacred-symbol', 1799);
  sampleActor(timeline, 'sacred-symbol', 13);
  assert.deepEqual(sampleActor(timeline, 'sacred-symbol', 1799), final);
  const movedBoundary = structuredClone(input); movedBoundary.scenes[2].durationInFrames -= 30; movedBoundary.scenes[3].durationInFrames += 30;
  assert.throws(() => shortSchema.parse(movedBoundary), /fixed beat duration/);
  const unbounded = {...input, structure: undefined}; assert.throws(() => shortSchema.parse(unbounded), /30–45/);
  const wrongDirection = {...direction, associations: [...direction.associations].reverse()};
  assert.throws(() => validateDirection(wrongDirection, script), /A, U, M|ordered/);
});

test('script repair uses the timed word budget and allows a one-cue hook', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'timed-script-'));
  try {
    const {scriptSchemaFor} = await import('../src/pipeline/contracts');
    let calls = 0;
    const output = await structuredStage({stage: 'script', model: 'fixture', schema: scriptSchemaFor('mythology', structure), system: 'Write the supplied structure.', input: JSON.stringify({structure}), directory, log: () => {}, validate: raw => validateScript(raw, research, 'mythology', structure), client: {chat: async request => {
      calls++;
      if (calls === 2) {
        assert.ok(request.messages.some(m => m.content.includes('Target 156 words')));
        assert.ok(!request.messages.some(m => m.content.includes('Target 96 words')));
        assert.ok(request.messages.some(m => m.content.includes('Hook and Ending may each have only one cue')));
      }
      const next = structuredClone(script); if (calls === 1) next.scenes[2].cues = ['A is waking, U is dreaming, and M is deep sleep.'];
      return {choices: [{message: {content: JSON.stringify(next)}}]};
    }}});
    assert.equal(calls, 2); assert.deepEqual(output, script);
  } finally {rmSync(directory, {recursive: true, force: true});}
});
