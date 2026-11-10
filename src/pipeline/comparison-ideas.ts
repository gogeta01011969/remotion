import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {comparisonIdeasSchema,comparisonIdeasGenerationSchema,comparisonEditorialSchema,type ComparisonConcept} from '../shorts/comparison-editorial';
import {sizeDatasetSchema,sizeItemSchema,type SizeDataset} from '../shorts/size-data';
import {comparisonVisualSchema} from '../shorts/comparison-visual';
import {resolveSizeBackground} from '../shorts/size-environment';
import {GroqClient,loadGroqConfig} from './groq';
import {structuredStage,writeJson} from './stages';
import {comparisonIdeasPrompt} from './comparison-prompts';

export type ComparisonRequest={topic:string;id:string;directory:string;root:string;log:(s:string)=>void};
export type ComparisonDependencies={client?:Pick<GroqClient,'chat'>;config?:ReturnType<typeof loadGroqConfig>};

// Visual variants/calibration make the full renderer schema unnecessarily
// large for free-tier text requests. The prompt describes their small output
// contracts; sizeDatasetSchema still validates the COMPLETE returned object.
export function comparisonGenerationSchema(metric:SizeDataset['metric'],sources:{id:string;url:string}[]=[]){
  const [cutout,sphere,box]=comparisonVisualSchema.options;
  const visual=metric==='diameter'?sphere.omit({calibration:true}):metric==='volume'?box:cutout.omit({calibration:true});
  const {appearance,material,...base}=sizeItemSchema.shape;
  const item=z.object({...base,visual:visual.optional(),...(metric==='diameter'?{appearance,material}:{}),...(sources.length?{sourceIds:z.array(z.enum(sources.map(s=>s.id) as [string,...string[]])).min(1)}:{})});
  const editorial=comparisonEditorialSchema.omit({items:true}).extend({objectRoles:comparisonEditorialSchema.shape.items});
  return z.object({...sizeDatasetSchema.shape,editorial,items:z.array(item).min(4).max(8)});
}

export function normalizeComparisonGeneration(raw:unknown){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return raw;
  const data={...raw} as Record<string,unknown>,e=data.editorial;
  // Canonicalize presentation metadata/order, never values, units or sources.
  if(typeof data.context==='string')data.context=data.context.slice(0,100);
  if(Array.isArray(data.items)&&data.items.every(i=>i&&typeof i==='object'&&typeof i.value==='number'&&Number.isFinite(i.value)))data.items=[...data.items].sort((a,b)=>a.value-b.value);
  if(!e||typeof e!=='object'||Array.isArray(e))return data;
  let editorial={...e} as Record<string,unknown>;
  if('objectRoles' in e){
    if('items' in e)throw new Error('Use editorial.objectRoles for role records; full objects belong only in the top-level items array.');
    const {objectRoles,...rest}=e;editorial={...rest,items:objectRoles};
  }
  if(Array.isArray(data.items)&&Array.isArray(editorial.items)){
    const ids=data.items.map(i=>i?.id);
    editorial.items=[...editorial.items].sort((a,b)=>ids.indexOf(a?.itemId)-ids.indexOf(b?.itemId));
  }
  return {...data,editorial};
}

export function ensureComparisonRequest(options:ComparisonRequest){
  mkdirSync(options.directory,{recursive:true});
  const requestPath=path.join(options.directory,'request.json');
  if(existsSync(requestPath)){
    const request=JSON.parse(readFileSync(requestPath,'utf8'));
    if(request.topic!==options.topic||request.id!==options.id)throw new Error('Comparison job already exists with a different request; use a new ID.');
  }else writeJson(requestPath,{id:options.id,topic:options.topic,planningVersion:2,createdAt:new Date().toISOString()});
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
  const ideas=await structuredStage({stage:'motion',artifact:'comparison-ideas',model:config.scriptModel,client,maxCompletionTokens:4800,constrained:false,compactSchema:true,nullableOptionals:true,schema:comparisonIdeasGenerationSchema,system:comparisonIdeasPrompt,input:JSON.stringify({topic:options.topic,existingResearch}),directory:options.directory,log:options.log,repairInstruction:'Keep the requested scope and propose three distinct feasible concepts. Every concept must include background: {environment: a supported setting, reason: why it relates to the overall video}. Correct the concept IDs, exact candidate names, dimension or visual approach identified below.',validate:raw=>{
    // JSON-mode fallback can echo the schema's annotation alongside valid data.
    // Ignore only this metadata key; retain strict validation of all content.
    const normalized=raw&&typeof raw==='object'&&!Array.isArray(raw)?Object.fromEntries(Object.entries(raw).filter(([key])=>key!=='$schema')):raw;
    const ideas=comparisonIdeasGenerationSchema.parse(normalized);
    if(!/\b(studio|neutral|plain)\b/i.test(options.topic))for(const c of ideas.concepts){
      const inferred=resolveSizeBackground({environment:'auto',items:[],title:`${options.topic} ${c.title}`,metric:c.metric});
      if(c.background!.environment==='studio'&&inferred.environment!=='studio')throw new Error(`Choose a contextual background for ${c.id}; ${inferred.environment} supports this topic. Reserve studio for genuinely abstract or unclassified ideas.`);
    }
    return ideas;
  }});
  writeJson(filename,ideas);return ideas;
}

export function validateConceptSelection(data:SizeDataset,concept:ComparisonConcept){
  if(!data.editorial)throw new Error('Prompt-generated comparisons need an editorial selection plan, not only a list of measurements.');
  if(data.editorial.conceptId!==concept.id||data.editorial.strategy!==concept.strategy)throw new Error('Selection must preserve the chosen concept ID and strategy.');
  if(data.metric!==concept.metric||data.unit!==concept.unit)throw new Error('Keep the selected concept metric and unit; do not combine incompatible dimensions.');
  if(data.editorial.viewerQuestion!==concept.viewerQuestion&&data.editorial.questionRevision?.originalQuestion!==concept.viewerQuestion)throw new Error('Preserve the selected viewer question or document a research-backed correction in questionRevision.');
  for(const role of ['opening','payoff'] as const){
    const proposed=role==='opening'?concept.openingCandidate:concept.payoffCandidate;
    const actual=data.items.find(item=>item.id===data.editorial![role].itemId)!;
    if(actual.label!==proposed&&!data.editorial.conceptAdjustments.some(a=>a.role===role&&a.originalCandidate===proposed&&a.replacementItemId===actual.id))throw new Error(`Document the research-backed ${role} adjustment from ${proposed} to ${actual.label}.`);
  }
  if(concept.strategy==='orders-of-magnitude'&&data.items.at(-1)!.value/data.items[0].value>=1e6&&(!data.scaleReference||data.displayUnits!=='adaptive'))throw new Error('An extreme scale journey requires the supported live ruler and adaptive units.');
  const included=new Set(data.items.map(i=>i.label.toLowerCase()));
  if(data.editorial.omittedCandidates.some(i=>included.has(i.label.toLowerCase())))throw new Error('An omitted candidate cannot also be a selected object.');
  return data;
}
