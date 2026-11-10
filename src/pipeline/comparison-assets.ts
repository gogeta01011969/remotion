import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,realpathSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {sizeDatasetSchema,type SizeDataset} from '../shorts/size-data';

function run(command:string,args:string[],maxBuffer=1024*1024){
  const result=spawnSync(command,args,{maxBuffer,timeout:60000});
  if(result.error||result.status!==0)throw new Error(`Asset inspection failed (${command}): ${result.error?.message??result.stderr.toString().slice(0,500)}`);
  return result.stdout;
}
export function inspectComparisonImage(filename:string,cutout:boolean) {
  const probe=JSON.parse(run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',filename]).toString());
  const {width,height}=probe.streams?.[0]??{};
  if(!width||!height||width*height>16777216||width>8192||height>8192)throw new Error('Comparison assets must be raster images up to 16 megapixels and 8192 pixels per edge.');
  const pixels=run('ffmpeg',['-v','error','-noautorotate','-i',filename,'-frames:v','1','-f','rawvideo','-pix_fmt','rgba','pipe:1'],width*height*4+1024*1024);
  if(pixels.length!==width*height*4)throw new Error('Could not decode a single complete asset frame.');
  let left=width,top=height,right=-1,bottom=-1,area=0,transparent=false;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const alpha=pixels[(y*width+x)*4+3];
    if(alpha<8)transparent=true;
    if(alpha<=16)continue;
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);area+=alpha/255;
  }
  if(right<left||bottom<top)throw new Error('Comparison asset is completely transparent.');
  if(cutout&&!transparent)throw new Error('Object cutouts need a transparent background. A rectangular photograph cannot be calibrated as an object silhouette.');
  if(!cutout&&area<width*height*.999)throw new Error('Sphere textures must be complete opaque surface maps.');
  if(!cutout&&Math.abs(width/height-2)>.03)throw new Error('Sphere textures must be equirectangular maps with a 2:1 aspect ratio.');
  const bounds=cutout?{x:left,y:top,width:right-left+1,height:bottom-top+1}:{x:0,y:0,width,height};
  return {pixelWidth:width,pixelHeight:height,bounds,coverage:cutout?Math.min(1,area/(bounds.width*bounds.height)):1,sha256:createHash('sha256').update(`${width}x${height}:`).update(pixels).digest('hex')};
}

// Assets are created/fetched by the run's provider, then inspected and frozen
// locally. Rendering never calls an image API or trusts source-image padding.
export function prepareComparisonAssets(raw:unknown,options:{root:string;assetRoot:string;runId:string}):SizeDataset {
  const data=sizeDatasetSchema.parse(raw);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.runId))throw new Error('Invalid comparison run ID.');
  const publicRoot=path.join(options.root,'public');
  for(const item of data.items){
    const visual=item.visual;if(!visual||visual.kind==='box')continue;
    const src=visual.kind==='cutout'?visual.src:visual.texture;
    const base=visual.calibration&&src.startsWith(`comparisons/${options.runId}/`)?publicRoot:options.assetRoot;
    const filename=path.resolve(base,src);
    if(!existsSync(filename))throw new Error(`${item.label}: missing per-run asset ${src}. Supply it or run the configured asset provider.`);
    const realBase=realpathSync(base),real=realpathSync(filename);
    if(!real.startsWith(realBase+path.sep))throw new Error('Asset path escapes its input directory.');
    const calibration=inspectComparisonImage(real,visual.kind==='cutout');
    const relative=`comparisons/${options.runId}/${item.id}-${calibration.sha256.slice(0,16)}.png`;
    const target=path.join(publicRoot,relative);mkdirSync(path.dirname(target),{recursive:true});
    if(real!==target)run('ffmpeg',['-v','error','-y','-noautorotate','-i',real,'-frames:v','1','-pix_fmt','rgba',target]);
    item.visual=visual.kind==='cutout'?{...visual,src:relative,calibration}:{...visual,texture:relative,calibration};
  }
  return sizeDatasetSchema.parse(data);
}
