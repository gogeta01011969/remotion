import {z} from 'zod';
import {sizeEnvironments} from './size-environment';

const id=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60);
const reason=z.string().trim().min(25).max(400);
export const comparisonStrategy=z.enum(['familiar-to-extreme','record-ladder','unexpected-neighbors','hidden-differences','orders-of-magnitude']);

const concept=z.object({
  id,title:z.string().min(5).max(100),
  viewerQuestion:z.string().min(15).max(180),
  audiencePromise:reason,
  strategy:comparisonStrategy,
  scope:z.enum(['within-request','interpret-broad-request']),scopeReason:reason,
  selectionRule:reason,
  metric:z.enum(['diameter','height','length','width','wingspan','area','volume']),
  unit:z.enum(['nm','um','mm','cm','m','km','AU','ly','mm2','cm2','m2','km2','mm3','cm3','m3','km3','mL','L']),
  measurementBasis:reason,
  visualApproach:z.enum(['textured-spheres','grounded-cutouts','side-cutouts','top-cutouts','equal-area-outlines','equivalent-volume-models']),
  background:z.object({environment:z.enum(sizeEnvironments),reason}).strict().optional(),
  candidates:z.array(z.string().trim().min(2).max(80)).min(4).max(10),
  openingCandidate:z.string().min(2).max(80),payoffCandidate:z.string().min(2).max(80),
  openingIdea:reason,payoffIdea:reason,
  feasibilityNotes:z.array(reason).min(1).max(4),
}).strict().superRefine((value,ctx)=>{
  const issue=(message:string)=>ctx.addIssue({code:'custom',message});
  const linear=['nm','um','mm','cm','m','km','AU','ly'];
  if(value.metric==='area'?!value.unit.endsWith('2'):value.metric==='volume'?!['mm3','cm3','m3','km3','mL','L'].includes(value.unit):!linear.includes(value.unit))issue('Concept metric and unit must describe one dimension.');
  if(value.metric==='diameter'&&value.visualApproach!=='textured-spheres')issue('Diameter needs sphere-compatible objects.');
  if(value.metric==='area'&&value.visualApproach!=='equal-area-outlines')issue('Area needs sourced equal-area outlines.');
  if(value.metric==='volume'&&value.visualApproach!=='equivalent-volume-models')issue('Plan equivalent-volume models for capacity rather than guessing volume from a silhouette.');
  if(value.metric==='wingspan'&&value.visualApproach!=='top-cutouts')issue('Wingspan needs a consistent top view with wings extended.');
  if(['length','width'].includes(value.metric)&&!['side-cutouts','top-cutouts'].includes(value.visualApproach))issue('Length/width needs a consistent side or top view.');
  if(value.metric==='height'&&value.visualApproach!=='grounded-cutouts')issue('Height needs full objects on a common ground line.');
  if(new Set(value.candidates.map(name=>name.toLowerCase())).size!==value.candidates.length)issue('Research candidates must be distinct objects.');
  for(const name of [value.openingCandidate,value.payoffCandidate])if(!value.candidates.includes(name))issue(`Opening/payoff "${name}" must exactly match one of: ${value.candidates.join('; ')}.`);
  if(value.openingCandidate===value.payoffCandidate)issue('Choose distinct provisional opening and payoff objects.');
});
export const comparisonIdeasSchema=z.object({
  schemaVersion:z.literal(1),selectedId:id,selectionReason:reason,
  concepts:z.array(concept).length(3),
}).strict().superRefine((ideas,ctx)=>{
  if(new Set(ideas.concepts.map(c=>c.id)).size!==3||!ideas.concepts.some(c=>c.id===ideas.selectedId))ctx.addIssue({code:'custom',message:'Use three unique concept IDs and select one of them.'});
  if(new Set(ideas.concepts.map(c=>c.viewerQuestion.toLowerCase())).size!==3)ctx.addIssue({code:'custom',message:'Propose three different viewer questions, not the same list under different titles.'});
});
export type ComparisonIdeas=z.infer<typeof comparisonIdeasSchema>;
export type ComparisonConcept=ComparisonIdeas['concepts'][number];

// Selection is the silent video's editorial script. It travels with the data
// so later compilation cannot replace its intent with a generic list.
export const comparisonEditorialSchema=z.object({
  conceptId:id,strategy:comparisonStrategy,
  viewerQuestion:z.string().min(15).max(180),throughline:reason,
  selectionRule:reason,
  opening:z.object({itemId:id,reason}).strict(),
  familiarAnchor:z.object({itemId:id,reason}).strict(),
  surprisingPair:z.object({smallerId:id,largerId:id,reason}).strict(),
  payoff:z.object({itemId:id,reason}).strict(),
  items:z.array(z.object({itemId:id,role:z.enum(['anchor','bridge','contrast','payoff']),reason}).strict()).min(4).max(8),
  omittedCandidates:z.array(z.object({label:z.string().min(1).max(80),reason}).strict()).max(10),
  conceptAdjustments:z.array(z.object({role:z.enum(['opening','payoff']),originalCandidate:z.string().min(2).max(80),replacementItemId:id,reason}).strict()).max(2).default([]),
  questionRevision:z.object({originalQuestion:z.string().min(15).max(180),reason}).strict().optional(),
  claim:z.object({kind:z.enum(['curated','top-n']),scope:reason,sourceIds:z.array(id).min(1)}).strict(),
}).strict();
export type ComparisonEditorial=z.infer<typeof comparisonEditorialSchema>;

export function editorialSelectionIssues(data:{items:{id:string;value:number}[];sources:{id:string}[];asOf?:string;basis?:string;editorial?:ComparisonEditorial}){
  const e=data.editorial;if(!e)return [];
  const issues:string[]=[],ids=data.items.map(i=>i.id),known=new Set(ids);
  if(e.items.length!==ids.length||e.items.some((item,i)=>item.itemId!==ids[i]))issues.push('Editorial item roles must cover every selected object in dataset order.');
  if(e.opening.itemId!==ids[0])issues.push('The opening must be the actual first, smallest object.');
  if(e.payoff.itemId!==ids.at(-1)||e.items.at(-1)?.role!=='payoff')issues.push('The payoff must be the actual last, largest object.');
  if(!known.has(e.familiarAnchor.itemId))issues.push('The familiar anchor must appear in the video.');
  const a=ids.indexOf(e.surprisingPair.smallerId),b=ids.indexOf(e.surprisingPair.largerId);
  if(a<0||b!==a+1)issues.push('The surprising pair must be two consecutive revealed objects, in scale order.');
  if(e.claim.sourceIds.some(id=>!data.sources.some(s=>s.id===id)))issues.push('Editorial claims must reference supplied sources.');
  if(e.claim.kind==='top-n'&&(!data.asOf||!data.basis))issues.push('A top-N claim needs a dated ranking scope and consistent measurement basis.');
  if(new Set(e.items.map(item=>item.reason.toLowerCase())).size!==e.items.length)issues.push('Give each object its own selection reason; repeated filler is not an editorial plan.');
  if(new Set(e.conceptAdjustments.map(a=>a.role)).size!==e.conceptAdjustments.length||e.conceptAdjustments.some(a=>a.replacementItemId!==e[a.role].itemId))issues.push('Opening/payoff adjustments must be unique and reference the actual selected role.');
  if(data.items.at(-1)!.value===data.items[0].value&&e.strategy!=='hidden-differences')issues.push('An all-equal selection needs an explicit hidden-differences angle, not invented escalation.');
  return issues;
}
