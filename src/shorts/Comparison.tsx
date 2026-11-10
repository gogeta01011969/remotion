import {comparisonSample, ratioLabel} from './mechanics';
import type {Actor, ActorState} from './schema';

type ComparisonActor = Extract<Actor, {kind: 'comparison'}>;
const ease = (n: number) => {const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t);};

export const Comparison = ({actor, state}: {actor: ComparisonActor; state: ActorState}) => {
  const p = Math.max(0, Math.min(1, state.phase));
  const sample = comparisonSample(actor.mode, actor.gravityRatio, p);
  const colors = ['#73E7FF', '#FFB47A'];
  const xs = [245, 655];
  const ground = 880;
  const fallHeight = 520;
  const launchScale = 550 / Math.max(sample.normalHeight, sample.changedHeight);
  const positions = [sample.normal, sample.changed].map(value => actor.mode === 'fall' ? ground - fallHeight + value * fallHeight : actor.mode === 'launch' ? ground - value * launchScale : 545);
  const result = actor.mode === 'force' ? sample.force : actor.mode === 'fall' || actor.metric === 'time' ? sample.changedTime / sample.normalTime : sample.changedHeight / sample.normalHeight;
  const resultUnit = actor.mode === 'force' ? 'WEIGHT' : actor.mode === 'fall' ? 'FALL TIME' : actor.metric === 'time' ? 'TIME ALOFT' : 'JUMP HEIGHT';
  const reveal = actor.mode === 'force' ? ease(p * 3) : ease((p - 0.62) / 0.22);
  const headlineLines = actor.heading.split('\n');
  return <div style={{width: 900, height: 1100, position: 'relative'}}>
    <div style={{position: 'absolute', top: 5, width: '100%', textAlign: 'center', color: '#F3F7FA', fontWeight: 700, fontSize: actor.heading.length > 35 ? 60 : 70, lineHeight: 1.06, letterSpacing: -2.5}}>{headlineLines.map((line, i) => <div key={i}>{line}</div>)}</div>
    <svg width="900" height="1100" viewBox="0 0 900 1100" style={{overflow: 'visible'}}>
      <defs>
        {colors.map((color, i) => <radialGradient key={i} id={`${actor.id}-ball-${i}`} cx="32%" cy="24%" r="75%"><stop stopColor="#FFFFFF"/><stop offset="0.22" stopColor={color}/><stop offset="1" stopColor={i === 0 ? '#1C7597' : '#8F4925'}/></radialGradient>)}
        <linearGradient id={`${actor.id}-floor`} x2="0" y2="1"><stop stopColor="#73E7FF" stopOpacity="0.13"/><stop offset="1" stopColor="#73E7FF" stopOpacity="0"/></linearGradient>
      </defs>
      <path d={`M80 ${ground}H820L890 990H10Z`} fill={`url(#${actor.id}-floor)`}/>
      {[0, 1, 2, 3, 4].map(i => <g key={i} opacity="0.12"><path d={`M75 ${ground - i * 130}H825`} stroke="#8CAEC2" strokeDasharray="2 12"/><path d={`M450 ${ground - i * 130 - 8}v16`} stroke="#8CAEC2"/></g>)}
      <path d={`M65 ${ground}H835`} stroke="#7BA8BE" strokeWidth="2" opacity="0.6"/>
      {xs.map((x, i) => {
        const color = colors[i];
        const label = i === 0 ? actor.referenceLabel : actor.changedLabel;
        const y = positions[i];
        const force = i === 0 ? 1 : sample.force;
        const height = (i === 0 ? sample.normalHeight : sample.changedHeight) * launchScale;
        return <g key={i}>
          <rect x={x - 157} y="184" width="314" height="52" rx="26" stroke={color} strokeOpacity="0.3" fill={`${color}0C`}/>
          <text x={x} y="217" textAnchor="middle" fill={color} fontSize="20" fontWeight="600" letterSpacing="2">{label}</text>
          {actor.mode === 'fall' ? <><path d={`M${x} ${ground - fallHeight}V${ground}`} stroke={color} strokeOpacity="0.22" strokeDasharray="4 10"/><path d={`M${x - 85} ${ground - fallHeight}h170`} stroke={color} strokeOpacity="0.5" strokeWidth="2"/></> : null}
          {actor.mode === 'launch' ? <g opacity={0.25 + reveal * 0.35}><path d={`M${x + 76} ${ground}V${ground - height}h-30`} fill="none" stroke={color} strokeWidth="2"/><path d={`M${x - 65} ${ground - height}h130`} stroke={color} strokeDasharray="3 9"/></g> : null}
          {actor.mode !== 'force' ? Array.from({length: 9}, (_, j) => {
            const trailP = Math.max(0, p - (j + 1) * 0.014);
            const trail = comparisonSample(actor.mode, actor.gravityRatio, trailP);
            const value = i === 0 ? trail.normal : trail.changed;
            const ty = actor.mode === 'fall' ? ground - fallHeight + value * fallHeight : ground - value * launchScale;
            return <circle key={j} cx={x} cy={ty - 34} r={Math.max(3, 20 - j * 1.7)} fill={color} opacity={p >= 0.999 ? 0 : (1 - j / 9) * 0.09}/>;
          }) : null}
          <ellipse cx={x} cy={ground + 13} rx={24 + 23 * (1 - Math.min(1, Math.abs(ground - y) / 600))} ry="7" fill="#000000" opacity="0.45"/>
          <circle cx={x} cy={y - 34} r="34" fill={`url(#${actor.id}-ball-${i})`}/>
          <circle cx={x - 10} cy={y - 47} r="8" fill="#FFFFFF" opacity="0.18"/>
          {actor.mode === 'force' ? <>
            <path d={`M${x} 584v${180 * force}m-15 -17l15 17 15 -17`} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"/>
            <text x={x} y="820" textAnchor="middle" fill={color} fontSize="58" fontWeight="700" letterSpacing="-2">{Math.round(force * 100)}%</text>
            <text x={x} y="852" textAnchor="middle" fill="#8CA7B9" fontSize="15" letterSpacing="2">WEIGHT</text>
          </> : null}
          {actor.mode !== 'force' ? <g opacity={reveal}>
            <text x={x} y="958" fill={color} textAnchor="middle" fontWeight="700" fontSize="53" letterSpacing="-2">{ratioLabel(i === 0 ? 1 : result)}</text>
            <text x={x} y="991" fill="#8CA7B9" textAnchor="middle" fontSize="15" letterSpacing="2">{resultUnit}</text>
          </g> : <text x={x} y="958" fill="#8CA7B9" textAnchor="middle" fontSize="18" letterSpacing="2">SAME MASS</text>}
        </g>;
      })}
    </svg>
    <div style={{position: 'absolute', left: 25, right: 25, top: 1030, textAlign: 'center', color: '#B8CFDC', fontSize: actor.takeaway.length > 58 ? 20 : 24, letterSpacing: 0.3, opacity: 0.45 + reveal * 0.55}}>{actor.takeaway}</div>
    <div style={{position: 'absolute', left: 25, right: 25, top: 1080, textAlign: 'center', color: '#668798', fontSize: 13, letterSpacing: 1.8}}>{actor.mode === 'force' ? 'IDENTICAL MASSES · ONLY GRAVITY CHANGES' : 'NO AIR RESISTANCE · MATCHED INITIAL CONDITIONS'}</div>
  </div>;
};
