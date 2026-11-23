import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {sizeDatasetSchema,type SizeDataset} from '../shorts/size-data';
import {comparisonMetrics,comparisonUnits,metricUnitCompatible,isQuantityMetric} from '../shorts/measurements';
import {sizeEnvironments,resolveSizeBackground} from '../shorts/size-environment';
import {comparisonSubjectHint} from '../shorts/comparison-context';
import {isComparisonDisplayLabel} from '../shorts/comparison-copy';
import {comparisonLimits} from '../shorts/comparison-limits';
import {objectAppearanceBrief} from './comparison-images';
import {GroqClient,loadGroqConfig} from './groq';
import {structuredStage,writeJson} from './stages';
import {finalizeComparisonPresentation} from './comparison-presentation';
import {UnworkableTopicError} from './generation-errors';
import type {ComparisonRequest,ComparisonDependencies} from './comparison-ideas';

export const simplePlanSchema=z.object({
 title:z.string().optional(),metric:z.enum(comparisonMetrics),unit:z.enum(comparisonUnits),basis:z.string().optional(),background:z.enum(sizeEnvironments).optional(),
 objects:z.array(z.object({name:z.string(),value:z.number(),label:z.string().optional(),condition:z.string().optional(),country:z.string().optional(),appearance:z.string().optional()}).strip()).min(2).max(15),
}).strip();
export const simpleComparisonPrompt=`Plan ONE meaningful, engaging silent English YouTube comparison Short for the supplied topic. Choose a clear angle and 8–15 recognizable real objects with useful contrasts, familiar anchors, surprising neighbors and an interesting final reveal. A smaller set is fine for a narrow matchup. Preserve an explicitly requested subject; otherwise choose a strong treatment rather than a random list or tiny variants of the same object. The objects and their differences should carry the story without narration. Choose the objects yourself within the supplied topic. Every object must actually belong to that subject pool. Land vehicles exclude spacecraft and people; animal comparisons exclude machines unless explicitly cross-category. Do not stretch the topic to force bigger values or fill a count. Never invent named models or projects; typical generic objects are better than fictional specificity.
Return a compact JSON object: title, metric, unit, basis, background, objects. Each object needs only name and value; optional label, condition, country and appearance can help the video. All values must use ONE common unit and comparable meaning. Use realistic approximate values from general knowledge. No web research, quotes, citations, evidence IDs, generated code or claims of verified records. Do not invent fictional objects or knowingly absurd values. If unsure of a precise figure, use a sensible rounded estimate or a more familiar object. Generic objects can use typical representative sizes with a brief condition such as 'Typical mug' or 'Varies by model'. This is an illustrative comparison, not a reference database.
Use diameter for whole sphere-like objects, height for upright subjects, length/width/wingspan for compatible views, volume for capacity cubes, or mass/count/speed/duration/energy/power/temperature for bar charts. Do not mix radius and diameter, mass and size, energy and power, or lifespans and calendar years. Numbers in objects are already expressed in the root unit. Temperatures may be negative in C/F, never below absolute zero. Relevant conditions can differ if labeled (diving versus service speed, typical lifespan, model/configuration). Include countries for landmarks when known. Do not invent dates or source links.
Choose a quiet related background: space, sports, architecture, nature, transport, sky, water, storage, laboratory, geography or studio. Appearance describes identity, real colors/materials/markings only; code supplies image format, pose, framing and animation. No rulers, annotations, backgrounds, texture-format instructions or arbitrary React. Prefer a concise curiosity question for the title; do not assert a winner that the approximate numbers contradict.`;

