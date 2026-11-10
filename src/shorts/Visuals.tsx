import {random} from 'remotion';

export const Stars = ({time, seed}: {time: number; seed: number}) => <svg width="1080" height="1920" style={{position: 'absolute', inset: 0}}>
  {Array.from({length: 120}, (_, i) => <circle key={i} cx={random(`${seed}-${i}-x`) * 1080} cy={(random(`${seed}-${i}-y`) * 1920 + time * (2 + i % 5)) % 1920} r={0.6 + random(`${seed}-${i}-r`) * 1.7} fill="#CEF3FF" opacity={0.2 + (Math.sin(i + time * 0.8) + 1) * 0.23}/>)}
</svg>;
