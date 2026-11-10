import {z} from 'zod';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color');
export const sceneSchema = z.object({
  type: z.enum(['intro', 'system', 'finale']),
  eyebrow: z.string().max(50),
  title: z.string().min(1).max(55),
  subtitle: z.string().max(140),
  weight: z.number().min(0.5).max(5),
  intensity: z.number().min(0.2).max(2),
});

export const videoSchema = z.object({
  width: z.number().int().min(320).max(3840).multipleOf(2),
  height: z.number().int().min(320).max(3840).multipleOf(2),
  fps: z.number().int().min(12).max(60),
  durationSeconds: z.number().min(9).max(120),
  seed: z.number().int().min(0).max(999999),
  particleCount: z.number().int().min(0).max(100),
  transition: z.enum(['fade', 'wipe']),
  colors: z.object({background: color, ink: color, accent: color, secondary: color}),
  scenes: z.array(sceneSchema).min(1).max(8),
});

export type VideoInput = z.infer<typeof videoSchema>;
export type SceneInput = z.infer<typeof sceneSchema>;

export const defaultInput: VideoInput = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 15,
  seed: 42,
  particleCount: 36,
  transition: 'wipe',
  colors: {background: '#F0EDE6', ink: '#202720', accent: '#D6FC54', secondary: '#9B8DCE'},
  scenes: [
    {type: 'intro', eyebrow: '01 / THE SPARK', title: 'Ideas in motion.', subtitle: 'A little code. An entirely new perspective.', weight: 1, intensity: 1},
    {type: 'system', eyebrow: '02 / THE SYSTEM', title: 'Beautiful by design.', subtitle: 'Shape. Rhythm. Possibility. All working together.', weight: 1, intensity: 1},
    {type: 'finale', eyebrow: '03 / THE POSSIBILITIES', title: 'Make the next move.', subtitle: 'Your imagination, frame by frame.', weight: 1, intensity: 1},
  ],
};

// Transitions overlap scenes. Add that overlap back before allocating frames.
// Integer allocation guarantees that the final scene ends on the exact last frame.
export const getTimeline = (input: VideoInput) => {
  const durationInFrames = Math.round(input.durationSeconds * input.fps);
  const transitionFrames = Math.round(input.fps * 0.5);
  const totalSceneFrames = durationInFrames + transitionFrames * (input.scenes.length - 1);
  const minimumSceneFrames = transitionFrames + 1;
  const remaining = totalSceneFrames - minimumSceneFrames * input.scenes.length;
  if (remaining < 0) throw new Error('Duration is too short for the scene transitions.');
  const weightSum = input.scenes.reduce((sum, scene) => sum + scene.weight, 0);
  let allocated = 0;
  const sceneFrames = input.scenes.map((scene, index) => {
    const frames = index === input.scenes.length - 1
      ? totalSceneFrames - allocated
      : minimumSceneFrames + Math.floor(remaining * scene.weight / weightSum);
    allocated += frames;
    return frames;
  });
  return {durationInFrames, transitionFrames, sceneFrames};
};
