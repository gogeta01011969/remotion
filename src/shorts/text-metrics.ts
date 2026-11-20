import {useMemo,useCallback} from 'react';

export type MeasureText=(text:string,fontSize:number,weight:number,letterSpacing?:number)=>number;
// Canvas and SVG/HTML use the same font family and weights. Measuring actual
// glyphs avoids treating narrow letters, wide capitals and punctuation equally.
export function useTextMetrics(fontFamily:string):MeasureText {
  const context=useMemo(()=>typeof document==='undefined'?null:document.createElement('canvas').getContext('2d'),[]);
  return useCallback<MeasureText>((text,size,weight,spacing=0)=>{
    if(!context)return text.length*size*.7;
    context.font=`${weight} ${size}px ${fontFamily}`;
    return context.measureText(text).width+Math.max(0,text.length-1)*spacing;
  },[context,fontFamily]);
}
export function fitText(text:string,maximum:number,width:number,weight:number,measure:MeasureText,spacing=0) {
  const measured=measure(text,maximum,weight,spacing);
  return measured<=width?maximum:maximum*width/measured;
}
export function fitNoteText(text:string,width:number,measure:MeasureText) {
  for(let size=30;size>=18;size--){
    let lines=1,lineWidth=0;
    for(const word of text.trim().split(/\s+/)){
      const w=measure(word,size,500),gap=lineWidth?measure(' ',size,500):0;
      if(w>width){if(lineWidth)lines++;lines+=Math.ceil(w/width)-1;lineWidth=w%width;}
      else if(lineWidth+gap+w>width){lines++;lineWidth=w;}else lineWidth+=gap+w;
    }
    if(lines*size*1.3<=96)return size;
  }
  return 18;
}

// Fit complete names into a fixed label band, including long unbroken tokens.
export function fitLabelText(text:string,maximum:number,width:number,height:number,weight:number,measure:MeasureText){
  const fits=(size:number)=>{
    let lines=1,line='';
    for(const word of text.trim().split(/\s+/)){
      if(measure(word,size,weight)>width){
        if(line){lines++;line='';}
        for(const char of word){if(line&&measure(line+char,size,weight)>width){lines++;line='';}line+=char;}
      }else if(line&&measure(line+' '+word,size,weight)>width){lines++;line=word;}
      else line+=(line?' ':'')+word;
    }
    return lines*size*1.18<=height;
  };
  if(fits(maximum))return maximum;
  let low=0,high=maximum;
  for(let i=0;i<16;i++){const mid=(low+high)/2;if(fits(mid))low=mid;else high=mid;}
  return low;
}
