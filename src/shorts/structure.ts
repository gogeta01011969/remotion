import {z} from 'zod';

export const structureSchema = z.object({
  endWithQuestion: z.boolean().default(false),
  hook: z.string().min(1).max(180).optional(),
  beats: z.array(z.object({name: z.string().min(1).max(80), durationSeconds: z.number().int().min(2).max(60)}).strict()).min(4).max(8),
}).strict().superRefine((structure, ctx) => {
  const duration = structure.beats.reduce((sum, b) => sum + b.durationSeconds, 0);
  if (duration < 30 || duration > 60) ctx.addIssue({code: 'custom', message: 'A timed structure must total 30–60 seconds.'});
  if (new Set(structure.beats.map(b => b.name)).size !== structure.beats.length) ctx.addIssue({code: 'custom', message: 'Beat names must be unique.'});
});
export type Structure = z.infer<typeof structureSchema>;
export const structureDuration = (structure: Structure) => structure.beats.reduce((sum, b) => sum + b.durationSeconds, 0);

// Fixed beat boundaries; measured speech is never truncated or allowed to spill.
export function layoutTimedCues(durations: number[], budget: number) {
  const lead = 1, tail = 2;
  const spoken = durations.reduce((sum, n) => sum + n, 0);
  if (!durations.length || spoken + lead + tail + (durations.length - 1) * 2 > budget) throw new Error(`Narration needs ${spoken} frames and does not fit the ${budget}-frame beat.`);
  const gap = durations.length > 1 ? Math.floor((budget - spoken - lead - tail) / durations.length) : 0;
  let frame = lead;
  return durations.map(duration => {const from = frame; frame += duration + gap; return {from, duration};});
}
