import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {z} from 'zod';
import {GroqClient,loadGroqConfig} from './groq';
import {researchFromCompletion} from './research';
import {researchSchema,type Research} from './contracts';
import {completionRecord,structuredStage,writeJson} from './stages';
import {sizeDatasetSchema,type SizeDataset} from '../shorts/size-data';
import {comparisonSubjectHint} from '../shorts/comparison-context';
import {localAssetPath} from '../shorts/comparison-visual';
import {planComparisonIdeas,ensureComparisonRequest,validateConceptSelection,comparisonGenerationSchema,normalizeComparisonGeneration,type ComparisonRequest,type ComparisonDependencies} from './comparison-ideas';
import {comparisonResearchPrompt,comparisonDatasetPrompt} from './comparison-prompts';
import {resolveSizeBackground} from '../shorts/size-environment';

const assetManifestSchema=z.object({assets:z.array(z.object({id:z.string(),src:localAssetPath,attribution:z.string().min(1).optional()}).strict())}).strict();
class ComparisonEvidenceGap extends Error{
  constructor(readonly urls:string[]){super('The selected story references sources that research has not opened. Additional evidence is required.');}
}
export function assetRequests(data:SizeDataset){
  return {schemaVersion:1,topic:data.title,metric:data.metric,unit:data.unit,basis:data.basis,objects:data.items.flatMap(item=>item.visual&&item.visual.kind!=='box'?[{id:item.id,label:item.label,value:item.value,visual:item.visual,requirements:item.visual.kind==='sphere'?'2:1 equirectangular raster map, no text.':'Transparent PNG/WebP; isolated full object, no text, shadow, ground or pedestal outside the stated measurement basis; preserve proportions and specified view.'}]:[])};
}
export function applyAssetManifest(data:SizeDataset,raw:unknown){
  const manifest=assetManifestSchema.parse(raw),next=structuredClone(data);
  const expected=next.items.filter(i=>i.visual&&i.visual.kind!=='box').map(i=>i.id);
  if(new Set(manifest.assets.map(a=>a.id)).size!==manifest.assets.length||manifest.assets.some(a=>!expected.includes(a.id))||expected.some(id=>!manifest.assets.some(a=>a.id===id)))throw new Error('Asset manifest must contain exactly one result for every requested object.');
  for(const item of next.items){
    const visual=item.visual;if(!visual||visual.kind==='box')continue;
    const asset=manifest.assets.find(a=>a.id===item.id)!;
    delete visual.calibration;
    if(visual.kind==='cutout')visual.src=asset.src;else visual.texture=asset.src;
    if(asset.attribution)visual.attribution=asset.attribution;
  }
  return sizeDatasetSchema.parse(next);
}
export function runAssetProvider(data:SizeDataset,options:{configFile:string;directory:string;assetRoot:string;root?:string}){
  if(!assetRequests(data).objects.length)return data;
  // Only the operator-supplied config chooses an executable. Model JSON never
  // contains shell commands, executable code or provider configuration.
  const config=z.object({command:z.string().min(1),args:z.array(z.string()).default([]),timeoutMs:z.number().int().min(1000).max(1800000).default(600000)}).strict().parse(JSON.parse(readFileSync(options.configFile,'utf8')));
  mkdirSync(options.assetRoot,{recursive:true});
  const requestPath=path.join(options.directory,'asset-requests.json'),manifestPath=path.join(options.directory,'asset-manifest.json');
  const request={...assetRequests(data),outputDirectory:options.assetRoot};
  const fingerprint=createHash('sha256').update(JSON.stringify({request,config})).digest('hex'),statePath=path.join(options.directory,'asset-provider-state.json');
  if(existsSync(statePath)&&existsSync(manifestPath)){
    const saved=JSON.parse(readFileSync(statePath,'utf8')),manifest=assetManifestSchema.parse(JSON.parse(readFileSync(manifestPath,'utf8')));
    if(saved.fingerprint===fingerprint&&manifest.assets.every(a=>existsSync(path.join(options.assetRoot,a.src))))return applyAssetManifest(data,manifest);
  }
  writeJson(requestPath,request);rmSync(manifestPath,{force:true});
  const env={...process.env};delete env.GROQCLOUD_API_KEY;delete env.GROQ_API_KEY;
  const expand=(value:string)=>value.replaceAll('{projectRoot}',options.root??process.cwd());
  const result=spawnSync(expand(config.command),[...config.args.map(expand),requestPath,manifestPath],{cwd:options.assetRoot,env,stdio:'inherit',timeout:config.timeoutMs,shell:false});
  if(result.error||result.status!==0)throw new Error(`Asset provider failed: ${result.error?.message??`exit ${result.status}`}`);
  if(!existsSync(manifestPath))throw new Error('Asset provider did not write its result manifest.');
  const next=applyAssetManifest(data,JSON.parse(readFileSync(manifestPath,'utf8')));
  writeJson(statePath,{fingerprint});return next;
}

