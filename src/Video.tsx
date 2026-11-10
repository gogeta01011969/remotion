import {Fragment} from 'react';
import {AbsoluteFill} from 'remotion';
import {linearTiming, TransitionSeries} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {wipe} from '@remotion/transitions/wipe';
import {getTimeline, type VideoInput} from './config';
import {Scene} from './scenes/Scene';

export const MotionVideo = (input: VideoInput) => {
  const {sceneFrames, transitionFrames} = getTimeline(input);
  return <AbsoluteFill style={{background: input.colors.background}}>
    <TransitionSeries>
      {input.scenes.map((scene, index) => <Fragment key={index}>
        {index > 0 ? input.transition === 'fade'
          ? <TransitionSeries.Transition timing={linearTiming({durationInFrames: transitionFrames})} presentation={fade()} />
          : <TransitionSeries.Transition timing={linearTiming({durationInFrames: transitionFrames})} presentation={wipe({direction: 'from-right'})} />
          : null}
        <TransitionSeries.Sequence durationInFrames={sceneFrames[index]} name={scene.eyebrow}>
          <Scene scene={scene} input={input} index={index}/>
        </TransitionSeries.Sequence>
      </Fragment>)}
    </TransitionSeries>
  </AbsoluteFill>;
};
