import {useMemo} from 'react';
import {AbsoluteFill, Html5Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ActorView} from './Actors';
import {compileStory, sampleActor} from './motion';
import {Stars} from './Visuals';
import {symbolCopy} from './locale';
import {useDevanagariFont} from './useDevanagariFont';
import {presentations} from './genres';
import {shortDuration, type ShortInput} from './schema';
import {ComparisonBackground} from './ComparisonBackground';
import {resolveSizeEnvironment,sizeEnvironmentPalette} from './size-environment';
import {sizeTextTiming} from './size-text-motion';

export const WhatIfShort = (input: ShortInput) => {
  const frame = useCurrentFrame();
  const hindi = input.language === 'hi';
  useDevanagariFont(hindi);
  const theme = presentations[input.genre];
  const sizeActor = input.actors.find(actor => actor.kind === 'size-comparison');
  const sizeComparison = Boolean(sizeActor);
  const sizeEnvironment=sizeActor?resolveSizeEnvironment(sizeActor.data):null;
  const background=sizeEnvironment?sizeEnvironmentPalette[sizeEnvironment].background:theme.background;
  const footer = input.actors.some(actor => actor.kind === 'sacred-symbol') ? symbolCopy[input.language].footer : hindi ? 'प्राचीन ज्ञान · परंपराओं की एक व्याख्या' : theme.footer;
  const {width, height} = useVideoConfig();
  const compiled = useMemo(() => compileStory(input), [input]);
  const camera = sampleActor(compiled, 'camera', frame);
  let sceneIndex = 0;
  compiled.starts.forEach((start, i) => {if (start <= frame) sceneIndex = i;});
  const scene = input.scenes[sceneIndex];
  const local = frame - compiled.starts[sceneIndex];
  const parentCaption = scene.captions.find(c => local >= c.from && local < c.from + c.duration);
  const caption = parentCaption?.chunks?.find(chunk => local >= chunk.from && local < chunk.from + chunk.duration) ?? parentCaption;
  const scale = Math.min(width / 1080, height / 1920);
  return <AbsoluteFill style={{background, fontFamily: hindi ? 'SacredDevanagari, Arial, sans-serif' : 'Arial, Helvetica, sans-serif', color: '#F3F7FA', overflow: 'hidden'}}>
    <div style={{position: 'absolute', width: 1080, height: 1920, left: (width - 1080 * scale) / 2, top: (height - 1920 * scale) / 2, transform: `scale(${scale})`, transformOrigin: 'top left', background: `radial-gradient(ellipse at 40% 45%, ${theme.glow}, ${theme.background} 70%)`, overflow: 'hidden'}}>
      {sizeEnvironment?<ComparisonBackground preset={sizeEnvironment} frame={frame} fps={input.fps} seed={input.seed}/>:<Stars time={frame / input.fps} seed={input.seed}/>}
      <AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(${540 - camera.x * camera.scale}px, ${960 - camera.y * camera.scale}px) scale(${camera.scale})`}}>
        {input.actors.map(actor => <ActorView key={actor.id} actor={actor} state={sampleActor(compiled, actor.id, frame)} seed={input.seed} language={input.language} textTiming={actor.kind==='size-comparison'?sizeTextTiming(scene,local,actor.id):undefined}/>)}
      </AbsoluteFill>
      {!sizeComparison?<div style={{position: 'absolute', top: 105, left: 68, fontWeight: 700, fontSize: 21, letterSpacing: hindi ? 0 : 4, color: input.accent}}>{hindi ? symbolCopy.hi.header : theme.label}</div>:null}
      {!sizeComparison?<div style={{position: 'absolute', left: 0, right: 0, top: 1370, bottom: 0, background: `linear-gradient(transparent, ${theme.background}DD 28%, ${theme.background})`}}/>:null}
      {!sizeComparison&&caption ? <div style={{position:'absolute',left:70,right:155,top:1470,fontSize:input.presentation==='silent'?34:hindi?42:43,lineHeight:hindi?1.45:1.23,fontWeight:600,letterSpacing:hindi?0:-.5,textShadow:'0 3px 18px #000',overflowWrap:'anywhere'}}><span style={{color:input.accent}}>▎</span>{caption.text}</div> : null}
      {!sizeComparison?<div style={{position: 'absolute', left: 70, right: 155, top: 1720, height: 3, background: '#FFFFFF18'}}><div style={{height: '100%', width: `${frame / (shortDuration(input) - 1) * 100}%`, background: input.accent}}/></div>:null}
      {!sizeComparison?<div style={{position:'absolute',left:70,top:1760,color:'#6B8799',fontSize:hindi?17:14,letterSpacing:hindi?0:2}}>{footer}</div>:null}
    </div>
    {input.audio ? <Html5Audio src={staticFile(input.audio)}/> : null}
  </AbsoluteFill>;
};
