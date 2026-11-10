import {Composition} from 'remotion';
import {MotionVideo} from './Video';
import {defaultInput, getTimeline, videoSchema} from './config';
import {WhatIfShort} from './shorts/ShortVideo';
import {defaultShort} from './shorts/defaults';
import {shortDuration, shortSchema} from './shorts/schema';
import {previewInput} from './shorts/defaults';
import {compileSizeComparison} from './pipeline/size-comparison';
import sizeData from '../comparisons/solar-system.json';
import sizeEpisode from '../comparisons/solar-system.en.json';

const defaultComparison = previewInput(compileSizeComparison(sizeData, sizeEpisode));

export const RemotionRoot = () => (
  <>
  <Composition
    id="SizeComparison"
    component={WhatIfShort}
    schema={shortSchema}
    defaultProps={defaultComparison}
    width={1080} height={1920} fps={30}
    durationInFrames={shortDuration(defaultComparison)}
    calculateMetadata={({props}) => {
      const input = shortSchema.parse(props);
      return {props: input, fps: input.fps, durationInFrames: shortDuration(input), width: 1080, height: 1920};
    }}
  />
  <Composition
    id="MotionLab"
    component={MotionVideo}
    schema={videoSchema}
    defaultProps={defaultInput}
    width={defaultInput.width}
    height={defaultInput.height}
    fps={defaultInput.fps}
    durationInFrames={getTimeline(defaultInput).durationInFrames}
    calculateMetadata={({props}) => {
      const input = videoSchema.parse(props);
      return {
        width: input.width,
        height: input.height,
        fps: input.fps,
        durationInFrames: getTimeline(input).durationInFrames,
        props: input,
      };
    }}
  />
  <Composition
    id="WhatIfShort"
    component={WhatIfShort}
    schema={shortSchema}
    defaultProps={defaultShort}
    width={1080}
    height={1920}
    fps={defaultShort.fps}
    durationInFrames={shortDuration(defaultShort)}
    calculateMetadata={({props}) => {
      const input = shortSchema.parse(props);
      return {props: input, fps: input.fps, durationInFrames: shortDuration(input), width: 1080, height: 1920};
    }}
  />
  </>
);
