// Your Photos: your own pictures as a scene. Each drifts slowly (a gentle zoom and pan), takes on the time of day (cool
// and dark at night, warm at dawn and dusk), and gives way to the next every few minutes with a slow crossfade. Rain or
// snow is laid over it by the app in wet weather. The pictures are kept in this browser's storage, scaled down to at most
// 2048 pixels on the long side, and never leave the device.
import { W, H, ctx, requestRender } from '../view.js';
import { daylight } from '../daylight.js';
import { kvSet, kvAll, kvDel } from '../store.js';

let list = [];                       // [{ id, name, url }]
const bitmaps = new Map();           // id -> ImageBitmap
let loaded = false;
const listeners = new Set();
export const onPhotosChange = f => listeners.add(f);
const changed = () => listeners.forEach(f => f());

export async function loadPhotos() {
  const all = await kvAll('photo:');
  list = Object.entries(all).map(([k, v]) => ({ id: k.slice(6), name: v.name, at: v.at || 0, blob: v.blob })).sort((a, b) => a.at - b.at);
  for (const p of list) if (!p.url) p.url = URL.createObjectURL(p.blob);
  loaded = true; changed(); return list;
}
export const photos = () => list;
async function bitmap(p) {
  if (bitmaps.has(p.id)) return bitmaps.get(p.id);
  try { const b = await createImageBitmap(p.blob); bitmaps.set(p.id, b); return b; } catch (e) { return null; }
}
export async function addPhotos(files) {
  let n = 0;
  for (const f of files) {
    if (!(f.type || '').startsWith('image/')) continue;
    try {
      const src = await createImageBitmap(f), k = Math.min(1, 2048 / Math.max(src.width, src.height));
      const c = document.createElement('canvas'); c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); src.close();
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .86));
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await kvSet('photo:' + id, { blob, name: f.name, at: Date.now() }); n++;
    } catch (e) {}
  }
  await loadPhotos(); return n;
}
export async function removePhoto(id) {
  await kvDel('photo:' + id); const b = bitmaps.get(id); if (b) b.close(); bitmaps.delete(id);
  const p = list.find(x => x.id === id); if (p && p.url) URL.revokeObjectURL(p.url);
  await loadPhotos();
}

export function photosScene() {
  let idx = 0, shownAt = 0, cur = null, prev = null, fadeT = 1;
  const HOLD = 180;   // seconds on each picture
  async function show(i) {
    if (!list.length) return;
    idx = (i + list.length) % list.length;
    const b = await bitmap(list[idx]); if (!b) return;
    prev = cur; cur = { b, seed: Math.random() * 6.28 }; fadeT = prev ? 0 : 1; shownAt = performance.now() / 1000; requestRender();
  }
  const draw1 = (p, t, alpha) => {
    const { b, seed } = p, age = t - p.t0;
    const z = 1.08 + .08 * (.5 + .5 * Math.sin(age * .012 + seed)), s = Math.max(W / b.width, H / b.height) * z, w = b.width * s, h = b.height * s;
    const fx = .5 + .4 * Math.sin(age * .009 + seed * 2), fy = .5 + .4 * Math.sin(age * .007 + seed);
    ctx.globalAlpha = alpha; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(b, -(w - W) * fx, -(h - H) * fy, w, h); ctx.globalAlpha = 1;
  };
  return {
    kind: 'canvas',
    init() { if (!loaded) loadPhotos().then(() => show(0)); else if (!cur) show(0); },
    draw(t, dt) {
      ctx.fillStyle = '#06070b'; ctx.fillRect(0, 0, W, H);
      if (!list.length) {
        ctx.fillStyle = '#ece6da'; ctx.font = '15px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
        const lines = W < 520 ? ['Add your own photos under', 'Scene in the ⋯ sheet.'] : ['Add your own photos under Scene in the ⋯ sheet.'];
        lines.forEach((l, i) => ctx.fillText(l, W / 2, H * .45 + i * 22));
        ctx.fillStyle = '#b3ab9b'; ctx.font = '12px "IBM Plex Mono", monospace';
        ctx.fillText('They stay on this device.', W / 2, H * .45 + lines.length * 22 + 6); ctx.textAlign = 'start';
        return;
      }
      const now = performance.now() / 1000;
      if (cur && now - shownAt > HOLD && list.length > 1) show(idx + 1);
      if (cur && cur.t0 === undefined) cur.t0 = t;
      if (prev && prev.t0 === undefined) prev.t0 = t;
      fadeT = Math.min(1, fadeT + dt / 4);
      if (prev && fadeT < 1) draw1(prev, t, 1);
      if (cur) draw1(cur, t, fadeT);
      // The time of day: dark and cool at night, a warm wash at dawn and dusk.
      const d = daylight(), tw = 1 - Math.abs(d * 2 - 1);
      ctx.fillStyle = `rgba(8, 14, 38, ${.55 * (1 - d) * (1 - d)})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255, 150, 70, ${.35 * tw})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.4)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    },
    next() { show(idx + 1); },
  };
}
