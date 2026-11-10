import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {namesSound, speechText, voiceFor, symbolCopy} from '../src/shorts/locale';
import {promptsFor} from '../src/pipeline/prompts';

test('Hindi speech pronunciation preserves display text and selects the installed Hindi adapter', () => {
  const display = 'ॐ को पवित्र क्यों माना जाता है?';
  assert.equal(speechText(display, 'hi'), 'ओम को पवित्र क्यों माना जाता है?');
  assert.equal(display, 'ॐ को पवित्र क्यों माना जाता है?');
  assert.equal(speechText(display, 'en'), display);
  assert.equal(voiceFor('hi'), 'Lekha');
  assert.equal(voiceFor('en'), 'Daniel');
  assert.equal(symbolCopy.hi.sounds.A, 'अ');
  assert.ok(/देवनागरी|Devanagari/.test(promptsFor('mythology', undefined, 'hi').script));
});

test('sound anchors recognize Devanagari tokens without matching parts of unrelated words', () => {
  for (const text of ['पहली ध्वनि “अ” जागती अवस्था से जुड़ी है।', "'आ' की ध्वनि", 'The first sound A represents waking.']) assert.ok(namesSound(text, 'A'));
  assert.ok(namesSound('ध्वनि उ स्वप्न से जुड़ी है।', 'U'));
  assert.ok(namesSound('तीसरी ध्वनि म् गहरी नींद से जुड़ी है।', 'M'));
  assert.ok(namesSound('तीसरी ध्वनि “म” है।', 'M'));
  assert.equal(namesSound('यह उपनिषद की शिक्षा है।', 'U'), false);
  assert.equal(namesSound('यह मांडूक्य उपनिषद है।', 'M'), false);
  assert.equal(namesSound('इस अवस्था में मन शांत है।', 'A'), false);
  assert.equal(namesSound('The middle sound U represents dreaming.', 'A'), false);
});

import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import english from './fixtures/om-en.json';
import hindi from './fixtures/om-hi.json';
import hindiDirection from './fixtures/om-hi-direction.json';
import template from '../shorts/structures/sacred-symbol-60.json';
import {structureSchema} from '../src/shorts/structure';
import {validateScript, type Research} from '../src/pipeline/contracts';
import {validateDirection} from '../src/pipeline/direction';
import {generateShort} from '../src/pipeline/workflow';
import {previewInput} from '../src/shorts/defaults';

const structure = structureSchema.parse(template);
const translatedStructure = {...structure, hook: undefined};
const topic = 'Why is the Om symbol considered sacred?';
const research: Research = {topic, model: 'fixture', searched: true, toolExecutions: 5, notes: 'Fixture research for the source-grounded interpretation in the approved English narration. The script identifies the text and differentiates the fourth from deep sleep.', sources: [1,2,3,4].map(n => ({id: `s${n}`, title: `Source ${n}`, url: `https://example.org/source-${n}`}))};

test('Hindi scripts use language-aware budgets, attribution and valid sound anchors', () => {
  validateScript(english, research, 'mythology', structure);
  validateScript(hindi, research, 'mythology', translatedStructure, 'hi');
  validateDirection(hindiDirection, hindi);
  assert.throws(() => validateScript(hindi, research, 'mythology', translatedStructure), /Narration|spoken cue|opening hook/);
  assert.throws(() => validateScript(english, research, 'mythology', translatedStructure, 'hi'), /Hindi/);
  const wrong = structuredClone(hindiDirection); wrong.associations[1].cue = 0;
  assert.throws(() => validateDirection(wrong, hindi), /ordered/);
  const noAttribution = structuredClone(hindi);
  noAttribution.scenes = noAttribution.scenes.map(scene => ({...scene, cues: scene.cues.map(cue => cue.replace(/उपनिषद|ग्रंथ|परंपरा|व्याख्या/g, 'विचार'))}));
  assert.throws(() => validateScript(noAttribution, research, 'mythology', translatedStructure, 'hi'), /Attribute/);
});

test('language adaptation reuses research, supplies the source script, and renders Hindi props', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'hindi-adaptation-'));
  const sourceDir = path.join(root, 'out', 'jobs', 'original-om');
  const calls: string[] = [];
  try {
    mkdirSync(sourceDir, {recursive: true}); mkdirSync(path.join(root, 'shorts'));
    writeFileSync(path.join(root, 'shorts', 'PLANNER.md'), 'Use supported motion.');
    const originalRequest = JSON.stringify({id: 'original-om', topic, language: 'en', genre: 'mythology', structure, provider: 'groq', createdAt: '2026-01-01T00:00:00Z', models: {research: 'research', script: 'script', motion: 'motion'}});
    writeFileSync(path.join(sourceDir, 'request.json'), originalRequest);
    writeFileSync(path.join(sourceDir, 'research.json'), JSON.stringify(research));
    writeFileSync(path.join(sourceDir, 'script.json'), JSON.stringify(english));
    const result = await generateShort({presentation:'narrated',root, adaptFrom: 'original-om', language: 'hi', id: 'hindi-om', log: () => {}}, {
      config: {apiKey: 'fixture', researchModel: 'research', scriptModel: 'script', motionModel: 'motion'},
      client: {chat: async request => {
        calls.push(request.model);
        assert.equal(request.tools, undefined);
        if (request.model === 'script') {
          const input = JSON.parse(request.messages.find(m => m.role === 'user')!.content);
          assert.equal(input.language, 'hi');
          assert.deepEqual(input.sourceScript.scenes.map((s: {cues: string[]}) => s.cues), english.scenes.map(s => s.cues));
          assert.equal(input.structure.hook, undefined);
          assert.ok(request.messages[0].content.includes('LANGUAGE — HINDI'));
          return {choices: [{message: {content: JSON.stringify(hindi)}}]};
        }
        assert.equal(JSON.parse(request.messages[1].content).language, 'hi');
        return {choices: [{message: {content: JSON.stringify(hindiDirection)}}]};
      }},
      renderer: async (_root, filename) => {
        const brief = JSON.parse(readFileSync(filename, 'utf8'));
        assert.equal(brief.language, 'hi'); assert.equal(brief.voice, 'Lekha');
        const props = previewInput(brief); assert.equal(props.language, 'hi');
        assert.deepEqual(props.scenes.map(s => s.durationInFrames), [90,270,840,450,150]);
        const output = path.join(root, 'out', 'shorts', brief.id); mkdirSync(output, {recursive: true});
        writeFileSync(path.join(output, `${brief.id}.mp4`), 'fixture');
      },
    });
    assert.deepEqual(calls, ['script', 'motion']);
    assert.equal(readFileSync(path.join(sourceDir, 'request.json'), 'utf8'), originalRequest);
    const adaptation = JSON.parse(readFileSync(path.join(result.jobDir, 'adaptation.json'), 'utf8'));
    assert.deepEqual(adaptation, {sourceJob: 'original-om', sourceLanguage: 'en', targetLanguage: 'hi'});
    await assert.rejects(generateShort({root, resume: 'hindi-om', language: 'en'}, {config: {apiKey: 'fixture', researchModel: 'research', scriptModel: 'script', motionModel: 'motion'}}), /Changing language/);
  } finally {rmSync(root, {recursive: true, force: true});}
});
