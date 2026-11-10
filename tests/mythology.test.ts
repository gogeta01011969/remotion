import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {detectGenre, presentations} from '../src/shorts/genres';
import {promptsFor} from '../src/pipeline/prompts';
import {validateScript, type Script, type Research} from '../src/pipeline/contracts';
import {compileSymbolicStory, validateDirection, type Direction} from '../src/pipeline/direction';
import {sampleSymbol} from '../src/shorts/story-symbols';
import {generateShort} from '../src/pipeline/workflow';
import type {Completion} from '../src/pipeline/groq';
import {previewInput} from '../src/shorts/defaults';
import {compileStory, sampleActor} from '../src/shorts/motion';
import {briefSchema} from '../src/shorts/schema';

const topic = 'Why does Lord Shiva wear a crescent moon?';
const script: Script = {
  title: 'The Moon in Shiva’s Hair', description: 'A symbolic retelling of one Hindu traditional account, not an astronomical explanation.', assumptions: ['Traditional accounts vary; illustrations are symbolic.'],
  scenes: [
    ['Why does Shiva wear a crescent moon?', 'One Hindu tradition begins with Chandra, the moon god, facing a terrible curse.'],
    ['Chandra favored Rohini over his other wives, angering their father, Daksha.', 'Daksha cursed him to fade away, and his light began to vanish.'],
    ["Desperate, Chandra sought Shiva’s protection before the last of his light was lost.", 'Shiva sheltered the crescent in his matted hair, giving the moon refuge.'],
    ['The curse remained, but Chandra could grow bright again, then wane once more.', 'That crescent remembers the rescue: a symbol of compassion, protection, and renewal.'],
  ].map((cues, i) => ({title: `Story beat ${i+1}`, cues, visualIntent: 'The moon changes its light and moves toward a protective illustrated guardian.', sourceIds: ['s1']})),
};
const direction: Extract<Direction, {renderer: 'symbolic-story'}> = {renderer: 'symbolic-story', symbol: 'moon', guardian: 'shiva', scenes: ['reveal', 'diminish', 'protect', 'renew'].map((action, i) => ({action: action as 'reveal', heading: `Beat ${i+1}`, cue: 0}))};
const research: Research = {topic, model: 'fixture', notes: 'Fixture notes on a traditional lunar rescue narrative and its variations. '.repeat(3), sources: [{id: 's1', title: 'Traditional account', url: 'https://example.org/tradition'}, {id: 's2', title: 'Iconography', url: 'https://example.edu/iconography'}], searched: true, toolExecutions: 3};
const response = (output: unknown): Completion => ({choices: [{message: {content: JSON.stringify(output)}}]});

test('content routing preserves hypotheticals and selects mythology with a neutral fallback', () => {
  assert.equal(detectGenre(topic), 'mythology');
  assert.equal(detectGenre('What if gravity were half as strong?'), 'what-if');
  assert.equal(detectGenre('What if Thor visited Earth?'), 'what-if');
  assert.equal(detectGenre('Why do leaves change color?'), 'explainer');
  assert.equal(detectGenre('The wisdom of Athena'), 'mythology');
  assert.ok(!presentations.mythology.tags.includes('#Science'));
  assert.ok(!presentations.mythology.label.includes('WHAT IF'));
  assert.notEqual(promptsFor('mythology').research, promptsFor('what-if').research);
});

test('mythology accepts a direct hook, requires attribution, and rejects forced hypotheticals', () => {
  assert.deepEqual(validateScript(script, research, 'mythology').scenes[0].cues, script.scenes[0].cues);
  assert.throws(() => validateScript(script, research), /What if/);
  const hypothetical = structuredClone(script); hypothetical.scenes[0].cues[0] = 'What if Shiva lost his moon?';
  assert.throws(() => validateScript(hypothetical, research, 'mythology'), /not a What if/);
  const unattributed = structuredClone(script); unattributed.scenes[0].cues[1] = 'Chandra, the moon god, was facing a terrible curse that threatened his light.';
  assert.throws(() => validateScript(unattributed, research, 'mythology'), /Attribute/);
  const wrongSource = structuredClone(script); wrongSource.scenes[1].sourceIds = ['invented'];
  assert.throws(() => validateScript(wrongSource, research, 'mythology'), /not present/);
});

