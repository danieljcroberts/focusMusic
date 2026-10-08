import './style.css';
import { cv, ctx, glc, stillImg, fadeCv, fctx, still, W, H, DPR, lowPower, lively, setSize, setLowPowerFlag, setLivelyFlag } from './view.js';
import { A, ok } from './assets.js';
import { state, saveState } from './state.js';
import { setStatus } from './status.js';
import { tickWeather } from './weather.js';
import { SCENES, makeScene } from './scenes/index.js';
import { STAGES, BGS } from './scenes/glass-shared.js';
import { TRACKS, sampleMusic, tickFades, audioCtx, setSceneKey, onSceneChange, togglePlay, nextTrack, follow, setFollow, openLib, libOpen } from './music.js';

const byKey = Object.fromEntries(TRACKS.map(t => [t.a + '|' + t.t, t]));
const instances = SCENES.map(makeScene);
SCENES.forEach((s, i) => { const k = state.bgs && state.bgs[s.name]; if (k && BGS[k] && instances[i].setBg) instances[i].setBg(k); });
const ready = new Array(SCENES.length).fill(false);
let cur = Math.max(0, SCENES.findIndex(s => s.name === state.scene)), fade = 0, t = 8, last = performance.now();

/* Scene navigation */
const nav = document.getElementById('nav');
let lastGroup = '';
SCENES.forEach((s, i) => {
  if (s.group !== lastGroup) {
    const g = document.createElement('span'); g.className = 'grp'; g.textContent = s.group; nav.appendChild(g); lastGroup = s.group;
  }
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'scene-' + i; b.dataset.i = i;
  const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = s.sw;
  b.append(sw, s.name);
  b.addEventListener('click', () => go(i));
  nav.appendChild(b);
});
const buttons = [...nav.querySelectorAll('button')];
const bgSeg = document.getElementById('bgSeg');
const bgButtons = Object.entries(BGS).map(([k, b]) => {
  const el = document.createElement('button');
  el.type = 'button'; el.dataset.k = k; el.textContent = b.label; el.setAttribute('aria-pressed', 'false');
  el.addEventListener('click', () => {
    const inst = instances[cur]; if (!inst.setBg || inst.bg === k) return;
    inst.setBg(k); updateText(); saveState({ bgs: Object.assign({}, state.bgs || {}, { [SCENES[cur].name]: k }) });
  });
  bgSeg.appendChild(el);
  return el;
});

function resize() {
  // Low power renders the 2D scenes at 1x; the WebGL scenes read lowPower themselves.
  const dpr = lowPower ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  setSize(window.innerWidth, window.innerHeight, dpr);
  cv.width = fadeCv.width = Math.round(W * DPR); cv.height = fadeCv.height = Math.round(H * DPR);
  ready.fill(false);
  ensure(cur);
  if (still) render(0);
}
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); });

