import {comparisonWarningSink} from './comparison-warnings';
import {isComparisonDisplayLabel} from '../shorts/comparison-copy';
import {comparisonLimits} from '../shorts/comparison-limits';
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {comparisonIdeasSchema,comparisonIdeasGenerationSchema,comparisonEditorialSchema,editorialSelectionIssues,editorialQualityIssues,type ComparisonConcept} from '../shorts/comparison-editorial';
import {sizeDatasetSchema,sizeItemSchema,type SizeDataset} from '../shorts/size-data';
import {comparisonVisualSchema} from '../shorts/comparison-visual';
import {resolveSizeBackground,sizeEnvironments} from '../shorts/size-environment';
import {GroqClient,loadGroqConfig} from './groq';
import {structuredStage,writeJson} from './stages';
import {comparisonIdeasPrompt} from './comparison-prompts';
import type {Research} from './contracts';
import type {WebFetch} from './research-web';
import type {VerifiedMeasurement} from './bounded-research';
import {isQuantityMetric} from '../shorts/measurements';

export type ComparisonRequest={topic:string;id:string;directory:string;root:string;log:(s:string)=>void;topicBrief?:{metric?:SizeDataset['metric'];family?:string;angle?:string;depth?:string;whyInteresting?:string;proposedObjects?:string[]}};
export type ComparisonDependencies={client?:Pick<GroqClient,'chat'>;config?:ReturnType<typeof loadGroqConfig>;webFetch?:WebFetch;research?:(request:ComparisonRequest,concept:ComparisonConcept,urls:string[])=>Promise<Research>};

// Visual variants/calibration make the full renderer schema unnecessarily
// large for free-tier text requests. The prompt describes their small output
// contracts; sizeDatasetSchema still validates the COMPLETE returned object.
export function comparisonGenerationSchema(metric:SizeDataset['metric'],sources:{id:string;url:string}[]=[],facts:VerifiedMeasurement[]=[]){
  const [cutout,sphere,box]=comparisonVisualSchema.options;
  const visual=isQuantityMetric(metric)?cutout.omit({calibration:true}).optional():metric==='diameter'?sphere.omit({calibration:true}):metric==='volume'?box:cutout.omit({calibration:true});
  const {appearance,material,...base}=sizeItemSchema.shape;
  const {value,sourceIds,range,note,approximate,...presentation}=base;
  const item=facts.length?z.object({...presentation,visual,evidenceId:z.enum(facts.map(f=>f.evidenceId) as [string,...string[]])}):z.object({...base,visual,...(sources.length?{sourceIds:z.array(z.enum(sources.map(s=>s.id) as [string,...string[]])).min(1)}:{})});
  const editorial=comparisonEditorialSchema.omit({items:true}).extend({objectRoles:comparisonEditorialSchema.shape.items});
  return z.object({...sizeDatasetSchema.shape,basis:sizeDatasetSchema.shape.basis.unwrap(),editorial:editorial.optional(),items:z.array(item).min(comparisonLimits.minimum).max(comparisonLimits.maximum)}).strict();
}

