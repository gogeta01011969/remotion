import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {openBrowser} from '@remotion/renderer';
import {geographicOutline,type GeographicGeometry} from '../src/pipeline/geographic-outline';

// Offline, deterministic asset preparation from checked-in source geometry.
// Only generated path data is rasterized; downloaded SVG is never executed.
async function main(){
  const root=path.resolve('comparisons/examples/assets');
  const browser=await openBrowser('chrome');
  const page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:null,onLog:()=>{}});
  const raster=async(svg:string,file:string)=>{
    const encoded=Buffer.from(svg).toString('base64');
    const data=await page.evaluate(async(encoded:string)=>{
      const image=new Image();image.src='data:image/svg+xml;base64,'+encoded;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      canvas.getContext('2d')!.drawImage(image,0,0);return canvas.toDataURL('image/png').split(',')[1];
    },encoded);
    writeFileSync(path.join(root,file),Buffer.from(data,'base64'));console.log(file);
  };
  try{
    const collection=JSON.parse(readFileSync(path.join(root,'raw/countries.geojson'),'utf8')) as {features:{properties:{ADM0_A3:string};geometry:GeographicGeometry}[]};
    for(const [code,id,color] of [['LKA','sri-lanka','#7FE3CC'],['ISL','iceland','#A9D8FF'],['CUB','cuba','#FFD293'],['JPN','japan','#FFA7A7'],['MDG','madagascar','#B5E39A'],['AUS','australia','#EBC177']]){
      const feature=collection.features.find(f=>f.properties.ADM0_A3===code);if(!feature)throw new Error(`Missing ${code}`);
      const outline=geographicOutline(feature.geometry,color);
      await raster(outline.svg,`${id}.png`);
    }
    for(const [model,color] of [['737-700','#A2DBEF'],['757-200','#B6CCF3'],['767-300','#E7CA9D'],['747-8','#E8B9AA']]){
      const source=readFileSync(path.join(root,`raw/boeing-${model}.svg`),'utf8');
      const d=source.match(/<path\s+d="([^"]+)"/)?.[1];
      if(!d||!/^[\s0-9.,eE+\-mMlLhHvVcCsSqQtTaAzZ]+$/.test(d))throw new Error('Unexpected aircraft path.');
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 64 64"><defs><linearGradient id="skin"><stop stop-color="${color}"/><stop offset=".47" stop-color="#F2F5F8"/><stop offset=".54" stop-color="${color}"/><stop offset="1" stop-color="#537784"/></linearGradient></defs><g transform="matrix(1,0,0,-1,0,64)"><path d="${d}" fill="url(#skin)"/></g></svg>`;
      await raster(svg,`boeing-${model}.png`);
    }
  }finally{await browser.close({silent:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
