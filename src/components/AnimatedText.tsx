import {spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const AnimatedText = ({text, color, centered = false}: {text: string; color: string; centered?: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: centered ? 'center' : 'flex-start', gap: '0 24px', color, fontWeight: 700, fontSize: 112, letterSpacing: -7, lineHeight: 1.02}}>
      {text.split(/\s+/).map((word, index) => {
        const progress = spring({frame: frame - index * fps * 0.09, fps, config: {damping: 19, stiffness: 110}});
        return <span key={`${word}-${index}`} style={{display: 'inline-block', opacity: Math.min(1, progress), transform: `translateY(${(1 - progress) * 90}px) rotate(${(1 - progress) * 5}deg)`}}>{word}</span>;
      })}
    </div>
  );
};
