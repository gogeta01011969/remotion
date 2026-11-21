import {quantityDomain} from './measurements';


// Sequential growth uses one fixed linear axis for the complete dataset.
export function sampleQuantityBars(values:number[],metric:string,active:number,localFrame:number,fps:number,overview=false,transitionSeconds=1){
  const focus=Math.max(0,Math.min(values.length-1,Math.round(active)));
  const progress=overview?1:Math.max(0,Math.min(1,localFrame/Math.max(1,fps*transitionSeconds)));
  const count=overview?values.length:focus+1,previous=Math.max(1,count-1);
  const domain=quantityDomain(values,metric);
  const chart={left:130,width:730,top:230,height:520};
  const y=(value:number)=>chart.top+chart.height*(1-(value-domain.min)/(domain.max-domain.min));
  const center=(i:number,n:number)=>chart.left+chart.width*(i+.5)/n;
  return {domain,chart,progress,zeroY:y(0),bars:values.map((value,i)=>{
    const visible=i<count,p=overview||i<focus?1:i===focus?progress:0;
    const animated=value*p,zero=y(0),end=y(animated);
    const targetX=center(i,count),oldX=i<focus?center(i,previous):targetX+45;
    return {visible,opacity:visible?(i<focus||overview?1:Math.min(1,Math.max(0,localFrame)/Math.max(1,fps*.2))):0,x:overview?targetX:oldX+(targetX-oldX)*progress,width:Math.min(100,chart.width/count*.48),top:Math.min(zero,end),height:Math.abs(end-zero),endY:end,value:animated};
  })};
}

// Dense charts alternate two label rows. Columns keep their exact bar alignment;
// thin leaders associate the lower row with its bar, without a repeated legend.
export function quantityLabelLayout(count:number,index:number,x:number,chart={top:230,height:520,width:730},forceDense=false){
  const dense=forceDense||count>8,slot=chart.width/count,row=dense?index%2:0;
  const width=dense?Math.min(118,slot*1.86):slot*.92;
  const size=dense?Math.min(80,width*.8):Math.min(110,slot*.8);
  const imageTop=chart.top+chart.height+(dense?35:48)+(dense?row*184:0)+(110-size)/2;
  return {dense,row,width,size,x,imageTop,nameTop:dense?chart.top+chart.height+140+row*184:chart.top+chart.height+176,fontSize:dense?22:Math.min(25,Math.max(17,slot*.21))};
}
