import './style.css';
import { cv, ctx, glc, stillImg, fadeCv, fctx, still, W, H, DPR, lowPower, lively, setSize, setLowPowerFlag, setLivelyFlag, setInvalidate, gctxFallback } from './view.js';
import { A, ok } from './assets.js';
import { state, saveState } from './state.js';
import { setStatus } from './status.js';
import { weather, tickWeather } from './weather.js';
import { daylight } from './daylight.js';
import { SCENES, makeScene } from './scenes/index.js';
import { governor } from './scenes/trip.js';
import { STAGES, BGS } from './scenes/glass-shared.js';
import { prevTrack, volume, setVolume, currentArt, toggleLove, currentLoved } from './music.js';
import { TRACKS, sampleMusic, tickFades, setScene, onSceneChange, togglePlay, nextTrack, openLib, libOpen, announce, setArtworkSource, bands, musicLevel, musicPlaying, currentTrack, queueResume, trackSlug } from './music.js';
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
import { openSheet, sheetOpen, setSceneTrack } from './sheet.js';
import { follow } from './music.js';
import { wizardOpen } from './soundtrack-ui.js';
import { timerRunning } from './timer.js';

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
  const im = document.createElement('img'); im.alt = ''; im.hidden = false; im.loading = 'lazy'; im.decoding = 'async'; im.src = `assets/thumbs/${slug(s)}.jpg`;
  im.addEventListener('error', () => { if (!thumbs[s.name]) im.hidden = true; }, { once: true });
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
  for (const [k, url] of Object.entries(saved)) { const name = k.slice(6); thumbs[name] = url; const i = SCENES.findIndex(s => s.name === name); if (i >= 0) { cards[i].im.src = url; cards[i].im.hidden = false; } }
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
  show(cur);   // a GPU scene creates its canvas in init, so pick the visible stage after it
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
  el('eyebrow').textContent = `${s.group} · ${cur + 1} of ${SCENES.length}`;
  el('title').textContent = s.name; el('pickTitle').textContent = s.name;
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
  window.dispatchEvent(new CustomEvent('sw-scene', { detail: { tone: s.tone, mood: s.mood } }));
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
  if (document.body.classList.contains('idle') && picker.hidden) caption(SCENES[cur].name);
  if (still) render(0);
}
// While the controls are hidden, a scene change shows just its name for a moment.
const toast = el('toast');
let toastTimer;
function caption(text) { toast.textContent = text; toast.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), 1600); }
/* Scenes that don't listen to the music themselves breathe a little with it: a touch of brightness on the bass and the
   level, smoothed. The scenes that react in their own way are left alone. */
const REACTS = new Set(['spectrumBars', 'feedback', 'superscope', 'beatstars', 'dancingscope', 'scope', 'spectrum', 'ferrofluid', 'tunnel', 'synthwave', 'neonhighway', 'vector', 'lasers', 'memphis',
  'supercell', 'storm', 'lava', 'kaleido', 'marble', 'plasma', 'nebula', 'voronoi', 'blackhole', 'deepfield', 'hearth', 'aurora', 'ink', 'inkBeat', 'reaction', 'flow', 'murmuration',
  'canopy', 'tide', 'lighthouse', 'clouds', 'train', 'cleanPower', 'offshore', 'blueprint', 'paperValley', 'solarNoon', 'rain', 'snow', 'cafe', 'windscreen', 'greenhouse', 'library', 'lanterns', 'volcano', 'saturn', 'orrery', 'ocean', 'jellyfish', 'mandel', 'mandala', 'holmestrand']);
let pulse = 1;
function tickPulse(dt) {
  const want = musicPlaying && !REACTS.has(SCENES[cur].key) ? 1 + bands.bass * .05 + musicLevel * .03 : 1;
  pulse += (want - pulse) * Math.min(1, dt * 12);
  const on = Math.abs(pulse - 1) > .003;
  document.body.classList.toggle('pulse', on);
  if (on) document.body.style.setProperty('--pulse', pulse.toFixed(3));
}
/* Weather over the pixel-art and photo scenes, which can't paint it themselves: rain streaks or, in the winter months,
   snow, when the weather is wet enough. Drawn on its own canvas above the scene. */
