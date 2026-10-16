// Scene art and bundled music live under public/assets and are referenced by file name.
import { requestRender } from './view.js';
import { NATIVE, SITE } from './native.js';

export const A = 'assets/scenes/';
// The Android app leaves the bundled music out (to stay under Google Play's size limit) and streams it from the live site.
export const M = NATIVE ? SITE + 'assets/music/' : 'assets/music/';

const IMG = {};
export function img(src) {
  if (!IMG[src]) { const i = new Image(); i.decoding = 'async'; i.onload = requestRender; i.src = A + src; IMG[src] = i; }
  return IMG[src];
}
export const ok = i => i.complete && i.naturalWidth > 0;
