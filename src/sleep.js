// Sleep timer: over the last ten minutes the scene slows and dims a little; over the last two it goes down with the music
// and the ambience as they fade; then it stays dark until the next tap or key.
import { setStatus } from './status.js';
import { fadeOutAll, setStopAtEnd } from './music.js';
import { setAmbienceMute } from './ambience.js';

let sleepAt = 0, winding = false;
const dim = document.getElementById('dim');
const buttons = [...document.getElementById('sleepSeg').querySelectorAll('button')];
export function setSleep(min) {
  const track = min === 'track';
  sleepAt = min && !track ? performance.now() + min * 60000 : 0; winding = false;
  setStopAtEnd(track);
  buttons.forEach(b => b.setAttribute('aria-pressed', String(track ? b.dataset.sleep === 'track' : +b.dataset.sleep === min)));
  dim.style.opacity = '';
  if (!min) { setAmbienceMute(false); document.body.classList.remove('sleep'); }
  else setStatus(track ? 'Stopping when this track ends.' : `Stopping in ${min} minutes.`);
}
buttons.forEach(b => b.addEventListener('click', () => setSleep(b.dataset.sleep === 'track' ? 'track' : +b.dataset.sleep)));
// The track the sleep timer was waiting on has ended: the scene dims as it does at the end of a timed sleep.
window.addEventListener('sw-track-ended-stop', () => { setAmbienceMute(true, 4); document.body.classList.add('sleep'); buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sleep === '0'))); setStatus('Stopped at the end of the track. Tap or press a key to wake the scene; press Play for music.'); });
// How dim the screen is, and how fast the scene moves, with `left` ms to go: a gentle slope over ten minutes, then steeper.
const dimFor = left => left > 120000 ? .15 * (1 - (left - 120000) / 480000) : .15 + .55 * (1 - left / 120000);
export function sleepPace(now = performance.now()) {
  if (!sleepAt) return 1;
  const left = sleepAt - now;
  return left > 600000 ? 1 : left > 120000 ? .7 + .3 * (left - 120000) / 480000 : Math.max(.3, .3 + .4 * left / 120000);
}
export function tickSleep(now) {
  if (!sleepAt) return;
  const left = sleepAt - now;
  if (!winding && left < 120000) { winding = true; fadeOutAll(110); setAmbienceMute(true, 110); setStatus('Winding down: the scene dims and the music fades over two minutes.'); }
  if (left > 0 && left < 600000) dim.style.opacity = dimFor(left).toFixed(3);   // the screen goes down with the music
  if (left <= 0) { sleepAt = 0; dim.style.opacity = ''; document.body.classList.add('sleep'); buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sleep === '0'))); setStatus('Stopped. Tap or press a key to wake the scene; press Play for music.'); }
}
// Any gesture after the stop wakes the scene; the music stays stopped until Play.
export function wakeFromSleep() {
  if (!document.body.classList.contains('sleep')) return;
  document.body.classList.remove('sleep'); dim.style.opacity = ''; setAmbienceMute(false);
}
