import './style.css';
import { cv, ctx, glc, stillImg, fadeCv, fctx, still, W, H, DPR, lowPower, lively, setSize, setLowPowerFlag, setLivelyFlag, setInvalidate, gctxFallback } from './view.js';
import { A, ok } from './assets.js';
import { state, saveState } from './state.js';
import { setStatus } from './status.js';
import { weather, tickWeather } from './weather.js';
import { daylight } from './daylight.js';
import { SCENES, makeScene, prefetchScenes } from './scenes/index.js';
import { governor } from './scenes/trip.js';
import { STAGES, BGS } from './scenes/glass-shared.js';
import { prevTrack, volume, setVolume, currentArt, toggleLove, currentLoved, eqName, setEq, trackInfo, playNext, xfade, setCrossfade, volCap, setVolCap, pace, setPace } from './music.js';
import { TRACKS, sampleMusic, tickFades, setScene, onSceneChange, togglePlay, nextTrack, openLib, libOpen, announce, setArtworkSource, bands, musicLevel, musicPlaying, currentTrack, queueResume, trackSlug, playingNow, trackPos, trackClock, seekFraction, beatPos } from './music.js';
import { level as ambienceLevel, setAmbienceKind, setAmbienceLevel, startAmbience, ambienceState } from './ambience.js';
import { localOn } from './local.js';
import { report, gpuName, diagOn, setDiag, diagText } from './diag.js';
import { kvAll, kvSet } from './store.js';
import './finish.js';
import { closeMenus } from './menus.js';
import { initTimer, toggleTimer, focusRunning, setIntention } from './timer.js';
import { initWake } from './wake.js';
import { initMoods, applyMood } from './moods.js';
import { listening, setListening } from './listen.js';
import { setRestK } from './rest.js';
import './summary.js';
import { tickGrade, drawWx } from './overlays.js';
import { initBench, benching } from './bench.js';
import './intervals.js';
import './tasks.js';
import './sync.js';
import { initSceneMenu, openShelves, closeShelves, shelvesOpen, syncStrip, focusStrip, settleStrip, noteRecent } from './scene-menu.js';
import { initNativeUi } from './native-ui.js';
import { NATIVE, SITE, nativeKeepAwake, nativeSavePicture } from './native.js';
import { excluded, included, setIncluded, onExcludedChange } from './excluded.js';
import './tour.js';
import './scenesets.js';
import * as ST from './soundtracks.js';
import { addPhotos, removePhoto, photos, loadPhotos, onPhotosChange } from './scenes/photos.js';
import { EXTRA_KINDS, extraList, addExtra, removeExtra, setExtraLevel } from './ambience.js';
import { tickSleep, wakeFromSleep, sleepPace, setSleep } from './sleep.js';
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
    else if (p.startsWith('s-')) out.soundtrack = p.slice(2);
  }
  return out;
}
const link = parseHash();
let cur = Math.max(0, link.scene >= 0 ? link.scene : SCENES.findIndex(s => s.name === state.scene)), fade = 0, fadeAt = 0, t = 8, last = performance.now();
if (link.track) queueResume(link.track, 0);
if (link.ambience !== undefined) setAmbienceLevel(link.ambience);
if (link.soundtrack && ST.byId(link.soundtrack)) ST.setCurrent(link.soundtrack);

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
// Left-out scenes are hidden from the strip (a group label hides too when all of its scenes are out).
function drawStrip() {
  cards.forEach((c, i) => { c.b.hidden = !included(SCENES[i].name); });
  nav.querySelectorAll('.grp').forEach(g => { g.hidden = !SCENES.some(s => s.group === g.textContent && included(s.name)); });
}
drawStrip(); onExcludedChange(drawStrip);
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
  ready.fill(false); restKey = '';   // a resize clears the canvas: a resting scene wakes for a moment to draw itself again
  ensure(cur);
  show(cur);   // a GPU scene creates its canvas in init, so pick the visible stage after it
  if (still) render(0);
}
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); });

// A scene that throws is marked broken and shown as a card, and the loop goes on; the error reaches the diagnostics overlay.
function fail(i, e) { if (!broken[i]) { broken[i] = e; report(e); } }
// A scene's code has arrived: start it properly, and show it if it is the one on screen.
window.addEventListener('sw-scene-loaded', e => {
  const i = SCENES.findIndex(s => s.key === e.detail); if (i < 0) return;
  ready[i] = false;
  if (i === cur) { ensure(cur); show(cur); updateText(); if (still) render(0); }
});
function ensure(i) {
  if (!ready[i]) { const c = costs[SCENES[i].key]; if (c && !costApplied.has(i)) { costApplied.add(i); instances[i].cost = c; } try { instances[i].init(); } catch (e) { fail(i, e); } ready[i] = true; }
}
/* Per-scene cost on this device: the render scale each shader scene's governor settled on, kept so a scene that is heavy
   here starts at the scale it needs instead of stuttering for a few seconds first. Not kept while low power is on. */
