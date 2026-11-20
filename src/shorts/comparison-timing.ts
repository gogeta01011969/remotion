import type {SizeDataset} from './size-data';

export const comparisonPacing={minimumReadingSeconds:2,maximumReadingSeconds:3,overviewSeconds:4,overviewTransitionSeconds:1} as const;
export function comparisonObjectTiming(data:Pick<SizeDataset,'metric'|'items'>,index:number){
  const previous=data.items[index-1]?.value,current=data.items[index].value;
  const dimension=data.metric==='area'?2:data.metric==='volume'?3:1;
  let span=index>0&&previous>0&&data.metric!=='temperature'?(current/previous)**(1/dimension):1;
  if(index>0&&(data.metric==='temperature'||previous<=0)){
    const values=data.items.map(item=>item.value),range=Math.max(...values)-Math.min(...values);
    // Signed/zero-based values use distance on the common axis, not temperature ratios.
    span=1+8*Math.abs(current-previous)/Math.max(1e-12,range);
  }
  // Logarithmic travel reflects the visual scale change without allowing an
  // astronomical jump to consume the whole Short. Keep timing local and bounded.
  const transitionSeconds=Math.round(Math.min(3,.8+.3*Math.log2(Math.max(1,span)))*100)/100;
  // Integer beat budgets work at every FPS. The remaining settled hold stays
  // between two and three seconds rather than rounding all arrivals to one speed.
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
