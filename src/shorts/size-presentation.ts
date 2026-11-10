import {sampleSizeShots,type SizeShot} from './size-shots';
import {type SizeDataset} from './size-data';
import {smoothStep} from './size-text-motion';

export const overviewTiming={detailArrival:.16,zoomStart:.5,zoomEnd:.75} as const;

// Each pose is centered by its occupied presentation bounds. Detail poses
// reserve text space; the text-free overview centers only its silhouettes.
// Interpolating offsets by phase avoids jumps when scene/title metadata changes.
export function sizePresentationOffset(data:SizeDataset,shots:SizeShot[],phase:number,showCountry:boolean){
  const p=Math.max(0,Math.min(shots.length-1,phase)),lo=Math.floor(p),hi=Math.min(shots.length-1,lo+1);
  const offset=(index:number)=>{
    const shot=shots[index];
    if(shot.role==='overview'){
      const sample=sampleSizeShots(data.items,shots,index,data.metric);
      const top=Math.min(...shot.visible.map(i=>sample.bodies[i].y-sample.bodies[i].height/2));
      return 575-(top+860)/2;
    }
    const bottom=shot.focus===shot.reference?(showCountry?952:926):1120;
    return 575-(-37+bottom)/2;
  };
  return offset(lo)+(offset(hi)-offset(lo))*smoothStep(p-lo);
}
export function detailTextOpacity(isLastDetail:boolean,progress:number){
  return isLastDetail?1-smoothStep((progress-(overviewTiming.zoomStart-.06))/.06):1;
}
