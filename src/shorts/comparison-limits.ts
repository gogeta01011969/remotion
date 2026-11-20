// Aim for 8–15 subjects; evidence-backed shorter comparisons remain usable.
export const comparisonLimits={minimum:4,targetMinimum:8,maximum:15,candidates:18,maximumSeconds:60} as const;
export function requireComparisonCount(count:number){
  if(count<comparisonLimits.minimum||count>comparisonLimits.maximum)throw new Error(`Comparisons support ${comparisonLimits.minimum}–${comparisonLimits.maximum} verified objects; found ${count}. Aim for ${comparisonLimits.targetMinimum}–${comparisonLimits.maximum}, but never pad with unsupported objects.`);
}
