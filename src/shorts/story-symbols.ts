export type StoryAction = 'reveal' | 'diminish' | 'approach' | 'protect' | 'renew';
export type StoryStep = {action: StoryAction; heading: string; cue: number};
export type SymbolPose = {x: number; y: number; radius: number; light: number; crescent: number; guardian: number};
const initial: SymbolPose = {x: 650, y: 360, radius: 105, light: 1, crescent: 0.2, guardian: 0.55};
function destination(from: SymbolPose, action: StoryAction): SymbolPose {
  switch (action) {
    case 'reveal': return {...from, light: 1, crescent: 0.18};
    case 'diminish': return {...from, radius: 80, light: 0.22, crescent: 0.035};
    case 'approach': return {...from, x: 570, y: 365, radius: 70, guardian: 1};
    case 'protect': return {...from, x: 500, y: 350, radius: 62, light: 0.75, crescent: 0.15, guardian: 1};
    case 'renew': return {...from, light: 1, crescent: 0.2};
  }
}
// Pure, seek-independent sampling. Each scene begins at the preceding pose.
export function sampleSymbol(steps: StoryStep[], phase: number): SymbolPose {
  const progress = Math.max(0, Math.min(steps.length, phase));
  let pose = {...initial};
  for (let i = 0; i < steps.length; i++) {
    const next = destination(pose, steps[i].action);
    const t = Math.max(0, Math.min(1, progress - i));
    const smooth = t * t * (3 - 2 * t);
    const blended = Object.fromEntries(Object.keys(pose).map(key => [key, pose[key as keyof SymbolPose] + (next[key as keyof SymbolPose] - pose[key as keyof SymbolPose]) * smooth])) as SymbolPose;
    if (t < 1) return blended;
    pose = next;
  }
  return pose;
}
