import {z} from 'zod';
import type {SizeDataset} from '../shorts/size-data';
import {sizeDatasetSchema} from '../shorts/size-data';
import type {GroqClient} from './groq';
import {structuredStage} from './stages';

// Completed authored diagrams remain supported. Every depicted real object in
// an automatic run requires a raster brief, including familiar sports balls.
export async function ensureComparisonImages(data:SizeDataset,options:{directory:string;client:Pick<GroqClient,'chat'>;model:string;log:(s:string)=>void}){
  if(data.metric==='area')throw new Error('Geographic outlines need real sourced geometry; Cloudflare cannot establish accurate borders.');
  const missing=data.items.filter(item=>!(data.metric==='volume'&&item.visual?.kind==='box')&&(!item.visual||item.visual.kind==='box'||!item.visual.generation));
  if(!missing.length)return data;
  const ids=missing.map(item=>item.id) as [string,...string[]];
  const schema=z.object({images:z.array(z.object({id:z.enum(ids),prompt:z.string().min(80).max(1400)}).strict()).length(missing.length)}).strict();
  const plan=await structuredStage({stage:'motion',artifact:'image-plan',model:options.model,client:options.client,schema,constrained:false,compactSchema:true,maxCompletionTokens:2200,directory:options.directory,log:options.log,input:JSON.stringify({topic:data.title,metric:data.metric,basis:data.basis,objects:missing.map(i=>({id:i.id,label:i.label,note:i.note,country:i.country,sourceUrls:data.sources.filter(s=>i.sourceIds.includes(s.id)).map(s=>s.url)}))}),system:'Write Cloudflare image briefs for EVERY supplied object. Return exactly one id/prompt per object. No procedural-material or catalog fallback, including familiar balls and planets. Describe exact identity, true typical colors, material, distinctive geometry and markings (sports seams/panels/stitches must resemble the real equipment). Do not invent markings or generic recolored spheres. For diameter describe a seamless flat 2:1 equirectangular surface texture filling the frame, not a photograph of a round ball. For other metrics describe one accurate isolated complete object, consistent orthographic view and measurement endpoints; wingspan requires fully extended wings in a top view. No captions, labels or unrelated scenery. Aim for 300–700 characters per prompt. Source URLs are research references, not supplied image inputs.',validate:raw=>{
    const result=schema.parse(raw);if(new Set(result.images.map(i=>i.id)).size!==ids.length)throw new Error('Image briefs must cover every requested object exactly once.');return result;
  }});
  const next=structuredClone(data);
  for(const item of next.items){
    const brief=plan.images.find(p=>p.id===item.id);if(!brief)continue;
    const referenceUrls=next.sources.filter(s=>item.sourceIds.includes(s.id)).map(s=>s.url);
    delete item.appearance;
    item.visual=data.metric==='diameter'?{kind:'sphere',texture:`${item.id}.png`,emissive:false,attribution:'Cloudflare image generation required',referenceUrls,generation:{prompt:brief.prompt}}:{kind:'cutout',src:`${item.id}.png`,view:item.visual?.kind==='cutout'?item.visual.view:data.metric==='height'?'front':data.metric==='wingspan'?'top':'side',attribution:'Cloudflare image generation required',referenceUrls,generation:{prompt:brief.prompt},...(item.visual?.kind==='cutout'&&item.visual.volumeProfile?{volumeProfile:item.visual.volumeProfile}:{})};
  }
  return sizeDatasetSchema.parse(next);
}

export function cloudflareObjectPrompt(label:string,kind:'sphere'|'cutout',brief:string){
  const format=kind==='sphere'?'Create a seamless flat 2:1 equirectangular surface texture. Fill the entire rectangular frame with the surface. No isolated circular ball, perspective, cast shadow or baked directional lighting.':'Create one isolated full object, accurate silhouette and real proportions, neutral background for local cutout extraction. No cropping, ground or cast shadow.';
  return `Subject: ${label}. ${format} Match the real object\'s typical colors, materials and distinctive markings; no captions or invented text. Details: ${brief.slice(0,1400)}`;
}
