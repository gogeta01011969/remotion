import {shortSchema, type Brief, type ShortInput} from './schema';
import {readingFrames} from './presentation';

// Visual time is explicit and independent of any voice or speech service.
export function prepareSilentInput(brief: Brief, fps = 30): ShortInput {
  const budgets = brief.structure
    ? brief.structure.beats.map(beat => beat.durationSeconds * fps)
    : brief.scenes.map(scene => Math.max(5 * fps, Math.round(1.8 * fps) + scene.cues.reduce((sum,text) => sum + readingFrames(text,fps),0)));
  const total = budgets.reduce((a,b)=>a+b,0);
  if (total < 30 * fps) {
    const extra = 30 * fps - total;
    budgets.forEach((_,i)=>{budgets[i] += Math.floor(extra/budgets.length)+(i<extra%budgets.length?1:0);});
  }
  return shortSchema.parse({
    presentation:'silent', captionMode:'sentence', language:brief.language, structure:brief.structure, genre:brief.genre,
    schemaVersion:2, topic:brief.topic, seed:brief.seed, accent:brief.accent, actors:brief.actors, fps,
    scenes:brief.scenes.map((scene,index)=>{
      const durationInFrames=budgets[index], gap=Math.round(.25*fps);
      const required=scene.cues.map(text=>readingFrames(text,fps));
      const lead=Math.round(Math.min(1.8, durationInFrames/fps*.3)*fps);
      if (lead+required.reduce((a,b)=>a+b,0)+Math.max(0,required.length-1)*gap+Math.round(.3*fps)>durationInFrames) throw new Error(`${scene.title}: notes leave too little time to read the visual. Shorten them or extend the beat.`);
      let cursor=lead;
      const captions=scene.cues.map((text,i)=>{const cue={text,from:cursor,duration:required[i]};cursor+=cue.duration+gap;return cue;});
      return {title:scene.title,motion:scene.motion,durationInFrames,captions};
    }),
  });
}