const costs = state.costs || {}, costApplied = new Set();
function keepCost(i) {
  const c = instances[i] && instances[i].cost; if (!c || lowPower) return;
  const k = SCENES[i].key, was = costs[k];
  if (c.scale < 1 || c.skip) costs[k] = { scale: +c.scale.toFixed(2), skip: c.skip }; else delete costs[k];
  if (JSON.stringify(was) !== JSON.stringify(costs[k])) saveState({ costs });
}
window.addEventListener('pagehide', () => keepCost(cur));
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
  setScene(s.music, s.tone, s.key);
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
// The current frame of the scene, drawn into another canvas (the crossfade's, or a postcard's).
function drawFrame(c, g) {
  const k = instances[cur].kind;
  if (k === 'canvas' || broken[cur]) g.drawImage(cv, 0, 0, c.width, c.height);
  else if (k === 'webgl') { const st = stageOf(instances[cur]); if (!st.hidden) g.drawImage(st, 0, 0, c.width, c.height); }
  else if (k === 'video') {
    const v = stageOf(instances[cur]);
    if (v.videoWidth) { const s = Math.max(c.width / v.videoWidth, c.height / v.videoHeight); g.drawImage(v, (c.width - v.videoWidth * s) / 2, (c.height - v.videoHeight * s) / 2, v.videoWidth * s, v.videoHeight * s); }
  }
  else if (k === 'image' && ok(stillImg)) {
    const s = Math.max(c.width / stillImg.naturalWidth, c.height / stillImg.naturalHeight);
    const w = stillImg.naturalWidth * s, h = stillImg.naturalHeight * s;
    g.imageSmoothingEnabled = false;
    g.drawImage(stillImg, (c.width - w) / 2, (c.height - h) / 2, w, h);
  }
}
function snapshot() {
  fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, fadeCv.width, fadeCv.height);
  try { drawFrame(fadeCv, fctx); } catch (e) { /* a blank snapshot just means no crossfade */ }
}
// A postcard: the scene as it is now, at the screen's full resolution, with its name and the date small in a corner.
// The Android app saves it to Pictures/Slow Windows; a browser shares it where it can, or downloads it.
// The scene as it is now, as a PNG blob at the screen's resolution, with or without a small caption.
async function frameBlob(caption = true) {
  const c = document.createElement('canvas'); c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
  const g = c.getContext('2d');
  g.fillStyle = SCENES[cur].sw || '#07080c'; g.fillRect(0, 0, c.width, c.height);
  try { drawFrame(c, g); } catch (e) {}
  if (caption) {
    const fs = Math.round(Math.min(c.width, c.height) * .022), pad = fs * 1.4;
    g.font = `${fs}px "IBM Plex Mono", monospace`; g.textBaseline = 'bottom';
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = fs * .6; g.fillStyle = 'rgba(236,230,218,.82)';
    g.fillText(`${SCENES[cur].name} · ${new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })} · Slow Windows`, pad, c.height - pad);
  }
  return new Promise(r => c.toBlob(r, 'image/png'));
}
async function postcard() {
  const blob = await frameBlob(true);
  if (!blob) { setStatus("Couldn't make a picture of this scene."); return; }
  const name = `slow-windows-${slug(SCENES[cur])}-${new Date().toISOString().slice(0, 10)}.png`;
  if (NATIVE) { setStatus(await nativeSavePicture(blob, name) ? 'Saved to your photos, in the Slow Windows album.' : "Couldn't save the picture."); return; }
  const file = new File([blob], name, { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: SCENES[cur].name }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); setStatus('Picture saved.');
}
el('postcardBtn').addEventListener('click', () => { el('sheetClose').click(); setTimeout(postcard, 400); });
// quiet: a preview from the filmstrip, which changes only the picture; the music, Drift and Recent hear of the scene
// once it is kept (sceneKept).
function go(i, quiet = false) {
  i = (i + SCENES.length) % SCENES.length;
  if (i === cur) return;
  keepCost(cur); snapshot();
  fade = still ? 0 : 1; fadeAt = performance.now(); fadeCv.style.opacity = fade;
  cur = i; ensure(cur); show(cur); updateText();
  saveState({ scene: SCENES[cur].name }); scheduleThumb();
  if (quiet) { if (still) render(0); return; }
  sceneKept(); syncStrip();
  if (picker.hidden && !shelvesOpen()) caption(SCENES[cur].name, true);   // there is no title bar: the name shows for a moment
  if (still) render(0);
}
function sceneKept() { onSceneChange(); noteSceneChange(); noteRecent(SCENES[cur].name); }
// Next or previous, skipping the scenes you have left out.
function step(d) {
  const n = SCENES.length;
  for (let k = 1; k < n; k++) { const i = ((cur + d * k) % n + n) % n; if (included(SCENES[i].name)) { go(i); return; } }
}
// While the controls are hidden, a scene change shows just its name for a moment.
const toast = el('toast');
let toastTimer;
function caption(text, scene = false) { toast.textContent = text; toast.classList.toggle('scene', scene); toast.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), 1600); }
/* Scenes that don't listen to the music themselves breathe a little with it: a touch of brightness on the bass and the
   level, smoothed. The scenes that react in their own way are left alone. */
const REACTS = new Set(['spectrumBars', 'feedback', 'superscope', 'beatstars', 'dancingscope', 'scope', 'spectrum', 'ferrofluid', 'tunnel', 'synthwave', 'neonhighway', 'vector', 'lasers', 'memphis',
  'supercell', 'storm', 'lava', 'kaleido', 'marble', 'plasma', 'nebula', 'voronoi', 'blackhole', 'deepfield', 'hearth', 'aurora', 'ink', 'inkBeat', 'reaction', 'flow', 'murmuration',
  'canopy', 'tide', 'lighthouse', 'clouds', 'train', 'cleanPower', 'offshore', 'blueprint', 'paperValley', 'solarNoon', 'rain', 'snow', 'cafe', 'windscreen', 'greenhouse', 'library', 'lanterns', 'volcano', 'saturn', 'orrery', 'ocean', 'jellyfish', 'mandel', 'mandala', 'holmestrand', 'polarNight', 'kelp']);
