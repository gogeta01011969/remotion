import {z} from 'zod';
import {deliverySchema} from '../shorts/delivery';
import {structureDuration, type Structure} from '../shorts/structure';
import type {Language} from '../shorts/locale';
import type {Genre} from '../shorts/genres';
import type {Presentation} from '../shorts/presentation';

export const researchSchema = z.object({
  topic: z.string(), model: z.string(), notes: z.string().min(100),
  sources: z.array(z.object({id: z.string(), title: z.string(), url: z.string().url()})).min(2),
  searched: z.literal(true), toolExecutions: z.number().int().positive(),
}).strict();
export type Research = z.infer<typeof researchSchema>;
const sceneObject = z.object({
  title: z.string().min(3).max(80), delivery: deliverySchema.optional(), spokenCues: z.array(z.string().min(1).max(300)).min(1).max(5).optional(), cues: z.array(z.string().min(1).max(180)).min(2).max(3),
  visualIntent: z.string().min(20).max(600), sourceIds: z.array(z.string()).min(1),
}).strict();
function scenesFor(structure?: Structure, language: Language = 'en') {
  if (!structure) return sceneObject;
  const variants = structure.beats.map((beat, index) => {
    const count = Math.min(5, Math.ceil(beat.durationSeconds / 6));
    const cue = z.string().min(1).max(language !== 'en' ? 240 : 180);
    return sceneObject.extend({title: z.literal(beat.name), cues: index === 0 && structure.hook ? z.array(z.literal(structure.hook)).length(1) : z.array(cue).length(count)});
  });
  return z.union(variants as [typeof variants[number], typeof variants[number], ...typeof variants[number][]]);
}
const scriptObject = (structure?: Structure, language: Language = 'en') => z.object({
  throughline: z.string().min(15).max(250).optional(),
  title: z.string().min(5).max(100), description: z.string().min(20).max(1800),
  assumptions: z.array(z.string().min(5).max(250)).min(1).max(6),
  scenes: z.array(scenesFor(structure, language)).min(structure?.beats.length ?? 4).max(structure?.beats.length ?? 6),
}).strict();
const narratedScriptSchemaFor = (genre: Genre, structure?: Structure, language: Language = 'en') => scriptObject(structure, language).superRefine((script, ctx) => {
  const words = script.scenes.flatMap(s => s.cues).join(' ').trim().split(/\s+/).length;
  const minimum = structure ? Math.floor(structureDuration(structure) * (language !== 'en' ? 2 : 1.75)) : genre === 'mythology' ? 75 : 85;
  const maximum = structure ? Math.ceil(structureDuration(structure) * (language !== 'en' ? 3.8 : 2.8)) : 105;
  if (words < minimum || words > maximum) ctx.addIssue({code: 'custom', message: `Narration has ${words} words; write ${minimum}–${maximum} words total. Narration must fit its measured timing budget.`});
  script.scenes.forEach((scene, i) => scene.cues.forEach((cue, j) => {
    if (cue.trim().split(/\s+/).length > (language !== 'en' ? 26 : 18)) ctx.addIssue({code: 'custom', path: ['scenes', i, 'cues', j], message: `Keep each spoken cue to ${language !== 'en' ? 26 : 18} words or fewer.`});
    if (/[=√θπ²³\\]/.test(cue)) ctx.addIssue({code: 'custom', path: ['scenes', i, 'cues', j], message: 'Narration must be plain spoken words, not equations, LaTeX or mathematical symbols.'});
  }));
  if (structure) {
    script.scenes.forEach((scene, i) => {
      const beat = structure.beats[i];
      if (scene.title !== beat.name) ctx.addIssue({code: 'custom', message: `Scene ${i + 1} must be titled ${beat.name}.`});
      if (i > 0) {
        const count = scene.cues.join(' ').trim().split(/\s+/).length;
        const lower = Math.floor(beat.durationSeconds * (language !== 'en' ? (beat.durationSeconds >= 20 ? 2.2 : 1.6) : (beat.durationSeconds >= 20 ? 2.4 : 1.8))), upper = Math.ceil(beat.durationSeconds * (language !== 'en' ? 4 : 3));
        if (count < lower || count > upper) ctx.addIssue({code: 'custom', message: `${beat.name} has ${count} words; use ${lower}–${upper} words for its ${beat.durationSeconds}-second budget. Expand with sourced explanation and concrete examples, not repetition.`});
      }
    });
    if (structure.hook && script.scenes[0].cues.join(' ') !== structure.hook) ctx.addIssue({code: 'custom', message: 'Preserve the requested hook verbatim in the first scene.'});
    if (structure.endWithQuestion && !/\?\s*$/.test(script.scenes.at(-1)!.cues.at(-1)!)) ctx.addIssue({code: 'custom', message: 'End the timed curiosity structure with a thoughtful question.'});
  }
  if (genre === 'what-if' && !(language === 'hi' ? /^(?:क्या\s+हो(?:गा)?\s+(?:अगर|यदि)|अगर)/ : language === 'hinglish' ? /^(?:kya\s+ho(?:ga)?\s+(?:agar|yadi)|agar|what\s+if)\b/i : /^what\s+if\b/i).test(script.scenes[0].cues[0].trim())) ctx.addIssue({code: 'custom', message: 'Open the narration with the What if question.'});
  if (genre === 'mythology' && /^what\s+if\b/i.test(script.scenes[0].cues[0].trim())) ctx.addIssue({code: 'custom', message: 'Mythology needs a direct story hook, not a What if hypothetical.'});
  if (genre === 'mythology' && !/tradition|legend|myth|account|story|tale|Upanishad|scripture|teaching|text|उपनिषद|परंपरा|कथा|ग्रंथ|मान्यता|शिक्षा|वेदांत/i.test(script.scenes.flatMap(s => s.cues).join(' '))) ctx.addIssue({code: 'custom', message: 'Attribute the sacred narrative in the spoken narration, for example: One Hindu tradition tells...'});
  script.scenes.forEach((scene, i) => {
    if (scene.delivery && (scene.delivery.pausesAfterMs.length !== scene.cues.length || scene.delivery.rates && scene.delivery.rates.length !== scene.cues.length)) ctx.addIssue({code: 'custom', message: 'Delivery settings must cover every cue.'});
    if (scene.spokenCues && scene.spokenCues.length !== scene.cues.length) ctx.addIssue({code: 'custom', path: ['scenes', i, 'spokenCues'], message: 'Each display cue needs exactly one corresponding spoken cue.'});
    if (language === 'hinglish' && (!scene.spokenCues || scene.spokenCues.some(cue => !/\p{Script=Devanagari}/u.test(cue)))) ctx.addIssue({code: 'custom', message: 'Hinglish needs pronunciation-ready spokenCues in Devanagari alongside Roman display cues.'});
    if (language === 'hinglish' && scene.cues.some(cue => /\p{Script=Devanagari}/u.test(cue) || !/[A-Za-z]/.test(cue))) ctx.addIssue({code: 'custom', message: 'Hinglish display cues must use Roman script.'});
  });
  if (language === 'hi' && !/\p{Script=Devanagari}/u.test(script.title)) ctx.addIssue({code: 'custom', message: 'The Hindi video title must be in Devanagari.'});
  if (language === 'hi' && script.scenes.some(scene => scene.cues.some(cue => !/\p{Script=Devanagari}/u.test(cue)))) ctx.addIssue({code: 'custom', message: 'Hindi narration must use natural Hindi in Devanagari, not romanized Hindi.'});
  if (script.scenes[0].cues[0].trim().split(/\s+/).length > (language !== 'en' ? 18 : 12)) ctx.addIssue({code: 'custom', message: `Keep the opening hook to at most ${language !== 'en' ? 18 : 12} words. Move context into later narration or metadata.`});
});
export function scriptSchemaFor(genre:Genre,structure?:Structure,language:Language='en',presentation:Presentation='narrated') {
  if(presentation==='narrated')return narratedScriptSchemaFor(genre,structure,language);
  const scene=sceneObject.extend({cues:z.array(z.string().min(1).max(100)).min(1).max(2)});
  return scriptObject(structure,language).extend({scenes:z.array(scene).min(structure?.beats.length??4).max(structure?.beats.length??6)}).superRefine((script,ctx)=>{
    for(const [i,s] of script.scenes.entries()) {
      if(s.delivery||s.spokenCues||s.cues.some(c=>c.split(/\s+/).length>12))ctx.addIssue({code:'custom',message:'Silent visual scripts use concise on-screen notes (12 words each), without spokenCues or delivery.'});
      if(structure&&s.title!==structure.beats[i].name)ctx.addIssue({code:'custom',message:'Keep the supplied visual beat order.'});
    }
    if(structure?.hook&&script.scenes[0].cues[0]!==structure.hook)ctx.addIssue({code:'custom',message:'Preserve the supplied on-screen hook.'});
    if(genre==='mythology'&&!/tradition|legend|myth|account|story|Upanishad|scripture|teaching|उपनिषद|परंपरा|कथा/i.test(script.scenes.flatMap(s=>s.cues).join(' ')))ctx.addIssue({code:'custom',message:'Attribute mythology or scripture in an on-screen note.'});
    if(language==='hi'&&script.scenes.some(s=>s.cues.some(c=>!/[\p{Script=Devanagari}]/u.test(c))))ctx.addIssue({code:'custom',message:'Use Hindi on-screen notes.'});
  });
}
export const scriptSchema = scriptSchemaFor('what-if');
export type Script = z.infer<typeof scriptSchema>;
export function validateScript(input: unknown, research: Research, genre: Genre = 'what-if', structure?: Structure, language: Language = 'en', presentation:Presentation='narrated'): Script {
  const script = scriptSchemaFor(genre, structure, language, presentation).parse(input);
  const ids = new Set(research.sources.map(s => s.id));
  if (script.scenes.some(s => s.sourceIds.some(id => !ids.has(id)))) throw new Error('Script references a source not present in the browser research.');
  return script;
}
