import {isQuantityMetric} from '../shorts/measurements';
import {z} from 'zod';
import {briefSchema} from '../shorts/schema';
import {sizeDatasetSchema} from '../shorts/size-data';
import {languageSchema, voiceFor} from '../shorts/locale';
import {deliverySchema} from '../shorts/delivery';
import {planComparisonStory} from './comparison-story';
import {presentationSchema} from '../shorts/presentation';
import {overviewTiming} from '../shorts/size-presentation';
import {materialProfiles} from '../shorts/object-materials';

// Narration is an editorial input, separate from sourced numerical facts.
// An AI can fill these contracts; the renderer never executes AI-written code.
export const comparisonEpisodeSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
  language: languageSchema.default('en'),
  presentation: presentationSchema.default('silent'),
  description: z.string().min(1).max(4000),
  scenes: z.array(z.object({
    itemId: z.string(), heading: z.string().min(1).max(50),
    beatId: z.string().optional(),
    durationSeconds: z.number().int().min(3).max(15),
    cues: z.array(z.string().min(1).max(240)).max(3).default([]),
    spokenCues: z.array(z.string().min(1).max(300)).min(1).max(3).optional(),
    referenceIds: z.array(z.string()).min(1).max(3).optional(),
    references: z.array(z.object({at:z.number().min(0).max(.9),itemId:z.string()}).strict()).min(1).max(3).optional(),
    delivery: deliverySchema.optional(),
  }).strict()).min(4).max(8),
}).strict();

// The common template can build a silent episode directly from validated data.
// Optional authored episodes only tune reading time, timing and reference choices.
export function defaultSizeEpisode(rawData:unknown) {
  const data=sizeDatasetSchema.parse(rawData), seconds=30;
  return comparisonEpisodeSchema.parse({id:`${data.id.slice(0,48).replace(/-$/,'')}-comparison`,language:'en',presentation:'silent',description:`${data.title}. A silent smallest-to-largest ${data.metric} comparison. ${isQuantityMetric(data.metric)?'Object images have illustrative presentation sizes; the quantity display encodes the measured values.':'Object dimensions use the correct dimensional scale; display spacing is illustrative.'} Measurements and applicable visual credits are included below.`,scenes:data.items.map((item,i)=>({itemId:item.id,heading:item.label,durationSeconds:i===data.items.length-1?8:Math.floor((seconds-8)/(data.items.length-1))+(i<(seconds-8)%(data.items.length-1)?1:0),cues:[]}))});
}

