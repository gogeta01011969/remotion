import {sizeDatasetSchema,type SizeDataset} from '../../src/shorts/size-data';
import {comparisonLimits,requireComparisonCount} from '../../src/shorts/comparison-limits';

// Historical examples remain unchanged. Undersized examples become explicitly
// synthetic geometry fixtures, never researched datasets for production jobs.
export function prepareComparisonExample(raw:unknown):{data:SizeDataset;synthetic:boolean}{
  const data=sizeDatasetSchema.parse(raw);
  if(data.items.length>=comparisonLimits.minimum){requireComparisonCount(data.items.length);return {data,synthetic:false};}
  const sourceId='synthetic-fixture';
  const items=Array.from({length:comparisonLimits.minimum},(_,i)=>{
    const original=data.items[i%data.items.length];
    const {range,...item}=original;
    return {...item,id:`fixture-${i+1}`,label:`Reference ${String.fromCharCode(65+i)}`,displayLabel:undefined,
      value:data.metric==='temperature'&&data.unit!=='K'?i-3:i+1,approximate:false,sourceIds:[sourceId],
      note:'Synthetic fixture value; original artwork reused only to exercise rendering.',
      country:original.country?'Synthetic fixture':undefined};
  });
  return {synthetic:true,data:sizeDatasetSchema.parse({...data,
    id:`${data.id.slice(0,40)}-verification`,title:`${data.metric[0].toUpperCase()+data.metric.slice(1)} — synthetic eight-object test`,
    context:'Offline template verification; values are synthetic, not factual measurements.',
    basis:'Synthetic numerical values in the specified unit test rendering and geometry only. Reused source artwork retains its original credits; no real-world measurement claim is made.',
    editorial:undefined,asOf:data.metric==='count'&&data.countBasis!=='fixed'?data.asOf:undefined,
    items,sources:[{id:sourceId,title:'Synthetic offline renderer fixture; values are not researched facts',url:'https://example.com/synthetic-renderer-fixture'}],
  })};
}
