import './style.css';
import { cv, ctx, glc, stillImg, fadeCv, fctx, still, W, H, DPR, lowPower, lively, setSize, setLowPowerFlag, setLivelyFlag, setInvalidate, gctxFallback } from './view.js';
import { A, ok } from './assets.js';
import { state, saveState } from './state.js';
import { setStatus } from './status.js';
import { weather, tickWeather } from './weather.js';
import { daylight } from './daylight.js';
import { SCENES, makeScene } from './scenes/index.js';
import { STAGES, BGS } from './scenes/glass-shared.js';
import { TRACKS, sampleMusic, tickFades, setScene, onSceneChange, togglePlay, nextTrack, follow, setFollow, openLib, libOpen, announce, setArtworkSource, bands, musicLevel, musicPlaying, currentTrack, queueResume, trackSlug } from './music.js';
import { level as ambienceLevel, setAmbienceKind, setAmbienceLevel, startAmbience, ambienceState } from './ambience.js';
import { localOn } from './local.js';
import { report, gpuName, diagOn, setDiag } from './diag.js';
import { kvAll, kvSet } from './store.js';
import './finish.js';
import { closeMenus } from './menus.js';
import { initTimer, toggleTimer } from './timer.js';
import { tickSleep, wakeFromSleep } from './sleep.js';
import { initDrift, toggleFav, drawFav, setDrift, drift, noteSceneChange, tickDrift } from './drift.js';
import { initSettings, showHelp, helpOpen, setDiagOn } from './settings.js';
import { openAbout, aboutOpen } from './about.js';

const el = id => document.getElementById(id);
const byKey = Object.fromEntries(TRACKS.map(t => [t.a + '|' + t.t, t]));
const instances = SCENES.map(makeScene);
SCENES.forEach((s, i) => { const k = state.bgs && state.bgs[s.name]; if (k && BGS[k] && instances[i].setBg) instances[i].setBg(k); });
const ready = new Array(SCENES.length).fill(false), broken = new Array(SCENES.length).fill(null);
const slug = s => s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* Links: #scene, or a set: #scene.m-track-slug.a40 (the track and the ambience level too) */
function parseHash() {
  const parts = location.hash.slice(1).split('.'), i = SCENES.findIndex(s => slug(s) === parts[0]);
  const out = { scene: i };
  for (const p of parts.slice(1)) {
    if (p.startsWith('m-')) out.track = TRACKS.find(t => trackSlug(t) === p.slice(2)) || null;
    else if (/^a\d+$/.test(p)) out.ambience = Number(p.slice(1)) / 100;
  }
  return out;
}
const link = parseHash();
let cur = Math.max(0, link.scene >= 0 ? link.scene : SCENES.findIndex(s => s.name === state.scene)), fade = 0, fadeAt = 0, t = 8, last = performance.now();
if (link.track) queueResume(link.track, 0);
if (link.ambience !== undefined) setAmbienceLevel(link.ambience);