let pulse = 1;
function tickPulse(dt) {
  const want = musicPlaying && !REACTS.has(SCENES[cur].key) ? 1 + bands.bass * .05 + musicLevel * .03 : 1;
  pulse += (want - pulse) * Math.min(1, dt * 12);
  const on = Math.abs(pulse - 1) > .003;
  document.body.classList.toggle('pulse', on);
  if (on) document.body.style.setProperty('--pulse', pulse.toFixed(3));
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
  // Music-reacting scenes come to rest when nothing plays: their clock slows to a stop over a second or two and then
  // they stop drawing (the last frame stays). Entering one starts it awake, so it settles in front of you.
  let st = t, sdt = dt, draw = true;
  const rk = SCENES[cur].key;
  if (RESTS.has(rk)) {
    if (restKey !== rk) { restKey = rk; restLin = 1; }
    restLin = Math.max(0, Math.min(1, restLin + (playingNow() ? dt : -dt) / 1.5));   // a second and a half either way
    restAct = restLin * restLin * (3 - 2 * restLin);
    setRestK(restAct);
    sdt = dt * restAct; restClock[rk] = (restClock[rk] ?? t) + sdt; st = restClock[rk];
    // Bars that fall under their own weight get real time and two seconds more, so they settle on the floor.
    if (REST_FALL.has(rk)) { restTail = restLin > 0 ? 2 : Math.max(0, restTail - dt); if (restLin < 1) sdt = dt; }
    draw = restLin > 0 || (REST_FALL.has(rk) && restTail > 0);
  } else setRestK(1);
  const d0 = performance.now();
  try { if (draw) inst.draw(st, sdt); }
  catch (e) { fail(cur, e); show(cur); setStatus(`${SCENES[cur].name} stopped with an error; the diagnostics overlay (\`) has the details.`); }
  drawMs += (performance.now() - d0 - drawMs) * .05;
  // The old scene dissolves into the new one; while the new one's code is still loading, the old picture holds.
  if (fade > 0) { if (inst.loaded === false) fadeAt = performance.now(); fade = Math.max(0, 1 - (performance.now() - fadeAt) / 2200); fadeCv.style.opacity = fade; }
}
let drawMs = 0;
const RESTS = new Set(['synthwave', 'neonhighway', 'vector', 'lasers', 'memphis', 'spectrumBars', 'feedback', 'superscope', 'beatstars', 'dancingscope', 'scope', 'spectrum', 'inkBeat']);
let restKey = '', restAct = 1, restLin = 1, restTail = 0; const restClock = {};
const REST_FALL = new Set(['spectrumBars']);

/* Share builds a link with the scene, the track and the ambience level; Previous lives in the sheet */
el('prevBtn').addEventListener('click', () => prevTrack());
function setLink() {
  const parts = [slug(SCENES[cur])], ct = currentTrack();
  if (ct && !ct.live && !ct.own) parts.push('m-' + trackSlug(ct));   // your own music stays on your device
  if (Math.round(ambienceLevel * 100) !== 35) parts.push('a' + Math.round(ambienceLevel * 100));
  if (ST.current().builtIn) parts.push('s-' + ST.current().id);   // your own soundtracks stay on your device
  return (NATIVE ? SITE : location.origin + location.pathname) + '#' + parts.join('.');   // a link others can open
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
  let lowNoted = false;
  const check = () => {
    if (!b.charging && b.level < .4 && !lowPower && !batteryNoted) { batteryNoted = true; setLowPower(true, 'Low power turned on to spare the battery. Turn it off under Settings.'); }
    const heavy = ['webgl', 'video'].includes(instances[cur].kind) || instances[cur].kind === 'three';
    if (!b.charging && b.level < .2 && heavy && !lowNoted) { lowNoted = true; const i = SCENES.findIndex(s => s.key === 'nightSky'); if (i >= 0) { go(i); setStatus('Battery below 20%: moved to a still scene, which costs almost nothing to show.'); } }
  };
  check(); b.addEventListener('levelchange', check); b.addEventListener('chargingchange', check);
}).catch(() => {});
let fpsAcc = 0, fpsN = 0, slowFor = 0, autoLow = false, lastFps = 0, diagAt = 0;
function watchFps(real) {
  fpsAcc += real; fpsN++;
  if (fpsAcc < 1) return;
  const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; lastFps = fps;
  if (fps < 22 && !lowPower && !autoLow && !document.hidden) {
    if (++slowFor >= 6) { autoLow = true; setLowPower(true, 'Low power turned on because the frame rate was low. Turn it off under Settings in the ⋯ menu.'); }
  } else slowFor = 0;
}
function drawDiag() { setDiag(diagLines()); }
function diagLines() {
  const s = SCENES[cur], inst = instances[cur], st = stageOf(inst), amb = ambienceState();
  return [
    `${s.name} · ${inst.kind} ${st.width || st.videoWidth || '?'}×${st.height || st.videoHeight || '?'} · DPR ${DPR}${lowPower ? ' · low power' : ''}${lively ? ' · lively' : ''}${broken[cur] ? ' · BROKEN' : ''}`,
    `cost: ${['webgl', 'video'].includes(instances[cur].kind) ? 'GPU scene' : `${drawMs.toFixed(1)} ms a frame on the CPU`} · ${drawMs > 12 || instances[cur].kind === 'webgl' ? 'heavy on the battery' : drawMs > 5 ? 'moderate' : 'light'}`,
    `${lastFps.toFixed(0)} fps · ${W}×${H} css px · ${gpuName()}${inst.kind === 'webgl' && (governor.scale < 1 || governor.skip) ? ` · governor ${Math.round(governor.scale * 100)}%${governor.skip ? ', half rate' : ''}` : ''}`,
    `weather ${weather.toFixed(2)} · daylight ${daylight().toFixed(2)}${localOn ? ' (local)' : ''}`,
    `music ${musicPlaying ? 'playing' : 'off'} · level ${musicLevel.toFixed(2)} · bass ${bands.bass.toFixed(2)} mid ${bands.mid.toFixed(2)} treble ${bands.treble.toFixed(2)}`,
    (b => `beat ${b.bpm.toFixed(1)} BPM${currentTrack()?.bpm ? '' : ' (heard)'} · lock ${Math.round(b.lock * 100)}% · the one on beat ${b.one + 1} · at ${(b.beats - b.one).toFixed(2)}${trackPos() ? ` · track ${trackPos().at.toFixed(2)} s` : ''}${b.lat ? ` · latency ${Math.round(b.lat * 1000)} ms` : ''}`)(beatPos()),
    `ambience ${amb.kind} · level ${amb.level.toFixed(2)} · ${amb.layers} layer${amb.layers === 1 ? '' : 's'}`,
  ];
}
// The version, under Settings: the Android app checks for a newer one on demand (native-ui.js); the website is always current.
el('verNote').textContent = NATIVE ? `Version 1.0.${import.meta.env.VITE_APP_VERSION}` : `Web app, always the latest (1.0.${import.meta.env.VITE_APP_VERSION})`;
el('updBtn').hidden = !NATIVE;
el('copyDiagBtn').addEventListener('click', async () => {
  const text = [`Slow Windows · ${new Date().toISOString()} · ${navigator.userAgent}`, `installed ${window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches} · track ${el('npTitle').textContent}`, '', diagText(diagLines())].join('\n');
  try { await navigator.clipboard.writeText(text); setStatus('Diagnostics copied. Paste them into a message.'); } catch (e) { setStatus("Couldn't copy: the browser refused. Turn on Diagnostics and take a screenshot instead."); }
});
// Seconds spent on each scene, for the picker's Most watched order; saved now and then.
const watch = state.watch || {}; let watchSaved = 0;
function frame(now) {
  const real = (now - last) / 1000, dt = Math.min(.05, real) * sleepPace(now); last = now; t += dt;   // the sleep timer slows the scene toward the end
  if (!document.hidden && !listening) { const n = SCENES[cur].name; watch[n] = (watch[n] || 0) + Math.min(.05, real); if (now - watchSaved > 30000) { watchSaved = now; saveState({ watch }); } }
  tickWeather(dt); sampleMusic(dt); tickFades(now); watchFps(real);
  if (!benching()) tickDrift(now);   // Drift waits while every scene is being tested
  tickSleep(now); tickPulse(dt); tickGrade(now, SCENES[cur].key); tickHaptic(dt);
  if (diagOn() && now - diagAt > 500) { diagAt = now; drawDiag(); }
  if (picker.hidden && !listening) { render(dt); drawWx(dt, SCENES[cur].key, t); }   // nothing to draw behind the scene grid or in listen-only
  requestAnimationFrame(frame);
}
if (still) setInterval(() => { tickFades(performance.now()); sampleMusic(.1); }, 100);
setInvalidate(() => { if (still) render(0); });

