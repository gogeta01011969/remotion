import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
let fontPromise: Promise<void> | undefined;
export function useDevanagariFont(enabled: boolean) {
  const [handle] = useState(() => delayRender('Loading local typography'));
  useEffect(() => {
    if (!enabled) {continueRender(handle); return;}
    fontPromise ??= new FontFace('SacredDevanagari', `url(${staticFile('assets/fonts/NotoSansDevanagari-Regular.ttf')})`).load().then(font => {(document.fonts as FontFaceSet & Set<FontFace>).add(font);});
    fontPromise.then(() => continueRender(handle)).catch(cancelRender);
  }, [enabled, handle]);
}
