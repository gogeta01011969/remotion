import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AnimatedText} from '../components/AnimatedText';
import {Orbit, ShapeGrid} from '../components/Geometry';
import {Particles} from '../components/Particles';
import type {SceneInput, VideoInput} from '../config';

export const Scene = ({scene, input, index}: {scene: SceneInput; input: VideoInput; index: number}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const {colors} = input;
  const scale = Math.min(width / 1600, height / 900);
  const reveal = spring({frame: frame - fps * 0.25, fps, config: {damping: 22}});
  const isFinale = scene.type === 'finale';
  const bg = isFinale ? colors.ink : colors.background;
  const ink = isFinale ? colors.background : colors.ink;
  return <AbsoluteFill style={{backgroundColor: bg, fontFamily: 'Arial, Helvetica, sans-serif', overflow: 'hidden'}}>
    <div style={{position: 'absolute', width: 1600, height: 900, left: (width - 1600 * scale) / 2, top: (height - 900 * scale) / 2, transform: `scale(${scale})`, transformOrigin: 'top left', color: ink}}>
      <Particles count={input.particleCount} seed={input.seed + index} color={ink} intensity={scene.intensity} />
      <div style={{position: 'absolute', left: 80, right: 80, top: 46, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, letterSpacing: 2}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}><span style={{width: 17, height: 17, background: isFinale ? colors.accent : colors.ink, borderRadius: '50%'}}/> MOTION / LAB</div>
        <span style={{opacity: 0.5, fontSize: 14}}>AN EXPERIMENT IN POSSIBILITY</span>
      </div>
      <div style={{position: 'absolute', top: 96, left: 80, right: 80, height: 1, background: ink, opacity: 0.18}} />
      {isFinale ? <>
        <div style={{position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center', opacity: reveal}}>
          <span style={{color: colors.accent, fontSize: 17, letterSpacing: 4}}>{scene.eyebrow}</span>
        </div>
        <div style={{position: 'absolute', left: 220, right: 220, top: 285}}><AnimatedText text={scene.title} color={ink} centered /></div>
        <div style={{position: 'absolute', top: 575, left: 0, right: 0, textAlign: 'center', opacity: reveal, fontSize: 25, color: `${ink}BB`}}>{scene.subtitle}</div>
        <div style={{position: 'absolute', top: 650, left: 650, width: 300, height: 64, background: colors.accent, borderRadius: 40, color: colors.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, letterSpacing: 2, transform: `translateY(${(1 - reveal) * 30}px)`, opacity: reveal}}>LET’S CREATE <span style={{marginLeft: 30, transform: `translateX(${Math.sin(frame / fps * 2) * 5}px)`}}>↗</span></div>
        {[0, 1].map(i => <div key={i} style={{position: 'absolute', width: 560, height: 560, border: `1px solid ${colors.accent}40`, borderRadius: '50%', left: i === 0 ? -380 : 1420, top: 200 + i * 200, transform: `scale(${1 + Math.sin(frame / fps + i) * 0.08})`}}/>)}
      </> : <>
        <div style={{position: 'absolute', left: 100, top: 235, width: 670}}>
          <div style={{fontSize: 17, letterSpacing: 4, marginBottom: 35, opacity: reveal}}>{scene.eyebrow}</div>
          <AnimatedText text={scene.title} color={ink} />
          <div style={{fontSize: 25, lineHeight: 1.5, maxWidth: 510, marginTop: 35, opacity: reveal, transform: `translateY(${(1 - reveal) * 25}px)`, color: `${ink}AA`}}>{scene.subtitle}</div>
          <div style={{display: 'flex', gap: 10, marginTop: 38, opacity: reveal}}>{['GENERATIVE', 'FRAME PERFECT'].map(label => <span key={label} style={{border: `1px solid ${ink}35`, borderRadius: 30, padding: '10px 16px', fontSize: 12, letterSpacing: 2}}>{label}</span>)}</div>
        </div>
        <div style={{position: 'absolute', right: scene.type === 'intro' ? 40 : 95, top: scene.type === 'intro' ? 140 : 180}}>
          {scene.type === 'intro' ? <Orbit colors={colors} intensity={scene.intensity}/> : <ShapeGrid colors={colors} intensity={scene.intensity}/>}
        </div>
      </>}
      <div style={{position: 'absolute', bottom: 58, left: 80, right: 80, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, letterSpacing: 2, opacity: 0.65}}>
        <span>BUILT FROM IDEAS. MOVED BY CODE.</span>
        <div style={{display: 'flex', gap: 8}}>{input.scenes.map((_, i) => <span key={i} style={{width: i === index ? 44 : 12, height: 6, borderRadius: 3, background: i === index ? (isFinale ? colors.accent : colors.ink) : `${ink}35`}}/>)}</div>
        <span>{String(index + 1).padStart(2, '0')} / {String(input.scenes.length).padStart(2, '0')}</span>
      </div>
      <div style={{position: 'absolute', bottom: 0, height: 4, background: colors.accent, width: `${interpolate(frame, [0, fps * 2], [0, 100], {extrapolateRight: 'clamp'})}%`}} />
    </div>
  </AbsoluteFill>;
};