export function normalizeComparisonGeneration(raw:unknown,log?:(line:string)=>void){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return raw;
  const data={...raw} as Record<string,unknown>;
  // A model cannot mark its own copy as locally finalized.
  delete data.presentationVersion;
  let e=data.editorial;
  if(data.template!=='size-comparison'){data.template='size-comparison';log?.('Using the supported comparison template.');}
  if(typeof data.title!=='string'||data.title.length<5||data.title.length>100){data.title='Object comparison';log?.('Using a neutral title because the optional title was missing or unusable.');}
  if(data.environment!==undefined&&data.environment!=='auto'&&!(sizeEnvironments as readonly string[]).includes(String(data.environment))){delete data.environment;delete data.backgroundReason;log?.('Inferring a supported local background.');}
  if(Array.isArray(data.items))data.items=data.items.map((raw,i)=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return raw;
    const item={...raw};delete item.conditionLabel;
    if(!sizeItemSchema.shape.material.safeParse(item.material).success){delete item.material;log?.(`Using the default material for object ${i+1}.`);}
    if(item.appearance!==undefined&&!sizeItemSchema.shape.appearance.safeParse(item.appearance).success){delete item.appearance;log?.(`The asset planner will provide the real appearance for object ${i+1}.`);}
    if(item.visual&&item.appearance)delete item.appearance;
    if(typeof item.color!=='string'||!/^#[0-9a-f]{6}$/i.test(item.color)){item.color=['#73DDD1','#75A9F4','#BE9BEA','#FFC181'][i%4];log?.(`Using a readable default color for object ${i+1}.`);}
    if(item.country!==undefined&&(typeof item.country!=='string'||!item.country.trim())){delete item.country;log?.(`Omitting unavailable country metadata for object ${i+1}.`);}
    const references=Array.isArray(data.sources)?data.sources.filter(source=>source&&Array.isArray(item.sourceIds)&&item.sourceIds.includes(source.id)).map(source=>source.url):[];
    if(!item.visual&&typeof item.id==='string'&&typeof data.metric==='string'&&!isQuantityMetric(data.metric)){
      item.visual=data.metric==='diameter'?{kind:'sphere',texture:`${item.id}.png`,attribution:'Cloudflare generation pending',referenceUrls:references}:data.metric==='volume'?{kind:'box',widthToHeight:1,depthToHeight:1,projection:'isometric'}:{kind:'cutout',src:`${item.id}.png`,view:data.metric==='height'?'front':data.metric==='wingspan'?'top':'side',attribution:'Cloudflare generation pending',referenceUrls:references};
      log?.(`Using the standard visual descriptor for object ${i+1}; assets will be prepared separately.`);
    }
    return item;
  });
  // The concept contract calls this measurementBasis; the dataset calls it
  // top-level basis. Move only this known alias, without inventing its text.
  const aliases=[data.measurementBasis,e&&typeof e==='object'&&!Array.isArray(e)?(e as Record<string,unknown>).measurementBasis:undefined].filter(v=>v!==undefined);
  for(const alias of aliases){
    if(typeof alias!=='string'||!alias.trim())throw new Error('measurementBasis must contain a nonempty measurement definition.');
    if(data.basis!==undefined&&data.basis!==alias)throw new Error('Conflicting measurement basis fields; use one consistent top-level basis.');
    data.basis=alias;
  }
  delete data.measurementBasis;
  if(e&&typeof e==='object'&&!Array.isArray(e)){
    e={...e};delete (e as Record<string,unknown>).measurementBasis;data.editorial=e;
  }
  // Project model output onto the dataset's known root fields. Planning notes
  // such as generationBrief are not facts, image instructions or executable
  // content. Missing required fields and every nested contract still validate
  // strictly below. Raw responses remain in the stage's audit artifacts.
  const ignored=Object.keys(data).filter(key=>!Object.hasOwn(sizeDatasetSchema.shape,key));
  for(const key of ignored)delete data[key];
  if(ignored.length)log?.(`comparison-data: ignored non-dataset root fields ${JSON.stringify(ignored)}`);
  // Optional chart thumbnails may be planned by the asset stage. Keep supplied
  // real imagery; temporary boxes allow data validation before image planning.
  if(typeof data.metric==='string'&&isQuantityMetric(data.metric)&&Array.isArray(data.items)){
    data.items=data.items.map(item=>{
      if(!item||typeof item!=='object'||Array.isArray(item))return item;
      return item.visual?item:{...item,visual:{kind:'box',widthToHeight:1,depthToHeight:1}};
    });
  }
  // Display aliases are optional presentation metadata. Drop unsupported or
  // oversized aliases rather than spending model retries repairing cosmetics.
  if(Array.isArray(data.items))data.items=data.items.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item)||!('displayLabel' in item))return item;
    if(typeof item.label==='string'&&typeof item.displayLabel==='string'&&item.displayLabel.trim().length>0&&item.displayLabel.trim().length<=24&&isComparisonDisplayLabel(item.label,item.displayLabel))return item;
    const {displayLabel,...rest}=item;return rest;
  });
  // Canonicalize presentation metadata/order, never values, units or sources.
  if(typeof data.context==='string')data.context=data.context.slice(0,100);
  if(typeof data.title==='string'&&(typeof data.context!=='string'||!data.context.trim()))data.context=data.title.slice(0,100);
  if(Array.isArray(data.items)&&data.items.every(i=>i&&typeof i==='object'&&typeof i.value==='number'&&Number.isFinite(i.value)))data.items=[...data.items].sort((a,b)=>a.value-b.value);
  if(Array.isArray(data.items)&&data.items.length>comparisonLimits.maximum){data.items=data.items.slice(0,comparisonLimits.maximum-1).concat(data.items.slice(-1));log?.('Selected a supported fifteen-object subset within the template capacity.');}
  if(!e||typeof e!=='object'||Array.isArray(e)){delete data.editorial;log?.('No usable optional editorial plan; using the measured object progression.');return data;}
  let editorial={...e} as Record<string,unknown>;
  if('objectRoles' in e){
    if('items' in e)log?.('Using objectRoles for optional editorial role metadata.');
    const {objectRoles,...rest}=e;editorial={...rest,items:objectRoles};
  }
  if(Array.isArray(data.items)&&Array.isArray(editorial.items)){
    const ids=data.items.map(i=>i?.id);
    editorial.items=[...editorial.items].sort((a,b)=>ids.indexOf(a?.itemId)-ids.indexOf(b?.itemId));
  }
  const claim=comparisonEditorialSchema.shape.claim.safeParse(editorial.claim);
  if(claim.success&&Array.isArray(data.sources)){
    const critical=editorialSelectionIssues({sources:data.sources,asOf:typeof data.asOf==='string'?data.asOf:undefined,basis:typeof data.basis==='string'?data.basis:undefined,editorial:{claim:claim.data} as import('../shorts/comparison-editorial').ComparisonEditorial});
    if(critical.length)throw new Error(critical.join(' '));
  }else if(editorial.claim&&typeof editorial.claim==='object'&&(editorial.claim as {kind?:string}).kind==='top-n')throw new Error('A ranking claim needs valid source metadata before it can be published.');
  const parsed=comparisonEditorialSchema.safeParse(editorial);
  if(!parsed.success){delete data.editorial;log?.('Omitted malformed optional editorial metadata; using the measured object progression.');return data;}
  if(Array.isArray(data.items)&&data.items.length>=2&&data.items.every(item=>item&&typeof item.id==='string'&&typeof item.value==='number')&&Array.isArray(data.sources)){
    const issues=editorialQualityIssues({items:data.items,sources:data.sources,editorial:parsed.data});
    if(issues.length){delete data.editorial;log?.(`Using the measured progression instead of inconsistent editorial metadata: ${issues.join(' ')}`);return data;}
  }
  return {...data,editorial:parsed.data};
}

