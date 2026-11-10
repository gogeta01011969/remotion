import {useId} from 'react';
import type {Actor, ActorState} from './schema';
import {sampleSymbol} from './story-symbols';

type StoryActor = Extract<Actor, {kind: 'symbolic-story'}>;
// Library illustration, selected by structured inputs; no topic-dependent JSX.
const Shiva = () => <g>
  <path d="M240 930Q225 850 310 790L390 720V650H510V720L590 790Q675 850 660 930Z" fill="#315B73"/>
  <path d="M280 880Q340 760 420 735M620 880Q560 760 480 735" stroke="#79ACBA" strokeWidth="3" fill="none"/>
  <path d="M330 555Q275 480 320 392Q324 332 395 330Q360 285 396 255Q440 225 490 252Q540 284 505 329Q580 337 581 408Q617 500 568 560L550 678Q526 711 508 670L385 680Q324 701 330 555Z" fill="#121525" stroke="#65718A" strokeWidth="3"/>
  <path d="M365 465Q365 405 450 397Q535 405 535 465L525 568Q513 623 450 653Q387 623 375 568Z" fill="#578699" stroke="#A0C5CA" strokeWidth="2"/>
  <path d="M359 463Q375 376 450 384Q536 382 543 463Q493 442 473 405Q430 456 359 463Z" fill="#151827"/>
  <path d="M397 509Q414 519 431 509M469 509Q486 519 503 509" fill="none" stroke="#1C3347" strokeWidth="5" strokeLinecap="round"/>
  <path d="M447 518L441 553H454M428 582Q450 590 472 582" fill="none" stroke="#294B60" strokeWidth="3" strokeLinecap="round"/>
  <path d="M416 463H484M419 473H481M423 483H477" stroke="#E9DFC3" strokeWidth="4" strokeLinecap="round"/>
  <ellipse cx="450" cy="473" rx="3" ry="11" fill="#E6B35F"/>
  <path d="M390 648Q450 685 510 648M385 665Q450 702 515 665" fill="none" stroke="#D8B979" strokeWidth="7" strokeDasharray="2 11" strokeLinecap="round"/>
  <path d="M330 422Q307 530 342 628M565 422Q594 526 563 628M380 354Q352 397 347 441M516 350Q545 393 554 436M394 280Q449 312 508 279M386 302Q448 330 516 302" stroke="#59617A" strokeWidth="3" fill="none"/>
  <path d="M315 834Q278 900 354 920L440 901M585 834Q622 900 546 920L460 901" stroke="#83AFBB" strokeWidth="29" fill="none" strokeLinecap="round"/>
  <path d="M292 930Q358 872 450 930Q542 872 608 930L630 956H270Z" fill="#92775B" stroke="#CFB684" strokeWidth="2"/>
  <path d="M230 915V468M230 520Q180 510 188 457M230 520Q280 510 272 457M230 468V435" stroke="#D1B67E" strokeWidth="5" fill="none" strokeLinecap="round"/>
</g>;

