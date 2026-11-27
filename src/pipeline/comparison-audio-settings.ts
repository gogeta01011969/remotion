// Preview first: turn this on only after the local mixes have been reviewed.
export const comparisonAudioSettings = {
  enabled: false,
  musicLufs: -24,
  effectPeakDb: -20,
  truePeakCeilingDb: -3,
  fadeInSeconds: .75,
  fadeOutSeconds: 1.5,
  loopCrossfadeSeconds: .1,
  minimumCueGapSeconds: 3,
} as const;
export type SoundtrackProfile = 'off' | 'calm-curiosity';
