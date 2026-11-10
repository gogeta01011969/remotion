import type {SizeDataset} from './size-data';

export const sizeEnvironments=['space','sports','studio','architecture','nature','transport','geography','sky','water','storage','laboratory'] as const;
export type SizeEnvironment=typeof sizeEnvironments[number];
export const backgroundDescriptions:Record<SizeEnvironment,string>={
  space:'Stars, orbital arcs and distant light connect astronomical comparisons.',
  sports:'Stadium lighting and court markings place sports equipment in a shared arena.',
  architecture:'A distant city silhouette and structural lines connect buildings and monuments.',
  nature:'Layered terrain and woodland silhouettes connect living subjects and trees.',
  transport:'Road perspective and lane markings connect ground vehicles.',
  geography:'A globe graticule connects geographic outlines without inventing country shapes.',
  sky:'Atmospheric layers and drifting clouds connect birds, aircraft and other flying objects.',
  water:'A water horizon and moving ripples connect ships, lakes and reservoirs.',
  storage:'Warehouse racks and container outlines connect storage and capacity comparisons.',
  laboratory:'Microscopic fields and specimen rings connect small-scale scientific subjects.',
  studio:'A neutral measurement stage supports an abstract or otherwise unclassified comparison.',
};
type BackgroundInput=Pick<SizeDataset,'environment'|'items'> & Partial<Pick<SizeDataset,'subject'|'title'|'context'|'metric'|'backgroundReason'>>;
export function resolveSizeBackground(data:BackgroundInput){
  const result=(environment:SizeEnvironment,source:'planned'|'explicit'|'topic'|'subject'|'appearance'|'fallback')=>({environment,source,reason:data.backgroundReason??backgroundDescriptions[environment]});
  if(data.environment!=='auto')return result(data.environment,data.backgroundReason?'planned':'explicit');
  const fixedSubjects={space:'space',sports:'sports',statues:'architecture',buildings:'architecture',structures:'architecture',geography:'geography'} as const;
  if(data.subject&&data.subject in fixedSubjects)return result(fixedSubjects[data.subject as keyof typeof fixedSubjects],'subject');
  // The whole episode decides the setting; individual reveals never switch it.
  const topic=`${data.title??''} ${data.context??''}`.toLowerCase();
  if(/\b(flying|flight|aircraft|airliners?|aviation|wingspans?|airships?|balloons?|birds?)\b/.test(topic))return result('sky','topic');
  if(/\b(ships?|boats?|submarines?|reservoirs?|lakes?|oceans?|seas?|water)\b/.test(topic))return result('water','topic');
  if(/\b(planets?|stars?|galax(?:y|ies)|astronomical|cosmos|solar|universe|moon|sun)\b/.test(topic))return result('space','topic');
  if(/\b(microscopic|microbes?|cells?|nanoparticles?|molecules?|bacteria|microbeads?)\b/.test(topic))return result('laboratory','topic');
  if(/\b(statues?|sculptures?|buildings?|structures?|skyscrapers?|landmarks?|towers?)\b/.test(topic))return result('architecture','topic');
  if(/\b(countries|islands?|continents?|geographic|land area)\b/.test(topic))return result('geography','topic');
  if(/\b(trees?|forests?|animals?|mammals?|insects?|wildlife)\b/.test(topic))return result('nature','topic');
  if(/\b(capacit(?:y|ies)|containers?|storage|warehouses?|freight|cargo)\b/.test(topic))return result('storage','topic');
  if(/\b(sports?|basketballs?|footballs?|golf|tennis|cricket|baseballs?)\b/.test(topic))return result('sports','topic');
  const subjects:Partial<Record<NonNullable<BackgroundInput['subject']>,SizeEnvironment>>={space:'space',sports:'sports',statues:'architecture',buildings:'architecture',structures:'architecture',animals:'nature',vehicles:'transport',geography:'geography'};
  if(data.subject&&subjects[data.subject])return result(subjects[data.subject]!,'subject');
  if(data.items.length&&data.items.every(item=>Boolean(item.appearance)))return result('space','appearance');
  if(data.items.every(item=>!item.appearance&&!item.visual)&&data.items.some(item=>['felt','seam','panels','golf','baseball','basketball'].includes(item.material)))return result('sports','appearance');
  if(data.metric==='volume')return result('storage','subject');
  return result('studio','fallback');
}
export function resolveSizeEnvironment(data:BackgroundInput):SizeEnvironment{return resolveSizeBackground(data).environment;}
export const sizeEnvironmentPalette:Record<SizeEnvironment,{background:string;glow:string}>={
  space:{background:'#030812',glow:'#17273F'},
  sports:{background:'#050D0B',glow:'#18392E'},
  architecture:{background:'#070B12',glow:'#243447'},
  nature:{background:'#05100C',glow:'#1A3B2A'},
  transport:{background:'#0B0D12',glow:'#2C3544'},
  geography:{background:'#050C13',glow:'#18394A'},
  sky:{background:'#06111E',glow:'#24476B'},
  water:{background:'#031017',glow:'#164C5C'},
  storage:{background:'#090E15',glow:'#303B4D'},
  laboratory:{background:'#060D18',glow:'#273453'},
  studio:{background:'#080D13',glow:'#202B38'},
};
