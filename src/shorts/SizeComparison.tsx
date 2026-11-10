import {useCurrentFrame,useVideoConfig} from 'remotion';
import type {Actor,ActorState} from './schema';
import {formatRatio,formatSize,formatUnit,formatMeasurement,comparisonRuler,sizeSample} from './size-data';
import type {Language} from './locale';
import {sampleSizeShots} from './size-shots';
import {needsCountry} from './comparison-context';
import {sizePresentationOffset,detailTextOpacity} from './size-presentation';
import {placeSizeLabels} from './size-labels';
import {ComparisonObject} from './ComparisonObject';
import {textEntrance,type SizeTextTiming} from './size-text-motion';
import {fitText,useTextMetrics} from './text-metrics';

export const SizeComparison=({actor,state,language='en',textTiming}:{actor:Extract<Actor,{kind:'size-comparison'}>;state:ActorState;language?:Language;textTiming?:SizeTextTiming})=>{
  const frame=useCurrentFrame(),{fps}=useVideoConfig(),{data}=actor;
  const measure=useTextMetrics(language==='hi'?'SacredDevanagari, Arial, sans-serif':'Arial, Helvetica, sans-serif');
  const active=Math.max(0,Math.min(data.items.length-1,Math.round(state.value)));
  const reference=Math.max(0,Math.min(active,Math.round(state.reference)));
  const shotIndex=actor.shots?Math.max(0,Math.min(actor.shots.length-1,Math.round(state.shot))):active;
  const shot=actor.shots?.[shotIndex],item=data.items[active],ref=data.items[reference];
  const oldSample=actor.shots?null:sizeSample(data.items,state.phase,data.metric);
  const sample=actor.shots?sampleSizeShots(data.items,actor.shots,state.phase,data.metric):{...oldSample!,bodies:oldSample!.bodies.map(b=>({...b,opacity:1,outline:0}))};
  const settled=actor.shots?sampleSizeShots(data.items,actor.shots,shotIndex,data.metric):sample;
  const showCountry=needsCountry(data.subject);
  const isOverview=shot?.role==='overview';
  const labels=isOverview?[]:placeSizeLabels(data.items,settled.bodies,active,reference,measure,{showCountry});
  const timing=textTiming??{localFrame:frame,durationInFrames:fps*8,referenceChangedAt:0};
  const isLastDetail=shot?.role==='detail'&&active===data.items.length-1;
  const textOpacity=detailTextOpacity(isLastDetail,timing.localFrame/Math.max(1,timing.durationInFrames-1));
  const verticalOffset=actor.shots?sizePresentationOffset(data,actor.shots,state.phase,showCountry):0;
  const entrance=(from:number,duration=fps*.3)=>{const motion=textEntrance(timing.localFrame,from,duration,timing.durationInFrames,fps);return {...motion,opacity:motion.opacity*textOpacity};};
  const titleMotion=entrance(fps*.06),sizeMotion=entrance(fps*.22),countryMotion=entrance(fps*.34);
  const labelFrom=shotIndex===0?fps*.28:timing.durationInFrames*.20;
  const metricMotion=entrance(Math.max(labelFrom+fps*.16,timing.referenceChangedAt),fps*.3);
  const arrived=shotIndex===0?1:Math.max(0,Math.min(1,(state.phase-shotIndex+.25)/.22));
  const approximate=Boolean(item.range||ref.range||item.approximate||ref.approximate);
  const value=shot?.metric==='question'?'?':shot?.metric==='difference'?`${approximate?'≈ ':''}${formatSize(item.value-ref.value)} ${formatUnit(data.unit)}`:shot?.metric==='percent'?`${approximate?'≈ ':''}${formatSize((item.value/ref.value-1)*100)}%`:`${approximate?'≈ ':''}${formatRatio(item.value/ref.value)}`;
  const explanation=`${item.label} / ${ref.label}`;
  const valueSize=fitText(value,74,836,750,measure,-3);
  const valueWidth=measure(value,valueSize,750,-3);
  const explanationWidth=measure(explanation,27,500);
  const stacked=valueWidth+22+explanationWidth>836;
  const quantity=`${item.range||item.approximate?'≈ ':''}${formatMeasurement(item.value,data.unit,data.displayUnits==='adaptive')}`;
  const ruler=data.scaleReference?comparisonRuler(sample.scale,data.unit):null;
  const metricLabel=item.visual?.kind==='box'&&item.visual.projection==='isometric'?'capacity · cube model':data.metric;
  return <div style={{width:900,height:1150,position:'relative'}}><div data-size-stage style={{width:900,height:1150,position:'relative',transform:`translateY(${verticalOffset}px)`}}>
    {!isOverview?<>
    <div data-size-text="name" style={{position:'absolute',left:24,top:-37,width:836,fontSize:fitText(item.label,82,836,750,measure,-2.8),fontWeight:750,letterSpacing:-2.8,lineHeight:1.05,color:'#F3F7FA',opacity:titleMotion.opacity,transform:`translateY(${titleMotion.offsetY}px)`}}>{item.label}</div>
    <div data-size-text="diameter" style={{position:'absolute',left:26,top:65,display:'flex',alignItems:'baseline',gap:16,opacity:sizeMotion.opacity,transform:`translateY(${sizeMotion.offsetY}px)`}}>
      <span style={{fontSize:fitText(quantity,34,836-16-measure(metricLabel,24,400),500,measure),fontWeight:500,color:'#D9E4EB',fontVariantNumeric:'tabular-nums'}}>{quantity}</span>
      <span style={{fontSize:24,color:'#849EAF'}}>{metricLabel}</span>
    </div>
    {showCountry&&item.country?<div data-size-text="country" style={{position:'absolute',left:26,top:118,width:836,fontSize:fitText(item.country,26,836,500,measure),lineHeight:1.2,fontWeight:500,color:'#AFC7D6',opacity:countryMotion.opacity,transform:`translateY(${countryMotion.offsetY}px)`}}>{item.country}</div>:null}
    </>:null}
    {!isOverview&&ruler?<svg data-size-text="scale" width="350" height="62" style={{position:'absolute',left:26,top:155,opacity:textOpacity}}>
      <text x="0" y="21" fill="#B5C7D3" fontSize="21" fontFamily="Arial, sans-serif">{ruler.label}</text>
      <path d={`M0 34v12m0 -6h${ruler.width}m0 -6v12`} stroke="#B5C7D3" fill="none" strokeWidth="1.6"/>
    </svg>:null}
    <svg width="900" height="820" viewBox="0 200 900 820" style={{position:'absolute',top:200,overflow:'hidden'}}>
      <defs><linearGradient id={`${actor.id}-floor`}><stop stopColor="#FFFFFF" stopOpacity="0"/><stop offset=".5" stopColor="#FFFFFF" stopOpacity=".2"/><stop offset="1" stopColor="#FFFFFF" stopOpacity="0"/></linearGradient></defs>
      <path d="M0 862H900" stroke={`url(#${actor.id}-floor)`}/>
      {sample.bodies.map((b,i)=>{
        if(b.opacity<.001||b.diameter<.15||b.diameter>12000||b.x+b.width/2<0||b.x-b.width/2>900)return null;
        const source=data.items[i];
        return <g key={source.id} data-size-object={source.id} opacity={b.opacity}>
          {source.material==='glow'&&b.diameter<2000?<circle cx={b.x} cy={b.y} r={b.diameter*.515} fill="none" stroke={source.color} strokeWidth={b.diameter*.015} strokeOpacity=".18"/>:null}
          <g opacity={1-b.outline*.9} transform={`translate(${b.x} ${b.y})`}><ComparisonObject item={source} width={b.width} height={b.height} turn={frame/fps*.045}/></g>
          {b.outline>.001?<rect x={b.x-b.width/2} y={b.y-b.height/2} width={b.width} height={b.height} fill="none" stroke={source.color} strokeWidth="3" strokeDasharray="8 6" opacity={b.outline}/>:null}
        </g>;
      })}
      {labels.map((label,index)=>{
        const body=sample.bodies[label.index];
        const motion=entrance(Math.max(labelFrom+index*fps*.045,label.index===reference?timing.referenceChangedAt:0),fps*.3);
        const visible=body.x>=0&&body.x<=900?body.opacity:0;
        return <g key={label.index} opacity={motion.opacity*visible*(label.index===active?1:.88)}>
          <path d={`M${body.x} 875V${label.y-29}H${label.x}`} fill="none" stroke="#8CA5B7" strokeOpacity=".4" strokeWidth="1.2" pathLength="1" strokeDasharray="1" strokeDashoffset={1-motion.opacity}/>
          <text data-size-text={`label-${label.index}`} x={label.x} y={label.y+motion.offsetY} textAnchor="middle" fill={label.index===active?'#F3F7FA':'#B5C7D3'} fontSize={label.fontSize} fontWeight={label.index===active?650:500}>{label.text}</text>
          {label.country?<text data-size-text={`label-country-${label.index}`} x={label.x} y={label.y+26+motion.offsetY} textAnchor="middle" fill="#92ACBD" fontSize={label.countryFontSize} fontWeight="500">{label.country}</text>:null}
        </g>;
      })}
    </svg>
    {!isOverview&&active!==reference?<div style={{position:'absolute',left:24,top:1030,width:836,opacity:arrived*metricMotion.opacity,transform:`translateY(${metricMotion.offsetY}px)`}}>
      <div style={{display:'flex',alignItems:'baseline',flexWrap:'wrap',columnGap:22,rowGap:10,marginTop:13}}>
        <span data-size-text="ratio" style={{fontSize:valueSize,lineHeight:1,fontWeight:750,letterSpacing:-3,color:'#F3F7FA',fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>{value}</span>
        <span data-size-text="reference" style={{fontSize:27,lineHeight:1.2,fontWeight:500,color:'#B5C7D3',overflowWrap:'anywhere',width:stacked?836:Math.max(0,836-valueWidth-22)}}>{explanation}</span>
      </div>
    </div>:null}
  </div></div>;
};
