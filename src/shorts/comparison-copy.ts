import type {SizeDataset} from './size-data';

// A display name may omit whole words, including middle qualifiers. It may
// normalize punctuation, but cannot add claims, abbreviations or another model.
export function isComparisonDisplayLabel(label:string,display:string){
  const tokens=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];
  const source=tokens(label),target=tokens(display);let cursor=0;
  if(!target.length)return false;
  for(const word of target){
    let next=-1;
    for(let start=cursor;start<source.length&&next<0;start++){
      let combined='';
      for(let end=start;end<source.length&&combined.length<word.length;end++){
        combined+=source[end];if(combined===word){next=end+1;break;}
      }
    }
    if(next<0)return false;cursor=next;
  }
  return true;
}

export function comparisonDisplayNames(data:Pick<SizeDataset,'items'|'subject'>){
  const proposed=data.items.map(item=>{
    const simple=item.displayLabel??(data.subject==='animals'?item.label.replace(/^(domestic|house)\s+/i,''):item.label);
    return !item.displayLabel&&simple!==item.label?simple.charAt(0).toUpperCase()+simple.slice(1):simple;
  });
  // Keep distinctions whenever shortening would make two subjects look identical.
  return proposed.map((name,i)=>proposed.some((other,j)=>j!==i&&(other.toLowerCase()===name.toLowerCase()||other.toLowerCase().endsWith(name.toLowerCase())))?data.items[i].label:name);
}
export function comparisonMeasurementLabel(data:Pick<SizeDataset,'metric'|'unit'|'title'|'basis'|'context'|'countBasis'|'asOf'>){
  const context=`${data.title} ${data.basis??''} ${data.context}`;
  const names:Record<string,string>={mass:'Mass',count:data.countBasis==='population'?'Population':'Count',speed:'Speed',duration:/lifespan|life expectancy|longevity/i.test(context)?'Lifespan':/battery/i.test(context)?'Battery life':'Time',energy:'Energy',power:'Power',temperature:'Temperature'};
  const units:Record<string,string>={year:'years',day:'days',h:'hours',min:'minutes',s:'seconds',C:'°C',F:'°F',K:'K'};
  const label=`${names[data.metric]??data.metric}${data.unit==='count'?'':` (${units[data.unit]??data.unit})`}`;
  // Dates matter for changing populations/inventories, not general lifespan or
  // physical readings. Do not imply every measurement shares one cat study date.
  return data.metric==='count'&&data.countBasis!=='fixed'&&data.asOf?`${label} · ${data.asOf.slice(0,4)}`:label;
}
