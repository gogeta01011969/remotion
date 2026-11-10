import {z} from 'zod';
import {briefSchema, type Actor, type Brief} from '../shorts/schema';
import {namesSound} from '../shorts/locale';
import type {Script} from './contracts';

export const directionSchema = z.discriminatedUnion('renderer', [
  z.object({renderer: z.literal('sacred-symbol'), symbol: z.literal('om'), reference: z.string().min(1).max(60), associations: z.array(z.object({sound: z.enum(['A', 'U', 'M']), cue: z.number().int().min(0).max(4), meaning: z.string().min(1).max(25)}).strict()).length(3), scenes: z.array(z.object({mode: z.enum(['reveal', 'resonate', 'states', 'silence', 'reflect']), heading: z.string().min(1).max(45)}).strict()).min(4).max(6)}).strict(),
  z.object({renderer: z.literal('symbolic-story'), symbol: z.enum(['moon', 'flame', 'lotus']), guardian: z.enum(['shiva', 'sanctuary', 'none']), scenes: z.array(z.object({action: z.enum(['reveal', 'diminish', 'approach', 'protect', 'renew']), heading: z.string().min(1).max(45), cue: z.number().int().min(0).max(2)}).strict()).min(4).max(6)}).strict(),
  z.object({
    renderer: z.literal('comparison'),
    gravityRatio: z.number().min(0.15).max(3),
    referenceLabel: z.string().min(1).max(20), changedLabel: z.string().min(1).max(20),
    scenes: z.array(z.object({mode: z.enum(['fall', 'launch', 'force']), focus: z.enum(['height', 'time']).default('height'), heading: z.string().min(3).max(50), takeaway: z.string().max(70), actionCue: z.number().int().min(0).max(2)}).strict()).min(4).max(6),
  }).strict(),
  z.object({renderer: z.literal('actors'), reason: z.string().min(10).max(300)}).strict(),
]);
export type Direction = z.infer<typeof directionSchema>;
export type ComparisonDirection = Extract<Direction, {renderer: 'comparison'}>;
export function validateDirection(raw: unknown, script: Script): Direction {
  const direction = directionSchema.parse(raw);
  if (direction.renderer === 'sacred-symbol') {
    if (!/(?:\b(?:om|aum)\b|ॐ|ओम|ओंकार)/i.test(script.scenes.flatMap(s => s.cues).join(' '))) throw new Error('The Om module requires narration about Om.');
    if (direction.scenes.length !== script.scenes.length) throw new Error('Sacred-symbol direction must cover every scene.');
    const stateScenes = direction.scenes.flatMap((scene, i) => scene.mode === 'states' ? [i] : []);
    if (stateScenes.length !== 1) throw new Error('Use exactly one states scene for the three sound associations.');
    direction.associations.forEach((a, i) => {if (a.cue >= script.scenes[stateScenes[0]].cues.length || (i > 0 && a.cue <= direction.associations[i-1].cue)) throw new Error('Sound associations need ordered, valid narration cue indices in the states scene.');});
    direction.associations.forEach(a => {if (!namesSound(script.scenes[stateScenes[0]].cues[a.cue], a.sound)) throw new Error(`The ${a.sound} association must anchor to the cue naming that sound.`);});
    if (direction.associations.map(a => a.sound).join('') !== 'AUM') throw new Error('Sound associations must be A, U, M in order.');
  }
  if (direction.renderer === 'symbolic-story') {
    if (direction.scenes.length !== script.scenes.length) throw new Error('Symbolic direction must cover every approved scene.');
    direction.scenes.forEach((step, i) => {if (step.cue >= script.scenes[i].cues.length) throw new Error('Symbolic direction references a missing cue.');});
    if (new Set(direction.scenes.map(s => s.action)).size < 3) throw new Error('A symbolic story needs at least three distinct narrative actions.');
    if (direction.guardian === 'shiva' && !/(?:shiva|शिव)/i.test(script.scenes.flatMap(s => s.cues).join(' '))) throw new Error('Shiva icon requires a story explicitly about Shiva. Use sanctuary or none for other traditions.');
  }
  if (direction.renderer === 'comparison') {
    if (direction.scenes.length !== script.scenes.length) throw new Error('Direction must cover every approved scene.');
    if (new Set(direction.scenes.map(s => s.mode)).size < 2) throw new Error('Use at least two explanatory comparison mechanisms, not the same repeated demonstration.');
    direction.scenes.forEach((s, i) => {
      if (s.actionCue >= script.scenes[i].cues.length) throw new Error(`Direction scene ${i + 1} references a missing action cue.`);
      if (/atmospher|breath|oxygen|terminal speed|terminal velocity|impact force|trampoline|ceiling|orbit|escape speed|buoyan/i.test(script.scenes[i].cues.join(' '))) throw new Error(`Scene ${i + 1} requires a mechanism beyond the comparison renderer. Revise its script or use the actor renderer.`);
    });
  }
  return direction;
}
export function compileComparisons(script: Script, direction: ComparisonDirection): Pick<Brief, 'actors' | 'scenes'> {
  const actors = direction.scenes.map((scene, i) => ({
    id: `experiment-${i + 1}`, kind: 'comparison', mode: scene.mode, metric: scene.focus, gravityRatio: direction.gravityRatio,
    referenceLabel: direction.referenceLabel, changedLabel: direction.changedLabel,
    heading: scene.heading, takeaway: scene.takeaway,
    state: {x: 500, y: 810, opacity: 0, phase: 0},
  }));
  const scenes = script.scenes.map((scene, i) => {
    const experiment = direction.scenes[i];
    const endCue = Math.min(experiment.actionCue + 1, scene.cues.length - 1);
    const motion = [
      {actor: actors[i].id, property: 'opacity', keyframes: [{at: 'start', value: 0}, {at: {cue: 0, offset: 0.12}, value: 1, easing: 'smooth'}]},
      {actor: actors[i].id, property: 'phase', keyframes: [{at: 'start', value: 0}, {at: {cue: experiment.actionCue, offset: 0.12}, value: 0}, {at: {cue: endCue, offset: 0.82}, value: 1}, {at: 'end', value: 1, easing: 'hold'}]},
      ...(i > 0 ? [{actor: actors[i - 1].id, property: 'opacity', keyframes: [{at: 'start', value: 1}, {at: {cue: 0, offset: 0.12}, value: 0, easing: 'smooth'}]}] : []),
    ];
    return {title: scene.title, cues: scene.cues, spokenCues: scene.spokenCues, delivery: scene.delivery, motion};
  });
  // Reuse the renderer's canonical validation/defaulting. No executable code
  // or per-topic JSX comes from the model; only typed recipe parameters.
  const validated = briefSchema.parse({schemaVersion: 2, id: 'comparison-validation', topic: script.title, voice: 'Daniel', wordsPerMinute: 172, seed: 42, accent: '#73E7FF', sources: [], description: script.description, actors, scenes});
  return {actors: validated.actors as Actor[], scenes: validated.scenes};
}

