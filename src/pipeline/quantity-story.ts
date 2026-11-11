import type {SizeDataset} from '../shorts/size-data';
import type {SizeShot} from '../shorts/size-shots';
import {quantityTemplate} from '../shorts/measurements';
import {resolveSizeBackground} from '../shorts/size-environment';
export function planQuantityStory(data:SizeDataset){
  const background=resolveSizeBackground(data),ratioAllowed=data.metric!=='temperature'&&data.items[0].value>0;
  const pair=data.items.slice(1).map((item,i)=>({i,difference:item.value-data.items[i].value})).sort((a,b)=>a.difference-b.difference)[0];
  const smaller=data.items[pair.i],larger=data.items[pair.i+1];
  const differenceRange={min:(larger.range?.min??larger.value)-(smaller.range?.max??smaller.value),max:(larger.range?.max??larger.value)-(smaller.range?.min??smaller.value)};
  const shots:SizeShot[]=data.items.map((item,i)=>({id:item.id,role:'detail',layout:'lineup',focus:i,reference:Math.max(0,i-1),visible:data.items.map((_,j)=>j),metric:data.metric==='temperature'?'difference':'ratio'}));
  let overview='quantity-overview';while(data.items.some(i=>i.id===overview))overview+='-end';
  shots.push({id:overview,role:'overview',layout:'lineup',focus:data.items.length-1,reference:0,visible:data.items.map((_,i)=>i),metric:data.metric==='temperature'?'difference':'ratio'});
  return {strategy:'simultaneous-quantity-comparison',template:quantityTemplate(data.metric),metric:data.metric,unit:data.unit,presentation:'silent',environment:background.environment,background,reason:data.editorial?.throughline??'Fixed presentation-size subjects with a separate quantitative display.',editorial:data.editorial??null,
    context:{subject:data.subject,requiredFields:data.metric==='count'&&data.countBasis!=='fixed'?['asOf','countBasis','basis']:['basis']},
    scaling:{dimension:0,measurementBasis:data.basis!,objects:data.items.map(i=>({id:i.id,width:1,height:1}))},
    caveats:['Object image dimensions are illustrative and do not represent the measured quantity.','All values use a shared linear axis; population estimates require dated scope.'],
    evidence:{ratiosApplicable:ratioAllowed,largestToSmallest:ratioAllowed?data.items.at(-1)!.value/data.items[0].value:null,closestPair:{smaller:{id:smaller.id,label:smaller.label,value:smaller.value},larger:{id:larger.id,label:larger.label,value:larger.value},difference:pair.difference,differenceRange,rangesOverlap:differenceRange.min<=0,percentWider:ratioAllowed&&smaller.value>0?(larger.value/smaller.value-1)*100:null},largestToNextLargest:ratioAllowed?data.items.at(-1)!.value/data.items.at(-2)!.value:null},
    writingBrief:{hook:data.editorial?.viewerQuestion??data.title,selectionRule:data.editorial?.selectionRule??data.basis!,objectRoles:data.editorial?.items??[],background,opening:data.editorial?.opening??null,familiarAnchor:data.editorial?.familiarAnchor??null,surprisingPair:data.editorial?.surprisingPair??null,payoff:data.editorial?.payoff??null,
      guardrails:['Show all subjects together and animate every quantity simultaneously on a shared clock.','Keep subject images at a consistent presentation size.','The quantity display alone encodes values on a common linear scale.','Temperature uses positions and differences, never Celsius/Fahrenheit ratios.','Races show constant-speed illustration with a labelled simulation clock, not real acceleration.','Counts use an explicit dot legend; population/inventory scope and date must be supplied.'],beats:['Show every subject together at the shared starting point','Animate every value and quantity graphic simultaneously on one clock','Hold the complete labelled comparison']},shots};
}
