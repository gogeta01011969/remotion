import {AbsoluteFill,random} from 'remotion';
import {sizeEnvironmentPalette,type SizeEnvironment} from './size-environment';

// Context, not a backdrop photograph. Everything is local and frame-derived.
// A shared mask protects the header, measurement block and short-note regions.
export const ComparisonBackground=({preset,frame,fps,seed}:{preset:SizeEnvironment;frame:number;fps:number;seed:number})=>{
  const palette=sizeEnvironmentPalette[preset],time=frame/fps;
  return <AbsoluteFill style={{background:`radial-gradient(ellipse at 48% 45%, ${palette.glow}, ${palette.background} 72%)`,pointerEvents:'none'}}>
    <svg data-comparison-background={preset} width="1080" height="1920" style={{position:'absolute',inset:0}} aria-hidden="true">
      <defs>
        <linearGradient id="comparison-details" x1="0" y1="0" x2="0" y2="1920" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#000"/><stop offset=".22" stopColor="#000"/><stop offset=".29" stopColor="#FFF"/><stop offset=".57" stopColor="#FFF"/><stop offset=".66" stopColor="#181818"/><stop offset=".85" stopColor="#080808"/><stop offset="1" stopColor="#000"/>
        </linearGradient>
        <mask id="comparison-quiet-zones"><rect width="1080" height="1920" fill="url(#comparison-details)"/></mask>
        <radialGradient id="comparison-nebula"><stop stopColor="#4D527A" stopOpacity=".22"/><stop offset="1" stopColor="#4D527A" stopOpacity="0"/></radialGradient>
        <radialGradient id="comparison-arena-light"><stop stopColor="#D6E9DF" stopOpacity=".55"/><stop offset=".12" stopColor="#BCDAD0" stopOpacity=".13"/><stop offset="1" stopColor="#A8D6C5" stopOpacity="0"/></radialGradient>
        <linearGradient id="comparison-floor" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#254F3C" stopOpacity="0"/><stop offset=".3" stopColor="#254F3C" stopOpacity=".36"/><stop offset="1" stopColor="#06130E" stopOpacity="0"/></linearGradient>
        <linearGradient id="comparison-atmosphere" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#76B3DA" stopOpacity="0"/><stop offset=".66" stopColor="#76B3DA" stopOpacity=".16"/><stop offset="1" stopColor="#76B3DA" stopOpacity="0"/></linearGradient>
      </defs>
      <g mask="url(#comparison-quiet-zones)">
        {preset==='space'?<>
          <ellipse cx="850" cy="770" rx="610" ry="390" fill="url(#comparison-nebula)" transform="rotate(-28 850 770)"/>
          {Array.from({length:110},(_,i)=><circle key={i} cx={random(`${seed}-space-x-${i}`)*1080} cy={random(`${seed}-space-y-${i}`)*1920} r={.5+random(`${seed}-space-r-${i}`)*1.25} fill="#DCEBFA" opacity={.13+random(`${seed}-space-o-${i}`)*.22+Math.sin(time*.3+i)*.035}/>)}
          <g fill="none" stroke="#7F9FBB" strokeWidth="1" opacity=".12"><ellipse cx="540" cy="1080" rx="790" ry="240" transform="rotate(-22 540 1080)"/><ellipse cx="540" cy="1080" rx="980" ry="300" transform="rotate(-22 540 1080)"/></g>
        </>:preset==='sky'?<>
          <ellipse cx="540" cy="1120" rx="920" ry="500" fill="url(#comparison-atmosphere)"/>
          {[{x:-40,y:720,s:1.3},{x:820,y:850,s:1.7},{x:180,y:1030,s:.9},{x:940,y:620,s:1}].map((cloud,i)=><g key={i} transform={`translate(${cloud.x+Math.sin(time*.035+i)*18} ${cloud.y}) scale(${cloud.s})`} fill="#ABC7DC" opacity=".13">
            <path d="M-100 40Q-120 0-70-4Q-52-65-4-42Q38-96 79-39Q130-48 146-5Q212-2 205 40Z"/>
            <path d="M-150 57Q0 38 240 57" fill="none" stroke="#D5E2EE" strokeWidth="2" opacity=".4"/>
          </g>)}
          <path d="M-80 1050Q540 995 1160 1050" fill="none" stroke="#96B5D5" strokeOpacity=".15"/>
          <path d="M50 1130Q500 470 1120 760" fill="none" stroke="#B3D4E9" strokeOpacity=".12" strokeDasharray="6 18"/>
        </>:preset==='water'?<>
          <path d="M0 865Q540 850 1080 865V1450H0Z" fill="#286478" opacity=".11"/>
          <path d="M0 865Q540 850 1080 865" fill="none" stroke="#A2C8D2" strokeOpacity=".25"/>
          {Array.from({length:8},(_,i)=>{
            const y=925+i*48,phase=Math.sin(time*.22+i)*18;
            return <path key={i} d={`M-100 ${y}Q${130+phase} ${y-20} 350 ${y}T800 ${y}T1250 ${y}`} fill="none" stroke="#94BFCA" strokeWidth={i%3===0?2:1} strokeOpacity={.08+(i%3)*.025}/>;
          })}
          <ellipse cx="540" cy="1010" rx="360" ry="170" fill="#A1D0DA" opacity=".035"/>
        </>:preset==='storage'?<>
          {[45,790].map((x,i)=><g key={i} transform={`translate(${x} 720)`} stroke="#9CAFC4" strokeWidth="3" strokeOpacity=".15" fill="none">
            <path d="M0 0V530M220 0V530M0 105H220M0 275H220M0 445H220"/>
            {[0,1,2].map(row=><g key={row} transform={`translate(14 ${15+row*170})`}>
              <rect width="78" height="88" fill="#6F8AA1" fillOpacity=".09"/>
              <rect x="102" width="88" height="88" fill="#8B9EAF" fillOpacity=".08"/>
              <path d="M15 0V88M31 0V88M47 0V88M63 0V88M120 0V88M140 0V88M160 0V88M180 0V88" strokeWidth="1"/>
            </g>)}
          </g>)}
          <path d="M-50 1430L540 1060L1130 1430M0 1240H1080" fill="none" stroke="#95A6BA" strokeOpacity=".1"/>
        </>:preset==='laboratory'?<>
          <g stroke="#A0C2DA" fill="none">
            <circle cx="540" cy="950" r="420" strokeWidth="2" strokeOpacity=".1"/>
            <circle cx="540" cy="950" r="440" strokeOpacity=".06"/>
            {Array.from({length:18},(_,i)=>{
              const x=45+random(`${seed}-specimen-x-${i}`)*990,y=600+random(`${seed}-specimen-y-${i}`)*650,r=8+random(`${seed}-specimen-r-${i}`)*24;
              return <g key={i} transform={`translate(${x+Math.sin(time*.08+i)*5} ${y})`} opacity=".13"><ellipse rx={r} ry={r*.7}/><circle r="3" fill="#9ABBCB" fillOpacity=".4"/></g>;
            })}
          </g>
          <path d="M60 700H95M77 683V718M970 1110H1005M988 1093V1128" stroke="#8EAABF" strokeOpacity=".22"/>
        </>:preset==='sports'?<>
          <rect y="1080" width="1080" height="650" fill="url(#comparison-floor)"/>
          <ellipse cx="20" cy="590" rx="270" ry="210" fill="url(#comparison-arena-light)"/>
          <ellipse cx="1060" cy="590" rx="270" ry="210" fill="url(#comparison-arena-light)"/>
          <g fill="#D9E8DF" opacity=".26">{[0,1].map(side=><g key={side} transform={`translate(${side?990:12} 550)`}>{Array.from({length:8},(_,i)=><rect key={i} x={i%4*18} y={Math.floor(i/4)*15} width="10" height="7" rx="3"/>)}</g>)}</g>
          <g fill="none" stroke="#9CBAA8" strokeWidth="2" opacity=".13">
            <path d="M540 1065L-250 1600M540 1065L1330 1600M-100 1180H1180M-100 1370H1180"/>
            <ellipse cx="540" cy="1230" rx="290" ry="70"/>
          </g>
          <path d="M-70 605L220 1080H470Z M1150 605L860 1080H610Z" fill="#ABCBB9" opacity=".025"/>
        </>:preset==='nature'?<>
          <path d="M-100 1100Q150 700 430 1080Q740 690 1180 1080V1550H-100Z" fill="#4B8062" opacity=".09"/>
          <ellipse cx="540" cy="1000" rx="800" ry="220" fill="#81B19A" opacity=".025"/>
          {[{x:60,h:280},{x:200,h:210},{x:900,h:240},{x:1035,h:340}].map((tree,i)=><g key={i} transform={`translate(${tree.x} 1150)`} fill="#77A18A" opacity=".13">
            <path d={`M-5 0V${-tree.h}H5V0Z`}/><ellipse cx="0" cy={-tree.h*.65} rx={tree.h*.24} ry={tree.h*.38}/>
          </g>)}
        </>:preset==='architecture'||preset==='transport'||preset==='geography'?<>
          <g fill="none" stroke="#82AFC5" strokeOpacity=".10" strokeWidth="1">
            {Array.from({length:12},(_,i)=><path key={i} d={`M${i*100-10} 500V1400 M-20 ${540+i*80}H1100`}/>)}
            {preset==='architecture'?<>
              <path d="M0 1150V975H65V890H105V1150H145V820H180V755H210V820H245V1150H800V920H850V810H880V740H905V810H940V1150H990V970H1040V900H1080V1150Z" fill="#91ACC0" fillOpacity=".14" strokeOpacity=".7"/>
              <path d="M145 895H245M145 955H245M850 890H940M850 950H940" strokeOpacity=".8"/>
            </>:preset==='transport'?<>
              <path d="M-100 1400L540 850L1180 1400M-100 1200H1180"/>
              <path d="M380 1400L540 850L700 1400" strokeDasharray="20 30" strokeOpacity=".9"/>
            </>:<>
              <ellipse cx="540" cy="940" rx="690" ry="360"/>
              {[.3,.6,.85].map(r=><ellipse key={r} cx="540" cy="940" rx={690*r} ry="360"/>)}
              {[-.65,-.3,0,.3,.65].map(r=><ellipse key={r} cx="540" cy={940+r*300} rx={690*Math.sqrt(1-r*r)} ry={65*(1-r*r)}/>) }
            </>}
          </g>
        </>:<>
          <ellipse cx="540" cy="1120" rx="690" ry="210" fill="#809BB4" opacity=".025"/>
          <path d="M0 1100H1080" stroke="#90A4B8" strokeOpacity=".1"/>
        </>}
      </g>
    </svg>
    <AbsoluteFill style={{background:'linear-gradient(90deg, #00000022, transparent 20%, transparent 80%, #00000044)'}}/>
  </AbsoluteFill>;
};