initTimer({ sceneName: () => SCENES[cur].name });
initDrift({ go, current: () => cur, cards });
initWake({ go, find: key => SCENES.findIndex(s => s.key === key) });
initMoods({ go, find: key => SCENES.findIndex(s => s.key === key), syncAmb: () => { amb.value = ambienceLevel; amb.dispatchEvent(new Event('input')); } });
initSettings({ drawDiag });

const clock = el('clock');
const tick = () => { const d = new Date(); clock.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
tick(); setInterval(tick, 10000);

/* The controls fade after a few quiet seconds (five with a mouse, three on touch). A mouse move, a key or a tap or upward
   swipe brings them back; sideways swipes and the arrow keys change scene without them. Hiding them by hand is remembered. */
let idleTimer, lastTouch = 0;
function wake(ms) {
  wakeFromSleep();
  if (document.body.classList.contains('idle')) { document.body.classList.remove('idle'); syncStrip(); }
  clearTimeout(idleTimer);
  idleTimer = setTimeout(hide, ms || (performance.now() - lastTouch < 1500 ? 3000 : 5000));
  keepAwake();
}
function hide() {
  clearTimeout(idleTimer);
  if (document.querySelector('.tmenu:not([hidden])')) { idleTimer = setTimeout(hide, 3000); return; }   // not while a menu is open
  settleStrip(); document.body.classList.add('idle');
}
function showByHand() { saveState({ hidden: false }); wake(3000); }
function hideByHand() { saveState({ hidden: true }); hide(); }
const onScene = e => !e.target.closest('.chrome, .sheet, .lib, .help, .hint1, .diag, .picker, .wiz, .summary, .intent, .info-card, .tour, .update, .ivpill, .shelves, .strip');
window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') wake(); }, { passive: true });
window.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || !onScene(e)) wake(); }, { passive: true });
window.addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) wake(); else { wakeFromSleep(); keepAwake(); } }, { passive: true });
window.addEventListener('focusin', e => { if (!onScene(e)) wake(); });

/* Ambient sound: starts on the first gesture, follows the scene, its level is remembered */
const amb = el('amb'); amb.value = ambienceLevel;
amb.addEventListener('input', () => setAmbienceLevel(Number(amb.value)));
for (const r of [amb, el('vol')]) { const say = () => r.setAttribute('aria-valuetext', Math.round(r.value * 100) + '%'); r.addEventListener('input', say); say(); }
['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, startAmbience, { once: true, passive: true }));

// Listen only lets the screen sleep (the web's wake lock is let go; the Android app stops holding the screen on).
el('listenBtn').addEventListener('click', () => { el('sheetClose').click(); setListening(true); });
window.addEventListener('sw-listening', e => { if (e.detail && wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } else if (!e.detail) keepAwake(); });
/* Keep the screen on while a scene is showing. The lock drops when the tab is hidden and is taken again when it returns. */
let wakeLock = null;
async function keepAwake() {
  if (NATIVE) { nativeKeepAwake(!document.body.classList.contains('sleep')); return; }   // Android keeps the screen on itself
  if (!('wakeLock' in navigator) || wakeLock || document.hidden || listening) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) { /* refused: low battery, a hidden page or a browser without it */ }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { keepAwake(); show(cur); }   // show() starts the scene's video again
  else STAGES.forEach(e => { if (e.tagName === 'VIDEO') e.pause(); });
});

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
    case 'ArrowRight': step(1); break;
    case 'ArrowLeft': step(-1); break;
    case 'n': case 'N': nextTrack(); break;
    case 'h': case 'H': love(); break;
    case 'i': case 'I': openInfo(); break;
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
    case 'b': case 'B': setListening(true); break;
    case 'c': case 'C': postcard(); break;
    case 'g': case 'G': if (!picker.hidden) closePicker(); else shelvesOpen() ? closeShelves() : openShelves(); break;
    case '?': showHelp(); break;
    case '`': setDiagOn(!diagOn()); break;
    case 'Escape': if (!el('trackInfo').hidden) { el('trackInfo').hidden = true; break; } if (!el('tour').hidden) { el('tourSkip').click(); break; } if (wizardOpen()) break; else if (!picker.hidden) closePicker(); else if (shelvesOpen()) closeShelves(); else if (helpOpen()) showHelp(false); else if (aboutOpen()) openAbout(false); else if (libOpen()) openLib(false); else if (sheetOpen()) openSheet(false); else closeMenus(); break;
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
  pressTimer = setTimeout(() => { if (swipe && !swipe.drag) { swipe.long = true; holding = true; haptic(); showByHand(); focusStrip(); } }, 550);
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
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { haptic(); showByHand(); step(dx < 0 ? 1 : -1); return; }   // the new scene, with the controls
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
    tapTimer = setTimeout(() => {
      tapTimer = null;
      if (quiet && focusRunning() && document.body.classList.contains('idle')) { if (!quietTold) { quietTold = true; caption('Focusing · swipe up for the controls'); } return; }
      if (document.body.classList.contains('idle')) showByHand();   // the same controls wherever the tap is
      else hideByHand();
    }, 260);
  }
}, { passive: true });