function ensure(i) { if (!ready[i]) { instances[i].init(); ready[i] = true; } }
function stageOf(inst) { return inst.kind === 'canvas' ? cv : inst.kind === 'image' ? stillImg : (inst.canvas || glc); }
function show(i) {
  const inst = instances[i], target = stageOf(inst);
  [cv, glc, stillImg, ...STAGES].forEach(e => { e.hidden = e !== target; });
  if (inst.kind === 'image' && stillImg.getAttribute('src') !== A + SCENES[i].src) stillImg.src = A + SCENES[i].src;
  STAGES.forEach(e => { if (e.tagName === 'VIDEO') { if (e === target) e.play().catch(() => {}); else e.pause(); } });
}
function updateText() {
  const s = SCENES[cur];
  document.getElementById('eyebrow').textContent = `${s.group} · Scene ${cur + 1} of ${SCENES.length}`;
  document.getElementById('title').textContent = s.name;
  document.getElementById('desc').textContent = s.desc;
  const art = document.getElementById('art');
  const info = s.bgs ? BGS[instances[cur].bg].art : s.art;
  art.textContent = '';
  if (info.url) { const a = document.createElement('a'); a.href = info.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = info.who; art.appendChild(a); }
  else art.textContent = info.who;
  document.getElementById('artlic').textContent = info.lic;
  document.getElementById('bgRow').hidden = !s.bgs;
  if (s.bgs) bgButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === instances[cur].bg)));
  setSceneKey(s.music);
  const mt = byKey[s.music];
  document.getElementById('who').textContent = mt ? `${mt.t} — ${mt.a}` : '';
  document.getElementById('lic').textContent = mt ? mt.lic + (mt.file ? '' : ' · streams') : '';
  buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === cur)));
  buttons[cur].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: still ? 'auto' : 'smooth' });
}
function snapshot() {
  fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, fadeCv.width, fadeCv.height);
  const k = instances[cur].kind;
  try {
    if (k === 'canvas') fctx.drawImage(cv, 0, 0);
    else if (k === 'webgl') { const st = stageOf(instances[cur]); if (!st.hidden) fctx.drawImage(st, 0, 0, fadeCv.width, fadeCv.height); }
    else if (k === 'video') {
      const v = stageOf(instances[cur]);
      if (v.videoWidth) { const s = Math.max(fadeCv.width / v.videoWidth, fadeCv.height / v.videoHeight); fctx.drawImage(v, (fadeCv.width - v.videoWidth * s) / 2, (fadeCv.height - v.videoHeight * s) / 2, v.videoWidth * s, v.videoHeight * s); }
    }
    else if (k === 'image' && ok(stillImg)) {
      const s = Math.max(fadeCv.width / stillImg.naturalWidth, fadeCv.height / stillImg.naturalHeight);
      const w = stillImg.naturalWidth * s, h = stillImg.naturalHeight * s;
      fctx.imageSmoothingEnabled = false;
      fctx.drawImage(stillImg, (fadeCv.width - w) / 2, (fadeCv.height - h) / 2, w, h);
    }
  } catch (e) { /* a blank snapshot just means no crossfade */ }
}
function go(i) {
  i = (i + SCENES.length) % SCENES.length;
  if (i === cur) return;
  snapshot();
  fade = still ? 0 : 1; fadeCv.style.opacity = fade;
  cur = i; ensure(cur); show(cur); updateText();
  saveState({ scene: SCENES[cur].name }); onSceneChange();
  if (still) render(0);
}
function render(dt) {
  const inst = instances[cur];
  if (inst.kind === 'canvas') {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  inst.draw(t, dt);
  if (fade > 0) { fade = Math.max(0, fade - dt / 1.4); fadeCv.style.opacity = fade; }
}

/* Low power: lower render resolution, fewer drops, lighter rain. Turns itself on if the frame rate stays low. */
const lowBtn = document.getElementById('lowBtn');
function setLowPower(v, note) {
  setLowPowerFlag(v); lowBtn.setAttribute('aria-pressed', String(v)); saveState({ lowPower: v });
  resize();
  if (note) setStatus(note);
}
setLowPowerFlag(!!state.lowPower);
lowBtn.addEventListener('click', () => setLowPower(!lowPower));
lowBtn.setAttribute('aria-pressed', String(lowPower));
const liveBtn = document.getElementById('liveBtn');
function setLively(v) { setLivelyFlag(v); liveBtn.setAttribute('aria-pressed', String(v)); saveState({ lively: v }); }
setLively(!!state.lively);
liveBtn.addEventListener('click', () => setLively(!lively));
let fpsAcc = 0, fpsN = 0, slowFor = 0, autoLow = false;
function watchFps(real) {
  fpsAcc += real; fpsN++;
  if (fpsAcc < 1) return;
  const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
  if (fps < 22 && !lowPower && !autoLow && !document.hidden) {
    if (++slowFor >= 6) { autoLow = true; setLowPower(true, 'Low power turned on because the frame rate was low. Turn it off in the top bar.'); }
  } else slowFor = 0;
}
function frame(now) {
  const real = (now - last) / 1000, dt = Math.min(.05, real); last = now; t += dt;
  tickWeather(dt); sampleMusic(dt); tickFades(now); watchFps(real);
  render(dt);
  requestAnimationFrame(frame);
}
if (still) setInterval(() => { tickFades(performance.now()); sampleMusic(.1); }, 100);

/* Focus timer: a focus block, then a break that dims the scene; the break starts on its own, the next block waits for you.
   It survives a reload: a running block picks up where the clock says it should be. */
const timer = { f: 25, b: 5, mode: 'focus', left: 25 * 60, running: false, last: 0 };
if (state.timer && state.timer.f) {
  const s = state.timer;
  timer.f = s.f; timer.b = s.b; timer.left = s.left ?? timer.f * 60;
  if (s.mode) timer.mode = s.mode;
  if (s.running && s.at) { timer.running = true; timer.left -= (Date.now() - s.at) / 1000; }
}
const tBtn = document.getElementById('tStart'), tMore = document.getElementById('tMore'), tMenu = document.getElementById('tMenu');
const fmt = sec => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
function saveTimer() { saveState({ timer: { f: timer.f, b: timer.b, mode: timer.mode, left: timer.left, running: timer.running, at: Date.now() } }); }
function drawTimer() {
  tBtn.textContent = `${timer.mode === 'focus' ? 'Focus' : 'Break'} ${fmt(Math.max(0, timer.left))}`;
  tBtn.setAttribute('aria-pressed', String(timer.running));
  document.body.classList.toggle('break', timer.mode === 'break');
}
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
function toggleTimer() {
  timer.running = !timer.running; timer.last = performance.now();
  const c = audioCtx(); if (timer.running && c && c.state === 'suspended') c.resume().catch(() => {});
  drawTimer(); saveTimer();
}
function resetTimer() { timer.mode = 'focus'; timer.left = timer.f * 60; timer.running = false; drawTimer(); saveTimer(); }
let lastSave = 0;
timer.last = performance.now();
setInterval(() => {
  if (!timer.running) return;
  const now = performance.now(); timer.left -= (now - timer.last) / 1000; timer.last = now;
  if (timer.left <= 0) {
    if (timer.mode === 'focus') { timer.mode = 'break'; timer.left = timer.b * 60; chime([660, 880]); setStatus('Focus block done. Break started.'); }
    else { timer.mode = 'focus'; timer.left = timer.f * 60; timer.running = false; chime([660]); setStatus('Break over. Press the timer to start the next focus block.'); }
    saveTimer();
  }
  if (now - lastSave > 10000) { lastSave = now; saveTimer(); }
  drawTimer();
}, 250);
tBtn.addEventListener('click', toggleTimer);
function closeMenu() { tMenu.hidden = true; tMore.setAttribute('aria-expanded', 'false'); }
tMore.addEventListener('click', () => { tMenu.hidden = !tMenu.hidden; tMore.setAttribute('aria-expanded', String(!tMenu.hidden)); });
tMenu.querySelectorAll('button[data-f]').forEach(b => b.addEventListener('click', () => {
  timer.f = +b.dataset.f; timer.b = +b.dataset.b; resetTimer(); closeMenu();
}));
document.getElementById('tReset').addEventListener('click', () => { resetTimer(); closeMenu(); });
document.addEventListener('pointerdown', e => { if (!tMenu.hidden && !e.target.closest('.timer')) closeMenu(); });
window.addEventListener('pagehide', saveTimer);
drawTimer();

const clock = document.getElementById('clock');
const tick = () => { const d = new Date(); clock.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
tick(); setInterval(tick, 10000);

/* The controls fade after five quiet seconds; any movement, key or focus brings them back. */
let idleTimer;
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('idle'), 5000);
  keepAwake();
}
['pointermove', 'pointerdown', 'keydown', 'touchstart', 'focusin'].forEach(e => window.addEventListener(e, wake, { passive: true }));

