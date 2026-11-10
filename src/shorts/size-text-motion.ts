import type {ShortScene} from './schema';
import {resolveAnchor} from './motion';

export type SizeTextTiming={localFrame:number;durationInFrames:number;referenceChangedAt:number};
export const smoothStep=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
export function textEntrance(frame:number,from:number,duration:number,beatDuration:number,fps:number) {
  const enter=smoothStep((frame-from)/Math.max(1,duration));
  const exit=smoothStep((beatDuration-1-frame)/Math.max(1,Math.round(fps*.2)));
  return {opacity:enter*exit,offsetY:(1-enter)*10};
}
export function sizeTextTiming(scene:ShortScene,localFrame:number,actorId:string):SizeTextTiming {
  let referenceChangedAt=0;
  const track=scene.motion.find(t=>t.actor===actorId&&t.property==='reference');
  let previous=track?.keyframes[0]?.value;
  for(const key of track?.keyframes??[]){
    const at=resolveAnchor(key.at,scene);
    if(key.value!==previous&&at<=localFrame)referenceChangedAt=at;
    previous=key.value;
  }
  return {localFrame,durationInFrames:scene.durationInFrames,referenceChangedAt};
}