const WX = new Set(SCENES.filter(s => s.group === 'Pixel art' || ['cityNight', 'nightSky', 'forestDusk'].includes(s.key)).map(s => s.key));
const wxCv = el('wx'), wxG = wxCv.getContext('2d');
let wxDrops = null;
function drawWx(dt) {
  const amount = WX.has(SCENES[cur].key) ? Math.max(0, (weather - .5) / .5) : 0;
  if (amount <= 0) { if (!wxCv.hidden) { wxCv.hidden = true; wxDrops = null; } return; }
  if (wxCv.hidden) { wxCv.hidden = false; wxCv.width = Math.round(W * DPR); wxCv.height = Math.round(H * DPR); }
  const m = new Date().getMonth(), snow = m >= 10 || m <= 1, n = Math.round((snow ? 140 : 220) * amount * (lowPower ? .5 : 1));
  if (!wxDrops || wxDrops.length !== n) wxDrops = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, v: snow ? 30 + Math.random() * 40 : 500 + Math.random() * 400, l: snow ? 1.5 + Math.random() * 2 : 10 + Math.random() * 18, w: Math.random() * 6.28 }));
  wxG.setTransform(DPR, 0, 0, DPR, 0, 0); wxG.clearRect(0, 0, W, H);
  wxG.strokeStyle = `rgba(214, 226, 240, ${.35 * amount})`; wxG.fillStyle = `rgba(255, 255, 255, ${.8 * amount})`; wxG.lineWidth = 1;
  wxG.beginPath();
  for (const d of wxDrops) {
    d.y += d.v * dt; if (snow) d.x += Math.sin(t * .8 + d.w) * 12 * dt; else d.x -= 60 * dt;
    if (d.y > H + 20) { d.y = -20; d.x = Math.random() * W; } if (d.x < -20) d.x = W + 20;
    if (snow) { wxG.moveTo(d.x + d.l, d.y); wxG.arc(d.x, d.y, d.l, 0, 6.283); } else { wxG.moveTo(d.x, d.y); wxG.lineTo(d.x - 2, d.y + d.l); }
  }
  if (snow) wxG.fill(); else wxG.stroke();
}
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

