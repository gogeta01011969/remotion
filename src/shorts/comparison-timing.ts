import {comparisonLimits} from './comparison-limits';
import type {SizeDataset} from './size-data';

export const comparisonPacing={minimumReadingSeconds:2,maximumReadingSeconds:3,overviewSeconds:4,overviewTransitionSeconds:1} as const;
function rawObjectTiming(data:Pick<SizeDataset,'metric'|'items'>,index:number){
  const previous=data.items[index-1]?.value,current=data.items[index].value;
  const dimension=data.metric==='area'?2:data.metric==='volume'?3:1;
  let span=index>0&&previous>0&&data.metric!=='temperature'?(current/previous)**(1/dimension):1;
  if(index>0&&(data.metric==='temperature'||previous<=0)){
    const values=data.items.map(item=>item.value),range=Math.max(...values)-Math.min(...values);
    // Signed/zero-based values use distance on the common axis, not temperature ratios.
    span=1+8*Math.abs(current-previous)/Math.max(1e-12,range);
  }
  // Close sizes pass quickly; each order of magnitude adds 2.3 seconds of
  // travel. A five-second cap bounds each individual arrival.
  const transitionSeconds=index===0?.8:Math.round(Math.min(5,.25+2.3*Math.log10(Math.max(1,span)))*100)/100;
  // Integer beat budgets work at every FPS. The remaining settled hold stays
  // between two and three seconds rather than rounding all arrivals to one speed.
  const detailSeconds=Math.ceil(transitionSeconds)+comparisonPacing.minimumReadingSeconds;
  return {transitionSeconds,readingSeconds:detailSeconds-transitionSeconds,detailSeconds};
}
// Reserve reading and overview time first. Trim the largest travel budgets
// only when needed, preserving scale-sensitive arrivals and all settled holds.
export function comparisonObjectTiming(data:Pick<SizeDataset,'metric'|'items'>,index:number){
  const raw=data.items.map((_,i)=>rawObjectTiming(data,i));
  const budgets=raw.map(t=>Math.ceil(t.transitionSeconds));
  const travelBudget=comparisonLimits.maximumSeconds-comparisonPacing.overviewSeconds-data.items.length*comparisonPacing.minimumReadingSeconds;
  let total=budgets.reduce((a,b)=>a+b,0);
  while(total>travelBudget){
    const largest=budgets.reduce((best,n,i)=>n>budgets[best]?i:best,0);
    if(budgets[largest]<=1)throw new Error('Comparison cannot fit its minimum reading time.');
    budgets[largest]--;total--;
  }
  const transitionSeconds=Math.min(raw[index].transitionSeconds,budgets[index]);
  const detailSeconds=Math.ceil(transitionSeconds)+comparisonPacing.minimumReadingSeconds;
  return {transitionSeconds,readingSeconds:detailSeconds-transitionSeconds,detailSeconds};
}
// Authored short beats still fit: reserve their own overview window and clamp
// arrival to the available detail time. Defaults retain two to three settled seconds per subject.
export function comparisonSceneTiming(seconds:number,transitionSeconds:number,last:boolean){
  const overviewSeconds=last?Math.min(comparisonPacing.overviewSeconds,Math.max(1,seconds-3)):0;
  const detailSeconds=seconds-overviewSeconds;
  const arrivalSeconds=Math.min(transitionSeconds,Math.max(.25,detailSeconds-comparisonPacing.minimumReadingSeconds));
  return {arrivalSeconds,detailSeconds,detailArrival:arrivalSeconds/seconds,zoomStart:detailSeconds/seconds,zoomEnd:(detailSeconds+Math.min(comparisonPacing.overviewTransitionSeconds,overviewSeconds*.5))/seconds};
}
