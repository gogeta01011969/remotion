// Music is optional: any soundtrack failure must leave a usable muted video.
export const comparisonAudioSettings = {
  enabled: true,
  musicLufs: -24,
  effectPeakDb: -20,
  truePeakCeilingDb: -3,
  fadeInSeconds: .75,
  fadeOutSeconds: 1.5,
  loopCrossfadeSeconds: .1,
  minimumCueGapSeconds: 3,
} as const;
export type SoundtrackProfile = 'off' | 'calm-curiosity';
