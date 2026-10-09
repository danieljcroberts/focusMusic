// Sleep timer: music and ambience fade over the last two minutes, then the scene dims until the next tap or key.
import { setStatus } from './status.js';
import { fadeOutAll } from './music.js';
import { setAmbienceMute } from './ambience.js';

let sleepAt = 0, winding = false;
const buttons = [...document.getElementById('sleepSeg').querySelectorAll('button')];
export function setSleep(min) {
  sleepAt = min ? performance.now() + min * 60000 : 0; winding = false;
  buttons.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.sleep === min)));
  if (!min) { setAmbienceMute(false); document.body.classList.remove('sleep'); }
  else setStatus(`Stopping in ${min} minutes.`);
}
buttons.forEach(b => b.addEventListener('click', () => setSleep(+b.dataset.sleep)));
export function tickSleep(now) {
  if (!sleepAt) return;
  const left = sleepAt - now;
  if (!winding && left < 120000) { winding = true; fadeOutAll(110); setAmbienceMute(true, 110); setStatus('Winding down: the music fades over two minutes.'); }
  if (left <= 0) { sleepAt = 0; document.body.classList.add('sleep'); buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sleep === '0'))); setStatus('Stopped. Tap or press a key to wake the scene; press Play for music.'); }
}
// Any gesture after the stop wakes the scene; the music stays stopped until Play.
export function wakeFromSleep() {
  if (!document.body.classList.contains('sleep')) return;
  document.body.classList.remove('sleep'); setAmbienceMute(false);
}
