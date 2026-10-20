// Interval training: work and rest in rounds (for example 40 s on, 20 s off, eight times), apart from the focus timer.
// A pill at the top shows the phase, the seconds left and the round; each change is marked by a chime, a buzz, and a
// soft glow around the edge of the screen (never a flash). In the rests the music drops to a third, and comes back up
// for the work. The Workout soundtrack is chosen when a session starts, if it isn't playing already.
import { state, saveState } from './state.js';
import { audioCtx, setDuck, musicPlaying, togglePlay } from './music.js';
import * as ST from './soundtracks.js';
import { setStatus } from './status.js';

const el = id => document.getElementById(id);
const pill = el('ivPill'), glow = el('ivGlow');
let cfg = { work: 40, rest: 20, rounds: 8, ...(state.intervals || {}) };
let run = null;   // { phase: 'ready' | 'work' | 'rest', left, round }
const fmt = s => { const c = Math.ceil(s); return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`; };
function tone(freqs, gain = .18) {
  const c = audioCtx(); if (!c) return;
  freqs.forEach((f, i) => {
    const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + i * .14;
    o.type = 'triangle'; o.frequency.value = f; o.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + .01); g.gain.exponentialRampToValueAtTime(.001, t0 + .35);
    o.start(t0); o.stop(t0 + .4);
  });
}
function mark(phase) {
  glow.className = 'ivglow ' + phase; glow.hidden = false; void glow.offsetWidth; glow.classList.add('on');
  setTimeout(() => glow.classList.remove('on'), 900);
  if (navigator.vibrate) navigator.vibrate(phase === 'work' ? [80, 60, 80] : [160]);
  tone(phase === 'work' ? [880, 1175, 1568] : phase === 'rest' ? [660, 440] : [523, 784, 1047, 1568]);
}
function draw() {
  pill.hidden = !run;
  if (!run) return;
  const label = run.phase === 'ready' ? 'Get ready' : run.phase === 'work' ? 'Work' : 'Rest';
  pill.className = 'ivpill ' + run.phase;
  pill.innerHTML = '';
  const b = document.createElement('b'); b.textContent = `${label} ${fmt(Math.max(0, run.left))}`;
  const s = document.createElement('span'); s.textContent = `${Math.max(1, run.round)} of ${cfg.rounds}`;
  pill.append(b, s);
}
function next() {
  if (run.phase === 'ready' || run.phase === 'rest') {
    if (run.phase === 'rest' && run.round >= cfg.rounds) return finish();
    run.round += 1; run.phase = 'work'; run.left = cfg.work; setDuck(false);
  } else if (run.round >= cfg.rounds) return finish();
  else { run.phase = 'rest'; run.left = cfg.rest; setDuck(true); }
  mark(run.phase); draw();
}
function finish() {
  run = null; setDuck(false); mark('done'); draw(); drawButtons();
  setStatus(`Intervals done: ${cfg.rounds} rounds of ${cfg.work} s. Well done.`);
}
let last = 0;
setInterval(() => {
  if (!run) return;
  const now = performance.now(), dt = Math.min(1, (now - last) / 1000); last = now;
  const before = run.left; run.left -= dt;
  if (run.left <= 3 && Math.ceil(before) !== Math.ceil(run.left) && run.left > 0) tone([run.phase === 'rest' ? 520 : 440], .1);   // the last three seconds tick
  if (run.left <= 0) next(); else draw();
}, 200);
export function startIntervals() {
  if (run) return stopIntervals();
  if (ST.current().id !== 'energy' && ST.byId('energy')) ST.setCurrent('energy');
  if (!musicPlaying) togglePlay();
  run = { phase: 'ready', left: 5, round: 0 }; last = performance.now();
  const c = audioCtx(); if (c && c.state === 'suspended') c.resume().catch(() => {});
  draw(); drawButtons(); setStatus(`Intervals: ${cfg.work} s on, ${cfg.rest} s off, ${cfg.rounds} rounds. Starting in five.`);
}
export function stopIntervals() { run = null; setDuck(false); draw(); drawButtons(); setStatus('Intervals stopped.'); }
export const intervalsRunning = () => !!run;
function drawButtons() {
  el('ivGo').textContent = run ? 'Stop intervals' : 'Start intervals';
  el('ivGo').setAttribute('aria-pressed', String(!!run));
  el('ivSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.w === cfg.work && +b.dataset.r === cfg.rest && +b.dataset.n === cfg.rounds)));
  el('ivW').value = cfg.work; el('ivR').value = cfg.rest; el('ivN').value = cfg.rounds;
}
const setCfg = c => { cfg = c; saveState({ intervals: cfg }); drawButtons(); };
el('ivSeg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => setCfg({ work: +b.dataset.w, rest: +b.dataset.r, rounds: +b.dataset.n })));
el('ivApply').addEventListener('click', () => {
  const n = (id, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(el(id).value) || 0)));
  setCfg({ work: n('ivW', 5, 600), rest: n('ivR', 0, 600), rounds: n('ivN', 1, 50) });
});
el('ivGo').addEventListener('click', () => { el('sheetClose').click(); startIntervals(); });
pill.addEventListener('click', stopIntervals);
drawButtons();