// Concept labels, rationale and design preferences do not control measurement
// truth. Correct missing bookkeeping locally and let the research stage verify
// candidates; incompatible dimensions still fail the concept schema.
export function normalizeComparisonIdeas(raw:unknown,topic:string,warn:(message:string)=>void=()=>{}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return raw;
  const input=raw as Record<string,any>;
  const text=(value:unknown,fallback:string,max=400)=>typeof value==='string'&&value.trim()&&value.length<=max?value:fallback;
  if(!Array.isArray(input.concepts))return raw;
  const approaches:Record<string,string>={diameter:'textured-spheres',height:'grounded-cutouts',length:'side-cutouts',width:'side-cutouts',wingspan:'top-cutouts',area:'equal-area-outlines',volume:'equivalent-volume-models',mass:'quantity-bars',count:'quantity-bars',speed:'quantity-bars',duration:'quantity-bars',energy:'quantity-bars',power:'quantity-bars',temperature:'temperature-axis'};
  const used=new Set<string>();
  const concepts=input.concepts.slice(0,3).map((value:any,i:number)=>{
    if(!value||typeof value!=='object'||Array.isArray(value))return value;
    const c={...value};
    const allowed=new Set(Object.keys(comparisonIdeasSchema.shape.concepts.element.shape));
    for(const key of Object.keys(c))if(!allowed.has(key))delete c[key];
    if(typeof c.id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.id)||c.id.length>60||used.has(c.id)){c.id=`concept-${i+1}`;while(used.has(c.id))c.id+='-plan';warn('Assigned a usable internal concept ID.');}used.add(c.id);
    c.title=text(c.title,'Object comparison',100);c.viewerQuestion=text(c.viewerQuestion,'How do these supported examples compare?',180);
    c.audiencePromise=text(c.audiencePromise,'Compare recognizable examples using one sourced measurement.');
    c.scope=['within-request','interpret-broad-request'].includes(c.scope)?c.scope:'within-request';
    c.scopeReason=text(c.scopeReason,'The requested topic defines the scope of the comparison.');
    c.selectionRule=text(c.selectionRule,'Use distinct supported objects and one compatible measurement.');
    if(!['familiar-to-extreme','record-ladder','unexpected-neighbors','hidden-differences','orders-of-magnitude'].includes(c.strategy)){c.strategy='familiar-to-extreme';warn('Used the default editorial angle.');}
    if(c.metric==='temperature'&&c.strategy==='orders-of-magnitude'){c.strategy='hidden-differences';warn('Temperature will use signed values rather than ratios.');}
    if(approaches[c.metric]&&c.visualApproach!==approaches[c.metric]){c.visualApproach=approaches[c.metric];warn('Used the supported visual template for the selected measurement.');}
    if(Array.isArray(c.candidates))c.candidates=[...new Set(c.candidates.filter((name:unknown)=>typeof name==='string'&&name.trim()).map((name:string)=>name.trim()))].slice(0,comparisonLimits.candidates);
    if(Array.isArray(c.candidates)&&c.candidates.length>=2){
      if(!c.candidates.includes(c.openingCandidate))c.openingCandidate=c.candidates[0];
      if(!c.candidates.includes(c.payoffCandidate)||c.payoffCandidate===c.openingCandidate)c.payoffCandidate=[...c.candidates].reverse().find((name:string)=>name!==c.openingCandidate);
    }
    c.openingIdea=text(c.openingIdea,`Introduce the provisional opening candidate ${c.openingCandidate??''}.`);
    c.payoffIdea=text(c.payoffIdea,`End with the researched largest supported object; the provisional candidate is ${c.payoffCandidate??''}.`);
    c.feasibilityNotes=Array.isArray(c.feasibilityNotes)&&c.feasibilityNotes.length?c.feasibilityNotes.slice(0,4).map((note:unknown)=>text(note,'Use the supported template and prepare the required assets locally.')):['Use the supported template and prepare required assets locally.'];
    const inferred=resolveSizeBackground({environment:'auto',items:[],title:`${topic} ${c.title}`,metric:c.metric});
    if(!c.background||!(sizeEnvironments as readonly string[]).includes(c.background.environment)||typeof c.background.reason!=='string'||!c.background.reason.trim()||c.background.reason.length>400||(c.background.environment==='studio'&&inferred.environment!=='studio'&&!/\b(studio|neutral|plain)\b/i.test(topic))){c.background={environment:inferred.environment,reason:inferred.reason};warn('Inferred the contextual local background.');}
    else c.background={environment:c.background.environment,reason:c.background.reason};
    return c;
  });
  const selectedId=concepts.some((c:any)=>c?.id===input.selectedId)?input.selectedId:concepts[0]?.id;
  if(selectedId!==input.selectedId)warn('Selected the first usable concept because the optional selection pointer was missing.');
  if(concepts.length!==3)warn('Continuing with the available concept options instead of requiring three.');
  return {schemaVersion:1,selectedId,selectionReason:text(input.selectionReason,'Use the selected supported comparison within the requested topic.'),concepts};
}