export function compileSymbolicStory(script: Script, direction: Extract<Direction, {renderer: 'symbolic-story'}>): Pick<Brief, 'actors' | 'scenes'> {
  const actor = {id: 'story-symbol', kind: 'symbolic-story', symbol: direction.symbol, guardian: direction.guardian, steps: direction.scenes, state: {x: 500, y: 810, phase: 0}};
  const scenes = script.scenes.map((scene, i) => ({title: scene.title, cues: scene.cues, spokenCues: scene.spokenCues, delivery: scene.delivery, motion: [{actor: actor.id, property: 'phase', keyframes: [
    {at: 'start', value: i},
    {at: {cue: direction.scenes[i].cue, offset: 0.05}, value: i},
    {at: {cue: scene.cues.length - 1, offset: 0.96}, value: i + 0.9999, easing: 'linear'},
    {at: 'end', value: i + 0.9999, easing: 'hold'},
  ]}]}));
  const validated = briefSchema.parse({schemaVersion: 2, genre: 'mythology', id: 'story-validation', topic: script.title, description: script.description, seed: 42, accent: '#EBC98A', actors: [actor], scenes});
  return {actors: validated.actors, scenes: validated.scenes};
}

export function compileSacredSymbol(script: Script, direction: Extract<Direction, {renderer: 'sacred-symbol'}>): Pick<Brief, 'actors' | 'scenes'> {
  const actor = {id: 'sacred-symbol', kind: 'sacred-symbol', symbol: direction.symbol, reference: direction.reference, associations: direction.associations, steps: direction.scenes, state: {x: 500, y: 810, phase: 0}};
  const scenes = script.scenes.map((scene, i) => {
    const lastAssociationCue = direction.associations[2].cue;
    const keys = direction.scenes[i].mode === 'states'
      ? direction.associations.flatMap((a, j) => [
        {at: {cue: a.cue, offset: .02}, value: i + .09 + j * .30, easing: j === 0 ? 'linear' : 'hold'},
        {at: {cue: a.cue, offset: .96}, value: i + .28 + j * .30, easing: 'linear'},
      ]).concat(lastAssociationCue + 1 < scene.cues.length ? [{at: {cue: lastAssociationCue + 1, offset: .02}, value: i + .98, easing: 'hold'}] : [])
      : scene.cues.map((_, j) => ({at: {cue: j, offset: .96}, value: i + (j + 1) / scene.cues.length * .9999, easing: 'linear'}));
    return {title: scene.title, cues: scene.cues, spokenCues: scene.spokenCues, delivery: scene.delivery, motion: [{actor: actor.id, property: 'phase', keyframes: [
      {at: 'start', value: i}, ...keys, {at: 'end', value: i + .9999, easing: 'hold'},
    ]}]};
  });
  const validated = briefSchema.parse({schemaVersion: 2, genre: 'mythology', id: 'symbol-validation', topic: script.title, description: script.description, seed: 42, accent: '#EBC98A', actors: [actor], scenes});
  return {actors: validated.actors, scenes: validated.scenes};
}
