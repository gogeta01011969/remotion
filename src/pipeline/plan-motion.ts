import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {actorSchema, motionSchema, propertiesFor, storyFragmentSchema, type Actor, type ShortInput} from '../shorts/schema';
import {compileStory, sampleActor} from '../shorts/motion';
import type {Research, Script} from './contracts';
import type {Delivery} from '../shorts/delivery';
import type {Language} from '../shorts/locale';
import type {Genre} from '../shorts/genres';
import type {Presentation} from '../shorts/presentation';
import type {GroqClient} from './groq';
import {structuredStage, writeJson} from './stages';
import {compileComparisons, compileSymbolicStory, compileSacredSymbol, directionSchema, validateDirection} from './direction';

const castSchema = z.object({actors: z.array(actorSchema).min(3).max(12)}).strict();
const sceneSchema = z.object({motion: z.array(motionSchema).min(1).max(16)}).strict();
type PlannedScene = {title: string; cues: string[]; spokenCues?: string[]; delivery?: Delivery; motion: z.infer<typeof motionSchema>[]};
function world(actors: Actor[], scenes: PlannedScene[], topic: string) {
  const input: ShortInput = {presentation:'narrated',captionMode: 'sentence', language: 'en', genre: 'what-if', schemaVersion: 2, topic, seed: 42, accent: '#73E7FF', fps: 30, actors, scenes: scenes.map(scene => ({title: scene.title, motion: scene.motion, durationInFrames: 210, captions: scene.cues.map((text, i) => ({text, from: 10 + i * Math.floor(180 / scene.cues.length), duration: Math.floor(180 / scene.cues.length)}))}))};
  const compiled = compileStory(input);
  const frame = Math.max(0, scenes.length * 210 - 1);
  return Object.fromEntries([...actors.map(a => a.id), 'camera'].map(id => [id, sampleActor(compiled, id, frame)]));
}
async function chunk<T>(options: {
  filename: string; input: string; generate: () => Promise<T>; validate: (raw: unknown) => T; log: (line: string) => void;
}): Promise<T> {
  const inputHash = createHash('sha256').update(options.input).digest('hex');
  if (existsSync(options.filename)) {
    const cached = JSON.parse(readFileSync(options.filename, 'utf8'));
    if (cached.inputHash !== inputHash) throw new Error(`Saved ${path.basename(options.filename)} does not match the current script/state. Start a new job.`);
    options.log(`motion: reused ${path.basename(options.filename)}`);
    return options.validate(cached.output);
  }
  const output = await options.generate(); writeJson(options.filename, {inputHash, output}); return output;
}
export async function planMotion(options: {
  script: Script; research: Research; presentation?:Presentation; language?: Language; genre?: Genre; model: string; client: Pick<GroqClient, 'chat'>; directory: string; root: string; log: (line: string) => void;
}) {
  const silentDirection=options.presentation==='silent' ? ' SILENT VISUAL STORY: There is no narration or soundtrack. Keep subjects and conditions visibly labeled, show the mechanism and result, and make the comparison understandable without reading a transcript. Cues are short supporting notes. Use progress anchors when timing an action independently of notes. Do not rely on audio to explain an ambiguous image.' : '';
  const guidance = readFileSync(path.join(options.root, 'shorts', 'PLANNER.md'), 'utf8')+silentDirection;
  const directionInput = JSON.stringify({...options.presentation==='silent'?{presentation:'silent'}:{},language: options.language ?? 'en', genre: options.genre ?? 'what-if', topic: options.research.topic, script: options.script, research: options.research.notes.slice(0, 6500)});
  const direction = await chunk({filename: path.join(options.directory, 'motion-direction.json'), input: directionInput, log: options.log, validate: raw => {const d = validateDirection(raw, options.script); if (options.genre === 'mythology' && d.renderer === 'comparison') throw new Error('Mythology uses narrative visuals, never gravity experiments.'); return d;}, generate: () => structuredStage({
    stage: 'motion', artifact: 'motion-direction', model: options.model, reasoningEffort: 'low', client: options.client, schema: directionSchema, directory: options.directory, log: options.log, input: directionInput, validate: raw => {const d = validateDirection(raw, options.script); if (options.genre === 'mythology' && d.renderer === 'comparison') throw new Error('Mythology uses narrative visuals, never gravity experiments.'); return d;},
    system: `VISUAL DIRECTION: Choose an executable visual grammar for the approved script. Return JSON.${silentDirection} When input language is hinglish, use short Roman-script Hinglish or plain English headings and meaning labels. Keep all machine keys and sound IDs unchanged. When input language is hi, ALL viewer-facing headings, reference names and meaning labels must be natural Hindi in Devanagari. Keep machine enums and A/U/M sound IDs in English, but map them to the actual cues naming अ/आ, उ/ऊ and म/म् respectively. Do not change the script or its facts.
For a script explaining Om/Aum, prefer renderer=sacred-symbol: symbol=om, reference=the actual named text/tradition (for example Mandukya Upanishad); associations=[{sound:A,meaning:Waking,cue:1},{sound:U,meaning:Dreaming,cue:2},{sound:M,meaning:Deep sleep,cue:3}] with meanings supported by the approved script and sources. Each association cue is the actual zero-based narration cue in the states scene explaining that sound; use ordered cue indices, not approximate time fractions. One scenes entry per approved scene, each with mode and heading. Modes reveal/resonate/states/silence/reflect respectively suit Hook/Mystery/Explanation/Payoff/Ending in a five-part Om explainer. The engine owns the glyph, illustrative waves, sound-state relationships and a quiet visual; no coordinates, deity art or invented curve meanings. Headings short 2–5 words, no slide title needed for every sentence. Preserve the approved script. Do not use the moon/Shiva story module for Om.
For genre=mythology, use renderer=symbolic-story when the narrative genuinely fits a moon, flame or lotus changing, finding refuge or renewing. It supports symbol moon/flame/lotus and guardian shiva/sanctuary/none. The shiva icon is ONLY for Lord Shiva stories; use sanctuary for a generic protective arch, none if no refuge is needed. Provide one scene entry per approved scene: action=reveal/diminish/approach/protect/renew, heading (2–5 words, maximum 45 characters), cue (which narration cue begins the action, usually 0). Use reveal for the curiosity hook, diminish for loss/curse, approach for seeking refuge, protect for shelter, renew for restoration. A four-scene lunar rescue can use reveal,diminish,protect,renew; protection includes movement of the crescent into the icon's hair. The library owns a continuous illustration, poses, mask-based lunar phases and layout. Preserve narration exactly. Do not force an unrelated story into this grammar: choose actors with a concise reason when it cannot express the story. Never choose gravity comparison for mythology. Do not invent new symbols or deity art.
For genre=what-if or explainer:  Prefer renderer=comparison ONLY when all scenes genuinely concern the same change in downward gravitational acceleration, and can be explained as force, fall, or launch comparisons. The renderer owns composition and calculates trajectories, labels, trails and metrics from gravityRatio. No planet backdrop or unrelated counters are needed. gravityRatio means changed gravitational acceleration divided by normal: half strength=0.5, twice strength=2. The ratio must match the researched premise and stay fixed across the story. Modes: force compares weight for identical masses; fall drops identical balls from identical heights (fall time ratio 1/sqrt(gravityRatio)); launch compares vertical jumps at identical initial speed (height and flight time ratios 1/gravityRatio). For launch scenes set focus=height when explaining jump height, and focus=time when explaining airtime; the metric labels must match the narration. For a hook, preview the clearest consequence; for the final scene, show the payoff. Use short clear headings (2–7 words, optional newline) and a short takeaway; no equations or formulas. referenceLabel and changedLabel name the two conditions and remain identical throughout. actionCue is the narration cue where the experiment begins, usually 0. Every scene needs a demonstration; use at least two distinct modes. Do not force unrelated topics or speculative consequences into these recipes. If the full story cannot be faithfully expressed with these mechanisms, choose renderer=actors with a reason; the normal object-track planner then runs. Preserve the approved script; return no revised narration or coordinates.`,
  })});
  if (direction.renderer === 'sacred-symbol') {
    options.log('motion: compiling sacred symbol explainer');
    return compileSacredSymbol(options.script, direction);
  }
  if (direction.renderer === 'symbolic-story') {
    options.log('motion: compiling continuous symbolic story');
    return compileSymbolicStory(options.script, direction);
  }
  if (direction.renderer === 'comparison') {
    options.log('motion: compiling validated comparison demonstrations');
    return compileComparisons(options.script, direction);
  }
  const castInput = JSON.stringify({topic: options.research.topic, assumptions: options.script.assumptions, scenes: options.script.scenes.map(({title, cues, visualIntent}) => ({title, cues, visualIntent}))});
  const validateCast = (raw: unknown) => {
    const cast = castSchema.parse(raw);
    storyFragmentSchema.parse({actors: cast.actors, scenes: []});
    if (!cast.actors.some(a => a.kind !== 'text' && a.kind !== 'particles')) throw new Error('Cast needs at least one real subject, not only labels or decoration.');
    return cast;
  };
  const cast = await chunk({filename: path.join(options.directory, 'motion-cast.json'), input: castInput, validate: validateCast, log: options.log, generate: () => structuredStage({
    stage: 'motion', artifact: 'motion-cast', model: options.model, client: options.client, schema: castSchema, directory: options.directory, log: options.log, validate: validateCast, input: castInput,
    system: `${guidance}\n\nCAST PLANNING STEP: Return only {actors:[...]}, defining the shared cast for the whole approved script. Use 3–12 actors, preferably 6–9. IDs MUST be lowercase letters/digits/hyphens, e.g. ball-a; never camelCase or underscores. Provide no motion tracks, no scenes and no code. Keep key visual subjects near x=540,y=850; use all initial states thoughtfully. Actors for later scenes must start opacity:0. Text: large enough to read, fontSize 30–90, width 800. Avoid stacking text on subjects. Do not use anatomical illustrations, feet, lungs or people; represent quantities with labeled abstract shapes. Every shape must specify width and height <=1800. Initial unused phase/value/amplitude channels must stay neutral: phase=0,value=0,amplitude=1. Use numeric:true for quantities whose value changes. There is no animated text string, color, width, height or radius property; choose existing numeric transform/value channels. Do not list camera in actors. Define enough shared actors/labels to explain ALL scenes, with their initial state for the beginning of the video.`,
  })});
  const scenes: PlannedScene[] = [];
  for (let index = 0; index < options.script.scenes.length; index++) {
    const approved = options.script.scenes[index];
    const currentState = world(cast.actors, scenes, options.research.topic);
    const input = JSON.stringify({sceneIndex: index, topic: options.research.topic, assumptions: options.script.assumptions, scene: approved, nextScene: options.script.scenes[index + 1]?.title ?? null, actors: cast.actors.map(({state: _initial, ...a}) => ({...a, currentState: currentState[a.id], allowedAnimatedProperties: propertiesFor(a.kind)})), cameraState: currentState.camera});
    const validate = (raw: unknown) => {
      const output = sceneSchema.parse(raw);
      const next = {title: approved.title, cues: approved.cues, spokenCues: approved.spokenCues, delivery: approved.delivery, motion: output.motion};
      storyFragmentSchema.parse({actors: cast.actors, scenes: [next]});
      world(cast.actors, [...scenes, next], options.research.topic);
      return output;
    };
    const label = `motion-scene-${String(index + 1).padStart(2, '0')}`;
    const planned = await chunk({filename: path.join(options.directory, `${label}.json`), input, validate, log: options.log, generate: () => structuredStage({
      stage: 'motion', artifact: label, model: options.model, client: options.client, schema: sceneSchema, directory: options.directory, log: options.log, validate, input,
      system: `You are the SCENE MOTION planning step. Return only {motion:[...]}, not actors, cues, titles or code. Animate the provided approved scene through its existing shared actors. Use only EXACT actor IDs and allowedAnimatedProperties from the input; camera supports x,y,scale. Each track targets ONE scalar numeric property and needs at least TWO ordered keyframes. Allowed anchors: "start", "end", or {cue:0,offset:0.5}, where cue is a zero-based index into THIS scene's cues and offset is a fraction 0–1. Easing is linear, smooth, hold, accelerate or decelerate. Use at most 3–8 tracks where practical, 2–4 keys per track. Do not invent actor IDs or properties such as text/color/width/height/radius. Position/scale/phase/amplitude/value provide the supported changes. Preserve the scenario assumptions. Only planet/waves/orbit/particles/comparison support phase; only waves support amplitude; only numeric text supports value. Phase is radians for planet/waves/orbit; particles phase is field-width cycles; comparison phase is progress 0–1. Actor states persist from prior scenes: begin from currentState unless explicitly repositioning a hidden object. Leave unused state unchanged. Opacity 0–1, scale 0.01–12, amplitude 0–300. Hide irrelevant objects/labels quickly in the first cue, reveal needed ones, and make the subject itself move/deform/change meaningfully. A camera push, opacity, text or particles alone are insufficient. Keep key content in x=70–925,y=200–1350, captions below1470. No decorative shakes or flashes. Do not arbitrarily count fixed facts from zero. If introducing a quantity comparison, animate the relevant force/height/path consistently with the narration.`,
    })});
    scenes.push({title: approved.title, cues: approved.cues, spokenCues: approved.spokenCues, delivery: approved.delivery, motion: planned.motion});
  }
  return {actors: cast.actors, scenes};
}
