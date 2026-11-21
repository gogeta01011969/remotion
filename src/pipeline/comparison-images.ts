import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import type {SizeDataset} from '../shorts/size-data';
import {sizeDatasetSchema} from '../shorts/size-data';
import type {GroqClient} from './groq';
import {comparisonWarningSink} from './comparison-warnings';
import {structuredStage,writeJson} from './stages';

// Completed authored diagrams remain supported. Every depicted real object in
// an automatic run requires a raster brief, including familiar sports balls.
export async function ensureComparisonImages(data:SizeDataset,options:{directory:string;client:Pick<GroqClient,'chat'>;model:string;log:(s:string)=>void}){
  if(data.metric==='area')throw new Error('Geographic outlines need real sourced geometry; Cloudflare cannot establish accurate borders.');
  data=structuredClone(data);
  const warn=comparisonWarningSink(options.directory,options.log);
  for(const item of data.items){
    if(item.visual&&item.visual.kind!=='box'&&item.visual.generation){
      const clean=objectAppearanceBrief(item.label,item.visual.kind,item.visual.generation.prompt);
      if(clean!==item.visual.generation.prompt){item.visual.generation.prompt=clean;warn(`Corrected conflicting image-format instructions for ${item.label} locally.`);}
    }
  }
  const missing=data.items.filter(item=>!(data.metric==='volume'&&item.visual?.kind==='box')&&(!item.visual||item.visual.kind==='box'||!item.visual.generation));
  if(!missing.length)return data;
  const images:{id:string;prompt:string}[]=[];
  for(let offset=0;offset<missing.length;offset+=5){
    const batch=missing.slice(offset,offset+5);
    const ids=batch.map(item=>item.id) as [string,...string[]];
    const schema=z.object({images:z.array(z.object({id:z.enum(ids),prompt:z.string().min(80).max(1400)}).strict()).length(batch.length)}).strict();
    const input=JSON.stringify({topic:data.title,metric:data.metric,basis:data.basis,objects:batch.map(i=>({id:i.id,label:i.label,note:i.note,country:i.country,sourceUrls:data.sources.filter(s=>i.sourceIds.includes(s.id)).map(s=>s.url)}))});
    const fingerprint=createHash('sha256').update('appearance-v2:'+input+options.model).digest('hex');
    const cacheFile=path.join(options.directory,`image-plan-batch-${offset/5+1}.json`);
    const cached=existsSync(cacheFile)?JSON.parse(readFileSync(cacheFile,'utf8')):null;
    const validate=(raw:unknown)=>{const result=schema.parse(raw);if(new Set(result.images.map(i=>i.id)).size!==ids.length)throw new Error('Image briefs must cover every requested object exactly once.');return result;};
    const plan=cached?.fingerprint===fingerprint?validate({images:cached.images}):await structuredStage({stage:'motion',artifact:missing.length<=5?'image-plan':`image-plan-${offset/5+1}`,model:options.model,client:options.client,schema,constrained:false,compactSchema:true,maxCompletionTokens:2200,directory:options.directory,log:options.log,input,system:'Write Cloudflare image briefs for EVERY supplied object. Return exactly one id/prompt per object. No procedural-material or catalog fallback, including familiar balls and planets. Describe exact identity, true typical colors, material, distinctive geometry and markings (sports seams/panels/stitches must resemble the real equipment). Do not invent markings or generic recolored spheres. Describe identity and appearance ONLY. Local code supplies all projection, pose, framing and output format. Do not request textures, equirectangular maps, sphere mapping, rulers, annotations, dimension lines, cutaways, captions, backgrounds or scenery. Do not invent dimensions or visible anatomy. Wingspan subjects need fully extended wings. Aim for 300–700 characters per prompt. Source URLs are research references, not supplied image inputs.',validate});
    writeJson(cacheFile,{fingerprint,...plan});
    images.push(...plan.images);
  }
  const next=structuredClone(data);
  for(const item of next.items){
    const brief=images.find(p=>p.id===item.id);if(!brief)continue;
    const referenceUrls=next.sources.filter(s=>item.sourceIds.includes(s.id)).map(s=>s.url);
    delete item.appearance;
    item.visual=data.metric==='diameter'?{kind:'sphere',texture:`${item.id}.png`,emissive:false,attribution:'Cloudflare image generation required',referenceUrls,generation:{prompt:objectAppearanceBrief(item.label,data.metric==='diameter'?'sphere':'cutout',brief.prompt)}}:{kind:'cutout',src:`${item.id}.png`,view:item.visual?.kind==='cutout'?item.visual.view:data.metric==='height'?'front':data.metric==='wingspan'?'top':'side',attribution:'Cloudflare image generation required',referenceUrls,generation:{prompt:objectAppearanceBrief(item.label,'cutout',brief.prompt)},...(item.visual?.kind==='cutout'&&item.visual.volumeProfile?{volumeProfile:item.visual.volumeProfile}:{})};
  }
  return sizeDatasetSchema.parse(next);
}

// Legacy conflicting briefs are discarded, not repaired with another model call.
export function objectAppearanceBrief(label:string,kind:'sphere'|'cutout',brief:string){
  const conflicting=kind==='cutout'?/equirectangular|seamless|mapping onto a sphere|mapped? (?:onto|to) (?:a )?sphere|surface texture|scale bar|measurement line|dimension line|ruler|annotat|cutaway/i:/isolated (?:circular )?ball|ruler|annotat|dimension line|cutaway/i;
  return conflicting.test(brief)?`Faithfully depict ${label}, using its real recognizable identity, typical colors, materials, proportions and distinguishing details. Do not invent markings or substitute another species or model.`:brief;
}
export function cloudflareObjectPrompt(label:string,kind:'sphere'|'cutout',brief:string,view?:'front'|'side'|'top'|'orthographic'){
  const format=kind==='sphere'?'Create a seamless flat 2:1 equirectangular surface texture. Fill the entire rectangular frame with the surface. No isolated circular ball, perspective, cast shadow or baked directional lighting.':'Create one isolated full object, accurate silhouette and real proportions, neutral background for local cutout extraction. Keep the complete object inside the central 70% of the canvas with empty margins on all sides. No cropping, ground, cast shadow, rulers or dimension annotations.';
  const pose=kind==='cutout'&&view?` Use a consistent ${view==='top'?'top-down orthographic view; show fully extended wings when present':view==='orthographic'?'orthographic view':view+' orthographic view'}.`:'';
  return `Subject: ${label}. ${format}${pose} Match the real object\'s typical colors, materials and distinctive markings; no captions or invented text. Details: ${objectAppearanceBrief(label,kind,brief).slice(0,1400)}`;
}
