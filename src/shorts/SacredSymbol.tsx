import type {Actor, ActorState} from './schema';
import {symbolCopy, type Language} from './locale';
import {useDevanagariFont} from './useDevanagariFont';
type SymbolActor = Extract<Actor, {kind: 'sacred-symbol'}>;
const clamp = (n: number) => Math.min(1, Math.max(0, n));
export const SacredSymbol = ({actor, state, language = 'en'}: {actor: SymbolActor; state: ActorState; language?: Language}) => {
  useDevanagariFont(true);
  const copy = symbolCopy[language];
  const textFont = language === 'hi' ? 'SacredDevanagari, sans-serif' : 'Georgia, serif';
  const index = Math.min(actor.steps.length - 1, Math.floor(state.phase));
  const step = actor.steps[index];
  const p = clamp(state.phase - index);
  const quiet = step.mode === 'silence' ? clamp(p * 2) : step.mode === 'reflect' ? 1 : 0;
  const states = step.mode === 'states';
  const previousMode = actor.steps[Math.max(0, index - 1)].mode;
  const blend = states ? clamp(p / .09) : previousMode === 'states' ? 1 - clamp(p / .12) : 0;
  const radius = 240 - blend * 80;
  const symbolY = 540 - blend * 120;
  const oscillation = Math.sin(state.phase * Math.PI * 8);
  const rippleStrength = (1 - quiet) * (step.mode === 'reveal' ? .3 + .7*p : 1);
  const active = p > .95 ? -1 : Math.min(2, Math.floor((p - .089) / .30));
  const gradient = `${actor.id}-gold`, clip = `${actor.id}-reveal`;
  return <div style={{width: 900, height: 1100}}><svg width="900" height="1100" viewBox="0 0 900 1100" style={{fontFamily: language === 'hi' ? 'SacredDevanagari, sans-serif' : 'Arial, sans-serif'}}>
    <defs>
      <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#FFF1C5"/><stop offset=".55" stopColor="#E0B46F"/><stop offset="1" stopColor="#9D7551"/></linearGradient>
      <clipPath id={clip}><rect x="80" y={step.mode === 'reveal' ? 780-clamp(.3+p)*640 : 0} width="740" height="1100"/></clipPath>
    </defs>
    <text x="450" y="68" textAnchor="middle" fill="#F5E7C7" fontFamily={textFont} fontSize={Math.min(48, 770/(step.heading.length*.56))}>{step.heading}</text>
    <text x="450" y="120" textAnchor="middle" fill="#C1AC86" fontFamily={language === 'hi' ? 'SacredDevanagari, sans-serif' : 'Arial,sans-serif'} fontSize="18" letterSpacing={language === 'hi' ? 0 : 1}>{actor.reference}</text>
    {Array.from({length: 6}, (_, i) => {
      const t = (state.phase * 1.7 + i / 6) % 1;
      return <circle key={i} cx="450" cy={symbolY-30} r={radius*.65+t*230} fill="none" stroke="#D6B97B" strokeWidth={i%2?1:2} opacity={(1-t)*.24*rippleStrength}/>;
    })}
    <g opacity={quiet ? .15 + quiet * .25 : .16} fill="none" stroke="#D7B979">
      <circle cx="450" cy={symbolY-30} r={radius+90}/><circle cx="450" cy={symbolY-30} r={radius+102} strokeDasharray="1 18"/>
    </g>
    <g clipPath={`url(#${clip})`}><g transform={`translate(450 ${symbolY}) scale(${(1 - blend * .28) * (1+oscillation*.009*(1-quiet))})`}>
      <text x="0" y="65" textAnchor="middle" dominantBaseline="middle" fill={`url(#${gradient})`} fontFamily="SacredDevanagari" fontSize="415">ॐ</text>
    </g></g>
    {states ? <g>
      {actor.associations.map((association, i) => {
        const x = 185 + i*265;
        const highlighted = active === i;
        return <g key={association.sound} opacity={p >= .089+i*.30 ? 1 : .23}>
          <path d={`M450 640Q450 710 ${x} 760`} fill="none" stroke="#D8B97A" strokeWidth="2" opacity={highlighted ? .85 : .25}/>
          <circle cx={x} cy="817" r="58" fill={highlighted?'#453C34':'#222332'} stroke={highlighted?'#F5DB9A':'#7A6A55'} strokeWidth="2"/>
          <text x={x} y="837" textAnchor="middle" fill="#F2DCA7" fontFamily={textFont} fontSize="54">{copy.sounds[association.sound]}</text>
          <text x={x} y="925" textAnchor="middle" fill="#F3E9D5" fontFamily={language === 'hi' ? 'SacredDevanagari, sans-serif' : 'Arial,sans-serif'} fontSize="27">{association.meaning}</text>
        </g>;
      })}
      <text x="450" y="1010" textAnchor="middle" fill="#AA9E8B" fontSize="16" letterSpacing={language === 'hi' ? 0 : 2}>{copy.states}</text>
    </g> : <g opacity={Math.max(0, 1 - quiet * 4)}>
      <path d={Array.from({length: 161}, (_, i) => {const x=110+i*4.25;const envelope=Math.sin(i/160*Math.PI);const y=900+Math.sin(i*.22-state.phase*15)*envelope*(40+10*oscillation)*rippleStrength; return `${i?'L':'M'}${x},${y}`;}).join(' ')} fill="none" stroke="#D9BC80" strokeWidth="3"/>
      <text x="450" y="1000" textAnchor="middle" fill="#B9AC92" fontSize="16" letterSpacing={language === 'hi' ? 0 : 3}>{copy.sound}</text>
    </g>}
    {quiet ? <g opacity={Math.max(0, (quiet - .35) / .65)}>
      <path d="M230 900H670" stroke="#C8B387" strokeWidth="1" opacity=".45"/>
      <circle cx="450" cy="900" r={4+Math.sin(p*Math.PI)*2} fill="#F0D69C"/>
      <text x="450" y="995" textAnchor="middle" fill="#E9D5B0" fontFamily={textFont} fontSize="34">{step.mode === 'reflect' ? copy.reflect : copy.silence}</text>
    </g> : null}
    <text x="450" y="1090" textAnchor="middle" fill="#948C80" fontSize="14" letterSpacing={language === 'hi' ? 0 : 2}>{copy.teaching}</text>
  </svg></div>;
};
