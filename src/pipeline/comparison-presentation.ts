import {sizeDatasetSchema,type SizeDataset} from '../shorts/size-data';
import {comparisonDisplayNames,comparisonMeasurementLabel} from '../shorts/comparison-copy';
import {resolveSizeBackground} from '../shorts/size-environment';
import {comparisonPolicy} from './comparison-policy';

// Conditions are copied from documented qualifiers, never inferred from anatomy.
export function comparisonCondition(note:string,metric:SizeDataset['metric']='speed'){
  if(metric!=='speed'){
    if(/\b(maximum take.?off|MTOW)\b/i.test(note))return 'Max takeoff weight';
    if(/\b(empty|unladen)\b/i.test(note))return 'Unladen';
    if(/\b(loaded|laden)\b/i.test(note))return 'Loaded';
    if(/\bcaptiv(?:e|ity)\b/i.test(note))return 'In captivity';
    if(/\bwild\b/i.test(note))return 'In the wild';
    if(/\b(range|endpoint)\b/i.test(note))return 'Range endpoint';
    if(/\b(typical|average|mean)\b/i.test(note))return 'Typical / average';
    if(/\bpeak\b/i.test(note))return 'Peak';
    if(/\b(sustained|continuous)\b/i.test(note))return 'Sustained';
    if(/\b(record|maximum)\b/i.test(note))return 'Reported maximum';
    return undefined;
  }
  if(/\b(diving|dive|stoop)\b/i.test(note))return 'Diving';
  if(/\b(service|commercial|regular)\b/i.test(note))return 'Service speed';
  if(/\b(electronically limited|limited top)\b/i.test(note))return 'Limited top speed';
  if(/\brecord\b/i.test(note))return 'Record run';
  if(/\bburst\b/i.test(note))return 'Burst speed';
  if(/\b(maximum|max|top)\b/i.test(note))return 'Reported maximum';
  return undefined;
}
export function finalizeComparisonPresentation(raw:SizeDataset,warn:(message:string)=>void=()=>{}){
  const data=sizeDatasetSchema.parse(structuredClone(raw));
  if(data.presentationVersion===comparisonPolicy.version)return data;
  const names=comparisonDisplayNames(data),pair=data.editorial?.surprisingPair;
  let a=pair?data.items.findIndex(i=>i.id===pair.smallerId):-1,b=pair?data.items.findIndex(i=>i.id===pair.largerId):-1;
  if(a<0||b<0||a===b){a=0;b=data.items.length-1;}
  const measurement=comparisonMeasurementLabel({...data,asOf:undefined});
  const headline=data.metric==='speed'?`Which is faster: ${names[a]} or ${names[b]}?`:`${measurement}: ${names[a]} vs ${names[b]}`;
  const neutral=`${measurement.split(' (')[0]} comparison`;
  const title=headline.length<=100?headline:neutral;
  if(data.title!==title)warn('Replaced the provisional headline with an evidence-bound comparison hook.');
  data.title=title;
  for(const item of data.items)item.conditionLabel=comparisonCondition(item.note,data.metric);
  if(data.metric==='speed'){
    data.basis='Documented speed figures under the conditions identified per object; service, diving, record and limited speeds are distinct conditions, not one identical test.';
    if(data.items.some(i=>!i.conditionLabel))warn('Some speed conditions have no concise supported label; their original source qualifiers remain in the description.');
  }
  // A dataset-level date is meaningful only when backed by changing count data
  // or a separately verified ranking. It is not a generic publication date.
  if(data.asOf&&!(data.metric==='count'&&data.countBasis!=='fixed')&&data.editorial?.claim.kind!=='top-n'){
    delete data.asOf;warn('Omitted an irrelevant comparison-wide date.');
  }
  data.context=`A curated comparison of ${data.items.length} documented objects.`;
  const background=resolveSizeBackground({...data,backgroundReason:undefined});
  data.backgroundReason=`${background.reason} The shared setting is illustrative; only the selected objects and their measurements are compared.`.slice(0,400);
  if(data.editorial){
    data.editorial.viewerQuestion=title;
    data.editorial.throughline=`Compare ${data.items.length} supported objects using ${data.metric} in ${data.unit}.`;
    data.editorial.selectionRule='Use the supported selected objects in measured order, without implying an exhaustive world ranking.';
    data.editorial.claim={kind:'curated',scope:'A curated selection of sourced measurements, not a complete ranking.',sourceIds:[...new Set(data.items.flatMap(i=>i.sourceIds))]};
    // The old notes may mention dropped candidates. Selection facts and source
    // qualifiers remain in the research artifacts rather than stale public copy.
    delete data.editorial.questionRevision;
  }
  for(const item of data.items)if(!item.conditionLabel)delete item.conditionLabel;
  data.presentationVersion=comparisonPolicy.version;
  return sizeDatasetSchema.parse(data);
}
