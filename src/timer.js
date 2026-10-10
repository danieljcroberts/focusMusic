// Focus timer: a focus block, then a break that dims the scene; every fourth break is a long one. The break starts on
// its own, the next block waits for you. It survives a reload: a running block picks up where the clock says it should be.
import { state, saveState } from './state.js';
import { setStatus } from './status.js';
import { audioCtx, setDuck, setLockLine } from './music.js';
import { registerMenu, closeMenus } from './menus.js';

const el = id => document.getElementById(id);
const timer = { f: 25, b: 5, lb: 15, every: 4, count: 0, mode: 'focus', left: 25 * 60, running: false, last: 0 };
if (state.timer && state.timer.f) {
  const s = state.timer;
  Object.assign(timer, { f: s.f, b: s.b, lb: s.lb || 15, every: s.every || 4, count: s.count || 0, mode: s.mode || 'focus', left: s.left ?? s.f * 60 });
  if (s.running && s.at) { timer.running = true; timer.left -= (Date.now() - s.at) / 1000; }
}
let sceneName = () => '';
const tBtn = el('tStart'), tMore = el('tMore'), tMenu = el('tMenu');
const fmt = sec => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
function save() { saveState({ timer: { f: timer.f, b: timer.b, lb: timer.lb, every: timer.every, count: timer.count, mode: timer.mode, left: timer.left, running: timer.running, at: Date.now() } }); }
function draw() {
  const label = timer.mode === 'focus' ? 'Focus' : timer.mode === 'long' ? 'Long break' : 'Break';
  tBtn.textContent = `${label} ${fmt(Math.max(0, timer.left))}`;
  tBtn.setAttribute('aria-pressed', String(timer.running));
  document.body.classList.toggle('break', timer.mode !== 'focus');
  el('tCount').textContent = timer.count ? `${timer.count} block${timer.count === 1 ? '' : 's'} today` : '';
  // The ring in the corner while the controls are hidden, and a line on the lock screen.
  const total = (timer.mode === 'focus' ? timer.f : timer.mode === 'long' ? timer.lb : timer.b) * 60;
  const active = timer.running || timer.mode !== 'focus';
  ring.toggleAttribute('hidden', !active); ring.classList.toggle('break', timer.mode !== 'focus');
  ringFill.style.strokeDashoffset = String(100 * Math.max(0, Math.min(1, timer.left / total)));
  setLockLine(active ? `${label} · ${Math.ceil(Math.max(0, timer.left) / 60)} min left` : '');
}
const ring = el('ring'), ringFill = el('ringFill');
function chime(notes) {
  const c = audioCtx(); if (!c) return;
  try {
    notes.forEach((freq, i) => {
      const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + i * .22;
      o.type = 'sine'; o.frequency.value = freq; o.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.16, t0 + .02); g.gain.exponentialRampToValueAtTime(.001, t0 + .6);
      o.start(t0); o.stop(t0 + .65);
    });
  } catch (e) {}
}
// A system notification when a block ends while the page is in the background. Asked for once, when the timer first starts.
function askNotify() { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); }
async function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) await reg.showNotification(title, { body, icon: './icon-512.png', tag: 'timer' });   // required on Android
    else new Notification(title, { body, icon: './icon-512.png', tag: 'timer' });
  } catch (e) {}
}
export function toggleTimer() {
  timer.running = !timer.running; timer.last = performance.now();
  if (timer.running) askNotify();
  const c = audioCtx(); if (timer.running && c && c.state === 'suspended') c.resume().catch(() => {});
  draw(); save();
}
function reset(keepCount = false) { timer.mode = 'focus'; timer.left = timer.f * 60; timer.running = false; if (!keepCount) timer.count = 0; setDuck(false); draw(); save(); }
// Completed focus blocks, kept locally, summarised as a line in Settings.
export function weekLine() {
  const log = state.sessions || [], week = Date.now() - 7 * 86400000, recent = log.filter(s => s.at > week);
  if (!recent.length) return 'No focus blocks this week yet.';
  const day = ts => new Date(ts).toDateString(), days = new Set(log.map(s => day(s.at)));
  let streak = 0; for (let d = new Date(); days.has(d.toDateString()); d.setDate(d.getDate() - 1)) streak++;
  if (!streak && days.has(day(Date.now() - 86400000))) { streak = 1; for (let d = new Date(Date.now() - 86400000); days.has(d.toDateString()); d.setDate(d.getDate() - 1)) streak++; }
  return `${recent.length} block${recent.length === 1 ? '' : 's'} · ${recent.reduce((a, s) => a + s.min, 0)} min · ${streak} day streak`;
}
let lastSave = 0;
timer.last = performance.now();
setInterval(() => {
  if (!timer.running) return;
  const now = performance.now(); timer.left -= (now - timer.last) / 1000; timer.last = now;
  if (timer.left <= 0) {
    if (timer.mode === 'focus') {
      const log = (state.sessions || []).slice(-499); log.push({ at: Date.now(), min: timer.f, scene: sceneName() }); saveState({ sessions: log });
      timer.count++;
      const long = timer.every > 0 && timer.count % timer.every === 0;
      timer.mode = long ? 'long' : 'break'; timer.left = (long ? timer.lb : timer.b) * 60;
      chime(long ? [660, 880, 1100] : [660, 880]); setStatus(long ? `Focus block done. Long break: ${timer.lb} minutes.` : 'Focus block done. Break started.');
      notify('Focus block done', `${long ? 'Long break' : 'Break'} for ${long ? timer.lb : timer.b} minutes.`); setDuck(true);
    } else {
      timer.mode = 'focus'; timer.left = timer.f * 60; timer.running = false;
      chime([660]); setStatus('Break over. Press the timer to start the next focus block.'); notify('Break over', 'Press the timer to start the next focus block.'); setDuck(false);
    }
    save();
  }
  if (now - lastSave > 10000) { lastSave = now; save(); }
  draw();
}, 250);
tBtn.addEventListener('click', toggleTimer);
registerMenu(tMore, tMenu, () => { el('tF').value = timer.f; el('tB').value = timer.b; el('tLB').value = timer.lb; el('tEvery').value = timer.every; });
tMenu.querySelectorAll('button[data-f]').forEach(b => b.addEventListener('click', () => {
  timer.f = +b.dataset.f; timer.b = +b.dataset.b; timer.lb = +b.dataset.lb; reset(true); closeMenus();
}));
el('tApply').addEventListener('click', () => {
  const n = (id, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(el(id).value) || 0)));
  timer.f = n('tF', 1, 180); timer.b = n('tB', 1, 60); timer.lb = n('tLB', 1, 90); timer.every = n('tEvery', 0, 12);
  reset(true); closeMenus();
});
el('tReset').addEventListener('click', () => { reset(); closeMenus(); });
window.addEventListener('pagehide', save);
// Presets set the durations without touching the count.
export const timerDurations = () => ({ f: timer.f, b: timer.b, lb: timer.lb, every: timer.every });
export function setTimerDurations(d) { Object.assign(timer, { f: d.f, b: d.b, lb: d.lb, every: d.every }); if (!timer.running) { timer.mode = 'focus'; timer.left = timer.f * 60; } draw(); save(); }
export const timerRunning = () => timer.running;
export function initTimer(opts) { sceneName = opts.sceneName; setDuck(timer.mode !== 'focus'); draw(); }
