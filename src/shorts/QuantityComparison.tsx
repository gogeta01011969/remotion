import {useCurrentFrame,useVideoConfig} from 'remotion';
import type {Actor,ActorState} from './schema';
import {ComparisonObject} from './ComparisonObject';
import {formatSize,formatRatio,formatUnit} from './size-data';
import {sampleRace,countDots,quantityDomain,quantityTemplate} from './measurements';
import type {SizeTextTiming} from './size-text-motion';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(t:number)=>t*t*(3-2*t);
const compact=(n:number)=>Math.abs(n)>=1e15?`${formatSize(n/1e15)}Q`:Math.abs(n)>=1e12?`${formatSize(n/1e12)}T`:Math.abs(n)>=1e9?`${formatSize(n/1e9)}B`:Math.abs(n)>=1e6?`${formatSize(n/1e6)}M`:Math.abs(n)>=1e3?`${formatSize(n/1e3)}K`:formatSize(n);

export const QuantityComparison=({actor,state,textTiming}:{actor:Extract<Actor,{kind:'size-comparison'}>;state:ActorState;textTiming?:SizeTextTiming})=>{
  const frame=useCurrentFrame(),{fps,durationInFrames}=useVideoConfig(),{data}=actor;
  const template=quantityTemplate(data.metric),race=template==='race',temperature=template==='temperature-axis',count=template==='count-grid';
  const active=Math.min(data.items.length-1,Math.round(state.value)),overview=state.shot>=data.items.length;
  const local=textTiming?.localFrame??frame,duration=textTiming?.durationInFrames??fps*6;
  const progress=smooth(clamp(local/Math.max(1,duration*.65))),raceProgress=clamp((frame/durationInFrames-.1)/.75);
  const domain=quantityDomain(data.items.map(i=>i.value),data.metric),span=domain.max-domain.min;
  const rowHeight=Math.min(176,780/data.items.length),left=166,width=670,start=210;
  const raceSample=race?sampleRace(data.items.map(i=>i.value),data.unit,data.raceDistanceM,raceProgress):null;
  const simulatedSeconds=raceSample?.elapsedSeconds??0;
  const dotValue=countDots(domain.max,domain.max).perDot;
  const footer=race?`Constant-speed illustration · ${data.raceDistanceM} m track · simulation ${formatSize(simulatedSeconds)} s`:count?`1 full dot = ${compact(dotValue)} ${data.countBasis==='population'?'individuals':'items'}${data.asOf?` · ${data.asOf}`:''}`:temperature?'Temperature on a shared scale':`${data.metric==='duration'?'Elapsed duration':'Shared scale'} · ${formatUnit(data.unit)}`;
  return <div data-quantity-template={template} style={{width:900,height:1150,position:'relative',color:'#F3F7FA'}}>
    <div style={{fontSize:Math.min(44,Math.max(30,1500/data.title.length)),fontWeight:750,lineHeight:1.12,maxWidth:850,letterSpacing:-1.5}}>{data.title}</div>
    <div style={{position:'absolute',top:110,color:'#A9C1CF',fontSize:24,textTransform:'uppercase',letterSpacing:3}}>{data.metric} · {formatUnit(data.unit)}{data.asOf&&!count?` · ${data.asOf}`:''}</div>
    {!count&&[0,.25,.5,.75,1].map(t=><div key={t} style={{position:'absolute',left:left+t*width,top:175,width:1,height:rowHeight*data.items.length+30,background:'#BFD5E318'}}><span style={{position:'absolute',top:-25,transform:'translateX(-50%)',fontSize:18,color:'#8EA8B8',fontVariantNumeric:'tabular-nums'}}>{compact(race?data.raceDistanceM*t:domain.min+t*span)}</span></div>)}
    {data.items.map((item,i)=>{
      const shown=race||overview||i<=active,p=overview||i<active?1:i===active?progress:0;
      const enter=race?smooth(clamp(frame/(fps*.6)-i*.1)):i===active?smooth(clamp(local/(fps*.45))):1;
      const visual=item.visual,aspect=visual?.kind==='cutout'&&visual.calibration?visual.calibration.bounds.width/visual.calibration.bounds.height:1;
      const imageSize=Math.min(110,rowHeight-18),imageWidth=aspect>=1?imageSize:imageSize*aspect,imageHeight=aspect>=1?imageSize/aspect:imageSize;
      const position=(item.value-domain.min)/span,zero=-domain.min/span;
      const imageX=race?left+raceSample!.fractions[i]*width:62;
      const value=item.value*p;
      return <div key={item.id} data-quantity-row={item.id} style={{position:'absolute',left:0,top:start+i*rowHeight,width:880,height:rowHeight-10,opacity:shown?enter:0,transform:`translateX(${(1-enter)*35}px)`}}>
        <svg style={{position:'absolute',left:imageX-imageSize/2,top:race?rowHeight-imageSize-4:rowHeight/2-imageSize/2,overflow:'visible'}} width={imageSize} height={imageSize} viewBox={`${-imageSize/2} ${-imageSize/2} ${imageSize} ${imageSize}`}><ComparisonObject item={item} width={imageWidth} height={imageHeight} turn={frame/fps*.045}/></svg>
        <div style={{position:'absolute',left,top:7,width:390,fontSize:Math.min(30,650/Math.max(1,item.label.length)),fontWeight:650,whiteSpace:'nowrap',color:i===active?item.color:'#E6EEF3'}}>{item.label}</div>
        <div style={{position:'absolute',right:38,top:7,fontSize:30,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{item.approximate?'≈ ':''}{compact(race?item.value:value)} <span style={{fontSize:20,color:'#9BB4C3'}}>{formatUnit(data.unit)}</span></div>
        {!race&&<>
          {!count&&<div style={{position:'absolute',left,top:65,width,height:14,borderRadius:7,background:'#FFFFFF0C'}}/>}
          {count?<div style={{position:'absolute',left,top:60,display:'grid',gridTemplateColumns:'repeat(40, 12px)',gap:4}}>{countDots(item.value,domain.max,p).fills.map((filled,n)=><span key={n} style={{width:10,height:10,borderRadius:3,transform:`scale(${.75+.25*filled})`,position:'relative',overflow:'hidden',background:'#FFFFFF12',opacity:1}}><span style={{position:'absolute',inset:0,width:`${filled*100}%`,background:item.color}}/></span>)}</div>:
          template==='timeline'||temperature?<>
            <div style={{position:'absolute',left:left+Math.min(zero,zero+(position-zero)*p)*width,top:68,width:Math.abs(position-zero)*width*p,height:6,background:item.color,opacity:.6}}/>
            <div style={{position:'absolute',left:left+(zero+(position-zero)*p)*width-8,top:63,width:16,height:16,borderRadius:8,background:item.color,boxShadow:`0 0 18px ${item.color}`}}/>
          </>:<div style={{position:'absolute',left,top:65,width:width*position*p,height:14,borderRadius:7,background:`linear-gradient(90deg, ${item.color}80, ${item.color})`,boxShadow:`0 0 22px ${item.color}30`}}/>}
        </>}
      </div>;
    })}
    <div style={{position:'absolute',left:0,top:1080,width:870,textAlign:'center',fontSize:20,color:'#A0B9C8'}}>{footer}</div>
    {!race&&!temperature&&active>0&&data.items[active-1].value>0&&progress>.98&&<div style={{position:'absolute',right:40,top:1020,fontSize:30,fontWeight:700,color:data.items[active].color}}>{formatRatio(data.items[active].value/data.items[active-1].value)} <span style={{fontSize:19,color:'#9BB4C3'}}>vs {data.items[active-1].label}</span></div>}
  </div>;
};
