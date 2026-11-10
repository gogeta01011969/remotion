import {random, useCurrentFrame, useVideoConfig} from 'remotion';

export const Particles = ({count, seed, color, intensity}: {count: number; seed: number; color: string; intensity: number}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;
  return <svg width="1600" height="900" style={{position: 'absolute', inset: 0}}>
    {Array.from({length: count}, (_, i) => {
      const x = random(`${seed}-${i}-x`) * 1600;
      const y = random(`${seed}-${i}-y`) * 900;
      const phase = random(`${seed}-${i}-phase`) * Math.PI * 2;
      const drift = time * (6 + random(`${seed}-${i}-speed`) * 12) * intensity;
      return <circle key={i} cx={(x + drift) % 1600} cy={y + Math.sin(time * 0.6 + phase) * 18} r={1.5 + random(`${seed}-${i}-size`) * 2.5} fill={color} opacity={0.12 + (Math.sin(time + phase) + 1) * 0.12} />;
    })}
  </svg>;
};
