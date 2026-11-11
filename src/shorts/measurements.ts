// Shared measurement semantics for research, validation and presentation.
export const quantityMetrics=['mass','count','speed','duration','energy','power','temperature'] as const;
export type QuantityMetric=typeof quantityMetrics[number];
export const comparisonMetrics=['diameter','height','length','width','wingspan','area','volume',...quantityMetrics] as const;
export const comparisonUnits=['nm','um','mm','cm','m','km','AU','ly','mm2','cm2','m2','km2','mm3','cm3','m3','km3','mL','L','mg','g','kg','t','lb','count','m/s','km/h','mph','s','min','h','day','year','J','kJ','MJ','GJ','Wh','kWh','W','kW','MW','GW','C','K','F'] as const;
export const sourceUnits=[...comparisonUnits,'ft','in','thousand','million','billion'] as const;
export const isQuantityMetric=(metric:string):metric is QuantityMetric=>(quantityMetrics as readonly string[]).includes(metric);
const length=['nm','um','mm','cm','m','km','AU','ly','ft','in'];
const allowed:Record<string,readonly string[]>={diameter:length,height:length,length,width:length,wingspan:length,area:['mm2','cm2','m2','km2'],volume:['mm3','cm3','m3','km3','mL','L'],mass:['mg','g','kg','t','lb'],count:['count','thousand','million','billion'],speed:['m/s','km/h','mph'],duration:['s','min','h','day','year'],energy:['J','kJ','MJ','GJ','Wh','kWh'],power:['W','kW','MW','GW'],temperature:['C','K','F']};
export const metricUnitCompatible=(metric:string,unit:string)=>Boolean(allowed[metric]?.includes(unit));
export const unitDimension=(unit:string)=>Object.entries(allowed).find(([m,units])=>!['diameter','height','width','wingspan'].includes(m)&&units.includes(unit))?.[0]??'unknown';
const factors:Record<string,number>={nm:1e-9,um:1e-6,mm:.001,cm:.01,m:1,km:1000,AU:149597870700,ly:9.4607304725808e15,ft:.3048,in:.0254,mm2:1e-6,cm2:.0001,m2:1,km2:1e6,mm3:1e-9,cm3:1e-6,m3:1,km3:1e9,mL:1e-6,L:.001,mg:1e-6,g:.001,kg:1,t:1000,lb:.45359237,count:1,thousand:1000,million:1e6,billion:1e9,'m/s':1,'km/h':1/3.6,mph:.44704,s:1,min:60,h:3600,day:86400,year:31557600,J:1,kJ:1000,MJ:1e6,GJ:1e9,Wh:3600,kWh:3600000,W:1,kW:1000,MW:1e6,GW:1e9};
export function convertMeasurement(value:number,from:string,to:string){
  if(unitDimension(from)!==unitDimension(to)||unitDimension(from)==='unknown')throw new Error(`Incompatible measurement units: ${from} to ${to}`);
  if(unitDimension(from)==='temperature'){
    const kelvin=from==='K'?value:from==='C'?value+273.15:(value-32)*5/9+273.15;
    if(kelvin<-.000001)throw new Error('Temperature cannot be below absolute zero.');
    return to==='K'?kelvin:to==='C'?kelvin-273.15:(kelvin-273.15)*9/5+32;
  }
  return value*factors[from]/factors[to];
}
export const quantityTemplate=(metric:string)=>metric==='speed'?'race':metric==='duration'?'timeline':metric==='temperature'?'temperature-axis':metric==='count'?'count-grid':'quantity-bars';
export function sampleRace(values:number[],unit:string,distance:number,progress:number){
  const speeds=values.map(v=>convertMeasurement(v,unit,'m/s')),fastest=Math.max(...speeds);
  const elapsedSeconds=fastest>0?distance/fastest*Math.max(0,Math.min(1,progress)):0;
  return {elapsedSeconds,distances:speeds.map(v=>v*elapsedSeconds),fractions:speeds.map(v=>distance>0?v*elapsedSeconds/distance:0)};
}
export function countDots(value:number,maximum:number,progress=1){
  const perDot=Math.max(1,10**Math.ceil(Math.log10(Math.max(1,maximum)/80)));
  return {perDot,fills:Array.from({length:Math.min(80,Math.ceil(value/perDot))},(_,i)=>Math.max(0,Math.min(1,value*Math.max(0,Math.min(1,progress))/perDot-i)))};
}
export function quantityDomain(values:number[],metric:string){
  const min=metric==='temperature'?Math.min(0,...values):0,max=Math.max(0,...values);
  return {min,max:max===min?min+1:max};
}
export const quantityUnitLabel=(unit:string)=>({C:'°C',F:'°F',count:'count',year:'years',day:'days'}[unit]??unit);
export const quantityUnitPatterns:Record<string,RegExp>={
  mg:/\bmg\b|milligrams?\b/i,g:/\bg\b|grams?\b/i,kg:/\bkg\b|kilograms?\b/i,t:/\bt\b|tonnes?\b|metric tons?\b/i,lb:/\blbs?\b|pounds?\b/i,
  count:/individuals?\b|people\b|animals?\b|items?\b|keys\b|seats\b|units\b|inhabitants?\b|faces\b|squares\b|cards\b|teeth\b|wheels\b/i,thousand:/thousand\b/i,million:/million\b/i,billion:/billion\b/i,
  'm/s':/m\s*\/\s*s\b|met(?:re|er)s? per second/i,'km/h':/km\s*\/\s*h\b|kilomet(?:re|er)s? per hour/i,mph:/\bmph\b|miles? per hour/i,
  s:/\bs\b|seconds?\b/i,min:/\bmin\b|minutes?\b/i,h:/\bh\b|hours?\b/i,day:/days?\b/i,year:/years?\b/i,
  J:/\bJ\b|joules?\b/i,kJ:/\bkJ\b|kilojoules?\b/i,MJ:/\bMJ\b|megajoules?\b/i,GJ:/\bGJ\b|gigajoules?\b/i,Wh:/\bWh\b|watt[- ]hours?\b/i,kWh:/\bkWh\b|kilowatt[- ]hours?\b/i,
  W:/\bW\b|watts?(?![- ]hours?)\b/i,kW:/\bkW\b|kilowatts?(?![- ]hours?)\b/i,MW:/\bMW\b|megawatts?(?![- ]hours?)\b/i,GW:/\bGW\b|gigawatts?(?![- ]hours?)\b/i,
  C:/°\s*C\b|degrees?\s+Celsius\b|Celsius\b|\bC\b/i,K:/kelvins?\b|\bK\b/i,F:/°\s*F\b|degrees?\s+Fahrenheit\b|Fahrenheit\b|\bF\b/i,
};