/* Scene navigation: a strip of cards, each with a thumbnail once the scene has been seen */
const thumbs = {};
const nav = el('nav');
let lastGroup = '';
const cards = SCENES.map((s, i) => {
  if (s.group !== lastGroup) {
    const g = document.createElement('span'); g.className = 'grp'; g.textContent = s.group; nav.appendChild(g); lastGroup = s.group;
  }
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'scene-' + i; b.className = 'card'; b.dataset.i = i;
  const th = document.createElement('span'); th.className = 'thumb'; th.style.background = s.sw;
  const im = document.createElement('img'); im.alt = ''; im.hidden = true;
  th.appendChild(im);
  const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = s.name;
  const star = document.createElement('span'); star.className = 'star'; star.textContent = '★'; star.hidden = !(state.favs || []).includes(s.name);
  b.append(th, lbl, star);
  b.addEventListener('click', () => go(i));
  nav.appendChild(b);
  return { b, im, star };
});
// Thumbnails live in IndexedDB; an older localStorage copy is moved over once.
(async () => {
  let old = null;
  try { old = JSON.parse(localStorage.getItem('sw-thumbs') || 'null'); localStorage.removeItem('sw-thumbs'); } catch (e) {}
  if (old) for (const [name, url] of Object.entries(old)) kvSet('thumb:' + name, url);
  const saved = await kvAll('thumb:');
  for (const [k, url] of Object.entries(saved)) { const name = k.slice(6); thumbs[name] = url; const i = SCENES.findIndex(s => s.name === name); if (i >= 0 && !cards[i].im.src) { cards[i].im.src = url; cards[i].im.hidden = false; } }
  if (old) for (const [name, url] of Object.entries(old)) { thumbs[name] = thumbs[name] || url; const i = SCENES.findIndex(s => s.name === name); if (i >= 0) { cards[i].im.src = thumbs[name]; cards[i].im.hidden = false; } }
})();
// Group chips above the strip scroll to the first card of a group.
const groupsEl = el('groups');
const groupChips = [...new Set(SCENES.map(s => s.group))].map(g => {
  const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false'); b.textContent = g;
  b.addEventListener('click', () => { const i = SCENES.findIndex(s => s.group === g); cards[i].b.scrollIntoView({ inline: 'start', block: 'nearest', behavior: still ? 'auto' : 'smooth' }); });
  groupsEl.appendChild(b); return { g, b };
});
const thumbC = document.createElement('canvas'); thumbC.width = 160; thumbC.height = 90;
const thumbG = thumbC.getContext('2d');
let thumbTimer;
// A few seconds into a scene, grab a small frame of it for the nav. Returns whether it got one.
function captureThumb() {
  const s = SCENES[cur], inst = instances[cur], src = stageOf(inst);
  const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
  if (!sw || !sh || src.hidden || broken[cur]) return false;
  try {
    const k = Math.max(160 / sw, 90 / sh);
    thumbG.fillStyle = '#000'; thumbG.fillRect(0, 0, 160, 90);
    thumbG.imageSmoothingEnabled = inst.kind !== 'image';
    thumbG.drawImage(src, (160 - sw * k) / 2, (90 - sh * k) / 2, sw * k, sh * k);
    const url = thumbC.toDataURL('image/jpeg', .6);
    thumbs[s.name] = url; cards[cur].im.src = url; cards[cur].im.hidden = false;
    kvSet('thumb:' + s.name, url);
    announce();   // the lock screen shows the scene too
    return true;
  } catch (e) { return false; }   // a tainted or blank frame just means no thumbnail yet
}
function scheduleThumb() { clearTimeout(thumbTimer); thumbTimer = setTimeout(captureThumb, 3000); }

