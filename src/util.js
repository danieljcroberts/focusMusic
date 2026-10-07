import { W, DPR } from './view.js';

export const rand = (a, b) => a + Math.random() * (b - a);
export const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
export const mix = (a, b, p) => a.map((v, i) => Math.round(v + (b[i] - v) * p));
export const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// An offscreen canvas at the current pixel ratio, with its context scaled to CSS pixels.
export function layer(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * DPR); c.height = Math.ceil(h * DPR);
  const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  return [c, g];
}
// An offscreen canvas in device pixels, for simulation buffers that scale themselves.
export function plain(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return [c, c.getContext('2d')];
}
export function glow(g, x, y, r, c, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgb(c, a)); gr.addColorStop(1, rgb(c, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}
export function stars(g, n, maxY) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(235,240,255,${rand(.15, .8)})`;
    const r = Math.random() < .08 ? rand(1, 1.6) : rand(.3, .9);
    g.beginPath(); g.arc(rand(0, W), rand(0, maxY), r, 0, Math.PI * 2); g.fill();
  }
}
// Erase a rounded stroke from a buffer: a drop clearing mist or sweeping up droplets.
// `scale` maps CSS pixels to the buffer's pixels.
export function wipe(g, scale, x0, y0, x1, y1, w, a) {
  g.globalCompositeOperation = 'destination-out'; g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = w * scale; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0 * scale, y0 * scale); g.lineTo(x1 * scale, y1 * scale); g.stroke(); g.globalCompositeOperation = 'source-over';
}
