import type {SizeDataset} from './size-data';

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