export function ensureComparisonRequest(options:ComparisonRequest){
  mkdirSync(options.directory,{recursive:true});
  const requestPath=path.join(options.directory,'request.json');
  if(existsSync(requestPath)){
    const request=JSON.parse(readFileSync(requestPath,'utf8'));
    if(request.topic!==options.topic||request.id!==options.id)throw new Error('Comparison job already exists with a different request; use a new ID.');
    if(options.topicBrief&&!request.topicBrief)writeJson(requestPath,{...request,topicBrief:options.topicBrief});
  }else writeJson(requestPath,{id:options.id,topic:options.topic,topicBrief:options.topicBrief,planningVersion:2,createdAt:new Date().toISOString()});
}

export async function planComparisonIdeas(options:ComparisonRequest,dependencies:ComparisonDependencies={}){
  ensureComparisonRequest(options);
  const filename=path.join(options.directory,'idea-plan.json');
  if(existsSync(filename))return comparisonIdeasSchema.parse(JSON.parse(readFileSync(filename,'utf8')));
  // Completed legacy runs are never silently reinterpreted with a new angle.
  if(existsSync(path.join(options.directory,'dataset.raw.json')))throw new Error('This job already has a dataset. Use a new ID to explore new ideas.');
  const config=dependencies.config??loadGroqConfig(path.join(options.root,'.env.local'));
  const client=dependencies.client??new GroqClient({apiKey:config.apiKey,onRetry:options.log});
  const researchFile=path.join(options.directory,'research.json');
  const existingResearch=existsSync(researchFile)?JSON.parse(readFileSync(researchFile,'utf8')):undefined;
  // Groq's constrained decoder repeatedly rejected these multi-concept plans.
  // Start in JSON mode, then enforce the complete generation contract locally.
  const warn=comparisonWarningSink(options.directory,options.log);
  const ideas=await structuredStage({stage:'motion',artifact:'comparison-ideas',model:config.scriptModel,client,maxCompletionTokens:4800,constrained:false,compactSchema:true,nullableOptionals:true,schema:comparisonIdeasGenerationSchema,system:comparisonIdeasPrompt,input:JSON.stringify({topic:options.topic,topicBrief:options.topicBrief,existingResearch}),directory:options.directory,log:options.log,repairInstruction:'Keep the requested scope and propose three distinct feasible concepts. Every concept must include background: {environment: a supported setting, reason: why it relates to the overall video}. Correct the concept IDs, exact candidate names, dimension or visual approach identified below.',validate:raw=>{
    const normalized=normalizeComparisonIdeas(raw,options.topic,warn);
    const ideas=comparisonIdeasGenerationSchema.parse(normalized);
    return ideas;
  }});
  writeJson(filename,ideas);return ideas;
}

