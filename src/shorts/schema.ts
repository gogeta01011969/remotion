import {z} from 'zod';
import {structureSchema, structureDuration} from './structure';
import {deliverySchema, captionModeSchema} from './delivery';
import {languageSchema} from './locale';
import {genreSchema} from './genres';
import {sizeDatasetSchema} from './size-data';
import {sizeShotSchema} from './size-shots';
import {presentationSchema, readingFrames} from './presentation';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const finite = z.number().finite().min(-20000).max(20000);
export const stateSchema = z.object({
  x: finite.default(540), y: finite.default(850),
  scale: z.number().min(0.01).max(12).default(1),
  rotation: finite.default(0), opacity: z.number().min(0).max(1).default(1),
  phase: finite.default(0), amplitude: z.number().min(0).max(300).default(1), value: finite.default(0), reference: finite.default(0), shot: finite.default(0),
}).strict();
const common = {id: z.string().regex(/^[a-z][a-z0-9-]*$/).max(40), state: stateSchema};
export const actorSchema = z.discriminatedUnion('kind', [
  z.object({...common, kind: z.literal('size-comparison'), data: sizeDatasetSchema, headings: z.array(z.string().min(1).max(50)).min(4).max(9), shots: z.array(sizeShotSchema).min(4).max(9).optional()}).strict(),
  z.object({...common, kind: z.literal('sacred-symbol'), symbol: z.literal('om'), reference: z.string().min(1).max(60), associations: z.array(z.object({sound: z.enum(['A', 'U', 'M']), cue: z.number().int().min(0).max(4), meaning: z.string().min(1).max(25)}).strict()).length(3), steps: z.array(z.object({mode: z.enum(['reveal', 'resonate', 'states', 'silence', 'reflect']), heading: z.string().min(1).max(45)}).strict()).min(4).max(6)}).strict(),
  z.object({...common, kind: z.literal('symbolic-story'), symbol: z.enum(['moon', 'flame', 'lotus']), guardian: z.enum(['shiva', 'sanctuary', 'none']), steps: z.array(z.object({action: z.enum(['reveal', 'diminish', 'approach', 'protect', 'renew']), heading: z.string().min(1).max(45), cue: z.number().int().min(0).max(2)}).strict()).min(4).max(6)}).strict().describe('Continuous illustrated sacred story. phase progresses from zero to steps.length. Deity art is stylized and symbolic.'),
  z.object({...common, kind: z.literal('comparison'), mode: z.enum(['fall', 'launch', 'force']), metric: z.enum(['height', 'time']).default('height'), gravityRatio: z.number().min(0.15).max(3), referenceLabel: z.string().min(1).max(20), changedLabel: z.string().min(1).max(20), heading: z.string().min(1).max(50), takeaway: z.string().max(70)}).strict().describe('Two-body mechanics comparison. phase is normalized experiment progress 0–1; trajectories and layout are calculated by the renderer.'),
  z.object({...common, kind: z.literal('planet'), diameter: z.number().min(50).max(1800)}).strict().describe('Textured Earth sphere using the bundled local texture. Use shapes for abstract bodies.'),
  z.object({...common, kind: z.literal('shape'), shape: z.enum(['circle', 'rectangle', 'arrow', 'ring']), width: z.number().min(2).max(1800), height: z.number().min(2).max(1800), color, outline: z.boolean().default(false)}).strict(),
  z.object({...common, kind: z.literal('text'), text: z.string().max(100), color, fontSize: z.number().min(14).max(160), width: z.number().min(100).max(950).default(850), numeric: z.boolean().default(false), suffix: z.string().max(25).default('')}).strict(),
  z.object({...common, kind: z.literal('city'), width: z.number().min(100).max(1800), height: z.number().min(100).max(1000), color, buildings: z.number().int().min(3).max(40).default(18)}).strict(),
  z.object({...common, kind: z.literal('waves'), width: z.number().min(100).max(1800), height: z.number().min(100).max(1000), color, layers: z.number().int().min(2).max(10).default(6)}).strict(),
  z.object({...common, kind: z.literal('particles'), width: z.number().min(100).max(2000), height: z.number().min(100).max(1800), color, count: z.number().int().min(3).max(100).default(32)}).strict(),
  z.object({...common, kind: z.literal('orbit'), radiusX: z.number().min(100).max(700), radiusY: z.number().min(60).max(500), color, markerColor: color, markerRadius: z.number().min(5).max(80).default(30)}).strict(),
]);
export type Actor = z.infer<typeof actorSchema>;
export type ActorState = z.infer<typeof stateSchema>;
export type Property = keyof ActorState;
export const propertiesFor = (kind: Actor['kind'] | 'camera'): Property[] => [
  ...(kind === 'camera' ? ['x', 'y', 'scale'] as const : ['x', 'y', 'scale', 'rotation', 'opacity'] as const),
  ...(['planet', 'waves', 'particles', 'orbit', 'comparison', 'symbolic-story', 'sacred-symbol', 'size-comparison'].includes(kind) ? ['phase'] as const : []),
  ...(kind === 'waves' ? ['amplitude'] as const : []),
  ...(kind === 'text' || kind === 'size-comparison' ? ['value'] as const : []),
  ...(kind === 'size-comparison' ? ['reference', 'shot'] as const : []),
];
export const anchorSchema = z.union([z.literal('start'), z.literal('end'), z.object({progress: z.number().min(0).max(1)}).strict(), z.object({cue: z.number().int().min(0).max(4), offset: z.number().min(0).max(1).default(0)}).strict()]);
export const motionSchema = z.object({
  actor: z.string(), property: z.enum(['x', 'y', 'scale', 'rotation', 'opacity', 'phase', 'amplitude', 'value', 'reference', 'shot']),
  keyframes: z.array(z.object({at: anchorSchema, value: finite, easing: z.enum(['linear', 'smooth', 'hold', 'accelerate', 'decelerate']).default('linear')}).strict()).min(2).max(16),
}).strict();
const sceneFields = {title: z.string().min(1).max(80), motion: z.array(motionSchema).min(1).max(60)};
const shared = {presentation: presentationSchema.default('narrated'), captionMode: captionModeSchema.default('sentence'), language: languageSchema.default('en'), structure: structureSchema.optional(), genre: genreSchema.default('what-if'), schemaVersion: z.literal(2), topic: z.string().min(5).max(200), seed: z.number().int(), accent: color, actors: z.array(actorSchema).min(1).max(40)};