export function compileSizeComparison(rawData: unknown, rawEpisode: unknown) {
  const data = sizeDatasetSchema.parse(rawData);
  const episode = comparisonEpisodeSchema.parse(rawEpisode);
  for(const item of data.items)if(item.visual&&item.visual.kind!=='box'&&!item.visual.calibration)throw new Error(`${item.label}: prepare and calibrate per-run assets with the compare command before compilation.`);
  const plan = planComparisonStory(data);
  if(data.items.some(item=>!item.visual&&!item.appearance&&!(item.material in materialProfiles)))throw new Error('A recognized surface map is required for geographic/celestial materials. Add a credited appearance instead of falling back to invented artwork.');
  if (episode.scenes.length !== data.items.length || episode.scenes.some((s, i) => s.itemId !== data.items[plan.shots[i].focus].id || s.beatId && s.beatId !== plan.shots[i].id)) throw new Error('Episode must follow the data-driven story plan. Run compare with --data and --plan-only before writing its script.');
  episode.scenes.forEach((s, i) => {
    if(episode.presentation==='silent'&&s.cues.length)throw new Error('Silent size comparisons show names and stats only; put explanatory notes in the description or dataset.');
    if(episode.presentation==='silent'&&s.referenceIds)throw new Error('Silent references use visual progress, not narration cue IDs.');
    const shown = new Set(plan.shots.slice(0, i + 1).flatMap(shot => shot.visible));
    if (s.referenceIds && (s.referenceIds.length !== s.cues.length || s.referenceIds.some(id => !data.items.some((item, index) => shown.has(index) && item.id === id)))) throw new Error('Each cue reference must identify an already revealed item.');
    if (s.referenceIds && ['side-by-side','overlay'].includes(plan.shots[i].layout) && s.referenceIds.some(id => id !== data.items[plan.shots[i].reference].id)) throw new Error('Pair and overlay narration references must match the objects in the planned shot.');
    if(s.references){
      if(s.references[0].at!==0||s.references.some((ref,j)=>j>0&&ref.at<=s.references![j-1].at))throw new Error('Visual references must begin at zero and be strictly ordered.');
      if(s.references.some(ref=>!data.items.some((item,j)=>item.id===ref.itemId&&shown.has(j))))throw new Error('Visual references must use already visible items.');
      if(['side-by-side','overlay'].includes(plan.shots[i].layout)&&s.references.some(ref=>ref.itemId!==data.items[plan.shots[i].reference].id))throw new Error('Pair and overlay references must match the planned objects.');
    }
  });
  const seconds = episode.scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  if (seconds < 30 || seconds > 45) throw new Error('Size-comparison Shorts must be 30–45 seconds.');
  const shots=plan.shots.map((shot,i)=>({...shot,reference:shot.role==='overview'?0:Math.min(shot.reference,...(episode.scenes[i].references??[]).map(ref=>data.items.findIndex(item=>item.id===ref.itemId)))}));
  return briefSchema.parse({
    id: episode.id, schemaVersion: 2, genre: 'explainer', language: episode.language, presentation:episode.presentation,
    topic: data.title, description: episode.description + (data.editorial?`\n\nViewer question: ${data.editorial.viewerQuestion}\n${data.editorial.throughline}\nSelection: ${data.editorial.claim.scope}`:'') + (data.basis?`\n\nMeasurement basis: ${data.basis}${data.asOf?` (as of ${data.asOf})`:''}`:'') + data.items.flatMap(item=>item.visual&&item.visual.kind!=='box'?[`\nVisual: ${item.label}: ${item.visual.attribution}. References: ${item.visual.referenceUrls.join(', ')}`]:[]).join('') + (data.metric==='volume'?'\nVolume illustrations use supplied depth and solid-fraction profiles; projected silhouettes alone do not prove volume.':'') + (data.items.some(item => item.appearance) ? '\n\nVisual credits: Earth map: NASA Blue Marble-derived / WebGL Earth. Moon map: NASA Scientific Visualization Studio, CGI Moon Kit / Ernie Wright / LROC. Mercury, Venus atmosphere, Mars, Jupiter, Neptune, Sun and Earth cloud maps: Solar System Scope (https://www.solarsystemscope.com/textures/), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Maps projected and lit locally; illustrative surfaces, not live imagery.' : ''), captionMode: episode.presentation==='silent'?'sentence':'phrase',
    voice: voiceFor(episode.language), wordsPerMinute: 185, seed: 42,
    accent: data.items[data.items.length - 1].color,
    sources: data.sources.map(({id: _id, ...source}) => source),
    structure: {beats: episode.scenes.map((s, i) => ({name: plan.shots[i].id, durationSeconds: s.durationSeconds}))},
    actors: [{id: 'sizes', kind: 'size-comparison', data:{...data,environment:plan.background.environment,backgroundReason:plan.background.reason}, shots, headings: [...episode.scenes.map(s => s.heading),'All objects'], state: {x: 500, y: 960, value: plan.shots[0].focus, reference: plan.shots[0].reference}}],
    scenes: episode.scenes.map((s, i) => ({
      title: s.heading, cues: s.cues, spokenCues: s.spokenCues, delivery: s.delivery,
      motion: [
        {actor: 'sizes', property: 'phase', keyframes: i === 0 ? [
          {at: 'start', value: 0}, {at: 'end', value: .08, easing: 'smooth'},
        ] : i===data.items.length-1 ? [
          {at:'start',value:i-1+.08},
          {at:{progress:overviewTiming.detailArrival},value:i,easing:'smooth'},
          {at:{progress:overviewTiming.zoomStart},value:i,easing:'hold'},
          {at:{progress:overviewTiming.zoomEnd},value:i+1,easing:'smooth'},
          {at:'end',value:i+1,easing:'hold'},
        ] : [
          {at: 'start', value: i - 1 + .08},
          {at: episode.presentation==='silent' ? {progress:data.scaleReference ? .8 : .27} : {cue: 0, offset: .85}, value: i - .025, easing: 'smooth'},
          {at: 'end', value: Math.min(i + .08, plan.shots.length - 1), easing: 'linear'},
        ]},
        {actor: 'sizes', property: 'value', keyframes: [{at: 'start', value: plan.shots[i].focus, easing: 'hold'}, {at: 'end', value: plan.shots[i].focus, easing: 'hold'}]},
        {actor: 'sizes', property: 'shot', keyframes: [{at: 'start', value: i, easing: 'hold'}, ...(i===data.items.length-1?[{at:{progress:overviewTiming.zoomStart},value:i+1,easing:'hold'}]:[]), {at: 'end', value: i===data.items.length-1?i+1:i, easing: 'hold'}]},
        {actor: 'sizes', property: 'reference', keyframes: episode.presentation==='silent' ? [
          {at:'start',value:s.references?data.items.findIndex(item=>item.id===s.references![0].itemId):plan.shots[i].reference,easing:'hold'},
          ...(s.references??[]).slice(1).map(ref=>({at:{progress:ref.at},value:data.items.findIndex(item=>item.id===ref.itemId),easing:'hold'})),
          {at:'end',value:s.references?data.items.findIndex(item=>item.id===s.references!.at(-1)!.itemId):plan.shots[i].reference,easing:'hold'},
        ] : [
          {at: 'start', value: s.referenceIds ? data.items.findIndex(item => item.id === s.referenceIds![0]) : plan.shots[i].reference, easing: 'hold'},
          ...s.cues.slice(1).map((_, cue) => ({at: {cue: cue + 1, offset: 0}, value: s.referenceIds ? data.items.findIndex(item => item.id === s.referenceIds![cue + 1]) : plan.shots[i].reference, easing: 'hold'})),
          {at: 'end', value: s.referenceIds ? data.items.findIndex(item => item.id === s.referenceIds![s.cues.length - 1]) : plan.shots[i].reference, easing: 'hold'},
        ]},
      ],
    })),
  });
}
