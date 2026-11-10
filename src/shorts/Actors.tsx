import type {Language} from './locale';
import type {ReactNode} from 'react';
import {random} from 'remotion';
import {Planet} from './Planet';
import {SacredSymbol} from './SacredSymbol';
import {SymbolicStory} from './SymbolicStory';
import {Comparison} from './Comparison';
import {SizeComparison} from './SizeComparison';
import type {Actor, ActorState} from './schema';
import type {SizeTextTiming} from './size-text-motion';

// Primitives only read the resolved state. No topic names, scene indexes, timers,
// external scene assets, or internally invented camera moves live here.
export const ActorView = ({actor, state: s, seed, language = 'en',textTiming}: {actor: Actor; state: ActorState; seed: number; language?: Language;textTiming?:SizeTextTiming}) => {
  let content: ReactNode;
  if (actor.kind === 'size-comparison') content = <SizeComparison actor={actor} state={s} language={language} textTiming={textTiming}/>;
  else if (actor.kind === 'sacred-symbol') content = <SacredSymbol actor={actor} state={s} language={language}/>;
  else if (actor.kind === 'symbolic-story') content = <SymbolicStory actor={actor} state={s}/>;
  else if (actor.kind === 'comparison') content = <Comparison actor={actor} state={s}/>;
  else if (actor.kind === 'planet') content = <Planet diameter={actor.diameter} angle={s.phase}/>;
  else if (actor.kind === 'text') content = <div style={{width: actor.width, color: actor.color, fontSize: actor.fontSize, lineHeight: 1.08, letterSpacing: actor.fontSize > 65 ? -3 : 1, fontWeight: actor.fontSize > 50 ? 700 : 500, whiteSpace: 'pre-line', textAlign: 'center', textShadow: '0 2px 18px #020810'}}>{actor.numeric ? `${Math.round(s.value).toLocaleString('en-US')}${actor.suffix}` : actor.text}</div>;
  else if (actor.kind === 'shape') content = <svg width={actor.width} height={actor.height} viewBox="0 0 100 100" preserveAspectRatio="none" style={{overflow: 'visible'}}>
    {actor.shape === 'circle' || actor.shape === 'ring'
      ? <ellipse cx="50" cy="50" rx="47" ry="47" fill={actor.outline || actor.shape === 'ring' ? 'none' : actor.color} stroke={actor.color} strokeWidth={actor.shape === 'ring' ? 1 : 0.5}/>
      : actor.shape === 'arrow'
        ? <path d="M5 50H91M72 28L94 50 72 72" stroke={actor.color} strokeWidth="5" fill="none" strokeLinecap="round"/>
        : <rect x="1" y="1" width="98" height="98" rx="3" fill={actor.outline ? 'none' : actor.color} stroke={actor.color} strokeWidth="1"/>}
  </svg>;
  else if (actor.kind === 'city') content = <svg width={actor.width} height={actor.height} viewBox={`0 0 ${actor.width} ${actor.height}`}>
    {Array.from({length: actor.buildings}, (_, i) => {
      const w = actor.width / actor.buildings;
      const h = actor.height * (0.2 + random(`${seed}-${actor.id}-${i}`) * 0.65);
      return <g key={i}><rect x={i * w + 3} y={actor.height - h} width={w - 6} height={h} fill="#102B3E" stroke={actor.color} strokeOpacity="0.5"/>
        {Array.from({length: 6}, (_, j) => <path key={j} d={`M${i * w + 10} ${actor.height - h + 16 + j * 27}h${Math.max(1, w - 20)}`} stroke={actor.color} opacity="0.35"/>)}
      </g>;
    })}<path d={`M0 ${actor.height - 1}H${actor.width}`} stroke={actor.color} strokeWidth="3"/>
  </svg>;
  else if (actor.kind === 'waves') content = <svg width={actor.width} height={actor.height} viewBox={`0 0 ${actor.width} ${actor.height}`} style={{overflow: 'visible'}}>
    <defs><linearGradient id={`${actor.id}-water`} x2="0" y2="1"><stop stopColor={actor.color} stopOpacity="0.36"/><stop offset="1" stopColor="#04101D" stopOpacity="0.95"/></linearGradient></defs>
    {Array.from({length: actor.layers}, (_, layer) => {
      const points = Array.from({length: 100}, (_, i) => {
        const x = i / 99 * actor.width;
        const y = actor.height * (0.18 + layer * 0.1) + Math.sin(x / 130 - s.phase + layer * 0.7) * s.amplitude + Math.sin(x / 58 + s.phase * 0.6 + layer) * s.amplitude * 0.18;
        return `${x},${y}`;
      });
      const line = `M${points.join(' L')}`;
      return <g key={layer}><path d={`${line}L${actor.width} ${actor.height}H0Z`} fill={`url(#${actor.id}-water)`}/><path d={line} fill="none" stroke={actor.color} strokeWidth={layer === 0 ? 3 : 1.3} opacity={0.45 + layer * 0.05}/></g>;
    })}
  </svg>;
  else if (actor.kind === 'particles') content = <svg width={actor.width} height={actor.height} style={{overflow: 'hidden'}}>
    {Array.from({length: actor.count}, (_, i) => {
      const x = ((random(`${seed}-${actor.id}-x-${i}`) + s.phase) % 1 + 1) % 1 * actor.width;
      const y = random(`${seed}-${actor.id}-y-${i}`) * actor.height;
      return <path key={i} d={`M${x} ${y}h${8 + random(`${seed}-${actor.id}-length-${i}`) * 45}`} stroke={actor.color} strokeWidth={i % 5 ? 1 : 2.5} opacity={0.1 + i % 4 * 0.12}/>;
    })}
  </svg>;
  else content = <svg width={actor.radiusX * 2 + 170} height={actor.radiusY * 2 + 170} viewBox={`${-actor.radiusX - 85} ${-actor.radiusY - 85} ${actor.radiusX * 2 + 170} ${actor.radiusY * 2 + 170}`}>
    <ellipse rx={actor.radiusX} ry={actor.radiusY} fill="none" stroke={actor.color} strokeWidth="2" opacity="0.5"/>
    <circle cx={Math.cos(s.phase) * actor.radiusX} cy={Math.sin(s.phase) * actor.radiusY} r={actor.markerRadius} fill={actor.markerColor}/>
  </svg>;
  return <div style={{position: 'absolute', left: s.x, top: s.y, opacity: s.opacity, transform: `translate(-50%, -50%) rotate(${s.rotation}deg) scale(${s.scale})`, transformOrigin: 'center', pointerEvents: 'none'}}>{content}</div>;
};