/* Share builds a link with the scene, the track and the ambience level; Previous lives in the sheet */
el('prevBtn').addEventListener('click', () => prevTrack());
function setLink() {
  const parts = [slug(SCENES[cur])], ct = currentTrack();
  if (ct && !ct.live && !ct.own) parts.push('m-' + trackSlug(ct));   // your own music stays on your device
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
    `${lastFps.toFixed(0)} fps · ${W}×${H} css px · ${gpuName()}${inst.kind === 'webgl' && (governor.scale < 1 || governor.skip) ? ` · governor ${Math.round(governor.scale * 100)}%${governor.skip ? ', half rate' : ''}` : ''}`,
    `weather ${weather.toFixed(2)} · daylight ${daylight().toFixed(2)}${localOn ? ' (local)' : ''}`,
    `music ${musicPlaying ? 'playing' : 'off'} · level ${musicLevel.toFixed(2)} · bass ${bands.bass.toFixed(2)} mid ${bands.mid.toFixed(2)} treble ${bands.treble.toFixed(2)}`,
    `ambience ${amb.kind} · level ${amb.level.toFixed(2)} · ${amb.layers} layer${amb.layers === 1 ? '' : 's'}`,
  ]);
}
function frame(now) {
  const real = (now - last) / 1000, dt = Math.min(.05, real); last = now; t += dt;
  tickWeather(dt); sampleMusic(dt); tickFades(now); watchFps(real);
  tickDrift(now); tickSleep(now); tickPulse(dt);
  if (diagOn() && now - diagAt > 500) { diagAt = now; drawDiag(); }
  if (picker.hidden) { render(dt); drawWx(dt); }   // nothing to draw behind the full-screen scene grid
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

/* The controls fade after a few quiet seconds (five with a mouse, three on touch). A mouse move, a key or a tap or upward
   swipe brings them back; sideways swipes and the arrow keys change scene without them. Hiding them by hand is remembered. */
let idleTimer, lastTouch = 0;
function wake(ms) {
  wakeFromSleep();
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(hide, ms || (performance.now() - lastTouch < 1500 ? 3000 : 5000));
  keepAwake();
}
function hide() { clearTimeout(idleTimer); document.body.classList.add('idle'); }
function showByHand() { if (typeof hideMini === 'function') hideMini(); saveState({ hidden: false }); wake(3000); }
function hideByHand() { saveState({ hidden: true }); hide(); }
const onScene = e => !e.target.closest('.chrome, .sheet, .lib, .help, .hint1, .diag, .picker, .mini, .wiz');
window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') wake(); }, { passive: true });
// Touching the mini player keeps the full controls hidden; it has its own short timer.
const onMini = e => !!e.target.closest('.mini');
window.addEventListener('pointerdown', e => { if (onMini(e)) return; if (e.pointerType === 'mouse' || !onScene(e)) wake(); }, { passive: true });
window.addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) wake(); else { wakeFromSleep(); keepAwake(); } }, { passive: true });
window.addEventListener('focusin', e => { if (!onScene(e) && !onMini(e)) wake(); });

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
// On phones the first tap on the scene goes full screen (browsers allow it only from a gesture), hiding the clock and
// battery bar. On by default where the pointer is a finger; the installed app also asks for full screen in its manifest.
const fsAutoBtn = el('fsAutoBtn');
let fsAuto = state.fsAuto ?? window.matchMedia('(pointer: coarse)').matches;
function setFsAuto(v) { fsAuto = v; fsAutoBtn.setAttribute('aria-pressed', String(v)); saveState({ fsAuto: v }); }
fsAutoBtn.addEventListener('click', () => setFsAuto(!fsAuto));
setFsAuto(fsAuto);
window.addEventListener('touchend', e => {
  if (!fsAuto || document.fullscreenElement || !document.fullscreenEnabled || !onScene(e)) return;
  const p = document.documentElement.requestFullscreen({ navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {});
}, { passive: true });

/* Keyboard. Form controls keep their own keys, so arrows on the volume slider only change the volume. */
window.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select') || wizardOpen()) return;
  const onControl = !!e.target.closest('button, a');
  switch (e.key) {
    case ' ': if (!onControl) { e.preventDefault(); togglePlay(); } break;
    case 'ArrowRight': go(cur + 1); break;
    case 'ArrowLeft': go(cur - 1); break;
    case 'n': case 'N': nextTrack(); break;
    case 'h': case 'H': love(); break;
    case 'p': case 'P': prevTrack(); break;
    case 'ArrowUp': e.preventDefault(); setVolume(volume() + .05); showLevel('right', 'Music', volume()); break;
    case 'ArrowDown': e.preventDefault(); setVolume(volume() - .05); showLevel('right', 'Music', volume()); break;
    case 'l': case 'L': openLib(!libOpen()); break;
    case 'm': case 'M': setSceneTrack(!follow); caption(follow ? 'Scenes change the track' : 'Scenes keep the track'); break;
    case 'o': case 'O': case ',': openSheet(); break;
    case 't': case 'T': toggleTimer(); break;
    case 'f': case 'F': toggleFs(); break;
    case 'v': case 'V': setLively(!lively); break;
    case 's': case 'S': toggleFav(); break;
    case 'd': case 'D': setDrift(!drift); break;
    case 'a': case 'A': openAbout(); break;
    case 'g': case 'G': picker.hidden ? openPicker() : closePicker(); break;
    case '?': showHelp(); break;
    case '`': setDiagOn(!diagOn()); break;
    case 'Escape': if (wizardOpen()) break; else if (!picker.hidden) closePicker(); else if (helpOpen()) showHelp(false); else if (aboutOpen()) openAbout(false); else if (libOpen()) openLib(false); else if (sheetOpen()) openSheet(false); else closeMenus(); break;
  }
});

