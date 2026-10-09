// A film finish over every scene: fine moving grain, a soft vignette and a touch of warmth, so scenes drawn in code,
// pixel art, photographs and footage read as one family. Two fixed layers under the controls; off with one toggle.
import { still } from './view.js';
import { state, saveState } from './state.js';

const grain = document.createElement('div'), vignette = document.createElement('div');
grain.className = 'grain'; vignette.className = 'vignette';
grain.setAttribute('aria-hidden', 'true'); vignette.setAttribute('aria-hidden', 'true');
document.getElementById('dim').before(vignette, grain);

// A 128px tile of noise, drawn once.
const c = document.createElement('canvas'); c.width = c.height = 128;
const g = c.getContext('2d'), im = g.createImageData(128, 128);
for (let i = 0; i < im.data.length; i += 4) { const v = 96 + Math.random() * 64; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
g.putImageData(im, 0, 0);
grain.style.backgroundImage = `url(${c.toDataURL('image/png')})`;

export let finishOn = state.finish !== false;
let timer = null;
export function setFinish(on) {
  finishOn = on; saveState({ finish: on });
  grain.hidden = vignette.hidden = !on;
  clearInterval(timer);
  if (on && !still) timer = setInterval(() => { grain.style.backgroundPosition = `${Math.floor(Math.random() * 128)}px ${Math.floor(Math.random() * 128)}px`; }, 90);
}
setFinish(finishOn);