const bgSeg = el('bgSeg');
const bgButtons = Object.entries(BGS).map(([k, b]) => {
  const btn = document.createElement('button');
  btn.type = 'button'; btn.dataset.k = k; btn.textContent = b.label; btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => {
    const inst = instances[cur]; if (!inst.setBg || inst.bg === k) return;
    inst.setBg(k); updateText(); saveState({ bgs: Object.assign({}, state.bgs || {}, { [SCENES[cur].name]: k }) });
  });
  bgSeg.appendChild(btn);
  return btn;
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

// A scene that throws is marked broken and shown as a card, and the loop goes on; the error reaches the diagnostics overlay.
function fail(i, e) { if (!broken[i]) { broken[i] = e; report(e); } }
function ensure(i) { if (!ready[i]) { try { instances[i].init(); } catch (e) { fail(i, e); } ready[i] = true; } }
function stageOf(inst) { return inst.kind === 'canvas' ? cv : inst.kind === 'image' ? stillImg : (inst.canvas || glc); }
function show(i) {
  const inst = instances[i], target = broken[i] ? cv : stageOf(inst);
  [cv, glc, stillImg, ...STAGES].forEach(e => { e.hidden = e !== target; });
  if (!broken[i] && inst.kind === 'image' && stillImg.getAttribute('src') !== A + SCENES[i].src) stillImg.src = A + SCENES[i].src;
  STAGES.forEach(e => { if (e.tagName === 'VIDEO') { if (e === target) e.play().catch(() => {}); else e.pause(); } });
}
function updateText() {
  const s = SCENES[cur];
  el('eyebrow').textContent = `${s.group} · Scene ${cur + 1} of ${SCENES.length}`;
  el('title').textContent = s.name;
  el('desc').textContent = s.desc;
  const art = el('art');
  const info = s.bgs ? BGS[instances[cur].bg].art : s.art;
  art.textContent = '';
  if (info.url) { const a = document.createElement('a'); a.href = info.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = info.who; art.appendChild(a); }
  else art.textContent = info.who;
  el('artlic').textContent = info.lic;
  el('bgRow').hidden = !s.bgs;
  if (s.bgs) bgButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === instances[cur].bg)));
  setScene(s.music, s.tone);
  setAmbienceKind(s.sound || 'none');
  const mt = byKey[s.music];
  el('who').textContent = mt ? `${mt.t} — ${mt.a}` : '';
  el('lic').textContent = mt ? mt.lic + (mt.file ? '' : ' · streams') : '';
  cards.forEach((c, i) => c.b.setAttribute('aria-pressed', String(i === cur)));
  groupChips.forEach(c => c.b.setAttribute('aria-selected', String(c.g === s.group)));
  history.replaceState(null, '', '#' + slug(s));
  announce();
  cards[cur].b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: still ? 'auto' : 'smooth' });
  drawFav();
}
function snapshot() {
  fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, fadeCv.width, fadeCv.height);
  const k = instances[cur].kind;
  try {
    if (k === 'canvas' || broken[cur]) fctx.drawImage(cv, 0, 0);
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
  fade = still ? 0 : 1; fadeAt = performance.now(); fadeCv.style.opacity = fade;
  cur = i; ensure(cur); show(cur); updateText();
  saveState({ scene: SCENES[cur].name }); onSceneChange();
  noteSceneChange(); scheduleThumb();
  if (document.body.classList.contains('idle')) caption(SCENES[cur].name);
  if (still) render(0);
}
// While the controls are hidden, a scene change shows just its name for a moment.
const toast = el('toast');
let toastTimer;
function caption(text) { toast.textContent = text; toast.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), 1600); }
function render(dt) {
  const inst = instances[cur];
  if (broken[cur]) {
    gctxFallback(`${SCENES[cur].name} failed on this device. Press → for the next scene.`);
    return;
  }
  if (inst.kind === 'canvas') {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  try { inst.draw(t, dt); }
  catch (e) { fail(cur, e); show(cur); setStatus(`${SCENES[cur].name} stopped with an error; the diagnostics overlay (\`) has the details.`); }
  if (fade > 0) { fade = Math.max(0, 1 - (performance.now() - fadeAt) / 1400); fadeCv.style.opacity = fade; }
}

/* Phone layout: More folds the controls out; Share builds a link with the scene, the track and the ambience level */
const moreBtn = el('moreBtn');
moreBtn.addEventListener('click', () => { const on = !document.body.classList.contains('more'); document.body.classList.toggle('more', on); moreBtn.setAttribute('aria-pressed', String(on)); });
function setLink() {
  const parts = [slug(SCENES[cur])], ct = currentTrack();
  if (ct && !ct.live) parts.push('m-' + trackSlug(ct));
  if (Math.round(ambienceLevel * 100) !== 35) parts.push('a' + Math.round(ambienceLevel * 100));
  return location.origin + location.pathname + '#' + parts.join('.');
}
el('shareBtn').addEventListener('click', async () => {
  const url = setLink();
  try {
    if (navigator.share) { await navigator.share({ title: 'Slow Windows: ' + SCENES[cur].name, url }); return; }
    await navigator.clipboard.writeText(url); setStatus('Link copied: ' + url);
  } catch (e) { if (e && e.name !== 'AbortError') setStatus(url); }
});
setArtworkSource(() => thumbs[SCENES[cur].name] || null);

/* Low power: lower render resolution, fewer drops, lighter rain. Turns itself on if the frame rate stays low. */
const lowBtn = el('lowBtn');
function setLowPower(v, note) {
  setLowPowerFlag(v); lowBtn.setAttribute('aria-pressed', String(v)); saveState({ lowPower: v });
  resize();
  if (note) setStatus(note);
}
setLowPowerFlag(!!state.lowPower);
lowBtn.addEventListener('click', () => setLowPower(!lowPower));
lowBtn.setAttribute('aria-pressed', String(lowPower));
const liveBtn = el('liveBtn');
function setLively(v) { setLivelyFlag(v); liveBtn.setAttribute('aria-pressed', String(v)); saveState({ lively: v }); }
setLively(!!state.lively);
liveBtn.addEventListener('click', () => setLively(!lively));
// On a draining battery below 40%, switch to low power once (the viewer can switch back).
let batteryNoted = false;
if (navigator.getBattery) navigator.getBattery().then(b => {
  const check = () => { if (!b.charging && b.level < .4 && !lowPower && !batteryNoted) { batteryNoted = true; setLowPower(true, 'Low power turned on to spare the battery. Turn it off in the top bar.'); } };
  check(); b.addEventListener('levelchange', check); b.addEventListener('chargingchange', check);
}).catch(() => {});
let fpsAcc = 0, fpsN = 0, slowFor = 0, autoLow = false, lastFps = 0, diagAt = 0;
function watchFps(real) {
  fpsAcc += real; fpsN++;
  if (fpsAcc < 1) return;
  const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; lastFps = fps;
  if (fps < 22 && !lowPower && !autoLow && !document.hidden) {
    if (++slowFor >= 6) { autoLow = true; setLowPower(true, 'Low power turned on because the frame rate was low. Turn it off in the top bar.'); }
  } else slowFor = 0;
}
function drawDiag() {
  const s = SCENES[cur], inst = instances[cur], st = stageOf(inst), amb = ambienceState();
  setDiag([
    `${s.name} · ${inst.kind} ${st.width || st.videoWidth || '?'}×${st.height || st.videoHeight || '?'} · DPR ${DPR}${lowPower ? ' · low power' : ''}${lively ? ' · lively' : ''}${broken[cur] ? ' · BROKEN' : ''}`,
    `${lastFps.toFixed(0)} fps · ${W}×${H} css px · ${gpuName()}`,
    `weather ${weather.toFixed(2)} · daylight ${daylight().toFixed(2)}${localOn ? ' (local)' : ''}`,
    `music ${musicPlaying ? 'playing' : 'off'} · level ${musicLevel.toFixed(2)} · bass ${bands.bass.toFixed(2)} mid ${bands.mid.toFixed(2)} treble ${bands.treble.toFixed(2)}`,
    `ambience ${amb.kind} · level ${amb.level.toFixed(2)} · ${amb.layers} layer${amb.layers === 1 ? '' : 's'}`,
  ]);
}
function frame(now) {
  const real = (now - last) / 1000, dt = Math.min(.05, real); last = now; t += dt;
  tickWeather(dt); sampleMusic(dt); tickFades(now); watchFps(real);
  tickDrift(now); tickSleep(now);
  if (diagOn() && now - diagAt > 500) { diagAt = now; drawDiag(); }
  render(dt);
  requestAnimationFrame(frame);
}
if (still) setInterval(() => { tickFades(performance.now()); sampleMusic(.1); }, 100);
setInvalidate(() => { if (still) render(0); });

initTimer({ sceneName: () => SCENES[cur].name });
initDrift({ go, current: () => cur, cards });
initSettings({ drawDiag });

const clock = el('clock');
const tick = () => { const d = new Date(); clock.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
tick(); setInterval(tick, 10000);

/* The controls fade after five quiet seconds. A mouse move, a key or a tap brings them back; swiping between scenes
   and the arrow keys do not, so you can flip through scenes without the menus. On touch, a tap on the scene toggles them. */
let idleTimer;
function wake() {
  wakeFromSleep();
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(hide, 5000);
  keepAwake();
}
function hide() { clearTimeout(idleTimer); document.body.classList.add('idle'); }
const onScene = e => !e.target.closest('.chrome, .lib, .help, .hint1, .diag');
window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') wake(); }, { passive: true });
window.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || !onScene(e)) wake(); }, { passive: true });
window.addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) wake(); else { wakeFromSleep(); keepAwake(); } }, { passive: true });
window.addEventListener('focusin', e => { if (!onScene(e)) wake(); });

