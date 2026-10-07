// A looping video as a scene. The file and its poster live in public/assets/scenes.
import { A } from '../assets.js';
import { addStage } from './glass-shared.js';

export function videoScene({ src, poster = '' }) {
  let v;
  return {
    kind: 'video',
    get canvas() { return v; },
    init() {
      if (v) return;
      v = document.createElement('video');
      Object.assign(v, { muted: true, loop: true, playsInline: true, preload: 'auto' });
      if (poster) v.poster = A + poster;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.src = A + src;
      addStage(v);
    },
    draw() {}
  };
}
