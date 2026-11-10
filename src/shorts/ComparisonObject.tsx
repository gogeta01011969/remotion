import {Img,staticFile} from 'remotion';
import type {SizeItem} from './size-data';
import {TexturedSphere} from './TexturedSphere';
import {materialProfiles,type ObjectMaterial} from './object-materials';

// Per-run cutouts have arbitrary identities and proportions. Only their
// occupied bounds are scaled; padding never changes the measured dimension.
export const ComparisonObject=({item,width,height,turn}:{item:SizeItem;width:number;height:number;turn:number})=>{
  const visual=item.visual;
  if(visual?.kind==='cutout'){
    const c=visual.calibration;if(!c)throw new Error(`Unprepared cutout: ${item.label}`);
    return <foreignObject x={-width/2} y={-height/2} width={width} height={height}><div style={{position:'relative',width,height,overflow:'hidden'}}><Img src={staticFile(visual.src)} style={{position:'absolute',maxWidth:'none',width:c.pixelWidth/c.bounds.width*width,height:c.pixelHeight/c.bounds.height*height,left:-c.bounds.x/c.bounds.width*width,top:-c.bounds.y/c.bounds.height*height}}/></div></foreignObject>;
  }
  if(visual?.kind==='box'&&visual.projection==='isometric'){
    const h=height/(1+.26*visual.depthToHeight),w=h*visual.widthToHeight,dx=width-w,dy=height-h;
    const x=-width/2,y=-height/2+dy;
    return <g stroke={item.color} strokeWidth={1.5} strokeLinejoin="round">
      <path d={`M${x} ${y}l${dx} ${-dy}h${w}l${-dx} ${dy}Z`} fill={item.color} fillOpacity=".85"/>
      <path d={`M${x+w} ${y}l${dx} ${-dy}v${h}l${-dx} ${dy}Z`} fill={item.color} fillOpacity=".34"/>
      <path d={`M${x} ${y}h${w}v${h}h${-w}Z`} fill={item.color} fillOpacity=".58"/>
      {[.25,.5,.75].map(t=><path key={t} d={`M${x} ${y+h*t}h${w}l${dx} ${-dy}`} fill="none" stroke="#FFF" strokeWidth="1" strokeOpacity=".18"/>)}
      <path d={`M${x} ${y+h}V${y}h${w}l${dx} ${-dy}`} fill="none" stroke="#FFF" strokeOpacity=".65"/>
    </g>;
  }
  if(visual?.kind==='box')return <g>
    <rect x={-width/2} y={-height/2} width={width} height={height} fill={item.color}/>
    <path d={`M${-width/2} ${height/2}V${-height/2}H${width/2}`} fill="none" stroke="#FFF" strokeOpacity=".3" strokeWidth="2"/>
    <rect x={-width/2} y={-height/2} width={width} height={height} fill={`url(#${item.id}-box-shade)`}/>
    <defs><linearGradient id={`${item.id}-box-shade`}><stop stopColor="#FFF" stopOpacity=".1"/><stop offset="1" stopColor="#000" stopOpacity=".35"/></linearGradient></defs>
  </g>;
  if(!visual&&!item.appearance&&!(item.material in materialProfiles))throw new Error(`Missing mapped appearance for ${item.label}.`);
  return <g transform={`scale(${width/200} ${height/200})`}><foreignObject x="-100" y="-100" width="200" height="200"><TexturedSphere appearance={item.appearance} texture={visual?.kind==='sphere'?visual.texture:undefined} emissive={visual?.kind==='sphere'?visual.emissive:false} material={item.material in materialProfiles?item.material as ObjectMaterial:'plain'} color={item.color} angle={turn}/></foreignObject></g>;
};