export const SymbolicStory = ({actor, state}: {actor: StoryActor; state: ActorState}) => {
  const uid = useId().replace(/:/g, '');
  const mask = `${uid}-moon`, light = `${uid}-light`, haze = `${uid}-haze`;
  const pose = sampleSymbol(actor.steps, state.phase);
  const index = Math.min(actor.steps.length - 1, Math.floor(state.phase));
  const step = actor.steps[index];
  const progress = Math.min(1, Math.max(0, state.phase - index));
  // Mask, rather than a translucent painted circle: background shows through.
  const Moon = ({x, y, r, fraction, opacity = 1, id}: {x: number; y: number; r: number; fraction: number; opacity?: number; id: string}) => <g opacity={opacity}>
    <defs><mask id={id}><circle cx={x} cy={y} r={r} fill="white"/><circle cx={x + r * fraction * 2} cy={y - r * 0.08} r={r * 0.98} fill="black"/></mask></defs>
    <circle cx={x} cy={y} r={r * 1.38} fill={`url(#${light})`} opacity="0.3"/>
    <g mask={`url(#${id})`}><circle cx={x} cy={y} r={r} fill="#F6EACD"/>
      <circle cx={x-r*.45} cy={y+r*.1} r={r*.23} fill="#C2BDAF" opacity=".4"/><circle cx={x-r*.25} cy={y-r*.52} r={r*.15} fill="#CBC4B6" opacity=".55"/>
      <circle cx={x-r*.6} cy={y-r*.3} r={r*.08} fill="#FFF9E7" opacity=".65"/>
    </g>
  </g>;
  return <div style={{width: 900, height: 1100}}><svg width="900" height="1100" viewBox="0 0 900 1100">
    <defs>
      <radialGradient id={light}><stop stopColor="#F6DFA8" stopOpacity=".7"/><stop offset="1" stopColor="#F6DFA8" stopOpacity="0"/></radialGradient>
      <radialGradient id={haze}><stop stopColor="#6686A5" stopOpacity=".25"/><stop offset="1" stopColor="#6686A5" stopOpacity="0"/></radialGradient>
    </defs>
    <text x="450" y="66" textAnchor="middle" fill="#F2E6CF" fontFamily="Georgia, serif" fontSize={Math.min(49, 770 / (step.heading.length * .56))}>{step.heading}</text>
    <path d="M335 103H565" stroke="#D8BA80" opacity=".5"/><path d="M444 103L450 97 456 103 450 109Z" fill="#D8BA80"/>
    <ellipse cx="450" cy="560" rx="400" ry="470" fill={`url(#${haze})`}/>
    <g fill="none" stroke="#D5B985" opacity={.1 + pose.guardian * .16}>
      <circle cx="450" cy="535" r="322"/><circle cx="450" cy="535" r="338" strokeDasharray="2 15"/>
      {Array.from({length: 16}, (_, i) => <path key={i} transform={`rotate(${i*22.5} 450 535)`} d="M450 200Q430 180 450 158Q470 180 450 200"/>)}
    </g>
    <g opacity=".28" fill="#35465D"><path d="M0 944L142 747 230 855 327 716 470 904 645 739 782 891 900 768V1000H0Z"/></g>
    <g opacity={pose.guardian}>
      {actor.guardian === 'shiva' ? <Shiva/> : actor.guardian === 'sanctuary' ? <g fill="none" stroke="#CDB47F" strokeWidth="5"><path d="M240 930V560Q240 320 450 270Q660 320 660 560V930M275 930V560Q275 370 450 315Q625 370 625 560V930M220 940H680"/></g> : null}
    </g>
    {actor.symbol === 'moon' ? <Moon x={pose.x} y={pose.y} r={pose.radius} fraction={pose.crescent} opacity={pose.light} id={mask}/> : actor.symbol === 'flame' ? <g transform={`translate(${pose.x} ${pose.y}) scale(${pose.radius/100})`} opacity={pose.light}><path d="M0-120Q100-20 50 70Q0 135-50 70Q-95 0-25-60Q-35 0 0 10Q35-25 0-120Z" fill="#E5B768"/><path d="M0-25Q45 45 0 90Q-40 50 0-25Z" fill="#FFF1BC"/></g> : <g transform={`translate(${pose.x} ${pose.y}) scale(${pose.radius/100})`} opacity={pose.light}>{[-50,-25,0,25,50].map((a,i)=><path key={i} transform={`rotate(${a} 0 65)`} d="M0 65Q-75-10 0-110Q75-10 0 65Z" fill={i%2?'#E5BDAC':'#C8919D'} stroke="#F4DCC8" strokeWidth="2"/>)}</g>}
    {step.action === 'renew' && actor.symbol === 'moon' ? <g opacity={progress}>
      {[.08,.3,.65,1,.65,.3,.08].map((f,i)=><Moon key={i} x={180+i*90} y={1040-Math.sin(i/6*Math.PI)*30} r={18} fraction={Math.min(1,f+Math.sin(progress*Math.PI)*.06)} opacity={.55+i%2*.3} id={`${mask}-${i}`}/>)}
    </g> : null}
    {step.action === 'approach' || step.action === 'protect' ? <path d={`M650 365Q590 ${280+progress*20} 505 350`} fill="none" stroke="#D8BA80" strokeWidth="2" strokeDasharray="3 12" opacity={Math.sin(progress*Math.PI)*.45}/> : null}
    <text x="450" y="1090" textAnchor="middle" fill="#BCA989" fontSize="15" letterSpacing="3">SYMBOLIC RETELLING</text>
  </svg></div>;
};
