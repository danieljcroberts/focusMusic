// Look around: tilting the phone, or moving the mouse on a computer, shifts layered scenes by depth, near layers more
// than far ones, as if looking out of a window. The phone's resting angle is learnt over a few seconds and counts as
// straight ahead, so holding it at any angle is fine and only leaning it looks around. Off with reduced motion, and
// under Settings in the sheet.
import { state, saveState } from './state.js';
import { still } from './view.js';

export let lookAround = typeof state.lookAround === 'boolean' ? state.lookAround : !still;
export function setLookAround(on) { lookAround = !!on; saveState({ lookAround }); if (!on) { want.x = 0; want.y = 0; } }

const want = { x: 0, y: 0 }, now = { x: 0, y: 0 };
let base = null, lastOrient = 0;
const clamp = v => Math.max(-1, Math.min(1, v));

window.addEventListener('deviceorientation', e => {
  if (e.gamma == null || e.beta == null) return;
  lastOrient = performance.now();
  // Left-right and front-back lean, turned to match the screen when the phone is on its side.
  const a = (screen.orientation && screen.orientation.angle) || 0;
  let lr = e.gamma, fb = e.beta;
  if (a === 90) [lr, fb] = [e.beta, -e.gamma]; else if (a === 270 || a === -90) [lr, fb] = [-e.beta, e.gamma]; else if (a === 180) [lr, fb] = [-e.gamma, -e.beta];
  if (!base) base = { lr, fb };
  base.lr += (lr - base.lr) * .01; base.fb += (fb - base.fb) * .01;   // the resting angle, learnt over a few seconds
  if (!lookAround) return;
  want.x = clamp((lr - base.lr) / 18); want.y = clamp((fb - base.fb) / 18);
});
window.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || !lookAround || performance.now() - lastOrient < 2000) return;
  want.x = clamp((e.clientX / innerWidth - .5) * 2); want.y = clamp((e.clientY / innerHeight - .5) * 2);
});
document.addEventListener('pointerleave', () => { want.x = 0; want.y = 0; });

// Called once a frame: eases toward where the phone or mouse points, and returns -1 to 1 on each axis.
export function tilt(dt = 1 / 60) {
  const k = Math.min(1, dt * 4);
  now.x += ((lookAround ? want.x : 0) - now.x) * k; now.y += ((lookAround ? want.y : 0) - now.y) * k;
  return now;
}
