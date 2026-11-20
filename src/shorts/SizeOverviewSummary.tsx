import type {SizeDataset} from './size-data';
import {formatMeasurement} from './size-data';
import {isQuantityMetric} from './measurements';
import {fitText,type MeasureText} from './text-metrics';

// Two endpoint labels explain the scale without labelling every silhouette.
// This component never contributes text to the separate quantity-chart template.
export const SizeOverviewSummary=({data,opacity,measure}:{data:SizeDataset;opacity:number;measure:MeasureText})=>{
  if(isQuantityMetric(data.metric))return null;
  const endpoints=[{role:'Smallest',item:data.items[0]},{role:'Largest',item:data.items.at(-1)!}];
  return <div data-size-overview-summary style={{position:'absolute',left:24,top:930,width:836,display:'flex',gap:48,opacity,transform:`translateY(${(1-opacity)*8}px)`}}>
    {endpoints.map(({role,item})=>{
      const value=`${item.range||item.approximate?'≈ ':''}${formatMeasurement(item.value,data.unit,data.displayUnits==='adaptive')}`;
      return <div key={role} data-size-endpoint={role.toLowerCase()} style={{width:394,minWidth:0,textAlign:'center'}}>
        <div style={{fontSize:17,letterSpacing:2,textTransform:'uppercase',color:'#A7BDCD',marginBottom:10}}>{role}</div>
        <div style={{fontSize:fitText(item.label,34,394,650,measure),fontWeight:650,lineHeight:1.2,color:item.color,whiteSpace:'nowrap'}}>{item.label}</div>
        <div style={{fontSize:fitText(value,36,394,700,measure),fontWeight:700,lineHeight:1.2,color:'#F3F7FA',marginTop:10,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>{value}</div>
      </div>;
    })}
  </div>;
};
