import {z} from 'zod';
import {comparisonSubjects,needsCountry} from './comparison-context';
import {comparisonVisualSchema} from './comparison-visual';
import {comparisonEditorialSchema,editorialSelectionIssues} from './comparison-editorial';
import {sizeEnvironments} from './size-environment';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60);
const positive = z.number().finite().min(1e-30).max(1e30);
export const sizeItemSchema = z.object({
  id: slug, label: z.string().min(1).max(24), value: positive,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  material: z.enum(['plain', 'craters', 'ocean', 'bands', 'glow', 'felt', 'seam', 'panels', 'golf', 'baseball', 'basketball']).default('plain'),
  appearance: z.enum(['earth', 'moon', 'jupiter', 'neptune', 'sun', 'mercury', 'mars', 'venus']).optional(),
  visual: comparisonVisualSchema.optional(),
  country: z.string().trim().min(1).max(56).optional(),
  sourceIds: z.array(slug).min(1),
  approximate: z.boolean().default(false),
  range: z.object({min: positive, max: positive}).strict().optional(),
  note: z.string().max(160).default(''),
}).strict().superRefine((item, ctx) => {
  if (item.range && !(item.range.min <= item.value && item.value <= item.range.max)) ctx.addIssue({code: 'custom', message: 'Representative measurement must lie inside its range.'});
});
export const sizeDatasetSchema = z.object({
  template: z.literal('size-comparison'), id: slug, title: z.string().min(5).max(100),
  subject: z.enum(comparisonSubjects).default('generic'),
  metric: z.enum(['diameter','height','length','width','wingspan','area','volume']),
  unit: z.enum(['nm','um','mm','cm','m','km','AU','ly','mm2','cm2','m2','km2','mm3','cm3','m3','km3','mL','L']),
  basis: z.string().min(5).max(500).optional(),
  asOf: z.iso.date().optional(),
  environment: z.enum(['auto',...sizeEnvironments]).default('auto'),
  backgroundReason:z.string().trim().min(15).max(400).optional(),
  displayUnits:z.enum(['fixed','adaptive']).default('fixed'),
  scaleReference:z.boolean().default(false),
  context: z.string().min(1).max(100),
  editorial:comparisonEditorialSchema.optional(),
  items: z.array(sizeItemSchema).min(4).max(8),
  sources: z.array(z.object({id: slug, title: z.string().min(1), url: z.string().url()}).strict()).min(1),
}).strict().superRefine((data, ctx) => {
  const issue=(message:string)=>ctx.addIssue({code:'custom',message});
  const linear=['nm','um','mm','cm','m','km','AU','ly'];
  if(data.metric==='area'?!data.unit.endsWith('2'):data.metric==='volume'?!['mm3','cm3','m3','km3','mL','L'].includes(data.unit):!linear.includes(data.unit))issue('Metric and unit must describe the same dimension.');
  if(data.metric!=='diameter'&&!data.basis)issue('Define a common measurement basis (including endpoints, pedestal policy, animal age or capacity definition).');
  if(data.scaleReference&&!linear.includes(data.unit))issue('A linear camera ruler requires a linear unit.');
  for(const item of data.items){
    if(needsCountry(data.subject)&&!item.country)issue(`${item.label}: ${data.subject} comparisons require a sourced country name.`);
    if(data.metric==='area'&&item.visual?.kind!=='cutout'&&item.visual?.kind!=='box')issue(`${item.label}: area requires an equal-area cutout or rectangular area model.`);
    if(data.metric==='diameter'&&item.visual&&item.visual.kind!=='sphere')issue(`${item.label}: diameter requires a sphere; choose height or width for other objects.`);
    if(item.visual?.kind==='box'&&item.visual.projection==='isometric'&&data.metric!=='volume')issue(`${item.label}: isometric models are for volume comparisons.`);
    if(item.visual&&item.appearance)issue(`${item.label}: choose a per-run visual or a catalog appearance, not both.`);
    if(data.metric!=='diameter'&&!item.visual&&!item.appearance)issue(`${item.label}: supply an explicit visual for this measurement.`);
    if(item.visual?.kind==='cutout'){
      if(data.metric==='area'&&(item.visual.view!=='top'&&item.visual.view!=='orthographic'))issue(`${item.label}: area requires a top or orthographic view.`);
      if(data.metric==='area'&&item.visual.projection!=='equal-area')issue(`${item.label}: area outlines require an equal-area projection.`);
      if(data.metric==='volume'&&!item.visual.volumeProfile)issue(`${item.label}: volume requires a sourced depth and solid-fraction profile.`);
    }
    if(data.metric==='wingspan'&&item.visual?.kind==='cutout'&&item.visual.view!=='top'&&item.visual.view!=='front')issue(`${item.label}: wingspan requires a top or front view with wings extended.`);
  }
  if (new Set(data.items.map(i => i.id)).size !== data.items.length || new Set(data.sources.map(s => s.id)).size !== data.sources.length) ctx.addIssue({code: 'custom', message: 'Item and source IDs must be unique.'});
  if (data.items.some(i => i.sourceIds.some(id => !data.sources.some(s => s.id === id)))) ctx.addIssue({code: 'custom', message: 'Every measurement must reference a supplied source.'});
  if (data.items.some((item, i) => i > 0 && item.value < data.items[i - 1].value)) ctx.addIssue({code: 'custom', message: 'Order objects by nondecreasing measurement; equal values are allowed.'});
  for(const message of editorialSelectionIssues(data))issue(message);
});
export type SizeDataset = z.infer<typeof sizeDatasetSchema>;
export type SizeItem = z.infer<typeof sizeItemSchema>;

