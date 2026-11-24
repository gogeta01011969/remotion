import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {isQuantityMetric} from '../shorts/measurements';
import type {SizeDataset} from '../shorts/size-data';
import type {GroqClient} from './groq';
import {structuredStage,writeJson} from './stages';
import {makeYouTubeMetadata,type YouTubeCopy} from './youtube';

const version=1;
const schema=z.object({title:z.string(),description:z.string(),tags:z.array(z.string()),hashtags:z.array(z.string())});
const clean=(value:string)=>value.replace(/[<>]/g,'').replace(/\s+/g,' ').trim();
const fingerprint=(data:SizeDataset)=>createHash('sha256').update(JSON.stringify({version,data})).digest('hex');
const file=(directory:string)=>path.join(directory,'youtube-metadata.json');
const safeConfig={privacy:'private' as const,madeForKids:false,containsSyntheticMedia:true};

export const youtubeMetadataPrompt=`Write viewer-facing English metadata for ONE already-rendered, silent comparison YouTube Short. Use only the supplied final objects and data. Prioritize a clear specific title and natural description that explain the actual video and help relevant viewers recognize it. Return title, description, tags and hashtags as JSON.
Title: aim for 40–75 characters, maximum 100. Name the main subject/measurement naturally, with one honest curiosity angle or meaningful contrast. Prefer recognizable words over vague hype. Do not use hashtags in the title, ALL CAPS, emoji spam, "you won't believe", guaranteed viral claims, unrelated trends, or unsupported "world's fastest/biggest", definitive top-N or record claims. The selection is curated and values may be approximate. Do not imply every object or all world records are covered.
Description: 2–3 concise sentences, about 200–450 characters. Lead with what is compared and the interesting contrast; mention a few recognizable objects that actually appear. Include measurement context when useful. At most one natural question that viewers can answer from the comparison. No keyword lists, fake research, invented facts/ratios, calls to buy anything, generated-image implementation details, timestamps or narration claims. Code appends the required approximation disclosure, image credits and references; do not duplicate them.
Tags: 4–8 relevant phrases, at most 10, including the subject, measurement and a few recognizable object names when useful. No unrelated traffic bait or repetitive keyword variations. Tags are supplementary; do not treat them as an algorithm hack. Hashtags: 2–3 relevant single-word hashtags including #Shorts. No #Viral, #Trending or #FYP. Do not invent analytics, search volumes or current trends. Every claim must fit the final video; do not reintroduce omitted objects or change its content, privacy or audience settings.`;

function fallbackCopy(data:SizeDataset):YouTubeCopy{
  return {title:data.title,description:[data.context,data.basis?`Measurement basis: ${data.basis}`:''].filter(Boolean).join('\n\n'),tags:['shorts','comparison'],hashtags:['#Shorts','#Comparison']};
}
function normalize(raw:unknown,data:SizeDataset):YouTubeCopy{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Expected a metadata object.');
  const input=raw as Record<string,unknown>,fallback=fallbackCopy(data);
  const title=typeof input.title==='string'?clean(input.title):'';
  const description=typeof input.description==='string'?input.description.trim().replace(/[<>]/g,''):'';
  if((!title||title.length>100)&&(!description||description.length>700))throw new Error('No usable title or description.');
  const tags:string[]=[];let tagCharacters=0;
  for(const entry of Array.isArray(input.tags)?input.tags:[]){
    if(typeof entry!=='string')continue;
    const tag=clean(entry).replace(/^#+/,'');
    const size=tag.length+(tag.includes(' ')?2:0)+(tags.length?1:0);
    if(!tag||tag.length>50||tags.some(t=>t.toLowerCase()===tag.toLowerCase())||tagCharacters+size>450)continue;
    tags.push(tag);tagCharacters+=size;if(tags.length===10)break;
  }
  const hashtags=['#Shorts'];
  for(const entry of Array.isArray(input.hashtags)?input.hashtags:[]){
    if(typeof entry!=='string')continue;
    const tag='#'+entry.trim().replace(/^#+/,'');
    if(!/^#[a-zA-Z][a-zA-Z0-9]{1,35}$/.test(tag)||/^#(?:viral|trending|fyp)$/i.test(tag)||hashtags.some(t=>t.toLowerCase()===tag.toLowerCase()))continue;
    hashtags.push(tag);if(hashtags.length===3)break;
  }
  return {title:title&&title.length<=100?title:fallback.title,description:description&&description.length<=700?description:fallback.description,tags:tags.length?tags:fallback.tags,hashtags:hashtags.length>1?hashtags:fallback.hashtags};
}

export function cachedYouTubeCopy(data:SizeDataset,directory:string):YouTubeCopy|undefined{
  try{
    const record=JSON.parse(readFileSync(file(directory),'utf8'));
    if(record.fingerprint!==fingerprint(data))return;
    const copy=normalize(record.copy,data);
    makeYouTubeMetadata(data,safeConfig,copy);
    return copy;
  }catch{return;}
}

// One optional request using the existing shared budget. Upload preparation only
// reads this cache; an upload intent never triggers or changes generated copy.
export async function ensureYouTubeMetadata(data:SizeDataset,options:{directory:string;client:Pick<GroqClient,'chat'>;model:string;log:(line:string)=>void}){
  const cached=cachedYouTubeCopy(data,options.directory);if(cached)return cached;
  const previous=file(options.directory);
  if(existsSync(previous))options.log('YouTube metadata: final dataset changed or the saved metadata is unusable; rebuilding.');
  let copy=fallbackCopy(data),status:'generated'|'fallback'='fallback';
  try{
    copy=await structuredStage({stage:'motion',artifact:'youtube-metadata',maxAttempts:1,maxCompletionTokens:1400,client:options.client,model:options.model,schema,constrained:false,compactSchema:true,system:youtubeMetadataPrompt,directory:options.directory,log:options.log,
      input:JSON.stringify({video:{heading:data.title,language:'English',presentation:'silent comparison',visualStyle:isQuantityMetric(data.metric)?'sequential animated bars; object thumbnails identify subjects':'true-scale object comparison with camera zooms',measurement:data.metric,unit:data.unit,basis:data.basis,approximate:data.dataQuality==='estimated'||data.items.some(i=>i.approximate),objectCount:data.items.length},objects:data.items.map(i=>({name:i.label,displayName:i.displayLabel,value:i.value,condition:i.conditionLabel??i.note,country:i.country})),hasSourceReferences:data.sources.length>0}),
      validate:raw=>{const result=normalize(raw,data);makeYouTubeMetadata(data,safeConfig,result);return result;}});
    status='generated';
  }catch{
    // A ready video remains deliverable during quota/outage or malformed copy.
    options.log('YouTube metadata: optional Groq copy is unavailable; keeping the existing title and description.');
  }
  writeJson(previous,{version,fingerprint:fingerprint(data),status,model:status==='generated'?options.model:null,copy});
  options.log(`YouTube metadata: ${status}; ${copy.title}`);
  return copy;
}
