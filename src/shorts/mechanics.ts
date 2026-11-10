export type ComparisonMode = 'fall' | 'launch' | 'force';

export function comparisonSample(mode: ComparisonMode, ratio: number, progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  // Dimensionless mechanics: g_A=1; g_B=ratio. Both use identical
  // initial conditions. Mapping to screen pixels happens only in the view.
  if (mode === 'force') return {
    normal: 0, changed: 0, normalTime: 1, changedTime: 1,
    normalHeight: 1, changedHeight: 1, force: 1 + (ratio - 1) * p,
  };
  const normalTime = mode === 'fall' ? Math.SQRT2 : 2;
  const changedTime = mode === 'fall' ? Math.sqrt(2 / ratio) : 2 / ratio;
  const elapsed = p * Math.max(normalTime, changedTime);
  const position = (g: number, time: number) => {
    if (elapsed >= time) return mode === 'fall' ? 1 : 0;
    return mode === 'fall' ? Math.min(1, 0.5 * g * elapsed ** 2) : Math.max(0, elapsed - 0.5 * g * elapsed ** 2);
  };
  return {
    normal: position(1, normalTime), changed: position(ratio, changedTime),
    normalTime, changedTime, normalHeight: 0.5, changedHeight: 0.5 / ratio, force: ratio,
  };
}
export const ratioLabel = (value: number) => `${Number(value.toFixed(1))}×`;