// Quiet focus: the setting, on unless turned off.
let quiet = state.quiet ?? true, quietTold = false;
const quietBtn = el('quietBtn'); quietBtn.setAttribute('aria-pressed', String(quiet));
quietBtn.addEventListener('click', () => { quiet = !quiet; quietBtn.setAttribute('aria-pressed', String(quiet)); saveState({ quiet }); });
window.addEventListener('sw-timer', e => { if (e.detail === 'focus') quietTold = false; });

// Breaks change the scene: a light, calm scene for the break (a favourite if there is one), and the focus block brings
// yours back.
let breakScene = !!state.breakScene, beforeBreak = -1;
const breakBtn = el('breakSceneBtn'); breakBtn.setAttribute('aria-pressed', String(breakScene));
breakBtn.addEventListener('click', () => { breakScene = !breakScene; breakBtn.setAttribute('aria-pressed', String(breakScene)); saveState({ breakScene }); });
window.addEventListener('sw-timer', e => {
  if (!breakScene) return;
  if (e.detail === 'break') {
    const light = SCENES.map((s, i) => i).filter(i => i !== cur && included(SCENES[i].name) && ['bright', 'warm', 'calm'].includes(SCENES[i].tone) && SCENES[i].mood !== 'night' && SCENES[i].group !== 'Trip' && SCENES[i].group !== 'Classic visualisers');
    const favs = light.filter(i => (state.favs || []).includes(SCENES[i].name)), pool = favs.length ? favs : light;
    if (pool.length) { beforeBreak = cur; go(pool[Math.floor(Math.random() * pool.length)]); }
  } else if (beforeBreak >= 0) { go(beforeBreak); beforeBreak = -1; }
});

// Feel the beat: a light buzz on strong beats in the visualiser scenes, off unless turned on.
let hapticBeat = !!state.hapticBeat, beatCool = 0, lastBass = 0;
const hapticBtn = el('hapticBtn'); hapticBtn.setAttribute('aria-pressed', String(hapticBeat));
hapticBtn.addEventListener('click', () => { hapticBeat = !hapticBeat; hapticBtn.setAttribute('aria-pressed', String(hapticBeat)); saveState({ hapticBeat }); });
const BEAT_GROUPS = new Set(['Classic visualisers', '80s', 'Trip', 'Workout']);
let lastBeat = 0;
function tickHaptic(dt) {
  beatCool -= dt;
  // On the beat clock once it has locked onto the kicks; until then, on strong rises in the bass.
  const b = beatPos(), beat = Math.floor(b.beats), onBeat = b.lock > .4 ? beat !== lastBeat : bands.bass > .75 && lastBass <= .75;
  if (hapticBeat && musicPlaying && beatCool <= 0 && BEAT_GROUPS.has(SCENES[cur].group) && onBeat) { beatCool = .2; try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} }
  lastBass = bands.bass; lastBeat = beat;
}

// What a focus block is for: asked as it starts, in a small card that goes away by itself.
const intentBox = el('intent'), intentIn = el('intentIn'); let intentTimer;
function closeIntent(save) { if (intentBox.hidden) return; if (save) setIntention(intentIn.value); intentBox.hidden = true; clearTimeout(intentTimer); }
window.addEventListener('sw-focus-start', () => {
  intentIn.value = state.lastIntent || ''; intentBox.hidden = false; intentIn.select();
  clearTimeout(intentTimer); intentTimer = setTimeout(() => closeIntent(true), 15000);
});
el('intentOk').addEventListener('click', () => closeIntent(true));
intentIn.addEventListener('keydown', e => { if (e.key === 'Enter') closeIntent(true); else if (e.key === 'Escape') { intentIn.value = ''; closeIntent(true); } else { clearTimeout(intentTimer); intentTimer = setTimeout(() => closeIntent(true), 20000); } });

// The sound preset, and the extra sounds you mix in under Music.
const eqButtons = [...el('eqSeg').querySelectorAll('button')];
const drawEq = () => eqButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.eq === eqName)));
eqButtons.forEach(b => b.addEventListener('click', () => { setEq(b.dataset.eq); drawEq(); })); drawEq();
const mixBox = document.createElement('div'); mixBox.className = 'mixer';
el('amb').closest('label').after(mixBox);
function drawMixer() {
  mixBox.textContent = '';
  for (const x of extraList()) {
    const row = document.createElement('label'); row.className = 'slider';
    const name = document.createElement('span'); name.textContent = EXTRA_KINDS[x.k];
    const r = document.createElement('input'); r.type = 'range'; r.min = 0; r.max = 1; r.step = .01; r.value = x.v; r.setAttribute('aria-label', EXTRA_KINDS[x.k] + ' level');
    r.addEventListener('input', () => setExtraLevel(x.k, Number(r.value)));
    const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'x'; rm.textContent = '×'; rm.setAttribute('aria-label', 'Remove ' + EXTRA_KINDS[x.k]);
    rm.addEventListener('click', e => { e.preventDefault(); removeExtra(x.k); drawMixer(); });
    row.append(name, r, rm); mixBox.append(row);
  }
  const sel = document.createElement('select'); sel.setAttribute('aria-label', 'Add a sound');
  sel.append(new Option('+ Add a sound…', ''), ...Object.entries(EXTRA_KINDS).filter(([k]) => !extraList().some(x => x.k === k)).map(([k, n]) => new Option(n, k)));
  sel.addEventListener('change', () => { if (sel.value) { startAmbience(); addExtra(sel.value); drawMixer(); } });
  mixBox.append(sel);
}
drawMixer();

