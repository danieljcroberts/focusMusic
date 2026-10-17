// Listen only: a black screen with a dim clock and the track's name, for long sessions and nights. The scene stops
// drawing (almost no power on OLED screens), the screen is allowed to sleep as usual, and music and ambience carry on.
// The clock moves a little every minute so nothing stays lit in one place. A tap or a key brings the scene back.
import { currentTrack } from './music.js';

const el = id => document.getElementById(id);
const box = el('listen'), clock = el('listenClock'), line = el('listenTrack');
export let listening = false;
let tick = null;
function draw() {
  const now = new Date(), ct = currentTrack();
  clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  line.textContent = ct ? `${ct.t} — ${ct.a}` : '';
  const m = now.getHours() * 60 + now.getMinutes();
  box.style.setProperty('--lx', `${30 + 40 * (.5 + .5 * Math.sin(m * .7))}%`);
  box.style.setProperty('--ly', `${30 + 40 * (.5 + .5 * Math.cos(m * .53))}%`);
}
export function setListening(on) {
  if (on === listening) return;
  listening = on; box.hidden = !on; document.body.classList.toggle('listening', on);
  clearInterval(tick); if (on) { draw(); tick = setInterval(draw, 15000); }
  window.dispatchEvent(new CustomEvent('sw-listening', { detail: on }));
}
box.addEventListener('click', () => setListening(false));
window.addEventListener('keydown', e => { if (listening && !e.metaKey && !e.ctrlKey) { e.stopImmediatePropagation(); setListening(false); } }, true);
