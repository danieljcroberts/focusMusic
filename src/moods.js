// Starter moods: one tap sets the soundtrack, the scene, the ambience and the timer together, so the app is good from
// the first minute without knowing where everything lives. Offered on the first visit and at the top of the sheet.
import { setStatus } from './status.js';
import { musicPlaying, togglePlay, nextTrack } from './music.js';
import { setAmbienceLevel, startAmbience } from './ambience.js';
import * as ST from './soundtracks.js';

const el = id => document.getElementById(id);
const MOODS = {
  study: { name: 'Study', note: 'Ambient music, the library window in the rain, a 50-minute focus timer', soundtrack: 'ambient', scene: 'library', ambience: .3, timer: '50' },
  relax: { name: 'Relax', note: 'Downtempo electronic over the fjord at Holmestrand, a little wind', soundtrack: 'downtempo', scene: 'holmestrand', ambience: .25 },
  workout: { name: 'Workout', note: 'Hard techno, trance and drum and bass on a run through the woods, 25-minute rounds with short breaks', soundtrack: 'energy', scene: 'trailRun', ambience: .15, timer: '25' },
  sleep: { name: 'Sleep', note: 'Calm music, the night sky, the screen dimmed, stopping in 30 minutes', bedtime: true },
};
let go = () => {}, find = () => -1, syncAmb = () => {};
export function applyMood(k) {
  const m = MOODS[k]; if (!m) return;
  if (m.bedtime) { el('bedBtn').click(); return; }
  if (ST.byId(m.soundtrack)) ST.setCurrent(m.soundtrack);
  const i = find(m.scene); if (i >= 0) go(i);
  startAmbience(); setAmbienceLevel(m.ambience); syncAmb();
  if (m.timer) { const b = document.querySelector(`#tMenu button[data-f="${m.timer}"]`); if (b) b.click(); }
  if (!musicPlaying) togglePlay(); else nextTrack();
  setStatus(`${m.name}: ${m.note}.`);
}
// A row of three buttons, used in the first-visit card and at the top of the sheet.
export function moodButtons(onPick) {
  const row = document.createElement('div'); row.className = 'moods';
  for (const [k, m] of Object.entries(MOODS)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mood';
    const t = document.createElement('b'); t.textContent = m.name; const n = document.createElement('span'); n.textContent = m.note;
    b.append(t, n); b.addEventListener('click', () => { applyMood(k); if (onPick) onPick(k); }); row.append(b);
  }
  return row;
}
export function initMoods(o) {
  go = o.go; find = o.find; syncAmb = o.syncAmb;
  el('hint1Ok').before(moodButtons(() => el('hint1Ok').click()));
  const sheetBody = document.querySelector('#sheet .body'), lbl = document.createElement('span');
  lbl.className = 'lbl startwith'; lbl.textContent = 'Start with';
  sheetBody.prepend(lbl, moodButtons(() => el('sheetClose').click()));
}