/* Keep the screen on while a scene is showing. The lock drops when the tab is hidden and is taken again when it returns. */
let wakeLock = null;
async function keepAwake() {
  if (!('wakeLock' in navigator) || wakeLock || document.hidden) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) { /* refused: low battery, a hidden page or a browser without it */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });

const fsBtn = document.getElementById('fs');
function toggleFs() {
  const el = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
}
fsBtn.addEventListener('click', toggleFs);
document.addEventListener('fullscreenchange', () => { fsBtn.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; });

/* Keyboard. Form controls keep their own keys, so arrows on the volume slider only change the volume. */
window.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select')) return;
  const onControl = !!e.target.closest('button, a');
  switch (e.key) {
    case ' ': if (!onControl) { e.preventDefault(); togglePlay(); } break;
    case 'ArrowRight': go(cur + 1); break;
    case 'ArrowLeft': go(cur - 1); break;
    case 'n': case 'N': nextTrack(); break;
    case 'l': case 'L': openLib(!libOpen()); break;
    case 'm': case 'M': setFollow(!follow); break;
    case 't': case 'T': toggleTimer(); break;
    case 'f': case 'F': toggleFs(); break;
    case 'v': case 'V': setLively(!lively); break;
    case 'Escape': if (libOpen()) openLib(false); break;
  }
});

/* A horizontal swipe on the scene changes it; swipes that start on the controls or the library are theirs. */
let swipe = null;
window.addEventListener('touchstart', e => {
  swipe = e.target.closest('.chrome, .lib') ? null : { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
}, { passive: true });
window.addEventListener('touchend', e => {
  if (!swipe) return;
  const dx = e.changedTouches[0].clientX - swipe.x, dy = e.changedTouches[0].clientY - swipe.y; swipe = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1));
}, { passive: true });

// The rain lab is a different scene list, so a hash change reloads into it.
window.addEventListener('hashchange', () => location.reload());

show(cur);
updateText();
resize();
if (still) render(0); else { render(0); requestAnimationFrame(t2 => { last = t2; requestAnimationFrame(frame); }); }
wake();
