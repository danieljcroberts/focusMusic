// Favourites and Drift: star the scenes you like; Drift moves between them every so often, preferring the ones that
// suit the hour, with the next scene's music starting a few seconds ahead of the switch.
import { SCENES } from './scenes/index.js';
import { state, saveState } from './state.js';
import { daylight } from './daylight.js';
import { follow, pickFor, playTrack } from './music.js';

const el = id => document.getElementById(id);
export const favs = new Set(state.favs || []);
let go = () => {}, current = () => 0, cards = [];
const favBtn = el('favBtn'), driftBtn = el('driftBtn');

export function drawFav() { const on = favs.has(SCENES[current()].name); favBtn.textContent = (on ? '★' : '☆') + ' Favourite'; favBtn.setAttribute('aria-pressed', String(on)); }
export function toggleFav() {
  const name = SCENES[current()].name;
  if (favs.has(name)) favs.delete(name); else favs.add(name);
  cards[current()].star.hidden = !favs.has(name); saveState({ favs: [...favs] }); drawFav();
}
favBtn.addEventListener('click', toggleFav);

export let drift = !!state.drift, driftMin = state.driftMin || 20;
let driftLast = performance.now(), driftPick = -1;
export function setDrift(v) { drift = v; driftBtn.setAttribute('aria-pressed', String(v)); saveState({ drift: v }); driftLast = performance.now(); }
driftBtn.addEventListener('click', () => setDrift(!drift));
const driftButtons = [...el('driftSeg').querySelectorAll('button')];
export function applyDriftMin(m) { driftMin = m; driftButtons.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.min === m))); saveState({ driftMin: m }); }
driftButtons.forEach(b => b.addEventListener('click', () => applyDriftMin(+b.dataset.min)));

function pickDrift() {
  const cur = current(), all = SCENES.map((s, i) => i).filter(i => i !== cur);
  const favPool = all.filter(i => favs.has(SCENES[i].name));
  const base = favPool.length ? favPool : all;
  const want = daylight() > .5 ? 'day' : 'night';
  const suited = base.filter(i => (SCENES[i].mood || 'any') === 'any' || SCENES[i].mood === want);
  const list = suited.length ? suited : base;
  return list[Math.floor(Math.random() * list.length)];
}
export function noteSceneChange() { driftLast = performance.now(); }
export function tickDrift(now) {
  if (!drift) return;
  const left = driftMin * 60000 - (now - driftLast);
  if (left < 3000 && driftPick < 0) {
    driftPick = pickDrift();
    const s = SCENES[driftPick], t = follow ? pickFor(s.music, s.tone) : null;
    if (t) playTrack(t);   // the music leads the scene by a few seconds
  }
  if (left <= 0) { const i = driftPick >= 0 ? driftPick : pickDrift(); driftPick = -1; go(i); }
}
export function initDrift(opts) {
  go = opts.go; current = opts.current; cards = opts.cards;
  setDrift(drift); applyDriftMin(driftMin); drawFav();
}