/* A horizontal swipe on the scene changes it; swipes that start on the controls or the library are theirs. */
// Sideways swipe: next or previous scene, with a small tick. Up: show the controls. Down: hide them. Tap: show or hide.
// Double-tap: left third previous track, middle play or pause, right third next track. Long press: the scene picker.
// Slide up or down along the right edge: music volume; along the left edge: the ambience level.
let swipe = null, tapTimer = null, pressTimer = null, lastTap = null;
const haptic = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };
const EDGE = .12;
const levelEl = el('level'), levelBar = el('levelBar'), levelLbl = el('levelLbl');
let levelTimer;
function showLevel(side, label, v) {
  levelEl.hidden = false; levelEl.dataset.side = side;
  levelBar.style.transform = `scaleY(${v})`; levelLbl.textContent = `${label}\n${Math.round(v * 100)}%`;
  clearTimeout(levelTimer); levelTimer = setTimeout(() => { levelEl.hidden = true; }, 900);
}
// A caption after a track change waits a moment so the new title is in place.
const trackCaption = icon => setTimeout(() => caption(`${icon} ${el('npTitle').textContent}`), 350);
window.addEventListener('touchstart', e => {
  lastTouch = performance.now();
  if (!onScene(e) || e.touches.length > 1) { swipe = null; return; }
  const p = e.changedTouches[0];
  const edge = p.clientX > W * (1 - EDGE) ? 'right' : p.clientX < W * EDGE ? 'left' : null;
  swipe = { x: p.clientX, y: p.clientY, at: performance.now(), long: false, edge, drag: false, v0: edge === 'right' ? volume() : ambienceLevel };
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => { if (swipe && !swipe.drag) { swipe.long = true; holding = true; haptic(); openPicker(); } }, 550);
}, { passive: true });
window.addEventListener('touchmove', e => {
  if (!swipe) return;
  const p = e.changedTouches[0], dx = p.clientX - swipe.x, dy = p.clientY - swipe.y;
  if (Math.abs(dx) > 12 || Math.abs(dy) > 12) clearTimeout(pressTimer);
  // An edge slide: once the finger has moved mostly up or down from an edge, it sets a level instead of swiping.
  if (swipe.edge && (swipe.drag || (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx) * 1.3))) {
    swipe.drag = true;
    const v = Math.max(0, Math.min(1, swipe.v0 - dy / (H * .45)));
    if (swipe.edge === 'right') { setVolume(v); showLevel('right', 'Music', v); }
    else { setAmbienceLevel(v); amb.value = v; amb.dispatchEvent(new Event('input')); showLevel('left', 'Ambience', v); }
  }
}, { passive: true });
// A cancelled touch (the browser took it over, or something opened under the finger) simply ends the gesture.
window.addEventListener('touchcancel', () => { clearTimeout(pressTimer); if (holding) { holding = false; liftAt = performance.now(); } swipe = null; }, { passive: true });
window.addEventListener('touchend', e => {
  clearTimeout(pressTimer);
  if (holding) { holding = false; liftAt = performance.now(); }
  if (!swipe) return;
  const p = e.changedTouches[0], s0 = swipe; swipe = null;
  if (s0.long) return;
  if (s0.drag) { haptic(); return; }
  const dx = p.clientX - s0.x, dy = p.clientY - s0.y, ms = performance.now() - s0.at;
  wakeFromSleep(); keepAwake();
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { haptic(); go(cur + (dx < 0 ? 1 : -1)); return; }
  if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) * 1.5) { if (dy < 0) showByHand(); else hideByHand(); return; }
  if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && ms < 400) {
    if (tapTimer && lastTap && Math.hypot(p.clientX - lastTap.x, p.clientY - lastTap.y) < 60) {   // double-tap, by zone
      clearTimeout(tapTimer); tapTimer = null; haptic();
      const zone = p.clientX < W / 3 ? 'prev' : p.clientX > W * 2 / 3 ? 'next' : 'play';
      if (zone === 'prev') { const r = prevTrack(); if (r === 'restart') caption('From the start'); else if (r) trackCaption('←'); }
      else if (zone === 'next') { nextTrack(); trackCaption('→'); }
      else { togglePlay(); caption(musicPlaying ? 'Paused' : 'Playing'); }
      return;
    }
    lastTap = { x: p.clientX, y: p.clientY };
    const low = p.clientY > H * .8;
    tapTimer = setTimeout(() => {
      tapTimer = null;
      if (!mini.hidden) hideMini();                                          // any tap on the scene puts the mini player away
      else if (document.body.classList.contains('idle')) { if (low) showMini(); else showByHand(); }   // near the bottom: the mini player
      else hideByHand();
    }, 260);
  }
}, { passive: true });

/* Mini player: the track and previous / play / next, over the bottom of the scene while the controls stay hidden.
   It follows the main player and tucks itself away after a few quiet seconds. Tapping the title opens the full controls. */