export function validateConceptSelection(data:SizeDataset,concept:ComparisonConcept,warn:(message:string)=>void=()=>{}){
  if(data.metric!==concept.metric||data.unit!==concept.unit)throw new Error('Keep the selected concept metric and unit; do not combine incompatible dimensions.');
  if(!data.editorial){warn('Using the sourced comparison without optional editorial metadata.');return data;}
  if(data.editorial.conceptId!==concept.id||data.editorial.strategy!==concept.strategy)warn('Editorial concept/strategy changed; the verified objects and measurement remain authoritative.');
  if(data.editorial.viewerQuestion!==concept.viewerQuestion&&data.editorial.questionRevision?.originalQuestion!==concept.viewerQuestion)warn('Viewer question changed without an optional questionRevision note.');
  for(const role of ['opening','payoff'] as const){
    const proposed=role==='opening'?concept.openingCandidate:concept.payoffCandidate;
    const key=(label:string)=>label.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
    for(const adjustment of data.editorial.conceptAdjustments){
      if(adjustment.role===role&&key(proposed)&&key(adjustment.originalCandidate)===key(proposed))adjustment.originalCandidate=proposed;
    }
    const actual=data.items.find(item=>item.id===data.editorial![role].itemId)??(role==='opening'?data.items[0]:data.items.at(-1)!);
    if(actual.label!==proposed&&!data.editorial.conceptAdjustments.some(a=>a.role===role&&a.originalCandidate===proposed&&a.replacementItemId===actual.id))warn(`Editorial ${role} changed from ${proposed} to ${actual.label}; using actual measurement order.`);
  }
  if(!isQuantityMetric(data.metric)&&concept.strategy==='orders-of-magnitude'&&data.items.at(-1)!.value/data.items[0].value>=1e6&&(!data.scaleReference||data.displayUnits!=='adaptive')){data.scaleReference=true;data.displayUnits='adaptive';warn('Enabled the live ruler and adaptive units for the verified extreme scale.');}
  const included=new Set(data.items.map(i=>i.label.toLowerCase()));
  if(data.editorial.omittedCandidates.some(i=>included.has(i.label.toLowerCase()))){data.editorial.omittedCandidates=data.editorial.omittedCandidates.filter(item=>!included.has(item.label.toLowerCase()));warn('Removed selected objects from optional omission metadata.');}
  return data;
}
