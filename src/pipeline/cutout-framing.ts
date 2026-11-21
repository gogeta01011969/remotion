import type {inspectComparisonImage} from './comparison-assets';

type Calibration=ReturnType<typeof inspectComparisonImage>;
export function cutoutEdgeCount(image:Calibration){
  const b=image.bounds;
  return Number(b.x<=1)+Number(b.y<=1)+Number(b.x+b.width>=image.pixelWidth-1)+Number(b.y+b.height>=image.pixelHeight-1);
}
export function framingRepairPrompt(prompt:string){
  // Put framing first so it remains explicit even with a long identity brief.
  return `FRAMING: Show the ENTIRE object including its highest tip, lowest base and every branch or wing. Fit it inside the central 70% of the canvas with a wide empty neutral margin on ALL FOUR sides. Preserve true proportions; pull the camera back, never crop or stretch. ${prompt}`.slice(0,2048);
}

// Bounds touching an edge are a quality signal, not proof of missing geometry.
// Decode/transparency/empty-frame checks happen before this advisory review.
export async function reviewCutoutFraming(options:{label:string;calibration:Calibration;retry?:()=>Promise<Calibration>;warn:(message:string)=>void}){
  let image=options.calibration;
  if(!cutoutEdgeCount(image))return image;
  if(options.retry){
    try{image=await options.retry();}
    catch{options.warn(`${options.label}: optional framing retry failed; retaining the original usable cutout.`);}
  }
  if(cutoutEdgeCount(image))options.warn(`${options.label}: foreground touches an image edge; possible clipping or mask residue. Continuing with the usable calibrated cutout; automatic bounds cannot establish whether the object is cropped.`);
  return image;
}
