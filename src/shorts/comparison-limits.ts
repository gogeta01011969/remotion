// New runs require 8–15 subjects. Readers retain four-item legacy projects.
export const comparisonLimits={minimum:8,maximum:15,candidates:18,legacyMinimum:4,maximumSeconds:60} as const;
export function requireComparisonCount(count:number){
  if(count<comparisonLimits.minimum||count>comparisonLimits.maximum)throw new Error(`New comparisons require ${comparisonLimits.minimum}–${comparisonLimits.maximum} supported objects; found ${count}. Broaden the topic or provide more verified candidates; never pad with unsupported objects.`);
}
