import {z} from 'zod';
import {sizePose,objectExtent,type GeometryItem,type SizeMetric} from './size-data';

export const sizeShotSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  role: z.enum(['detail','overview']).default('detail'),
  layout: z.enum(['zoom', 'side-by-side', 'overlay', 'lineup']),
  focus: z.number().int().min(0).max(7), reference: z.number().int().min(0).max(7),
  visible: z.array(z.number().int().min(0).max(7)).min(1).max(8),
  metric: z.enum(['question', 'ratio', 'difference', 'percent']),
}).strict();
export type SizeShot = z.infer<typeof sizeShotSchema>;
type Body = {x: number; y: number; diameter: number; width:number; height:number; opacity: number; outline: number};

// A shot changes framing and which objects share a baseline, never their ratios.
function pose(items: GeometryItem[], shot: SizeShot,metric:SizeMetric) {
  if (shot.layout === 'zoom') {
    const sample = sizePose(items, shot.focus,shot.reference,metric);
    const padding=shot.role==='overview'?.9:1;
    return {scale:sample.scale*padding,bodies:sample.bodies.map((b,i)=>({...b,x:450+(b.x-450)*padding,y:860-b.height*padding/2,width:b.width*padding,height:b.height*padding,diameter:b.diameter*padding,opacity:i<=shot.focus?1:0,outline:0}))};
  }
  const selected = [...shot.visible].sort((a, b) => items[a].value - items[b].value);
  const largest = Math.max(...selected.map(i => Math.max(...Object.values(objectExtent(items[i],metric)))));
  const overlay = shot.layout === 'overlay';
  const gap = largest * (shot.layout === 'lineup' ? .12 : .18);
  const width = overlay ? largest : selected.reduce((sum, i) => sum + objectExtent(items[i],metric).width, 0) + gap * (selected.length - 1);
  const scale = Math.min(overlay ? 560 / largest : 520 / largest, 820 / width);
  let cursor = 450 - width * scale / 2;
  const positions = new Map<number, number>();
  for (const i of selected) {positions.set(i, overlay ? 450 : cursor + objectExtent(items[i],metric).width * scale / 2); cursor += (objectExtent(items[i],metric).width + gap) * scale;}
  const bodies: Body[] = items.map((item, i) => ({x: positions.get(i) ?? 450, y: 860 - objectExtent(item,metric).height * scale / 2, width:objectExtent(item,metric).width*scale,height:objectExtent(item,metric).height*scale,diameter:Math.max(...Object.values(objectExtent(item,metric)))*scale, opacity: positions.has(i) ? 1 : 0, outline: overlay && i === shot.reference ? 1 : 0}));
  return {scale, bodies};
}

export function sampleSizeShots(items: GeometryItem[], shots: SizeShot[], phase: number,metric:SizeMetric='diameter') {
  const p = Math.max(0, Math.min(shots.length - 1, phase));
  const lo = Math.floor(p), hi = Math.min(shots.length - 1, lo + 1), t = p - lo;
  const a = pose(items, shots[lo],metric), b = pose(items, shots[hi],metric);
  const scale = a.scale * (b.scale / a.scale) ** t;
  // For an escalating world keep the fixed-pivot continuous zoom behavior.
  const zoom = shots[lo].layout === 'zoom' && shots[hi].layout === 'zoom';
  const mix = zoom && Math.abs(b.scale - a.scale) > 1e-15 ? (scale - a.scale) / (b.scale - a.scale) : t;
  const bodies: Body[] = items.map((item, i) => ({
    x: a.bodies[i].x + (b.bodies[i].x - a.bodies[i].x) * mix,
    y: 860 - objectExtent(item,metric).height * scale / 2, width:objectExtent(item,metric).width*scale,height:objectExtent(item,metric).height*scale,diameter:Math.max(...Object.values(objectExtent(item,metric)))*scale,
    opacity: a.bodies[i].opacity + (b.bodies[i].opacity - a.bodies[i].opacity) * t,
    outline: a.bodies[i].outline + (b.bodies[i].outline - a.bodies[i].outline) * t,
  }));
  return {scale, bodies};
}
