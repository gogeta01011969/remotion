import type {SizeItem} from './size-data';
import type {MeasureText} from './text-metrics';

type Body={x:number;diameter:number;opacity:number};
export type SizeLabel={index:number;text:string;x:number;y:number;fontSize:number;width:number;bodyX:number;country?:string;countryFontSize?:number};

// Fixed focus/reference rows keep identities stable. Secondary labels use spare
// space only; tiny objects retain their real silhouettes and can be marked <1 px.
export function placeSizeLabels(items:(Pick<SizeItem,'label'>&Partial<Pick<SizeItem,'country'>>)[],bodies:Body[],focus:number,reference:number,measure:MeasureText=(text,size)=>text.length*size*.7,options:{showCountry?:boolean}={}) {
  const order=[focus,reference,focus-1,...items.map((_,i)=>i)].filter((i,pos,all)=>i>=0&&all.indexOf(i)===pos);
  const placed:SizeLabel[]=[];
  for(const i of order){
    const b=bodies[i], required=i===focus||i===reference;
    if(!b||b.opacity<.6||b.x<0||b.x>900||!required&&b.diameter<28)continue;
    const text=items[i].label+(b.diameter<1?' · <1 px':'');
    let fontSize=i===focus?27:24;
    const weight=i===focus?650:500;
    const actualWidth=measure(text,fontSize,weight);
    if(actualWidth>548)fontSize*=548/actualWidth;
    const country=options.showCountry?items[i].country:undefined;
    const countryFontSize=country?Math.min(21,21*548/measure(country,21,500)):undefined;
    const width=Math.max(measure(text,fontSize,weight),country?measure(country,countryFontSize!,500):0)+12;
    const clamp=(x:number)=>Math.max(24+width/2,Math.min(860-width/2,x));
    const secondRow=options.showCountry?988:966;
    const rows=i===focus?[920]:i===reference?[secondRow]:[920,secondRow];
    for(const y of rows){
      const neighbors=placed.filter(label=>label.y===y);
      const candidates=[clamp(b.x),...(!required?neighbors.flatMap(label=>[clamp(label.x-(label.width+width)/2-20),clamp(label.x+(label.width+width)/2+20)]):[])].sort((a,bx)=>Math.abs(a-b.x)-Math.abs(bx-b.x));
      const x=candidates.find(candidate=>Math.abs(candidate-b.x)<=(required?900:150)&&!neighbors.some(label=>Math.abs(label.x-candidate)<(label.width+width)/2+19.99));
      if(x!==undefined){placed.push({index:i,text,x,y,fontSize,width,bodyX:b.x,country,countryFontSize});break;}
    }
  }
  return placed;
}
