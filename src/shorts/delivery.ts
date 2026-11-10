import {z} from 'zod';

export const deliverySchema = z.object({
  rates: z.array(z.number().int().min(130).max(210)).min(1).max(5).optional(),
  pausesAfterMs: z.array(z.number().int().min(0).max(2000)).min(1).max(5),
  maxEndHoldMs: z.number().int().min(0).max(3000).default(1500),
}).strict();
export type Delivery = z.infer<typeof deliverySchema>;
export const captionModeSchema = z.enum(['sentence', 'phrase']);

export function layoutDirectedCues(durations: number[], budget: number, fps: number, delivery: Delivery) {
  if (delivery.pausesAfterMs.length !== durations.length || delivery.rates && delivery.rates.length !== durations.length) throw new Error('Delivery settings must cover every cue.');
  let frame = 1;
  const cues = durations.map((duration, i) => {
    const from = frame;
    frame += duration + Math.round(delivery.pausesAfterMs[i] * fps / 1000);
    return {from, duration};
  });
  if (frame + 2 > budget) throw new Error(`Directed narration exceeds its beat by ${((frame + 2 - budget) / fps).toFixed(2)}s. Shorten the script or adjust its declared delivery; speech was not accelerated or cut.`);
  const tail = budget - frame;
  if (tail > Math.round(delivery.maxEndHoldMs * fps / 1000) + 2) throw new Error(`Directed beat leaves ${(tail / fps).toFixed(2)}s of unplanned hold. Adjust the script or pacing.`);
  return cues;
}

// Phrase timing is estimated within a measured spoken cue, not forced alignment.
// Parent cues remain intact for motion anchors and source narration matching.
export function makeCaptionChunks(text: string, from: number, duration: number, fps: number) {
  const words = text.trim().split(/\s+/);
  const groups: string[][] = [];
  let group: string[] = [];
  const closesSentence = (word: string) => /[.!?;:]["'”’]?$/u.test(word);
  for (let i = 0; i < words.length; i++) {
    group.push(words[i]);
    if (closesSentence(words[i]) || group.length >= 3 && /[,]$/.test(words[i])) {groups.push(group); group = [];}
    else if (group.length >= 5) {
      // Keep a short auxiliary with its preceding phrase, e.g. “jodta hai:”.
      if (words[i + 1] && closesSentence(words[i + 1]) && words[i + 1].replace(/[^\p{L}]/gu, '').length <= 4) group.push(words[++i]);
      groups.push(group); group = [];
    }
  }
  if (group.length) groups.push(group);
  const minimumFrames = Math.ceil(fps * .55);
  const maxGroups = Math.max(1, Math.floor(duration / minimumFrames));
  while (groups.length > maxGroups) {
    let smallest = 0;
    for (let i = 1; i < groups.length - 1; i++) if (groups[i].length + groups[i + 1].length < groups[smallest].length + groups[smallest + 1].length) smallest = i;
    groups.splice(smallest, 2, groups[smallest].concat(groups[smallest + 1]));
  }
  const minimum = Math.min(minimumFrames, Math.floor(duration / groups.length));
  const remaining = duration - minimum * groups.length;
  let cursor = 0, frame = from;
  return groups.map((phrase, index) => {
    cursor += phrase.length;
    const end = index === groups.length - 1 ? from + duration : from + minimum * (index + 1) + Math.round(remaining * cursor / words.length);
    const chunk = {text: phrase.join(' '), from: frame, duration: end - frame};
    frame = end; return chunk;
  });
}
