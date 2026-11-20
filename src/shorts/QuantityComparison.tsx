import {useMemo} from 'react';
import {useCurrentFrame,useVideoConfig} from 'remotion';
import type {Actor,ActorState} from './schema';
import {formatSize} from './size-data';
import {ComparisonObject} from './ComparisonObject';
import {fitText,fitLabelText,useTextMetrics} from './text-metrics';
import {comparisonDisplayNames,comparisonMeasurementLabel} from './comparison-copy';
import {quantityTemplate} from './measurements';
import {comparisonObjectTiming,comparisonSceneTiming} from './comparison-timing';
import {sampleQuantityBars,quantityLabelLayout} from './quantity-bars';
import type {SizeTextTiming} from './size-text-motion';
const compact=(n:number)=>Math.abs(n)>=1e15?`${formatSize(n/1e15)}Q`:Math.abs(n)>=1e12?`${formatSize(n/1e12)}T`:Math.abs(n)>=1e9?`${formatSize(n/1e9)}B`:Math.abs(n)>=1e6?`${formatSize(n/1e6)}M`:Math.abs(n)>=1e3?`${formatSize(n/1e3)}K`:formatSize(n);

export const QuantityComparison=({actor,state,textTiming}:{actor:Extract<Actor,{kind:'size-comparison'}>;state:ActorState;textTiming?:SizeTextTiming})=>{
  const frame=useCurrentFrame(),{fps}=useVideoConfig(),{data}=actor;
  const active=Math.max(0,Math.min(data.items.length-1,Math.round(state.value))),overview=state.shot>=data.items.length;
  const objectTiming=comparisonObjectTiming(data,active);
  const timing=comparisonSceneTiming((textTiming?.durationInFrames??fps*objectTiming.detailSeconds)/fps,objectTiming.transitionSeconds,active===data.items.length-1&&!overview);
  const sample=sampleQuantityBars(data.items.map(i=>i.value),data.metric,active,textTiming?.localFrame??frame,fps,overview,timing.arrivalSeconds);
  const names=useMemo(()=>comparisonDisplayNames(data),[data.items,data.subject]),measure=useTextMetrics('Arial, Helvetica, sans-serif');
  const count=overview?data.items.length:active+1;
  const nameSizes=useMemo(()=>names.map((name,i)=>{const label=quantityLabelLayout(count,i,0);return fitLabelText(name,label.fontSize,label.width,66,650,measure);}),[names,count,measure]);
  const valueText=(value:number)=>compact(data.metric==='count'?Math.round(value):value);
  return <div data-quantity-template={quantityTemplate(data.metric)} style={{width:900,height:data.items.length>8?1190:1000,position:'relative',color:'#F3F7FA'}}>
    <div style={{fontSize:Math.min(40,Math.max(28,1400/data.title.length)),fontWeight:750,lineHeight:1.14,maxWidth:860}}>{data.title}</div>
    <div style={{position:'absolute',top:175,left:sample.chart.left,fontSize:20,color:'#A9C1CF'}}>{comparisonMeasurementLabel(data)}</div>
    {[0,.25,.5,.75,1].map(t=>{
      const y=sample.chart.top+sample.chart.height*(1-t),value=sample.domain.min+(sample.domain.max-sample.domain.min)*t;
      return <div key={t} style={{position:'absolute',left:sample.chart.left,top:y,width:sample.chart.width,height:1,background:'#BFD5E322'}}><span style={{position:'absolute',right:'100%',paddingRight:18,top:-10,fontSize:18,color:'#A4BCCB',fontVariantNumeric:'tabular-nums'}}>{compact(value)}</span></div>;
    })}
    <div style={{position:'absolute',left:sample.chart.left,top:sample.zeroY,width:sample.chart.width,height:2,background:'#C7DBE788'}}/>
    {data.items.map((item,i)=>{
      const bar=sample.bars[i];if(!bar.visible)return null;
      const visual=item.visual,aspect=visual?.kind==='cutout'&&visual.calibration?visual.calibration.bounds.width/visual.calibration.bounds.height:1;
      const slot=sample.chart.width/(overview?data.items.length:active+1);
      const label=quantityLabelLayout(overview?data.items.length:active+1,i,bar.x,sample.chart);
      const statistic=`${item.approximate?'≈ ':''}${valueText(bar.value)}`;
      const statisticSize=label.dense?fitText(statistic,25,slot*.9,700,measure):Math.min(25,slot*.23);
      const size=label.size,width=aspect>=1?size:size*aspect,height=aspect>=1?size/aspect:size;
      return <div key={item.id} data-quantity-column={item.id} style={{opacity:bar.opacity}}>
        <div style={{position:'absolute',left:bar.x-bar.width/2,top:bar.top,width:bar.width,height:bar.height,borderRadius:'8px 8px 3px 3px',background:`linear-gradient(90deg, ${item.color}80, ${item.color})`,boxShadow:`0 0 24px ${item.color}20`,borderTop:`2px solid ${item.color}`,boxSizing:'border-box'}}/>
        <div style={{position:'absolute',left:bar.x-slot/2,top:item.value<0?bar.endY+12:bar.endY-32,width:slot,textAlign:'center',fontSize:statisticSize,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{statistic}</div>
        {label.dense&&label.row===1?<div style={{position:'absolute',left:bar.x,top:sample.chart.top+sample.chart.height+10,width:1,height:label.imageTop-sample.chart.top-sample.chart.height-20,background:`${item.color}35`}}/>:null}
        {visual&&visual.kind!=='box'?<svg data-chart-subject={item.id} style={{position:'absolute',left:bar.x-size/2,top:label.imageTop,overflow:'visible'}} width={size} height={size} viewBox={`${-size/2} ${-size/2} ${size} ${size}`}><ComparisonObject item={item} width={width} height={height} turn={frame/fps*.045}/></svg>:null}
        <div style={{position:'absolute',left:bar.x-label.width/2,top:label.nameTop,width:label.width,textAlign:'center',fontSize:nameSizes[i],height:66,fontFamily:'Arial, Helvetica, sans-serif',lineHeight:1.18,fontWeight:650,color:item.color,overflowWrap:'anywhere'}}>{names[i]}</div>
      </div>;
    })}

  </div>;
};
