import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import script from './fixtures/om-hinglish.json';
import rawDirection from './fixtures/om-hinglish-direction.json';
import template from '../shorts/structures/sacred-symbol-60.json';
import {structureSchema} from '../src/shorts/structure';
import {languageSchema, symbolCopy, voiceFor, speechText} from '../src/shorts/locale';
import {validateScript, type Research} from '../src/pipeline/contracts';
import {validateDirection, compileSacredSymbol, type Direction} from '../src/pipeline/direction';
import {validateMotion} from '../src/pipeline/workflow';
import {previewInput} from '../src/shorts/defaults';
import {briefSchema} from '../src/shorts/schema';
import {promptsFor} from '../src/pipeline/prompts';

const structure = {...structureSchema.parse(template), hook: undefined};
const research: Research = {topic: 'Why is Om sacred?', notes: 'Approved source-grounded teaching about the syllable Om in the Mandukya Upanishad. The fourth is distinguished from deep sleep. '.repeat(2), model: 'fixture', searched: true, toolExecutions: 5, sources: [1,2,3,4].map(n => ({id: `s${n}`, title: `Source ${n}`, url: `https://example.org/text-${n}`}))};

test('Hinglish keeps Roman captions separate from pronunciation-ready Hindi-English speech', () => {
  assert.equal(languageSchema.parse('hinglish'), 'hinglish');
  assert.equal(voiceFor('hinglish'), 'Lekha');
  const approved = validateScript(script, research, 'mythology', structure, 'hinglish');
  assert.ok(approved.scenes.every(s => s.cues.every(c => !/\p{Script=Devanagari}/u.test(c))));
  assert.ok(approved.scenes.every(s => s.spokenCues!.every(c => /\p{Script=Devanagari}/u.test(c))));
  assert.equal(speechText('ॐ', 'hinglish'), 'ओम');
  assert.equal(symbolCopy.hinglish.sounds.A, 'A');
  assert.ok(promptsFor('mythology', structure, 'hinglish').script.includes('LANGUAGE — HINGLISH'));
  const missing = {...structuredClone(script), scenes: script.scenes.map((scene, i) => ({...scene, spokenCues: i === 0 ? undefined : scene.spokenCues}))};
  assert.throws(() => validateScript(missing, research, 'mythology', structure, 'hinglish'), /spokenCues/);
  const mismatched = structuredClone(script); mismatched.scenes[2].spokenCues.pop();
  assert.throws(() => validateScript(mismatched, research, 'mythology', structure, 'hinglish'), /corresponding spoken cue/);
  const devanagariCaptions = structuredClone(script); devanagariCaptions.scenes[0].cues[0] = 'कभी सोचा है, ओम को पवित्र क्यों मानते हैं?';
  assert.throws(() => validateScript(devanagariCaptions, research, 'mythology', structure, 'hinglish'), /Roman script/);
});

test('motion planning preserves both display and speech, while render captions remain Roman', () => {
  const direction = validateDirection(rawDirection, script) as Extract<Direction, {renderer: 'sacred-symbol'}>;
  const plan = compileSacredSymbol(script, direction);
  const request = {id: 'hinglish-test', topic: research.topic, language: 'hinglish' as const, genre: 'mythology' as const, structure};
  const brief = validateMotion(plan, script, research, request);
  assert.deepEqual(brief.scenes.map(s => s.spokenCues), script.scenes.map(s => s.spokenCues));
  assert.equal(brief.voice, 'Lekha');
  const prepared = previewInput(brief);
  assert.equal(prepared.language, 'hinglish');
  assert.deepEqual(prepared.scenes.map(s => s.captions.map(c => c.text)), script.scenes.map(s => s.cues));
  assert.deepEqual(prepared.scenes.map(s => s.durationInFrames), [90,270,840,450,150]);
  const missingSpeech = {...brief, scenes: brief.scenes.map((scene, i) => ({...scene, spokenCues: i === 0 ? undefined : scene.spokenCues}))};
  assert.throws(() => briefSchema.parse(missingSpeech), /pronunciation-ready spokenCues/);
  const changedSpeech = structuredClone(plan); changedSpeech.scenes[0].spokenCues![0] = 'बदली हुई बात';
  assert.throws(() => validateMotion(changedSpeech, script, research, request), /verbatim/);
  const mismatched = structuredClone(brief); mismatched.scenes[2].spokenCues!.pop();
  assert.throws(() => briefSchema.parse(mismatched), /corresponding spoken cue/);
});
