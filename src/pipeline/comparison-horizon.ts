export type PhysicalMetric='diameter'|'height'|'length'|'width'|'wingspan'|'volume';
type Family={id:string;subjects:string;metrics:PhysicalMetric[];policy:string;match:RegExp};
// Subject/angle catalogs describe capabilities, not a fixed list of objects.
// Research still chooses and verifies the actual objects on each run.
export const comparisonFamilies:Family[]=[
  {id:'worlds',subjects:'Planets, moons and small spherical worlds',metrics:['diameter'],policy:'Compare physical diameters, not orbital distances.',match:/planet|moon|solar system|worlds/},
  {id:'stars',subjects:'Stars and stellar extremes',metrics:['diameter'],policy:'Distinguish radius/diameter and uncertain estimates; avoid unsupported records.',match:/stars?|stellar|sun/},
  {id:'sports-equipment',subjects:'Sports equipment across games and standards',metrics:['diameter','length','width'],policy:'Keep competition standards, sizes and promotional replicas distinct.',match:/sports?|balls?|racket|bat\b/},
  {id:'landmarks',subjects:'Statues, buildings and iconic structures',metrics:['height'],policy:'Use consistent pedestal/antenna rules and sourced countries.',match:/statue|building|landmark|tower|skyscraper/},
  {id:'infrastructure',subjects:'Bridges, dams and civil engineering',metrics:['height','length','width'],policy:'Define span versus total length and structural height versus water depth.',match:/bridge|dam\b|infrastructure|tunnel/},
  {id:'aircraft',subjects:'Aircraft, gliders and airships',metrics:['length','wingspan'],policy:'Never mix wingspan, fuselage length, rotor diameter or altitude.',match:/aircraft|airliner|airship|glider|aviation/},
  {id:'land-vehicles',subjects:'Road, rail, agricultural and heavy vehicles',metrics:['height','length','width'],policy:'Use fixed configurations and comparable body endpoints.',match:/vehicle|truck|train|tractor|bus\b|car\b/},
  {id:'watercraft',subjects:'Boats, ships and submarines',metrics:['length','width'],policy:'Choose overall length or beam consistently; distinguish historical ships.',match:/ship|boat|submarine|watercraft/},
  {id:'land-animals',subjects:'Land animals from familiar to unusual',metrics:['height','length'],policy:'Specify adults, representative/range policy and consistent anatomical endpoints.',match:/land animal|mammal|elephant|giraffe|reptile/},
  {id:'marine-life',subjects:'Marine animals and ocean life',metrics:['length'],policy:'Separate documented specimens from speculative maximum sizes.',match:/whale|marine|ocean life|shark|squid/},
  {id:'winged-life',subjects:'Birds, bats and winged insects',metrics:['length','wingspan'],policy:'Use comparable fully extended wings or body-length endpoints.',match:/bird|bat\b|winged|insect|albatross/},
  {id:'trees-plants',subjects:'Trees and giant plants',metrics:['height','length'],policy:'Separate living/historical records and mature representative specimens.',match:/tree|plant|forest|bamboo/},
  {id:'everyday-objects',subjects:'Familiar household and human-scale objects',metrics:['diameter','height','length','width'],policy:'Name exact object/specification and keep diameter sphere-compatible.',match:/household|everyday|furniture|kitchen|human.scale/},
  {id:'machines',subjects:'Cranes, excavators, turbines and industrial machines',metrics:['height','length','width'],policy:'Use complete operating configurations; do not mix boom length and machine height.',match:/machine|crane|excavator|turbine|industrial/},
  {id:'microscopic',subjects:'Cells, particles and microscopic objects',metrics:['diameter','length'],policy:'Define the dimension, use supported static views and readable scale references.',match:/microscop|cell|particle|microbe|bacter/},
  {id:'storage-capacity',subjects:'Containers and storage capacities',metrics:['volume'],policy:'Show equivalent-volume measurement models, not exterior-size claims.',match:/capacity|container|storage|reservoir/},
  {id:'cross-category',subjects:'Recognizable objects across compatible categories',metrics:['height','length','width','wingspan'],policy:'One honest dimension, compatible views and a genuinely useful familiar anchor.',match:/cross.category|natural.*human|flying objects/},
];
export const familyIds=comparisonFamilies.map(f=>f.id) as [string,...string[]];
export const comparisonAngles=[
  {id:'familiar-to-extreme',brief:'Use a familiar anchor to make an unfamiliar extreme relatable.'},
  {id:'unexpected-neighbors',brief:'Reveal surprising near-equalities across recognizable objects.'},
  {id:'hidden-differences',brief:'Explain meaningful small differences without inventing huge jumps.'},
  {id:'record-ladder',brief:'Build a dated, clearly scoped record progression only if evidence supports it.'},
  {id:'orders-of-magnitude',brief:'Travel across scale with supported zoom, adaptive units and a live ruler.'},
  {id:'through-history',brief:'Compare clearly identified historical and current examples on one dimension.'},
  {id:'within-one-family',brief:'Explore a specific underused subgroup with distinct, recognizable items.'},
  {id:'natural-vs-engineered',brief:'Compare natural and human-made objects using identical endpoints.'},
] as const;
export const angleIds=comparisonAngles.map(a=>a.id) as [typeof comparisonAngles[number]['id'],...typeof comparisonAngles[number]['id'][]];
export const depthIds=['accessible','specialist','extreme-scale'] as const;
export const futureComparisonDimensions=[
  {dimension:'mass',needs:'Mass-specific proportional quantities and reference weights'},
  {dimension:'speed',needs:'Time/distance race animation with consistent conditions'},
  {dimension:'population',needs:'Count-based symbols or bars and dated comparable estimates'},
  {dimension:'age-duration',needs:'Timeline renderer with explicit start/end definitions'},
  {dimension:'energy-power',needs:'Quantity renderer distinguishing energy from power'},
  {dimension:'geographic-area',needs:'Reliable real-outline acquisition; authored outlines already render'},
] as const;
type EditorialItem={topic:string;metric:string|null;family?:string;angle?:string;depth?:string};
export function topicFamily(item:EditorialItem){
  if(item.family&&familyIds.includes(item.family))return item.family;
  const family=comparisonFamilies.find(f=>(!item.metric||f.metrics.includes(item.metric as PhysicalMetric))&&f.match.test(item.topic.toLowerCase()));
  return family?.id??'cross-category';
}
export function horizonPriority(candidate:EditorialItem,completed:EditorialItem[]){
  const recent=completed.slice(-12),family=topicFamily(candidate),last=recent.at(-1);
  return recent.filter(j=>topicFamily(j)===family).length*6+
    (candidate.angle?recent.filter(j=>j.angle===candidate.angle).length*2:0)+
    (candidate.depth?recent.filter(j=>j.depth===candidate.depth).length:0)+
    (last&&topicFamily(last)===family?12:0)+(last?.metric===candidate.metric?2:0);
}
export function horizonBrief(allowed:string[]){
  return {families:comparisonFamilies.filter(f=>f.metrics.some(m=>allowed.includes(m))).map(({match,...f})=>({...f,metrics:f.metrics.filter(m=>allowed.includes(m))})),angles:[...comparisonAngles],depths:depthIds,
    depthGuidance:'Accessible: familiar references. Specialist: a specific subgroup with at least one familiar anchor. Extreme-scale: honest large spans with readable scale references. Choose based on evidence and visual feasibility.'};
}