// Your photos: add, list with a remove button each, and a way to go to the scene.
const photoScene = SCENES.findIndex(s => s.key === 'photos');
function drawPhotos() {
  const box = el('photoList'); box.textContent = '';
  el('photoNote').textContent = photos().length ? `${photos().length} photo${photos().length === 1 ? '' : 's'}, kept on this device` : 'None yet';
  for (const p of photos()) {
    const t = document.createElement('span'); t.className = 'ph';
    const im = document.createElement('img'); im.src = p.url; im.alt = p.name;
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Remove ' + p.name);
    x.addEventListener('click', () => removePhoto(p.id));
    t.append(im, x); box.append(t);
  }
}
onPhotosChange(drawPhotos); loadPhotos();
el('photoAdd').addEventListener('click', () => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.addEventListener('change', async () => { const n = await addPhotos([...inp.files]); setStatus(`Added ${n} photo${n === 1 ? '' : 's'}.`); if (photoScene >= 0) go(photoScene); });
  inp.click();
});
el('photoGo').addEventListener('click', () => { if (photoScene >= 0) go(photoScene); });

// Between tracks and the volume limit, under Music and Now playing.
const xButtons = [...el('xfadeSeg').querySelectorAll('button')];
const drawX = () => xButtons.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.x === xfade)));   // -1 is Auto
xButtons.forEach(b => b.addEventListener('click', () => { setCrossfade(+b.dataset.x); drawX(); })); drawX();
// The Workout pace, under Music.
const paceButtons = [...el('paceSeg').querySelectorAll('button')];
const drawPace = () => paceButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === pace)));
paceButtons.forEach(b => b.addEventListener('click', () => { setPace(b.dataset.p); drawPace(); setStatus(`Workout pace: ${b.textContent.toLowerCase()}.`); })); drawPace();
// Holding play or pause offers the sleep timer: 15, 30 or 60 minutes, or the end of the track.
{
  const pop = document.createElement('div'); pop.className = 'tmenu sleeppop'; pop.hidden = true; pop.setAttribute('role', 'menu');
  const head = document.createElement('span'); head.className = 'lbl'; head.textContent = 'Stop playing';
  pop.append(head);
  for (const [label, v] of [['In 15 minutes', 15], ['In 30 minutes', 30], ['In 60 minutes', 60], ['At the end of this track', 'track'], ['Sleep timer off', 0]]) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('role', 'menuitem');
    b.addEventListener('click', () => { pop.hidden = true; setSleep(v); if (!v) setStatus('Sleep timer off.'); });
    pop.append(b);
  }
  document.body.append(pop);
  for (const id of ['play']) {
    const b = el(id); let hold = null, held = false;
    b.addEventListener('pointerdown', () => { held = false; clearTimeout(hold); hold = setTimeout(() => {
      held = true; haptic(); const r = b.getBoundingClientRect();
      pop.hidden = false; pop.style.left = `${Math.max(10, Math.min(innerWidth - 240, r.left + r.width / 2 - 115))}px`; pop.style.bottom = `${innerHeight - r.top + 12}px`;
    }, 480); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => clearTimeout(hold));
    b.addEventListener('click', e => { if (held) { held = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    b.addEventListener('contextmenu', e => e.preventDefault());
  }
  document.addEventListener('pointerdown', e => { if (!pop.hidden && !e.target.closest('.sleeppop')) pop.hidden = true; });
}
const capButtons = [...el('capSeg').querySelectorAll('button')];
const drawCap = () => capButtons.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.cap === volCap)));
capButtons.forEach(b => b.addEventListener('click', () => { setVolCap(+b.dataset.cap); drawCap(); })); drawCap();