test('symbolic story preserves narration, has continuous seek-independent poses and bounded progress', () => {
  validateDirection(direction, script);
  const plan = compileSymbolicStory(script, direction);
  assert.deepEqual(plan.scenes.map(s => s.cues), script.scenes.map(s => s.cues));
  const brief = briefSchema.parse({...plan, genre: 'mythology', schemaVersion: 2, id: 'myth-test', topic, description: script.description, seed: 42, accent: '#EBC98A'});
  const preview = previewInput(brief);
  assert.equal(preview.genre, 'mythology');
  const compiled = compileStory(preview);
  for (let i = 1; i < direction.scenes.length; i++) {
    const left = sampleSymbol(direction.scenes, i - 1e-7), right = sampleSymbol(direction.scenes, i + 1e-7);
    for (const key of Object.keys(left) as (keyof typeof left)[]) assert.ok(Math.abs(left[key] - right[key]) < 1e-4);
  }
  const sought = sampleSymbol(direction.scenes, 2.5);
  sampleSymbol(direction.scenes, 0); sampleSymbol(direction.scenes, 4);
  assert.deepEqual(sampleSymbol(direction.scenes, 2.5), sought);
  assert.equal(sampleSymbol(direction.scenes, 4).light, 1);
  assert.ok(sampleActor(compiled, 'story-symbol', 1259).phase < 4);
  const invalid = structuredClone(brief); invalid.scenes[0].motion[0].keyframes[2].value = 7;
  assert.throws(() => briefSchema.parse(invalid), /progress/);
  const other = structuredClone(script); other.scenes = other.scenes.map(s => ({...s, cues: s.cues.map(c => c.replace(/Shiva|Shiva’s/gi, 'a guardian'))}));
  assert.throws(() => validateDirection(direction, other), /requires a story/);
});

test('topic-only mythology workflow uses narrative research, writing, direction and render metadata', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myth-pipeline-'));
  mkdirSync(path.join(root, 'shorts')); writeFileSync(path.join(root, 'shorts', 'PLANNER.md'), 'Use supported symbols.');
  const calls: string[] = [];
  try {
    const result = await generateShort({presentation:'narrated',root, topic, id: 'myth-auto', log: () => {}}, {
      config: {apiKey: 'fixture', researchModel: 'research', scriptModel: 'script', motionModel: 'motion'},
      client: {chat: async request => {
        calls.push(request.model);
        if (request.tools) {
          assert.ok(request.messages[0].content.includes('Mythology'));
          return {choices: [{message: {content: research.notes, executed_tools: [{type: 'browser_search'}, ...research.sources.map(s => ({type: 'browser.open', search_results: {results: [{url: s.url, title: s.title, content: s.title}]}}))]}}]};
        }
        if (request.model === 'script') {
          assert.ok(request.messages[0].content.includes('NEVER start What if'));
          assert.ok(!request.messages.some(m => m.content.includes('EDITORIAL REVISION')));
          return response(script);
        }
        return response(direction);
      }},
      renderer: async (_root, filename) => {
        const brief = JSON.parse(readFileSync(filename, 'utf8'));
        assert.equal(brief.genre, 'mythology');
        assert.ok(brief.description.includes('#Mythology'));
        assert.ok(!brief.description.includes('#WhatIf'));
        assert.equal(brief.actors[0].kind, 'symbolic-story');
        assert.deepEqual(brief.scenes.map((s: {cues: string[]}) => s.cues), script.scenes.map(s => s.cues));
        const dir = path.join(root, 'out', 'shorts', brief.id); mkdirSync(dir, {recursive: true}); writeFileSync(path.join(dir, `${brief.id}.mp4`), 'fixture');
      },
    });
    assert.deepEqual(calls, ['research', 'script', 'motion']);
    assert.equal(result.plannedOnly, false);
    await assert.rejects(generateShort({root, resume: 'myth-auto', genre: 'what-if', log: () => {}}, {config: {apiKey: 'fixture', researchModel: 'x', scriptModel: 'x', motionModel: 'x'}}), /Changing genre requires a new job/);
  } finally {rmSync(root, {recursive: true, force: true});}
});

test('provider constrained-JSON failures recover without bypassing local script validation', async () => {
  const {structuredStage} = await import('../src/pipeline/stages');
  const {scriptSchemaFor} = await import('../src/pipeline/contracts');
  const directory = mkdtempSync(path.join(tmpdir(), 'myth-json-'));
  let calls = 0;
  try {
    const result = await structuredStage({stage: 'script', model: 'test', schema: scriptSchemaFor('mythology'), system: promptsFor('mythology').script, input: '{}', directory, log: () => {}, validate: raw => validateScript(raw, research, 'mythology'), client: {chat: async request => {
      calls++;
      if (calls === 1) {assert.equal(request.response_format?.type, 'json_schema'); throw new Error('GroqCloud HTTP 400: Failed to generate JSON.');}
      assert.equal(request.response_format?.type, 'json_object');
      if (calls === 2) {const invalid = structuredClone(script); invalid.scenes[0].sourceIds = ['fabricated']; return response(invalid);}
      assert.ok(request.messages.some(m => m.content.includes('not present')));
      return response(script);
    }}});
    assert.deepEqual(result, script);
    assert.equal(calls, 3);
  } finally {rmSync(directory, {recursive: true, force: true});}
});
