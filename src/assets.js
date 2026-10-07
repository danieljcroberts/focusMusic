// Scene art and bundled music live under public/assets and are referenced by file name.
export const A = 'assets/scenes/';
export const M = 'assets/music/';

const IMG = {};
export function img(src) {
  if (!IMG[src]) { const i = new Image(); i.decoding = 'async'; i.src = A + src; IMG[src] = i; }
  return IMG[src];
}
export const ok = i => i.complete && i.naturalWidth > 0;