// The track info card: tap the track's name under Music (or press I).
// The track card: filled from the playing track, and filled again whenever the track changes while it is open.
function fillInfo() {
  const info = trackInfo(); if (!info) return false;
  el('tiTitle').textContent = info.t; el('tiArtist').textContent = info.a; el('tiKind').textContent = [info.kind, info.lic].filter(Boolean).join(' · ');
  const ul = el('tiLines'); ul.textContent = '';
  for (const l of info.lines) { const li = document.createElement('li'); li.textContent = l; ul.append(li); }
  if (info.src) { const li = document.createElement('li'), a = document.createElement('a'); a.href = info.src; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Source and full credit ↗'; li.append(a); ul.append(li); }
  const more = el('tiMore'); more.textContent = '';
  if (info.more.length) {
    const h = document.createElement('span'); h.className = 'lbl'; h.textContent = `More by ${info.a}`; more.append(h);
    for (const t of info.more) { const r = document.createElement('div'); r.className = 'row'; const n = document.createElement('span'); n.textContent = t.t; const b = document.createElement('button'); b.type = 'button'; b.textContent = 'play next'; b.addEventListener('click', () => { playNext(t); b.textContent = 'queued'; b.disabled = true; }); r.append(n, b); more.append(r); }
  }
  return true;
}
function openInfo() {
  if (!fillInfo()) { setStatus('Nothing playing yet.'); return; }
  el('trackInfo').hidden = false; el('tiClose').focus();
}
el('tiClose').addEventListener('click', () => { el('trackInfo').hidden = true; });
el('npTitle').addEventListener('click', openInfo); el('npTitle').setAttribute('role', 'button'); el('npTitle').tabIndex = 0; el('npTitle').title = 'About this track';
el('npTitle').addEventListener('keydown', e => { if (e.key === 'Enter') openInfo(); });

function drawLove() {
  const on = currentLoved();
  el('loveBtn').setAttribute('aria-pressed', String(on)); el('loveBtn').textContent = (on ? '♥' : '♡') + ' Love';
  for (const b of [el('barLove')]) { b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Loved. Tap to unlove' : 'Love this track'); }
}
// The player bar: previous and love here (play and next are wired in music.js); the art follows the track, as does the
// love state, on every track change and play or pause.
el('prev').addEventListener('click', () => prevTrack());
el('barTitle').addEventListener('click', () => openInfo());
// The seek line: tap to jump, or drag with the time shown above the finger; arrow keys step 10 s.
for (const pg of [el('barSeek')]) {
  const bubble = pg.querySelector('.when'), fill = pg.firstChild;
  const fracAt = e => { const r = pg.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
  const show = f => { const p = trackPos(); fill.style.width = `${(f * 100).toFixed(2)}%`; if (p) { bubble.hidden = false; bubble.style.left = `${f * 100}%`; bubble.textContent = `${trackClock(f * p.dur)} / ${trackClock(p.dur)}`; } };
  pg.addEventListener('pointerdown', e => {
    e.stopPropagation(); if (!trackPos()) return;
    pg.setPointerCapture(e.pointerId); pg.classList.add('drag'); show(fracAt(e));
  });
  pg.addEventListener('pointermove', e => { if (pg.classList.contains('drag')) show(fracAt(e)); });
  const done = e => { if (!pg.classList.contains('drag')) return; pg.classList.remove('drag'); bubble.hidden = true; if (e.type === 'pointerup') { seekFraction(fracAt(e)); haptic(); } };
  pg.addEventListener('pointerup', done); pg.addEventListener('pointercancel', done);
  pg.addEventListener('click', e => e.stopPropagation());
  pg.addEventListener('keydown', e => {
    const p = trackPos(); if (!p || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation(); seekFraction((p.at + (e.key === 'ArrowRight' ? 10 : -10)) / p.dur);
  });
}
// Holding the cover opens the track card (licence, source, more by the artist); a tap still opens the soundtracks.
{
  const art = el('stBtn'); let hold = null, held = false;
  art.addEventListener('pointerdown', () => { held = false; clearTimeout(hold); hold = setTimeout(() => { held = true; haptic(); openInfo(); }, 480); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) art.addEventListener(ev, () => clearTimeout(hold));
  art.addEventListener('click', e => { if (held) { held = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  art.addEventListener('contextmenu', e => e.preventDefault());
}
// Swiping the bar sideways skips: left for the next track, right for the previous one. The bar follows the finger a
// little, and a swipe never also presses the button it started on.
for (const bar of [el('playerBar')]) {
  let x0 = null, y0 = 0, swiped = false;
  bar.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; swiped = false; bar.style.transition = 'none'; });
  bar.addEventListener('pointermove', e => { if (x0 === null) return; const dx = e.clientX - x0; if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(e.clientY - y0)) bar.style.transform = `translateX(${Math.max(-40, Math.min(40, dx * .35))}px)`; });
  const end = e => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    bar.style.transition = 'transform .25s ease'; bar.style.transform = '';
    if (e.type === 'pointerup' && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; haptic(); if (dx < 0) { nextTrack(); trackCaption('→'); } else { prevTrack(); trackCaption('←'); } }
  };
  bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
  bar.addEventListener('click', e => { if (swiped) { swiped = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}
el('barLove').addEventListener('click', () => love());
function syncBar() {
  drawLove();
  if (!el('trackInfo').hidden) fillInfo();   // an open track card follows the music
  const art = currentArt(), im = el('barArt');
  if (art) { if (im.getAttribute('src') !== art) im.src = art; im.hidden = false; } else im.hidden = true;
  const [name, artist] = el('npTitle').textContent.split(' — ');
  el('barName').textContent = name || 'Nothing playing'; el('barArtist').textContent = artist || 'Tap play for music';
  const ct = currentTrack(); el('stBtn').setAttribute('aria-label', `${ct ? `${ct.t} by ${ct.a}. ` : ''}Soundtrack: ${el('stName').textContent}. Tap to change it or open the library.`);
}
window.addEventListener('sw-playstate', syncBar); window.addEventListener('sw-loved', syncBar);
syncBar();   // the track waiting on opening
new MutationObserver(syncBar).observe(el('npTitle'), { childList: true, characterData: true, subtree: true });
function love() { const on = toggleLove(); if (on === null) return; drawLove(); caption(on ? '♥ Loved' : 'Not loved'); haptic(); }
el('loveBtn').addEventListener('click', love);

/* The scene picker: every scene as a thumbnail, grouped. Built once; reopening only updates the current scene and new
   thumbnails. While it is open the scene behind stops drawing, so scrolling the grid stays smooth. */
const picker = el('picker'), pickerGrid = el('pickerGrid');
// holding: the finger that opened the grid is still down; liftAt: when it came up. Taps are ignored until just after the lift.
let pickerTiles = null, holding = false, liftAt = 0;
let pickMode = state.pickMode || 'all', pickHeads = [];
function buildPicker() {
  pickerTiles = []; pickHeads = [];
  let g = '';
  SCENES.forEach((s, i) => {
    if (s.group !== g) {
      g = s.group; const h = document.createElement('h3'); h.textContent = g; h.dataset.g = g;
      // In Choose mode, each group heading can include or leave out the whole group.
      const grp = g, tg = document.createElement('button'); tg.type = 'button'; tg.className = 'pbtn grpTog';
      tg.addEventListener('click', () => {
        const names = SCENES.filter(x => x.group === grp).map(x => x.name), on = names.some(n => !included(n));
        if (!setIncluded(names, on, SCENES.map(x => x.name))) setStatus('At least one scene has to stay in.');
      });
      h.append(tg); pickerGrid.append(h); pickHeads.push(h);
    }
    const b = document.createElement('button'); b.type = 'button';
    const t = document.createElement('span'); t.className = 'pt'; t.style.background = s.sw;
    const im = document.createElement('img'); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.src = `assets/thumbs/${slug(s)}.jpg`; t.append(im);
    im.addEventListener('error', () => { if (!thumbs[s.name]) im.hidden = true; }, { once: true });
    b.append(t, s.name);
    // The lift of the long press that opened the grid would otherwise pick whatever tile is under the finger.
    b.addEventListener('click', () => {
      if (holding || performance.now() - liftAt < 400) return;
      if (pickMode === 'choose') { toggleScene(i); return; }
      closePicker(); go(i);
    });
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
  applyPickMode();
  picker.hidden = false;
  if (!pickerTiles[cur].b.hidden) pickerTiles[cur].b.scrollIntoView({ block: 'center' }); else pickerGrid.scrollTop = 0;
}
// All, by group; Favourites only; or Most watched, one list ordered by the time spent on each.
function applyPickMode() {
  const favs = new Set(state.favs || []), rank = SCENES.map((s, i) => i).sort((a, b) => (watch[SCENES[b].name] || 0) - (watch[SCENES[a].name] || 0));
  const choosing = pickMode === 'choose', shown = i => choosing || (included(SCENES[i].name) && (pickMode !== 'fav' || favs.has(SCENES[i].name)));
  picker.classList.toggle('choosing', choosing); el('chooseBar').hidden = !choosing;
  pickerTiles.forEach(({ b }, i) => {
    b.hidden = !shown(i); b.style.order = pickMode === 'most' ? String(rank.indexOf(i)) : '';
    b.classList.toggle('off', !included(SCENES[i].name));
    if (choosing) b.setAttribute('aria-label', `${SCENES[i].name}: ${included(SCENES[i].name) ? 'included' : 'left out'}. Tap to change.`); else b.removeAttribute('aria-label');
  });
  pickHeads.forEach(h => {
    const idx = SCENES.map((s, i) => i).filter(i => SCENES[i].group === h.dataset.g);
    h.hidden = pickMode === 'most' || !idx.some(shown);
    const tg = h.querySelector('.grpTog'); tg.hidden = !choosing; tg.textContent = idx.some(i => !included(SCENES[i].name)) ? 'Include all' : 'Leave all out';
  });
  const n = SCENES.filter(s => included(s.name)).length;
  el('chooseNote').textContent = `${n} of ${SCENES.length} scenes included. Tap a scene to include or leave it out: left-out scenes are skipped when swiping, by Drift and by break scenes.`;
  if (pickMode === 'fav' && !favs.size) pickerGrid.dataset.empty = 'Star scenes with Favourite to see them here.'; else delete pickerGrid.dataset.empty;
  el('pickMode').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === pickMode)));
}
el('pickMode').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { pickMode = b.dataset.m; if (pickMode !== 'choose') saveState({ pickMode }); if (pickerTiles) applyPickMode(); pickerGrid.scrollTop = 0; }));
function toggleScene(i) {
  const name = SCENES[i].name;
  if (!setIncluded([name], !included(name), SCENES.map(x => x.name))) setStatus('At least one scene has to stay in.');
}
onExcludedChange(() => { if (pickerTiles) applyPickMode(); el('chooseSum').textContent = chooseSum(); });
const chooseSum = () => excluded.size ? `${SCENES.length - excluded.size} of ${SCENES.length} included` : `all ${SCENES.length} included`;
el('chooseSum').textContent = chooseSum();
el('chooseAll').addEventListener('click', () => setIncluded(SCENES.map(s => s.name), true));
el('chooseFavs').addEventListener('click', () => {
  const favs = new Set(state.favs || []);
  if (!favs.size) { setStatus('Star some scenes with Favourite first.'); return; }
  setIncluded(SCENES.map(s => s.name), true); setIncluded(SCENES.filter(s => !favs.has(s.name)).map(s => s.name), false, SCENES.map(s => s.name));
});
el('chooseBtn').addEventListener('click', () => { el('sheetClose').click(); pickMode = 'choose'; openPicker(); });
function closePicker() { picker.hidden = true; if (pickMode === 'choose') { pickMode = state.pickMode && state.pickMode !== 'choose' ? state.pickMode : 'all'; } }
el('pickerClose').addEventListener('click', closePicker);
el('sceneBtn').addEventListener('click', () => openShelves());
el('stripAll').addEventListener('click', () => openShelves());
toast.addEventListener('click', () => { if (toast.classList.contains('scene')) openShelves(); });
initSceneMenu({ SCENES, cur: () => cur, go, commit: sceneKept, included, haptic, wake: () => wake(),
  thumb: i => thumbs[SCENES[i].name] || `assets/thumbs/${slug(SCENES[i])}.jpg`, openGrid: () => openPicker() });

// A scene link in the hash switches scenes (so the back button walks through them).
window.addEventListener('hashchange', () => { const i = parseHash().scene; if (i >= 0) go(i); });

// Installable and usable offline once the service worker has seen the files. Fails quietly where it isn't allowed.
if (import.meta.env.PROD && !NATIVE && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});   // the Android app carries its files itself

initNativeUi({ caption, frame: () => frameBlob(false), go, current: () => cur, find: key => SCENES.findIndex(s => s.key === key), sceneName: () => SCENES[cur].name });
initBench({ scenes: SCENES, go, current: () => cur });
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
// ?mood=study|relax|sleep: the long-press shortcuts on the app icon. Music may wait for a first tap where the browser insists.
if (['study', 'relax', 'workout', 'sleep'].includes(q.get('mood'))) { if (!el('hint1').hidden) el('hint1Ok').click(); applyMood(q.get('mood')); }
if (location.search) history.replaceState(null, '', location.pathname + location.hash);
scheduleThumb();
// Once the app has settled, fetch the rest of the scenes' code quietly, so they open at once and work offline.
setTimeout(() => (window.requestIdleCallback || (f => f()))(prefetchScenes), 15000);
