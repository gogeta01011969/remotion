export const comparisonSubjects=['generic','statues','buildings','structures','animals','vehicles','geography','space','sports'] as const;
export type ComparisonSubject=typeof comparisonSubjects[number];
// Geographic identity matters for fixed landmarks; it is not relevant to a
// generic ball or planet. This policy is shared by planning and presentation.
export const needsCountry=(subject:ComparisonSubject)=>subject==='statues'||subject==='buildings'||subject==='structures';

// Enforce unambiguous topic categories before accepting an AI plan. Ambiguous
// or mixed topics remain for the research/planning stage to classify.
export function comparisonSubjectHint(topic:string):ComparisonSubject|undefined {
  const statues=/\b(statues?|sculptures?)\b/i.test(topic),buildings=/\b(buildings?|skyscrapers?)\b/i.test(topic);
  if(!statues&&!buildings&&/\bstructures?\b/i.test(topic))return 'structures';
  return statues===buildings?undefined:statues?'statues':'buildings';
}