const mini = el('mini'), miniPlay = el('miniPlay');
let miniTimer;
function syncMini() {
  const [name, artist] = el('npTitle').textContent.split(' — ');
  el('miniName').textContent = name || 'Nothing playing';
  el('miniArtist').textContent = artist || 'Tap play for music';
  const playing = el('play').textContent === 'Pause';
  miniPlay.textContent = playing ? 'Pause' : 'Play'; miniPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  drawLove();
  const art = currentArt(), im = el('miniArt');            // a small cover, when the track carries one
  if (art) { if (im.getAttribute('src') !== art) im.src = art; im.hidden = false; } else im.hidden = true;
}
function drawLove() {
  const on = currentLoved();
  for (const b of [el('miniLove'), el('loveBtn')]) { b.setAttribute('aria-pressed', String(on)); b.textContent = (on ? '♥' : '♡') + (b.id === 'loveBtn' ? ' Love' : ''); }
}
function love() { const on = toggleLove(); if (on === null) return; drawLove(); caption(on ? '♥ Loved' : 'Not loved'); haptic(); }
el('miniLove').addEventListener('click', () => { love(); bumpMini(); });
el('loveBtn').addEventListener('click', love);
function showMini() { syncMini(); mini.hidden = false; bumpMini(); haptic(); }
function hideMini() { clearTimeout(miniTimer); mini.hidden = true; }
function bumpMini() { clearTimeout(miniTimer); miniTimer = setTimeout(hideMini, 6000); }
new MutationObserver(syncMini).observe(el('npTitle'), { childList: true, characterData: true, subtree: true });
new MutationObserver(syncMini).observe(el('play'), { childList: true, characterData: true, subtree: true });
el('miniPrev').addEventListener('click', () => { prevTrack(); bumpMini(); });
miniPlay.addEventListener('click', () => { togglePlay(); bumpMini(); });
el('miniNext').addEventListener('click', () => { nextTrack(); bumpMini(); });
el('miniTitle').addEventListener('click', () => { hideMini(); showByHand(); });

/* The scene picker: every scene as a thumbnail, grouped. Built once; reopening only updates the current scene and new
   thumbnails. While it is open the scene behind stops drawing, so scrolling the grid stays smooth. */
const picker = el('picker'), pickerGrid = el('pickerGrid');
// holding: the finger that opened the grid is still down; liftAt: when it came up. Taps are ignored until just after the lift.
let pickerTiles = null, holding = false, liftAt = 0;
function buildPicker() {
  pickerTiles = [];
  let g = '';
  SCENES.forEach((s, i) => {
    if (s.group !== g) { g = s.group; const h = document.createElement('h3'); h.textContent = g; pickerGrid.append(h); }
    const b = document.createElement('button'); b.type = 'button';
    const t = document.createElement('span'); t.className = 'pt'; t.style.background = s.sw;
    const im = document.createElement('img'); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.src = `assets/thumbs/${slug(s)}.jpg`; t.append(im);
    im.addEventListener('error', () => { if (!thumbs[s.name]) im.hidden = true; }, { once: true });
    b.append(t, s.name);
    // The lift of the long press that opened the grid would otherwise pick whatever tile is under the finger.
    b.addEventListener('click', () => { if (holding || performance.now() - liftAt < 400) return; closePicker(); go(i); });
    pickerGrid.append(b); pickerTiles.push({ b, im });
  });
}
function openPicker() {
  if (!pickerTiles) buildPicker();
  pickerTiles.forEach(({ b, im }, i) => {
    b.setAttribute('aria-pressed', String(i === cur));
    const url = thumbs[SCENES[i].name];
    if (url && im.getAttribute('src') !== url) { im.src = url; im.hidden = false; }
  });
  picker.hidden = false;
  pickerTiles[cur].b.scrollIntoView({ block: 'center' });
}
function closePicker() { picker.hidden = true; }
el('pickerClose').addEventListener('click', closePicker);
el('sceneBtn').addEventListener('click', () => openPicker());

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
if (state.hidden && el('hint1').hidden) hide(); else wake();   // start as you left it, unless the first-run hint is up
// App-icon shortcuts: ?start=focus starts a focus block.
const q = new URLSearchParams(location.search);
if (q.get('start') === 'focus' && !timerRunning()) { toggleTimer(); caption('Focus block started'); }
if (location.search) history.replaceState(null, '', location.pathname + location.hash);
scheduleThumb();
