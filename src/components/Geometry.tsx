import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {VideoInput} from '../config';

type Props = {colors: VideoInput['colors']; intensity: number};

export const Orbit = ({colors, intensity}: Props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps * intensity;
  const entrance = spring({frame, fps, config: {damping: 16, stiffness: 65}});
  return <svg width="660" height="660" viewBox="-330 -330 660 660" style={{overflow: 'visible', transform: `scale(${0.7 + entrance * 0.3})`}}>
    <circle r="260" fill="none" stroke={colors.ink} strokeWidth="1" opacity="0.15" />
    <circle r="202" fill="none" stroke={colors.ink} strokeWidth="1" opacity="0.15" strokeDasharray="3 12" />
    {[0, 1, 2].map(i => <ellipse key={i} rx="260" ry="100" fill="none" stroke={colors.ink} strokeWidth="2" transform={`rotate(${i * 60 + time * 12})`} opacity="0.7" />)}
    <g transform={`rotate(${-time * 18})`}>
      <rect x="-84" y="-84" width="168" height="168" rx="32" fill={colors.accent} transform="rotate(22)" />
      <path d="M-42 0 H42 M0 -42 V42" stroke={colors.ink} strokeWidth="15" />
    </g>
    {[0, 1, 2, 3].map(i => {
      const angle = i * Math.PI / 2 + time * 0.5;
      return <circle key={i} cx={Math.cos(angle) * 260} cy={Math.sin(angle) * 260} r={i === 0 ? 22 : 10} fill={i % 2 ? colors.ink : colors.secondary} />;
    })}
  </svg>;
};

export const ShapeGrid = ({colors, intensity}: Props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps * intensity;
  return <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 164px)', gap: 16}}>
    {Array.from({length: 9}, (_, i) => {
      const p = spring({frame: frame - i * fps * 0.055, fps, config: {damping: 17, stiffness: 90}});
      const turn = Math.sin(time * 0.8 + i) * 14;
      const fill = [colors.accent, colors.secondary, colors.ink][i % 3];
      return <div key={i} style={{height: 164, background: i % 3 === 2 ? 'transparent' : `${colors.ink}08`, border: `1px solid ${colors.ink}25`, borderRadius: 24, display: 'grid', placeItems: 'center', transform: `scale(${p})`}}>
        <svg width="136" height="136" viewBox="-68 -68 136 136" style={{transform: `rotate(${turn + time * (i % 2 ? 9 : -9)}deg)`}}>
          {i % 3 === 0 ? <rect x="-44" y="-44" width="88" height="88" rx={i === 0 ? 44 : 14} fill={fill} /> : i % 3 === 1 ? <path d="M0 -58 L16 -18 L58 0 L16 18 L0 58 L-16 18 L-58 0 L-16 -18 Z" fill={fill} /> : <><circle r="44" stroke={fill} strokeWidth="14" fill="none"/><circle r={interpolate(Math.sin(time + i), [-1, 1], [6, 16])} fill={colors.secondary}/></>}
        </svg>
      </div>;
    })}
  </div>;
};
