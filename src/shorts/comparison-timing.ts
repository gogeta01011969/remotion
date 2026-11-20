import type {SizeDataset} from './size-data';

export const comparisonPacing={readingSeconds:4,overviewSeconds:4,overviewTransitionSeconds:1} as const;
export function comparisonObjectTiming(data:Pick<SizeDataset,'metric'|'items'>,index:number){
  const previous=data.items[index-1]?.value,current=data.items[index].value;
  const dimension=data.metric==='area'?2:data.metric==='volume'?3:1;
  const span=index>0&&previous>0&&data.metric!=='temperature'?(current/previous)**(1/dimension):1;
  const transitionSeconds=span>=10000?3:span>=100?2:1;
  return {transitionSeconds,readingSeconds:comparisonPacing.readingSeconds,detailSeconds:transitionSeconds+comparisonPacing.readingSeconds};
}
// Authored short beats still fit: reserve their own overview window and clamp
// arrival to the available detail time. Defaults retain four seconds per subject.
export function comparisonSceneTiming(seconds:number,transitionSeconds:number,last:boolean){
  const overviewSeconds=last?Math.min(comparisonPacing.overviewSeconds,seconds*.45):0;
  const detailSeconds=seconds-overviewSeconds;
  const arrivalSeconds=Math.min(transitionSeconds,detailSeconds*.4);
  return {arrivalSeconds,detailSeconds,detailArrival:arrivalSeconds/seconds,zoomStart:detailSeconds/seconds,zoomEnd:(detailSeconds+Math.min(comparisonPacing.overviewTransitionSeconds,overviewSeconds*.5))/seconds};
}
