import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {materialProfiles, proceduralMap, type ObjectMaterial} from './object-materials';

export const sphereAssets = {
  mercury: {map: 'mercury.jpg', clouds: null, longitude: 0, emissive: false},
  mars: {map: 'mars.jpg', clouds: null, longitude: .2, emissive: false},
  venus: {map: 'venus_atmosphere.jpg', clouds: null, longitude: 0, emissive: false},
  earth: {map: 'earth.jpg', clouds: 'earth-clouds.jpg', longitude: -.15, emissive: false},
  moon: {map: 'moon.jpg', clouds: null, longitude: 0, emissive: false},
  jupiter: {map: 'jupiter.jpg', clouds: null, longitude: .4, emissive: false},
  neptune: {map: 'neptune.jpg', clouds: null, longitude: .2, emissive: false},
  sun: {map: 'sun.jpg', clouds: null, longitude: 0, emissive: true},
} as const;
export type SphereAppearance = keyof typeof sphereAssets;
const size = 384;
const normals = Array.from({length: size * size}, (_, i) => {
  const x = (i % size + .5 - size / 2) / (size / 2);
  const y = (Math.floor(i / size) + .5 - size / 2) / (size / 2);
  if (x*x + y*y > 1) return null;
  const z = Math.sqrt(1-x*x-y*y);
  return {x,y,u: Math.atan2(x,z)/(2*Math.PI)+.5, v: Math.acos(-y)/Math.PI, light: .12 + .88*Math.max(0,-x*.4-y*.25+z*.88), rim: (1-z)**4, z};
});
const cache = new Map<string, Promise<ImageData>>();
function loadMap(file: string) {
  if (!cache.has(file)) cache.set(file, new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas'); canvas.width=image.width; canvas.height=image.height;
        const ctx=canvas.getContext('2d', {willReadFrequently:true});
        if (!ctx) throw new Error('Canvas is unavailable.');
        ctx.drawImage(image,0,0); resolve(ctx.getImageData(0,0,image.width,image.height));
      } catch (error) {reject(error);}
    };
    image.onerror=()=>reject(new Error(`Missing local texture: ${file}`));
    image.src=staticFile(file.includes('/')?file:`assets/${file}`);
  }));
  return cache.get(file)!;
}
const pixel = (map: ImageData, u: number, v: number) => (Math.max(0,Math.min(map.height-1,Math.floor(v*map.height)))*map.width+Math.floor(((u%1)+1)%1*map.width))*4;

// An orthographic sphere, not a cropped/rotated photograph. Longitude changes
// around the sphere's axis; geography and seams follow the curved surface.
export const TexturedSphere = ({appearance, texture, emissive=false, material='plain', color='#EEEEEE', angle}: {appearance?: SphereAppearance; texture?:string; emissive?:boolean; material?:ObjectMaterial; color?:string; angle: number}) => {
  const asset=useMemo(()=>texture?{map:texture,clouds:null,longitude:0,emissive}:appearance?sphereAssets[appearance]:null,[texture,appearance,emissive]);
  const profile=materialProfiles[material];
  const canvas=useRef<HTMLCanvasElement>(null);
  const [maps,setMaps]=useState<{color:ImageData;clouds:ImageData|null}|null>(null);
  const [handle]=useState(()=>delayRender(`Local ${appearance??material} sphere surface`));
  const released=useRef(false);
  useLayoutEffect(()=>{
    let active=true;
    Promise.all([asset?loadMap(asset.map):Promise.resolve(proceduralMap(material,color)), asset?.clouds ? loadMap(asset.clouds) : Promise.resolve(null)]).then(([color,clouds])=>{
      if(active)setMaps({color,clouds});
    }).catch(error=>{if(active)cancelRender(error);});
    return ()=>{active=false;if(!released.current){continueRender(handle);released.current=true;}};
  },[asset,material,color,handle]);
  useLayoutEffect(()=>{
    const ctx=canvas.current?.getContext('2d');
    if(!ctx||!maps)return;
    const output=ctx.createImageData(size,size);
    const longitude=(angle+(asset?.longitude??.65))/(2*Math.PI);
    for(let i=0;i<normals.length;i++){
      const n=normals[i];if(!n)continue;
      const tilt=asset?0:profile.tilt;
      const objectX=n.x*Math.cos(tilt)-n.y*Math.sin(tilt), objectY=n.x*Math.sin(tilt)+n.y*Math.cos(tilt);
      const u=asset?n.u:Math.atan2(objectX,n.z)/(2*Math.PI)+.5;
      const v=asset?n.v:Math.acos(-objectY)/Math.PI;
      const source=pixel(maps.color,u+longitude,v), dest=i*4;
      const cloud=maps.clouds ? maps.clouds.data[pixel(maps.clouds,n.u+longitude*.96,n.v)]/255*.82 : 0;
      let light=asset?.emissive ? .84+.16*n.z : n.light;
      if(!asset&&material==='golf'){
        const height=(du:number,dv:number)=>maps.color.data[pixel(maps.color,u+longitude+du,v+dv)+3]/100*.004;
        const du=1/maps.color.width,dv=1/maps.color.height;
        const slopeU=(height(du,0)-height(-du,0))/(4*Math.PI*du*Math.max(.1,Math.sin(v*Math.PI)));
        const slopeV=(height(0,dv)-height(0,-dv))/(2*Math.PI*dv);
        const theta=Math.atan2(objectX,n.z),lat=v*Math.PI;
        const bx=slopeU*Math.cos(theta)+slopeV*Math.cos(lat)*Math.sin(theta);
        const by=slopeV*Math.sin(lat),bz=-slopeU*Math.sin(theta)+slopeV*Math.cos(lat)*Math.cos(theta);
        const nx=n.x-bx*Math.cos(tilt)-by*Math.sin(tilt),ny=n.y+bx*Math.sin(tilt)-by*Math.cos(tilt),nz=n.z-bz;
        light=.12+.88*Math.max(0,(-nx*.4-ny*.25+nz*.88)/Math.hypot(nx,ny,nz));
      }
      const highlight=asset?0:profile.shine*Math.pow(Math.max(0,-n.x*.23-n.y*.28+n.z*.93),profile.gloss)*255;
      for(let channel=0;channel<3;channel++){
        const base=maps.color.data[source+channel]*(1-cloud)+245*cloud;
        const atmosphere=appearance==='earth' ? n.rim*[8,36,70][channel] : 0;
        output.data[dest+channel]=base*light+atmosphere+highlight;
      }
      output.data[dest+3]=255;
    }
    ctx.putImageData(output,0,0);
    if(!released.current){continueRender(handle);released.current=true;}
  },[angle,asset,appearance,profile,maps,handle]);
  return <canvas ref={canvas} width={size} height={size} style={{width:200,height:200,display:'block',borderRadius:'50%'}}/>;
};