export const formatSize = (value: number) => value!==0&&Math.abs(value)<.1 ? value.toLocaleString('en-US',{maximumSignificantDigits:3}) : Math.abs(value)>=1e12 ? value.toExponential(2) : value.toLocaleString('en-US', {maximumFractionDigits: Math.abs(value) < 1000 ? 1 : 0});
export const formatRatio = (value: number) => `${value>=1e9?value.toExponential(2):value.toLocaleString('en-US', {maximumFractionDigits: value < 10 ? 2 : 1})}x`;

export const formatUnit=(unit:SizeDataset['unit'])=>unit==='um'?'µm':unit.replace('2','²').replace('3','³');
const meters:Partial<Record<SizeDataset['unit'],number>>={nm:1e-9,um:1e-6,mm:1e-3,cm:1e-2,m:1,km:1000,AU:149597870700,ly:9460730472580800};
export function formatMeasurement(value:number,unit:SizeDataset['unit'],adaptive=false){
  if(adaptive&&meters[unit]){
    const physical=value*meters[unit]!;
    const choices=['ly','AU','km','m','cm','mm','um','nm'] as const;
    const selected=choices.find(u=>physical>=meters[u]!*(1-1e-10))??'nm';
    return `${formatSize(physical/meters[selected]!)} ${formatUnit(selected)}`;
  }
  return `${formatSize(value)} ${formatUnit(unit)}`;
}
// A 1/2/5 ruler follows the camera's actual world-to-pixel transform.
export function comparisonRuler(scale:number,unit:SizeDataset['unit']){
  const ideal=220/scale,power=10**Math.floor(Math.log10(ideal));
  const value=[1,2,5,10].map(n=>n*power).reduce((a,b)=>Math.abs(Math.log(b/ideal))<Math.abs(Math.log(a/ideal))?b:a);
  return {value,width:value*scale,label:formatMeasurement(value,unit,true)};
}
export type GeometryItem=Pick<SizeItem,'value'> & Partial<Pick<SizeItem,'visual'>>;
export type SizeMetric=SizeDataset['metric'];

// Geometry is in a shared world space. Area and volume are converted to
// lengths once, before a common camera transform is applied to every object.
export function objectExtent(item:GeometryItem,metric:SizeMetric='diameter') {
  const visual=item.visual;
  const aspect=visual?.kind==='cutout' ? (visual.calibration?.bounds.width??1)/(visual.calibration?.bounds.height??1) : visual?.kind==='box'?visual.widthToHeight:1;
  if(visual?.kind==='cutout'&&!visual.calibration)throw new Error('Prepare per-run assets before planning geometry.');
  let height:number;
  if(metric==='area')height=Math.sqrt(item.value/(aspect*(visual?.kind==='cutout'?visual.calibration!.coverage:visual?.kind==='box'?1:Math.PI/4)));
  else if(metric==='volume'){
    const depth=visual?.kind==='box'?visual.depthToHeight:visual?.kind==='cutout'?visual.volumeProfile!.depthToHeight:1;
    const fraction=visual?.kind==='cutout'?visual.volumeProfile!.solidFraction:visual?.kind==='box'?1:Math.PI/6;
    height=Math.cbrt(item.value/(aspect*depth*fraction));
  }else height=['length','width','wingspan'].includes(metric)?item.value/aspect:item.value;
  if(visual?.kind==='box'&&visual.projection==='isometric')return {width:height*(aspect+.38*visual.depthToHeight),height:height*(1+.26*visual.depthToHeight)};
  return {width:height*aspect,height};
}
export function sizeLayout(items:GeometryItem[],metric:SizeMetric='diameter') {
  let edge=0,previousWidth=0;
  return items.map(item=>{
    const extent=objectExtent(item,metric),gap=previousWidth*.18,x=edge+gap+extent.width/2;
    edge=x+extent.width/2;previousWidth=extent.width;
    return {x,...extent,diameter:Math.max(extent.width,extent.height)};
  });
}
export function sizePose(items:GeometryItem[],focus:number,reference=Math.max(0,focus-1),metric:SizeMetric='diameter') {
  const world=sizeLayout(items,metric),first=world[Math.min(focus,reference)],last=world[focus];
  const left=first.x-first.width/2,right=last.x+last.width/2;
  const maxHeight=Math.max(...world.slice(Math.min(focus,reference),focus+1).map(b=>b.height));
  const scale=Math.min(600/maxHeight,820/(right-left)),offset=450-(left+right)/2*scale;
  return {scale,offset,bodies:world.map(body=>({x:body.x*scale+offset,y:860-body.height*scale/2,width:body.width*scale,height:body.height*scale,diameter:body.diameter*scale}))};
}
export function sizeSample(items:GeometryItem[],phase:number,metric:SizeMetric='diameter') {
  const world=sizeLayout(items,metric),p=Math.max(0,Math.min(items.length-1,phase));
  const lo=Math.floor(p),hi=Math.min(items.length-1,lo+1),t=p-lo;
  const a=sizePose(items,lo,undefined,metric),b=sizePose(items,hi,undefined,metric);
  const scale=a.scale*(b.scale/a.scale)**t;
  const weight=Math.abs(b.scale-a.scale)<1e-15?t:(scale-a.scale)/(b.scale-a.scale),offset=a.offset+(b.offset-a.offset)*weight;
  return {scale,bodies:world.map(body=>({x:body.x*scale+offset,y:860-body.height*scale/2,width:body.width*scale,height:body.height*scale,diameter:body.diameter*scale}))};
}
