// Focus timer: a focus block, then a break that dims the scene; every fourth break is a long one. The break starts on
// its own, the next block waits for you. It survives a reload: a running block picks up where the clock says it should be.
import { state, saveState } from './state.js';
import { setStatus } from './status.js';
import { audioCtx, setDuck, setLockLine } from './music.js';
import { whenSheetOpens } from './sheet.js';

const el = id => document.getElementById(id);
const timer = { f: 25, b: 5, lb: 15, every: 4, count: 0, mode: 'focus', left: 25 * 60, running: false, last: 0 };
if (state.timer && state.timer.f) {
  const s = state.timer;
  Object.assign(timer, { f: s.f, b: s.b, lb: s.lb || 15, every: s.every || 4, count: s.count || 0, mode: s.mode || 'focus', left: s.left ?? s.f * 60, intent: s.intent || '', away: s.away || 0 });
  if (s.running && s.at) { timer.running = true; timer.left -= (Date.now() - s.at) / 1000; }
}
let sceneName = () => '';
const tBtn = el('tStart'), tMenu = el('tMenu');
const fmt = sec => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
function save() { saveState({ timer: { f: timer.f, b: timer.b, lb: timer.lb, every: timer.every, count: timer.count, mode: timer.mode, left: timer.left, running: timer.running, at: Date.now(), intent: timer.intent || '', away: timer.away || 0 } }); }
function draw() {
  const il = el('intentLine'); if (il) { il.textContent = timer.mode === 'focus' && timer.intent ? timer.intent : ''; il.hidden = !il.textContent; }
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
// What this block is for (optional), and how often the app was left while it ran.
export function setIntention(text) { timer.intent = String(text || '').trim().slice(0, 60); if (timer.intent) saveState({ lastIntent: timer.intent }); draw(); save(); }
export const intention = () => timer.intent || '';
document.addEventListener('visibilitychange', () => { if (document.hidden && timer.running && timer.mode === 'focus') { timer.away = (timer.away || 0) + 1; save(); } });
export function toggleTimer() {
  const fresh = !timer.running && timer.mode === 'focus' && timer.left >= timer.f * 60 - 1;
  timer.running = !timer.running; timer.last = performance.now();
  if (fresh) { timer.away = 0; timer.intent = ''; window.dispatchEvent(new CustomEvent('sw-focus-start')); }
  if (timer.running) { askNotify(); window.dispatchEvent(new CustomEvent('sw-timer', { detail: timer.mode === 'focus' ? 'focus' : 'break' })); }
  const c = audioCtx(); if (timer.running && c && c.state === 'suspended') c.resume().catch(() => {});
  draw(); save();
}
function reset(keepCount = false) { timer.mode = 'focus'; timer.left = timer.f * 60; timer.running = false; if (!keepCount) timer.count = 0; setDuck(false); draw(); save(); }
// Completed focus blocks, kept locally, summarised as a line in the sheet.
export function weekLine() {
  const log = state.sessions || [], week = Date.now() - 7 * 86400000, recent = log.filter(s => s.at > week);
  if (!recent.length) return 'No focus blocks this week yet.';
  const day = ts => new Date(ts).toDateString(), days = new Set(log.map(s => day(s.at)));
  // The streak forgives one rest day in any seven, and today doesn't count against it until it's over.
  let streak = 0, rest = -99;
  for (let i = 0; i < 400; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (days.has(d.toDateString())) streak++;
    else if (i === 0) continue;
    else if (i - rest >= 7) rest = i;
    else break;
  }
  return `${recent.length} block${recent.length === 1 ? '' : 's'} · ${recent.reduce((a, s) => a + s.min, 0)} min · ${streak} day streak`;
}
let lastSave = 0;
timer.last = performance.now();
setInterval(() => {
  if (!timer.running) return;
  const now = performance.now(); timer.left -= (now - timer.last) / 1000; timer.last = now;
  if (timer.left <= 0) {
    if (timer.mode === 'focus') {
      const log = (state.sessions || []).slice(-499); log.push({ at: Date.now(), min: timer.f, scene: sceneName(), intent: timer.intent || undefined }); saveState({ sessions: log });
      timer.count++;
      const long = timer.every > 0 && timer.count % timer.every === 0;
      timer.mode = long ? 'long' : 'break'; timer.left = (long ? timer.lb : timer.b) * 60;
      window.dispatchEvent(new CustomEvent('sw-timer', { detail: 'break' }));
      window.dispatchEvent(new CustomEvent('sw-block-done', { detail: { min: timer.f, scene: sceneName(), count: timer.count, break: long ? timer.lb : timer.b, away: timer.away || 0, intent: timer.intent || '' } }));
      chime(long ? [660, 880, 1100] : [660, 880]); setStatus(long ? `Focus block done. Long break: ${timer.lb} minutes.` : 'Focus block done. Break started.');
      notify('Focus block done', `${long ? 'Long break' : 'Break'} for ${long ? timer.lb : timer.b} minutes.`); setDuck(true);
    } else {
      timer.mode = 'focus'; timer.left = timer.f * 60; timer.running = false;
      window.dispatchEvent(new CustomEvent('sw-timer', { detail: 'focus' }));
      chime([660]); setStatus('Break over. Press the timer to start the next focus block.'); notify('Break over', 'Press the timer to start the next focus block.'); setDuck(false);
    }
    save();
  }
  if (now - lastSave > 10000) { lastSave = now; save(); }
  draw();
}, 250);
tBtn.addEventListener('click', toggleTimer);
whenSheetOpens(() => { el('tF').value = timer.f; el('tB').value = timer.b; el('tLB').value = timer.lb; el('tEvery').value = timer.every; });
tMenu.querySelectorAll('button[data-f]').forEach(b => b.addEventListener('click', () => {
  timer.f = +b.dataset.f; timer.b = +b.dataset.b; timer.lb = +b.dataset.lb; reset(true); drawPresets();
}));
const drawPresets = () => tMenu.querySelectorAll('button[data-f]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.f === timer.f && +b.dataset.b === timer.b)));
drawPresets();
el('tApply').addEventListener('click', () => {
  const n = (id, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(el(id).value) || 0)));
  timer.f = n('tF', 1, 180); timer.b = n('tB', 1, 60); timer.lb = n('tLB', 1, 90); timer.every = n('tEvery', 0, 12);
  reset(true); drawPresets();
});
el('tReset').addEventListener('click', () => reset());
window.addEventListener('pagehide', save);
export const timerRunning = () => timer.running;
export const focusRunning = () => timer.running && timer.mode === 'focus';
// What the week's focus went to: minutes per intention, largest first.
export function weekIntents() {
  const week = Date.now() - 7 * 86400000, by = {};
  for (const s of state.sessions || []) if (s.at > week) { const k = s.intent || 'Unlabelled'; by[k] = (by[k] || 0) + s.min; }
  return Object.entries(by).sort((a, b) => b[1] - a[1]);
}
// The last seven days as minutes per day, oldest first, for the chart in the sheet.
export function weekBars() {
  const log = state.sessions || [], out = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const day = d.toDateString(); out.push({ label: d.toLocaleDateString([], { weekday: 'narrow' }), min: log.filter(s => new Date(s.at).toDateString() === day).reduce((a, s) => a + s.min, 0) }); }
  return out;
}
export function initTimer(opts) { sceneName = opts.sceneName; setDuck(timer.mode !== 'focus'); draw(); }