// The same semantic checks run on authored briefs and prepared render inputs.
function checkStory(input: {actors: Actor[]; scenes: {motion: z.infer<typeof motionSchema>[]; cues?: string[]; spokenCues?: string[]; delivery?: {rates?: number[]; pausesAfterMs: number[]}; captions?: {from: number; duration: number}[]}[]}, ctx: z.RefinementCtx) {
  const ids = input.actors.map(a => a.id);
  if (new Set(ids).size !== ids.length || ids.includes('camera')) ctx.addIssue({code: 'custom', path: ['actors'], message: 'Actor IDs must be unique. camera is reserved.'});
  const neutral = stateSchema.parse({});
  input.actors.forEach((actor, i) => {
    if (actor.kind === 'size-comparison' && (actor.headings.length !== (actor.shots?.length ?? actor.data.items.length) || actor.state.phase < 0 || actor.state.phase > (actor.shots?.length ?? actor.data.items.length) - 1 || !Number.isInteger(actor.state.value) || actor.state.value < 0 || actor.state.value >= actor.data.items.length)) ctx.addIssue({code: 'custom', path: ['actors', i], message: 'Size comparison needs one heading per shot and valid initial progress and active item.'});
    if (actor.kind === 'size-comparison' && actor.shots?.some(shot => shot.focus >= actor.data.items.length || shot.reference >= actor.data.items.length || shot.visible.some(i => i >= actor.data.items.length) || !shot.visible.includes(shot.focus) || !shot.visible.includes(shot.reference) || new Set(shot.visible).size !== shot.visible.length)) ctx.addIssue({code: 'custom', path: ['actors', i], message: 'Shot items must exist, be unique, and include focus and reference.'});
    if (actor.kind === 'size-comparison' && (!Number.isInteger(actor.state.reference) || actor.state.reference < 0 || actor.state.reference >= actor.data.items.length)) ctx.addIssue({code: 'custom', path: ['actors', i], message: 'Invalid initial comparison reference.'});
    if (actor.kind === 'size-comparison' && (!Number.isInteger(actor.state.shot) || actor.state.shot < 0 || actor.state.shot >= actor.headings.length)) ctx.addIssue({code: 'custom', path: ['actors', i], message: 'Invalid initial comparison shot.'});
    for (const property of Object.keys(actor.state) as Property[]) {
      if (!propertiesFor(actor.kind).includes(property) && actor.state[property] !== neutral[property]) ctx.addIssue({code: 'custom', path: ['actors', i, 'state', property], message: `Unsupported initial property for ${actor.kind}`});
    }
    if (actor.kind === 'text' && !actor.numeric && actor.state.value !== 0) ctx.addIssue({code: 'custom', path: ['actors', i, 'state', 'value'], message: 'Initial value requires numeric text'});
  });
  input.scenes.forEach((scene, sceneIndex) => {
    if (scene.delivery && (scene.delivery.pausesAfterMs.length !== scene.cues?.length || scene.delivery.rates && scene.delivery.rates.length !== scene.cues?.length)) ctx.addIssue({code: 'custom', path: ['scenes', sceneIndex, 'delivery'], message: 'Delivery settings must cover every narration cue.'});
    if (scene.spokenCues && scene.spokenCues.length !== scene.cues?.length) ctx.addIssue({code: 'custom', path: ['scenes', sceneIndex, 'spokenCues'], message: 'Each display cue needs exactly one corresponding spoken cue.'});
    const hasSubjectChange = scene.motion.some(track => {
      const kind = input.actors.find(a => a.id === track.actor)?.kind;
      return kind && kind !== 'text' && kind !== 'particles' && track.property !== 'opacity'
        && track.keyframes.some(k => k.value !== track.keyframes[0].value);
    });
    if (!hasSubjectChange) ctx.addIssue({code: 'custom', path: ['scenes', sceneIndex, 'motion'], message: 'Each scene needs a changing subject. Text fades, camera movement and decorative particles alone are insufficient.'});
    const targets = new Set<string>();
    scene.motion.forEach((track, trackIndex) => {
      const issue = (message: string) => ctx.addIssue({code: 'custom', path: ['scenes', sceneIndex, 'motion', trackIndex], message});
      const actor = input.actors.find(a => a.id === track.actor);
      const kind = track.actor === 'camera' ? 'camera' : actor?.kind;
      if (!kind || !propertiesFor(kind).includes(track.property)) issue(`Unsupported target ${track.actor}.${track.property}`);
      if (actor?.kind === 'text' && track.property === 'value' && !actor.numeric) issue('Animating value requires a numeric text actor');
      const target = `${track.actor}.${track.property}`;
      if (targets.has(target)) issue(`Duplicate track ${target} in this scene`);
      targets.add(target);
      let previous = -1;
      track.keyframes.forEach(k => {
        const count = scene.cues?.length ?? scene.captions?.length ?? 0;
        const order = k.at === 'start' ? -0.5 : k.at === 'end' ? count * 2 + 1 : 'progress' in k.at ? k.at.progress * (count * 2 + 1) : k.at.cue * 2 + k.at.offset;
        if (typeof k.at !== 'string' && 'cue' in k.at && k.at.cue >= count) issue('Keyframe references a missing narration cue');
        if (order <= previous) issue('Keyframes must be strictly ordered');
        previous = order;
        if (track.property === 'opacity' && (k.value < 0 || k.value > 1)) issue('Opacity must be 0–1');
        if (track.property === 'scale' && (k.value < 0.01 || k.value > 12)) issue('Scale must be 0.01–12');
        if (track.property === 'amplitude' && (k.value < 0 || k.value > 300)) issue('Wave amplitude must be 0–300');
        if ((actor?.kind === 'symbolic-story' || actor?.kind === 'sacred-symbol') && track.property === 'phase' && (k.value < 0 || k.value > actor.steps.length)) issue('Symbolic story progress must fit its steps');
        if (actor?.kind === 'comparison' && track.property === 'phase' && (k.value < 0 || k.value > 1)) issue('Comparison progress must be 0–1');
        if (actor?.kind === 'size-comparison' && track.property === 'phase' && (k.value < 0 || k.value > (actor.shots?.length ?? actor.data.items.length) - 1)) issue('Size progress must fit the planned shots.');
        if (actor?.kind === 'size-comparison' && track.property === 'value' && (!Number.isInteger(k.value) || k.value < 0 || k.value >= actor.data.items.length || k.easing !== 'hold')) issue('Active size item must use valid integer indices with hold easing.');
        if (actor?.kind === 'size-comparison' && track.property === 'reference' && (!Number.isInteger(k.value) || k.value < 0 || k.value >= actor.data.items.length || k.easing !== 'hold')) issue('Size references must use valid integer indices with hold easing.');
        if (actor?.kind === 'size-comparison' && track.property === 'shot' && (!Number.isInteger(k.value) || k.value < 0 || k.value >= actor.headings.length || k.easing !== 'hold')) issue('Size shots must use valid integer indices with hold easing.');
      });
    });
  });
}
export const briefSchema = z.object({
  ...shared,
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
  voice: z.string().min(1).max(80).default('Daniel'), wordsPerMinute: z.number().int().min(130).max(210).default(172),
  sources: z.array(z.object({title: z.string(), url: z.string().url()})).default([]), description: z.string().max(5000),
  scenes: z.array(z.object({...sceneFields, delivery: deliverySchema.optional(), spokenCues: z.array(z.string().min(1).max(300)).min(1).max(5).optional(), cues: z.array(z.string().min(1).max(240)).max(5)}).strict()).min(4).max(8),
}).strict().superRefine((input, ctx) => {
  checkStory(input, ctx);
  if (input.presentation === 'silent' && input.scenes.some(scene => scene.spokenCues || scene.delivery || scene.cues.length > 2 || scene.cues.some(cue => cue.split(/\s+/).length > 12))) ctx.addIssue({code: 'custom', message: 'Silent scenes use at most two concise on-screen notes (12 words each), without speech or delivery settings.'});
  if (input.presentation === 'narrated' && input.scenes.some(scene => !scene.cues.length)) ctx.addIssue({code:'custom',message:'Narrated scenes need at least one speech cue.'});
  if (input.presentation === 'narrated' && input.language === 'hinglish' && input.scenes.some(scene => !scene.spokenCues)) ctx.addIssue({code: 'custom', message: 'Hinglish briefs need pronunciation-ready spokenCues for every scene.'});
  if (input.structure && input.scenes.length !== input.structure.beats.length) ctx.addIssue({code: 'custom', message: 'Timed structure must have one scene per beat.'});
});
// Planning may validate a cast or one scene before the complete brief exists.
export const storyFragmentSchema = z.object({actors: z.array(actorSchema).min(1).max(40), scenes: z.array(briefSchema.shape.scenes.element).max(8)}).strict().superRefine(checkStory);
const captionChunkSchema = z.object({text: z.string().min(1).max(240), from: z.number().int().min(0), duration: z.number().int().positive()}).strict();
const assetPath = z.string().regex(/^[a-zA-Z0-9_./-]+$/).refine(p => !p.startsWith('/') && !p.split('/').includes('..'), 'Use a relative public asset path');
export const shortSchema = z.object({
  ...shared, fps: z.number().int().min(24).max(60), audio: assetPath.optional(),
  scenes: z.array(z.object({
    ...sceneFields, durationInFrames: z.number().int().min(24),
    captions: z.array(z.object({text: z.string().min(1).max(240), from: z.number().int().min(0), duration: z.number().int().positive(), chunks: z.array(captionChunkSchema).min(1).max(12).optional()}).strict()).max(5),
  }).strict()).min(4).max(8),
}).strict().superRefine((input, ctx) => {
  checkStory(input, ctx);
  if (input.presentation === 'silent' && (input.audio || input.scenes.some(scene => scene.captions.length > 2 || scene.captions.some(cue => cue.chunks || cue.text.split(/\s+/).length > 12 || cue.duration < readingFrames(cue.text, input.fps))))) ctx.addIssue({code:'custom',message:'Silent videos have no audio and use brief notes with sufficient reading time, not speech caption fragments.'});
  if (input.presentation === 'narrated' && input.scenes.some(scene => !scene.captions.length)) ctx.addIssue({code:'custom',message:'Narrated scenes need captions.'});
  const total = input.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
  if (input.structure) {
    if (input.scenes.length !== input.structure.beats.length || total !== structureDuration(input.structure) * input.fps) ctx.addIssue({code: 'custom', message: 'Video must exactly match its timed structure.'});
    input.scenes.forEach((scene, i) => {if (scene.durationInFrames !== (input.structure?.beats[i]?.durationSeconds ?? 0) * input.fps) ctx.addIssue({code: 'custom', message: `Scene ${i + 1} must fit its fixed beat duration.`});});
  } else if (total < input.fps * 30 || total > input.fps * 45) ctx.addIssue({code: 'custom', message: 'Shorts must be 30–45 seconds.'});
  input.scenes.forEach((s, i) => {
    let previousEnd = 0;
    s.captions.forEach(c => {
      if (c.from < previousEnd || c.from + c.duration > s.durationInFrames) ctx.addIssue({code: 'custom', path: ['scenes', i, 'captions'], message: 'Captions must be ordered, non-overlapping, and contained in the scene.'});
      if (c.chunks) {
        let next = c.from;
        c.chunks.forEach(chunk => {if (chunk.from !== next || chunk.from + chunk.duration > c.from + c.duration) ctx.addIssue({code: 'custom', message: 'Caption phrases must continuously cover their parent cue.'}); next = chunk.from + chunk.duration;});
        if (next !== c.from + c.duration || c.chunks.map(chunk => chunk.text).join(' ') !== c.text.trim().replace(/\s+/g, ' ')) ctx.addIssue({code: 'custom', message: 'Caption phrases must preserve their full parent text and duration.'});
      }
      previousEnd = c.from + c.duration;
    });
  });
});
export type Brief = z.infer<typeof briefSchema>;
export type ShortInput = z.infer<typeof shortSchema>;
export type ShortScene = ShortInput['scenes'][number];
export const shortDuration = (input: ShortInput) => input.scenes.reduce((n, s) => n + s.durationInFrames, 0);
