import {stateSchema, type ActorState, type Property, type ShortInput, type ShortScene} from './schema';

type Key = {frame: number; value: number; easing: 'linear' | 'smooth' | 'hold' | 'accelerate' | 'decelerate'};
export type CompiledStory = {tracks: Record<string, Record<Property, Key[]>>; starts: number[]};
export const resolveAnchor = (at: ShortScene['motion'][number]['keyframes'][number]['at'], scene: ShortScene) => {
  if (at === 'start') return 0;
  if (at === 'end') return scene.durationInFrames - 1;
  if ('progress' in at) return Math.round(at.progress * (scene.durationInFrames - 1));
  const cue = scene.captions[at.cue];
  if (!cue) throw new Error(`Missing cue ${at.cue}`);
  return Math.min(scene.durationInFrames - 1, cue.from + Math.round(cue.duration * at.offset));
};

export function compileStory(input: ShortInput): CompiledStory {
  const tracks: CompiledStory['tracks'] = {};
  for (const actor of [...input.actors, {id: 'camera', state: stateSchema.parse({x: 540, y: 960})}]) {
    tracks[actor.id] = Object.fromEntries(Object.entries(actor.state).map(([property, value]) => [property, [{frame: 0, value, easing: 'hold'}]])) as Record<Property, Key[]>;
  }
  const starts: number[] = [];
  let start = 0;
  for (const scene of input.scenes) {
    starts.push(start);
    for (const motion of scene.motion) {
      const target = tracks[motion.actor]?.[motion.property];
      if (!target) throw new Error(`Unsupported motion target ${motion.actor}.${motion.property}`);
      const keys = motion.keyframes.map(k => ({frame: start + resolveAnchor(k.at, scene), value: k.value, easing: k.easing}));
      if (keys.some((k, i) => i > 0 && k.frame <= keys[i - 1].frame)) throw new Error(`Keyframes resolve to the same or reversed frame: ${motion.actor}.${motion.property}`);
      const first = keys[0].frame;
      const last = target[target.length - 1];
      // Hold previous state until an explicit first keyframe. Never tween across a scene gap.
      if (first > last.frame + 1) target.push({frame: first - 1, value: last.value, easing: 'hold'});
      for (const key of keys) {
        if (target[target.length - 1].frame === key.frame) target.pop();
        target.push(key);
      }
    }
    start += scene.durationInFrames;
  }
  return {tracks, starts};
}

export function sampleTrack(keys: Key[], frame: number) {
  let previous = keys[0];
  for (let i = 1; i < keys.length; i++) {
    const next = keys[i];
    if (frame < next.frame) {
      const t = Math.max(0, Math.min(1, (frame - previous.frame) / (next.frame - previous.frame)));
      const eased = next.easing === 'hold' ? 0 : next.easing === 'smooth' ? t * t * (3 - 2 * t) : next.easing === 'accelerate' ? t * t : next.easing === 'decelerate' ? 1 - (1 - t) ** 2 : t;
      return previous.value + (next.value - previous.value) * eased;
    }
    previous = next;
  }
  return previous.value;
}
export function sampleActor(compiled: CompiledStory, id: string, frame: number): ActorState {
  return Object.fromEntries(Object.entries(compiled.tracks[id]).map(([property, keys]) => [property, sampleTrack(keys, frame)])) as ActorState;
}

export function motionReport(input: ShortInput) {
  return input.scenes.map(scene => ({title: scene.title, changes: scene.motion.filter(m => m.keyframes.some(k => k.value !== m.keyframes[0].value)).map(m => `${m.actor}.${m.property}`)}));
}