/* Ambient sound: starts on the first gesture, follows the scene, its level is remembered */
const amb = el('amb'); amb.value = ambienceLevel;
amb.addEventListener('input', () => setAmbienceLevel(Number(amb.value)));
for (const r of [amb, el('vol')]) { const say = () => r.setAttribute('aria-valuetext', Math.round(r.value * 100) + '%'); r.addEventListener('input', say); say(); }
['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, startAmbience, { once: true, passive: true }));

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

const fsBtn = el('fs');
function toggleFs() {
  const root = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
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
    case 's': case 'S': toggleFav(); break;
    case 'd': case 'D': setDrift(!drift); break;
    case 'a': case 'A': openAbout(); break;
    case '?': showHelp(); break;
    case '`': setDiagOn(!diagOn()); break;
    case 'Escape': if (helpOpen()) showHelp(false); else if (aboutOpen()) openAbout(false); else if (libOpen()) openLib(false); else closeMenus(); break;
  }
});

/* A horizontal swipe on the scene changes it; swipes that start on the controls or the library are theirs. */
let swipe = null;
window.addEventListener('touchstart', e => {
  swipe = onScene(e) ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY, at: performance.now() } : null;
}, { passive: true });
window.addEventListener('touchend', e => {
  if (!swipe) return;
  const dx = e.changedTouches[0].clientX - swipe.x, dy = e.changedTouches[0].clientY - swipe.y, ms = performance.now() - swipe.at; swipe = null;
  wakeFromSleep(); keepAwake();
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1));   // swipe: next or previous scene, controls stay as they are
  else if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && ms < 400) {                                // tap: show or hide the controls
    if (document.body.classList.contains('idle')) wake(); else hide();
  }
}, { passive: true });

// A scene link in the hash switches scenes (so the back button walks through them).
window.addEventListener('hashchange', () => { const i = parseHash().scene; if (i >= 0) go(i); });

// Installable and usable offline once the service worker has seen the files. Fails quietly where it isn't allowed.
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

// For the smoke test: which scenes failed, and a thumbnail capture on demand.
window.slowWindows = { broken: () => SCENES.filter((s, i) => broken[i]).map(s => s.name), captureThumb, current: () => SCENES[cur].name };

show(cur);
updateText();
resize();
if (still) render(0); else { render(0); requestAnimationFrame(t2 => { last = t2; requestAnimationFrame(frame); }); }
wake();
scheduleThumb();