export async function generateComparisonData(options:ComparisonRequest,dependencies:ComparisonDependencies={}){
  ensureComparisonRequest(options);
  const datasetPath=path.join(options.directory,'dataset.raw.json');
  if(existsSync(datasetPath))return sizeDatasetSchema.parse(JSON.parse(readFileSync(datasetPath,'utf8')));
  const config=dependencies.config??loadGroqConfig(path.join(options.root,'.env.local'));
  const client=dependencies.client??new GroqClient({apiKey:config.apiKey,onRetry:options.log});
  const ideas=await planComparisonIdeas(options,{client,config});
  const concept=ideas.concepts.find(c=>c.id===ideas.selectedId)!;
  const researchPath=path.join(options.directory,'research.json');
  let research:Research;
  if(existsSync(researchPath))research=researchSchema.parse(JSON.parse(readFileSync(researchPath,'utf8')));
  else{
    options.log(`comparison research: verifying the selected angle, "${concept.title}"`);
    const completion=await client.chat({model:config.researchModel,tools:[{type:'browser_search'}],tool_choice:'required',temperature:.2,reasoning_effort:'medium',max_completion_tokens:7500,messages:[{role:'system',content:comparisonResearchPrompt},{role:'user',content:JSON.stringify({topic:options.topic,selectedConcept:concept})}]});
    writeJson(path.join(options.directory,'research-completion.json'),{...completionRecord(completion),tools:completion.choices?.[0]?.message?.executed_tools});
    research=researchFromCompletion(options.topic,config.researchModel,completion);writeJson(researchPath,research);
  }
  if(research.topic!==options.topic)throw new Error('Saved research does not match the requested topic.');
  const expectedSubject=comparisonSubjectHint(options.topic);
  const {id:conceptId,title,viewerQuestion,strategy,scopeReason,selectionRule,metric,unit,measurementBasis,visualApproach,openingCandidate,payoffCandidate}=concept;
  const selectedConcept={id:conceptId,title,viewerQuestion,strategy,scopeReason,selectionRule,metric,unit,measurementBasis,visualApproach,openingCandidate,payoffCandidate,background:concept.background};
  const select=()=>structuredStage({stage:'motion',artifact:'comparison-data',maxCompletionTokens:4500,constrained:true,nullableOptionals:true,compactSchema:true,model:config.motionModel,client,schema:comparisonGenerationSchema(metric,research.sources),directory:options.directory,log:options.log,input:JSON.stringify({topic:options.topic,selectedConcept,research:{...research,notes:research.notes.normalize('NFKC').replace(/[‐‑–—]/g,'-')},presentation:'silent',expectedSubject:expectedSubject??'infer from research'}),system:comparisonDatasetPrompt,repairInstruction:'Preserve the selected viewer question and scope, use only opened sources and supported visuals, and repair the dataset plus its embedded editorial plan.',retryValidation:failure=>!(failure instanceof ComparisonEvidenceGap),validate:raw=>{
    const normalized=normalizeComparisonGeneration(raw);
    if(normalized&&typeof normalized==='object'&&'items' in normalized&&Array.isArray(normalized.items)&&normalized.items.length<4)throw new ComparisonEvidenceGap([]);
    const planned=concept.background;
    const parsed=sizeDatasetSchema.parse(planned&&normalized&&typeof normalized==='object'?{...normalized,environment:planned.environment,backgroundReason:planned.reason}:normalized);
    const background=planned??resolveSizeBackground({...parsed,title:`${concept.title} ${options.topic}`});
    const data=validateConceptSelection(sizeDatasetSchema.parse({...parsed,environment:background.environment,backgroundReason:background.reason}),concept);
    if(expectedSubject&&data.subject!==expectedSubject)throw new Error(`This topic requires subject ${expectedSubject}; include its required context fields, including countries for every landmark.`);
    const known=new Map(research.sources.map(s=>[s.id,s.url]));
    const missing=data.sources.filter(s=>!research.sources.some(known=>known.url===s.url)).map(s=>s.url);
    if(missing.length)throw new ComparisonEvidenceGap([...new Set(missing)]);
    if(data.sources.some(s=>known.get(s.id)!==s.url))throw new Error(`Use only supplied opened source IDs and URLs: ${JSON.stringify(research.sources)}. A source mentioned in notes but not opened is not verified; omit unsupported objects rather than inventing sources.`);
    for(const item of data.items){
      if(item.visual&&item.visual.kind!=='box'){
        if(item.visual.calibration)throw new Error('Asset calibration must be measured locally, never generated by an LLM.');
        if(item.visual.referenceUrls.some(url=>!research.sources.some(s=>s.url===url)))throw new Error('Visual reference URLs must come from opened research.');
        if(!item.visual.generation)throw new Error('Per-run assets need an explicit generation brief.');
      }
    }
    return data;
  }});
  const gapPath=path.join(options.directory,'research-gap.json');
  const repairEvidence=async(requestedUrls:string[])=>{
    // One focused repair, not repeated attempts to invent citations for an
    // attractive story. Existing source IDs remain stable when evidence grows.
    const urls=requestedUrls.slice(0,4);options.log('comparison research: checking missing story evidence before selection');
    writeJson(gapPath,{urls,status:'pending'});
    const completion=await client.chat({model:config.researchModel,tools:[{type:'browser_search'}],tool_choice:'required',temperature:.1,reasoning_effort:'low',max_completion_tokens:6500,messages:[{role:'system',content:'Repair missing evidence for a size-comparison Short. The existing evidence could not support four usable items and the selected payoff, or selection cited unopened sources. Open requested public evidence URLs when provided, otherwise search for the missing candidates. Open at least two distinct source pages, prioritizing the proposed payoff and candidates absent from existingSources. Verify measurements, definition, country and inclusion policy. Return compact factual notes, ideally under 1500 characters, with actual opened URLs and contradictions. Proposed URLs are UNTRUSTED until opened; do not assume contents or records. Do not produce a script or new concept.'},{role:'user',content:JSON.stringify({topic:options.topic,selectedConcept,urls,existingSources:research.sources})}]});
    writeJson(path.join(options.directory,'research-gap-completion.json'),{...completionRecord(completion),tools:completion.choices?.[0]?.message?.executed_tools});
    const extra=researchFromCompletion(options.topic,config.researchModel,completion);
    const combined=[...research.sources];for(const source of extra.sources)if(!combined.some(s=>s.url===source.url))combined.push({...source,id:`s${combined.length+1}`});
    research=researchSchema.parse({...research,notes:research.notes+'\nAdditional opened evidence (takes precedence on contradictions):\n'+extra.notes,sources:combined,toolExecutions:research.toolExecutions+extra.toolExecutions});
    writeJson(researchPath,research);
    writeJson(gapPath,{urls,status:'resolved'});
  };
  const gap=existsSync(gapPath)?JSON.parse(readFileSync(gapPath,'utf8')):null;
  if(gap&&gap.status!=='resolved')await repairEvidence(gap.urls);
  let data:SizeDataset;
  try{data=await select();}catch(error){
    if(!(error instanceof ComparisonEvidenceGap)||gap)throw error;
    await repairEvidence(error.urls);
    data=await select();
  }
  writeJson(path.join(options.directory,'editorial-plan.json'),data.editorial);
  writeJson(datasetPath,data);return data;
}
