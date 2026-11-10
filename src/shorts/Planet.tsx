import {useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';

// Orthographic texture projection; every pixel is determined by the input angle.
// A small offscreen sphere is scaled up smoothly to keep local renders fast.
const size = 640;
const radius = size / 2;
const surface = Array.from({length: size * size}, (_, i) => {
  const x = (i % size + 0.5 - radius) / radius;
  const y = (Math.floor(i / size) + 0.5 - radius) / radius;
  const r2 = x * x + y * y;
  if (r2 > 1) return null;
  const z = Math.sqrt(1 - r2);
  return {longitude: Math.atan2(x, z), v: Math.acos(-y) / Math.PI, light: Math.max(0.025, -x * 0.55 - y * 0.35 + z * 0.72), edge: Math.pow(1 - z, 3)};
});

export const Planet = ({angle, diameter = 780}: {angle: number; diameter?: number}) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const released = useRef(false);
  const [texture, setTexture] = useState<ImageData | null>(null);
  const [handle] = useState(() => delayRender('Loading local NASA Earth texture'));
  useLayoutEffect(() => {
    const img = new Image();
    img.onload = () => {
      const tmp = document.createElement('canvas');
      tmp.width = img.width; tmp.height = img.height;
      const ctx = tmp.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      setTexture(ctx.getImageData(0, 0, img.width, img.height));
    };
    img.onerror = () => cancelRender(new Error('Missing public/assets/earth.jpg'));
    img.src = staticFile('assets/earth.jpg');
  }, []);
  useLayoutEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !texture) return;
    const output = ctx.createImageData(size, size);
    surface.forEach((p, i) => {
      if (!p) return;
      const u = ((p.longitude / (2 * Math.PI) + 0.5 + angle / (2 * Math.PI)) % 1 + 1) % 1;
      const source = (Math.min(texture.height - 1, Math.floor(p.v * texture.height)) * texture.width + Math.floor(u * texture.width)) * 4;
      const dest = i * 4;
      output.data[dest] = texture.data[source] * p.light + p.edge * 15;
      output.data[dest + 1] = texture.data[source + 1] * p.light + p.edge * 70;
      output.data[dest + 2] = texture.data[source + 2] * p.light + p.edge * 110;
      output.data[dest + 3] = 255;
    });
    ctx.putImageData(output, 0, 0);
    if (!released.current) { continueRender(handle); released.current = true; }
  }, [angle, texture, handle]);
  return <div style={{width: diameter, height: diameter, borderRadius: '50%', boxShadow: '0 0 35px #3B9DFF55, 0 0 100px #267DFF22', position: 'relative'}}>
    <canvas ref={canvas} width={size} height={size} style={{width: '100%', height: '100%', borderRadius: '50%'}}/>
    <div style={{position: 'absolute', inset: -2, borderRadius: '50%', border: '2px solid #8DE7FF50'}}/>
  </div>;
};
