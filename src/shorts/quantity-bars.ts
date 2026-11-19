import {quantityDomain} from './measurements';
import {smoothStep} from './size-text-motion';

// Sequential reveals share a linear axis. Reframing changes the axis for every
// visible bar together, preserving values and ratios as the next subject arrives.
export function sampleQuantityBars(values:number[],metric:string,active:number,localFrame:number,fps:number,overview=false){
  const focus=Math.max(0,Math.min(values.length-1,Math.round(active)));
  const progress=overview?1:smoothStep((localFrame-fps*.15)/Math.max(1,fps*1.1));
  const count=overview?values.length:focus+1,previous=Math.max(1,count-1);
  const target=quantityDomain(values.slice(0,count),metric),from=quantityDomain(values.slice(0,Math.max(1,focus)),metric);
  const domain={min:from.min+(target.min-from.min)*progress,max:from.max+(target.max-from.max)*progress};
  const chart={left:130,width:730,top:230,height:620};
  const y=(value:number)=>chart.top+chart.height*(1-(value-domain.min)/(domain.max-domain.min));
  const center=(i:number,n:number)=>chart.left+chart.width*(i+.5)/n;
  return {domain,chart,progress,zeroY:y(0),bars:values.map((value,i)=>{
    const visible=i<count,p=overview||i<focus?1:i===focus?progress:0;
    const animated=value*p,zero=y(0),end=y(animated);
    const targetX=center(i,count),oldX=i<focus?center(i,previous):targetX+45;
    return {visible,opacity:visible?(i<focus||overview?1:progress):0,x:overview?targetX:oldX+(targetX-oldX)*progress,width:Math.min(100,chart.width/count*.48),top:Math.min(zero,end),height:Math.abs(end-zero),endY:end,value:animated};
  })};
}
