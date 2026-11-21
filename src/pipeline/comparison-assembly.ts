import {createHash} from 'node:crypto';
import {sizeDatasetSchema,type SizeDataset} from '../shorts/size-data';
import {comparisonLimits} from '../shorts/comparison-limits';
import {comparisonSubjectHint} from '../shorts/comparison-context';
import type {ComparisonConcept} from '../shorts/comparison-editorial';
import type {Research} from './contracts';
import type {VerifiedMeasurement} from './bounded-research';
import {UnworkableTopicError} from './generation-errors';

export function assembleVerifiedComparison(options:{id:string;topic:string;concept:ComparisonConcept;research:Research;facts:VerifiedMeasurement[]}){
 const {concept,research}=options;
 if(options.facts.length<comparisonLimits.minimum)throw new UnworkableTopicError('At least two verified measurements are required before assembling a comparison.');
 const known=new Map(research.sources.map(s=>[s.id,s]));
 for(const fact of options.facts)if(fact.unit!==concept.unit||!known.has(fact.sourceId)||!Number.isFinite(fact.value))throw new UnworkableTopicError('Verified measurements must retain their common unit and opened source IDs.');
 const sorted=[...options.facts].sort((a,b)=>a.value-b.value||(a.candidate<b.candidate?-1:a.candidate>b.candidate?1:0));
 // Retain both endpoints and spread the available intermediate ranks. Selection
 // never changes a measurement or pads the dataset with unsupported objects.
 const facts=sorted.length<=comparisonLimits.maximum?sorted:Array.from({length:comparisonLimits.maximum},(_,i)=>sorted[Math.round(i*(sorted.length-1)/(comparisonLimits.maximum-1))]);
 const hint=comparisonSubjectHint(options.topic);
 const setting=concept.background?.environment;
 const subject:SizeDataset['subject']=hint??(setting==='space'?'space':setting==='sports'?'sports':setting==='geography'?'geography':'generic');
 const countContext=`${options.topic} ${concept.title} ${concept.measurementBasis}`;
 const countBasis=concept.metric==='count'?(/population/i.test(countContext)?'population':/inventory|fleet/i.test(countContext)?'inventory':'fixed'):undefined;
 const items=facts.map((fact,index)=>{
  const id=`object-${createHash('sha256').update(fact.evidenceId).digest('hex').slice(0,12)}`;
  const referenceUrls=[known.get(fact.sourceId)!.url];
  const visual=concept.metric==='diameter'?{kind:'sphere',texture:`${id}.png`,attribution:'Cloudflare image generation required',referenceUrls}:concept.metric==='volume'?{kind:'box',widthToHeight:1,depthToHeight:1,projection:'isometric'}:{kind:'cutout',src:`${id}.png`,view:concept.metric==='height'?'front':concept.metric==='wingspan'?'top':'side',attribution:'Cloudflare image generation required',referenceUrls};
  return {id,label:fact.candidate,value:fact.value,sourceIds:[fact.sourceId],note:(fact.qualifier||fact.quote).slice(0,160),color:['#73DDD1','#78AEFC','#C5A4FB','#FFBD77','#FF8195','#A8D973'][index%6],approximate:/\b(about|approximate|approximately|estimated?|range|endpoint)\b/i.test(fact.quote+' '+fact.qualifier),visual,...(fact.country?{country:fact.country}:{}),...(fact.asOf?{asOf:fact.asOf}:{})};
 });
 if(concept.metric==='area')throw new UnworkableTopicError('Automatic geographic comparisons require sourced outline geometry; numerical area alone cannot supply it.');
 const dates=[...new Set(facts.map(f=>f.asOf).filter(Boolean))];
 const asOf=dates.length===1&&facts.every(f=>f.asOf)?dates[0]:undefined;
 const pairIndex=facts.slice(1).map((fact,i)=>({i,score:Math.abs(fact.value-facts[i].value)/Math.max(Math.abs(fact.value),Math.abs(facts[i].value),1e-12)})).sort((a,b)=>a.score-b.score||a.i-b.i)[0].i;
 const allSourceIds=[...new Set(facts.map(f=>f.sourceId))];
 const editorial={conceptId:concept.id,strategy:facts[0].value===facts.at(-1)!.value?'hidden-differences':concept.strategy,viewerQuestion:concept.viewerQuestion,throughline:'A measured progression assembled from the supported research records.',selectionRule:concept.selectionRule,
  opening:{itemId:items[0].id,reason:'Smallest verified measurement in the selected set.'},familiarAnchor:{itemId:items[0].id,reason:'The first supported object anchors the progression.'},
  surprisingPair:{smallerId:items[pairIndex].id,largerId:items[pairIndex+1].id,reason:'These neighboring verified values have the smallest relative difference in the selected set.'},
  payoff:{itemId:items.at(-1)!.id,reason:'Largest verified measurement in the selected set.'},
  items:items.map((item,i)=>({itemId:item.id,role:i===0?'anchor':i===items.length-1?'payoff':i===pairIndex+1?'contrast':'bridge',reason:`Supported measurement for ${item.label}.`.slice(0,400)})),
  omittedCandidates:concept.candidates.filter(name=>!facts.some(f=>f.candidate===name)).slice(0,10).map(label=>({label,reason:'Not part of the selected verified subset.'})),
  claim:{kind:'curated',scope:'A selection of supported measurements, not an exhaustive ranking.',sourceIds:allSourceIds}};
 const parsed=sizeDatasetSchema.safeParse({template:'size-comparison',id:options.id,title:concept.title,subject,metric:concept.metric,unit:concept.unit,basis:concept.measurementBasis,environment:setting??'auto',backgroundReason:concept.background?.reason,context:'A curated selection assembled from quoted verified measurements.',displayUnits:'adaptive',scaleReference:!['count','mass','speed','duration','energy','power','temperature','area','volume'].includes(concept.metric),...(countBasis?{countBasis}:{}),...(asOf?{asOf}:{}),editorial,items,sources:research.sources.filter(s=>facts.some(f=>f.sourceId===s.id))});
 if(!parsed.success)throw new UnworkableTopicError(`Verified measurements cannot form a coherent comparison: ${parsed.error.issues.map(i=>i.message).join('; ')}`);
 return parsed.data;
}