export function buildSimpleComparison(raw:unknown,options:Pick<ComparisonRequest,'id'|'topic'>):SizeDataset{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new UnworkableTopicError('The comparison plan needs a metric, common unit and at least two objects.');
 const input=raw as Record<string,any>;
 if(!comparisonMetrics.includes(input.metric)||!comparisonUnits.includes(input.unit)||!metricUnitCompatible(input.metric,input.unit))throw new UnworkableTopicError('Choose one supported measurement and compatible common unit.');
 if(input.metric==='area')throw new UnworkableTopicError('Geographic-outline acquisition is not enabled for automatic videos. Choose another supported measurement.');
 const seen=new Set<string>();
 const objects=(Array.isArray(input.objects)?input.objects:Array.isArray(input.items)?input.items:[]).map((item:any)=>item&&typeof item==='object'?{...item}:item).filter((item:any)=>{
   if(!item||typeof item!=='object')return false;
   const name=typeof item.name==='string'?item.name.trim():typeof item.label==='string'?item.label.trim():'';
   const numeric=typeof item.value==='string'?item.value.trim().replace(/,/g,''):'';
   const value=typeof item.value==='number'?item.value:numeric&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(numeric)?Number(numeric):NaN;
   if(!name||name.length>80||seen.has(name.toLowerCase())||!Number.isFinite(value)||Math.abs(value)>1e30||input.metric!=='temperature'&&value<0||!['temperature','count','speed','duration','energy','power'].includes(input.metric)&&value===0)return false;
   if(input.metric==='temperature'&&(input.unit==='K'&&value<0||input.unit==='C'&&value<-273.15||input.unit==='F'&&value<-459.67))return false;
   seen.add(name.toLowerCase());item.name=name;item.value=value;return true;
 }).slice(0,comparisonLimits.maximum).sort((a:any,b:any)=>a.value-b.value);
 if(objects.length<comparisonLimits.minimum)throw new UnworkableTopicError('Choose at least two distinct objects with sensible numeric values.');
 const environment=sizeEnvironments.includes(input.background)?input.background:'auto';
 const hinted=resolveSizeBackground({environment,items:[],title:options.topic,metric:input.metric});
 const subject=comparisonSubjectHint(options.topic)??(hinted.environment==='space'?'space':hinted.environment==='sports'?'sports':hinted.environment==='nature'?'animals':'generic');
 const items=objects.map((item:any,index:number)=>{
   const id=`object-${index+1}`;const kind=input.metric==='diameter'?'sphere':'cutout';
   const appearance=typeof item.appearance==='string'&&item.appearance.trim()?item.appearance.slice(0,1400):`Faithfully depict ${item.name}, using its real recognizable identity, typical colors, materials and proportions. Preserve its distinguishing features.`;
   const visual=input.metric==='volume'?{kind:'box',widthToHeight:1,depthToHeight:1,projection:'isometric'}:{kind,...(kind==='sphere'?{texture:`${id}.png`}:{src:`${id}.png`,view:input.metric==='height'?'front':input.metric==='wingspan'?'top':'side'}),attribution:'AI-generated illustrative image; Cloudflare preparation required.',referenceUrls:[],generation:{prompt:objectAppearanceBrief(item.name,kind,appearance)}};
   const label=typeof item.label==='string'&&item.label.trim().length<=24&&isComparisonDisplayLabel(item.name,item.label)?item.label.trim():undefined;
   return {id,label:item.name,...(label?{displayLabel:label}:{}),value:input.metric==='count'&&input.unit==='count'?Math.round(item.value):item.value,color:['#73DDD1','#78AEFC','#C5A4FB','#FFBD77','#FF8195','#A8D973'][index%6],approximate:true,sourceIds:[],note:typeof item.condition==='string'&&item.condition.trim()?item.condition.slice(0,160):'Approximate illustrative value; actual measurements may vary.',...(typeof item.country==='string'&&item.country.trim()?{country:item.country.trim().slice(0,56)}:{}),visual};
 });
 const basis=typeof input.basis==='string'&&input.basis.trim()?input.basis.slice(0,500):`Approximate ${input.metric} in ${input.unit}; representative values for an illustrative comparison.`;
 const data=sizeDatasetSchema.parse({template:'size-comparison',dataQuality:'estimated',id:options.id,title:typeof input.title==='string'&&input.title.length>=5?input.title.slice(0,100):options.topic.slice(0,100),metric:input.metric,unit:input.unit,basis,subject,environment:hinted.environment,backgroundReason:hinted.reason,displayUnits:'adaptive',scaleReference:!isQuantityMetric(input.metric)&&!['area','volume'].includes(input.metric),context:'An illustrative comparison using approximate values.',...(input.metric==='count'?{countBasis:/population/i.test(options.topic+' '+basis)?'population':'fixed'}:{}),items,sources:[]});
 return finalizeComparisonPresentation(data);
}

export async function planSimpleComparison(options:ComparisonRequest,dependencies:ComparisonDependencies={}){
 const cachedFile=path.join(options.directory,'dataset.raw.json');
 if(existsSync(cachedFile))return finalizeComparisonPresentation(sizeDatasetSchema.parse(JSON.parse(readFileSync(cachedFile,'utf8'))));
 const config=dependencies.config??loadGroqConfig(path.join(options.root,'.env.local'));
 const client=dependencies.client??new GroqClient({apiKey:config.apiKey,onRetry:options.log});
 const data=await structuredStage({stage:'motion',artifact:'comparison-plan',maxAttempts:2,model:config.scriptModel,client,constrained:false,compactSchema:true,maxCompletionTokens:4000,schema:simplePlanSchema,system:simpleComparisonPrompt,input:JSON.stringify({topic:options.topic,measurement:options.topicBrief?.metric,curiosity:options.topicBrief?.whyInteresting}),directory:options.directory,log:options.log,repairFromDraft:true,repairInstruction:'Keep the topic and return a simple common metric/unit with an ordered list of real objects and plausible approximate values. No IDs, sources or research records are needed.',validate:raw=>buildSimpleComparison(raw,options)});
 writeJson(cachedFile,data);writeJson(path.join(options.directory,'comparison-plan.json'),{mode:'simple-estimated',topic:options.topic,title:data.title,metric:data.metric,unit:data.unit,basis:data.basis,background:data.environment,objects:data.items.map(i=>({name:i.label,value:i.value,condition:i.note,country:i.country,appearance:i.visual&&i.visual.kind!=='box'?i.visual.generation?.prompt:undefined})),webResearch:false});
 writeJson(path.join(options.directory,'dataset-assembly.json'),{version:2,mode:'simple-estimated',selectedMeasurements:data.items.length,modelRequests:0,webResearch:false});
 options.log(`Planned ${data.items.length} objects using approximate values; no web research.`);
 return data;
}
