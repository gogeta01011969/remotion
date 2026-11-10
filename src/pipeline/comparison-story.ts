import {sizeDatasetSchema,objectExtent} from '../shorts/size-data';
import type {SizeShot} from '../shorts/size-shots';
import {needsCountry} from '../shorts/comparison-context';
import {resolveSizeBackground} from '../shorts/size-environment';

// One consistent visual template. Analysis informs honest wording and caveats,
// while every subject follows the same smallest-to-largest camera progression.
export function planComparisonStory(raw: unknown) {
  const data = sizeDatasetSchema.parse(raw);
  const pairs = data.items.slice(1).map((item, i) => ({small: i, large: i + 1, ratio: item.value / data.items[i].value, difference: item.value - data.items[i].value}));
  const closest = pairs.reduce((a, b) => a.ratio <= b.ratio ? a : b);
  const small = data.items[closest.small], large = data.items[closest.large];
  const differenceRange = {min: (large.range?.min ?? large.value) - (small.range?.max ?? small.value), max: (large.range?.max ?? large.value) - (small.range?.min ?? small.value)};
  const span = data.items.at(-1)!.value / data.items[0].value;
  const top = pairs.at(-1)!;
  const strategy = 'size-progression';
  const background=resolveSizeBackground(data);
  const shots:SizeShot[] = data.items.map((_,i)=>({id:data.items[i].id,role:'detail',layout:'zoom',focus:i,reference:Math.max(0,i-1),visible:data.items.slice(0,i+1).map((_,j)=>j),metric:'ratio'}));
  let overviewId='overview';while(data.items.some(item=>item.id===overviewId))overviewId+='-end';
  shots.push({id:overviewId,role:'overview',layout:'zoom',focus:data.items.length-1,reference:0,visible:data.items.map((_,i)=>i),metric:'ratio'});
  const describe = (index: number) => ({id: data.items[index].id, label: data.items[index].label, value: data.items[index].value});
  return {
    strategy, template:'size-zoom-v1', metric: data.metric, unit: data.unit, presentation:'silent',environment:background.environment,background,
    reason:data.editorial?.throughline??'Use the same smallest-to-largest zoom template for every size comparison. Measurements determine the scale, ratios and wording, not a different visual format.',
    editorial:data.editorial??null,
    context:{subject:data.subject,requiredFields:needsCountry(data.subject)?['country']:[]},
    scaling:{dimension:data.metric==='area'?2:data.metric==='volume'?3:1,measurementBasis:data.basis??'Diameter',objects:data.items.map(item=>({id:item.id,...objectExtent(item,data.metric)}))},
    caveats: differenceRange.min <= 0 ? ['The closest pair has overlapping permitted ranges. Describe representative examples, not a guaranteed size ordering.'] : ['Measurements with ranges are representative examples; rounded comparisons are approximate.'],
    evidence: {largestToSmallest: span, closestPair: {smaller: describe(closest.small), larger: describe(closest.large), difference: closest.difference, differenceRange, rangesOverlap: differenceRange.min <= 0, percentWider: (closest.ratio - 1) * 100}, largestToNextLargest: top.ratio},
    writingBrief: {
      hook:data.editorial?.viewerQuestion??`Start with ${data.items[0].label}; the progression ends at ${data.items.at(-1)!.label}.`,
      selectionRule:data.editorial?.selectionRule??'Use the supplied curated dataset in measurement order.',
      objectRoles:data.editorial?.items??[],
      background,
      opening:data.editorial?.opening??null,
      familiarAnchor:data.editorial?.familiarAnchor??null,
      surprisingPair:data.editorial?.surprisingPair??null,
      payoff:data.editorial?.payoff??null,
      guardrails:['Keep the shared zoom template and reveal objects in dataset order.','Use object names and measurements as the primary text, with one clearly named reference per ratio.','Show names, measurements and numeric ratios; include countries for statues and buildings. Keep explanations and caveats in the description and measurement metadata.','Close measurements need restrained wording, not exaggerated size or dramatic claims.','Linear dimensions use direct scaling; area uses square-root scaling with filled-area calibration; volume uses cube-root scaling with supplied profiles. Display spacing is illustrative.','Keep the current reference visible; include the first object in the final comparison.','Give the last object its own detail beat before a separate all-object zoom-out. The overview contains objects only, without names or other text. Center the presentation vertically.'],
      beats:['Introduce the smallest object','Reveal each larger object on the same world baseline','Introduce the largest with the preceding object, then zoom out to an unlabeled overview of the full set'],
    },
    shots,
  };
}
