import raw from '../../shorts/earth-stops.json';
import {briefSchema, shortSchema, type Brief} from './schema';
import {prepareSilentInput} from './silent';

// Preview-only timing. The build command replaces it with measured speech durations.
export function previewInput(rawBrief: unknown) {
  const brief: Brief = briefSchema.parse(rawBrief);
  if (brief.presentation === 'silent') return prepareSilentInput(brief);
  const baseFrames = Math.floor(1260 / brief.scenes.length);
  const extraFrames = 1260 % brief.scenes.length;
  return shortSchema.parse({
    presentation:brief.presentation, captionMode: brief.captionMode, language: brief.language, structure: brief.structure, genre: brief.genre, schemaVersion: brief.schemaVersion, topic: brief.topic, seed: brief.seed, accent: brief.accent, actors: brief.actors, fps: 30,
    scenes: brief.scenes.map((s, index) => {
      const durationInFrames = brief.structure ? brief.structure.beats[index].durationSeconds * 30 : baseFrames + (index < extraFrames ? 1 : 0);
      const cueFrames = Math.floor((durationInFrames - (brief.structure ? 10 : 30)) / s.cues.length);
      return {title: s.title, motion: s.motion, durationInFrames, captions: s.cues.map((text, i) => ({text, from: (brief.structure ? 2 : 10) + i * cueFrames, duration: cueFrames}))};
    }),
  });
}
export const defaultShort = previewInput(raw);
