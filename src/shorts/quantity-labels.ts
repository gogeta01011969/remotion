import type {MeasureText} from './text-metrics';
export function labelColor(color:string){
  let rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  const luminance=(v:number[])=>v.map(c=>{const n=c/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  while(luminance(rgb)<.42)rgb=rgb.map(c=>Math.min(255,c+8));
  return '#'+rgb.map(c=>c.toString(16).padStart(2,'0')).join('');
}
// Preserve whole words: select an explicit two-line layout or shrink a long
// single token. Do not let the browser split names at arbitrary characters.
export function chartNameLayout(text:string,width:number,maximum:number,measure:MeasureText){
  let lines=[text];
  const words=text.trim().split(/\s+/);
  if(words.length>1){
    const alternatives=words.slice(1).map((_,i)=>[words.slice(0,i+1).join(' '),words.slice(i+1).join(' ')]);
    lines=alternatives.sort((a,b)=>Math.max(...a.map(s=>measure(s,maximum,650)))-Math.max(...b.map(s=>measure(s,maximum,650))))[0];
  }
  const measured=Math.max(...lines.map(s=>measure(s,maximum,650)));
  return {lines,fontSize:Math.min(maximum,maximum*width/Math.max(1,measured))};
}
export function denseQuantityLabels(names:string[],count:number,measure:MeasureText){
  const width=730/count*.92;
  return count>8||names.slice(0,count).some(name=>chartNameLayout(name,width,25,measure).fontSize<20);
}
