import './style.css';
import { cv, ctx, glc, stillImg, fadeCv, fctx, still, W, H, DPR, lowPower, lively, setSize, setLowPowerFlag, setLivelyFlag, setInvalidate } from './view.js';
import { A, M, ok } from './assets.js';
import { state, saveState } from './state.js';
import { setStatus } from './status.js';
import { weather, tickWeather, setWeatherOverride } from './weather.js';
import { setDaylightOverride } from './daylight.js';
import { SCENES, makeScene } from './scenes/index.js';
import { STAGES, BGS } from './scenes/glass-shared.js';
import { TRACKS, sampleMusic, tickFades, audioCtx, setSceneKey, onSceneChange, togglePlay, nextTrack, follow, setFollow, openLib, libOpen, setDuck, announce, setArtworkSource } from './music.js';
import { level as ambienceLevel, setAmbienceKind, setAmbienceLevel, startAmbience, setAmbienceMute, ambienceState } from './ambience.js';
import { bands, musicLevel, musicPlaying, playTrack, canPlay, fadeOutAll } from './music.js';
import { daylight } from './daylight.js';
import { localOn, enableLocal, disableLocal } from './local.js';
import { gpuName, diagOn, toggleDiag, setDiag } from './diag.js';

const el = id => document.getElementById(id);
const byKey = Object.fromEntries(TRACKS.map(t => [t.a + '|' + t.t, t]));
const instances = SCENES.map(makeScene);
SCENES.forEach((s, i) => { const k = state.bgs && state.bgs[s.name]; if (k && BGS[k] && instances[i].setBg) instances[i].setBg(k); });
const ready = new Array(SCENES.length).fill(false);
const slug = s => s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fromHash = SCENES.findIndex(s => '#' + slug(s) === location.hash);
let cur = Math.max(0, fromHash >= 0 ? fromHash : SCENES.findIndex(s => s.name === state.scene)), fade = 0, fadeAt = 0, t = 8, last = performance.now();
const favs = new Set(state.favs || []);

/* Scene navigation: a strip of cards, each with a thumbnail once the scene has been seen */
const THUMB_KEY = 'sw-thumbs';
let thumbs = {};
try { thumbs = JSON.parse(localStorage.getItem(THUMB_KEY) || '{}') || {}; } catch (e) { thumbs = {}; }
const nav = el('nav');
let lastGroup = '';
const cards = SCENES.map((s, i) => {
  if (s.group !== lastGroup) {
    const g = document.createElement('span'); g.className = 'grp'; g.textContent = s.group; nav.appendChild(g); lastGroup = s.group;
  }
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'scene-' + i; b.className = 'card'; b.dataset.i = i;
  const th = document.createElement('span'); th.className = 'thumb'; th.style.background = s.sw;
  const im = document.createElement('img'); im.alt = ''; im.hidden = true; if (thumbs[s.name]) { im.src = thumbs[s.name]; im.hidden = false; }
  th.appendChild(im);
  const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = s.name;
  const star = document.createElement('span'); star.className = 'star'; star.textContent = '★'; star.hidden = !favs.has(s.name);
  b.append(th, lbl, star);
  b.addEventListener('click', () => go(i));
  nav.appendChild(b);
  return { b, im, star };
});
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
// A few seconds into a scene, grab a small frame of it for the nav. Kept per viewer; dropped if storage is short.
function captureThumb() {
  const s = SCENES[cur], inst = instances[cur], src = stageOf(inst);
  const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
  if (!sw || !sh || src.hidden) return;
  try {
    const k = Math.max(160 / sw, 90 / sh);
    thumbG.fillStyle = '#000'; thumbG.fillRect(0, 0, 160, 90);
    thumbG.imageSmoothingEnabled = inst.kind !== 'image';
    thumbG.drawImage(src, (160 - sw * k) / 2, (90 - sh * k) / 2, sw * k, sh * k);
    const url = thumbC.toDataURL('image/jpeg', .6);
    thumbs[s.name] = url; cards[cur].im.src = url; cards[cur].im.hidden = false;
    announce();   // the lock screen shows the scene too
    const json = JSON.stringify(thumbs);
    if (json.length < 2.5e6) localStorage.setItem(THUMB_KEY, json);
  } catch (e) { /* a tainted or blank frame just means no thumbnail yet */ }
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
  setSceneKey(s.music);
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
  fade = still ? 0 : 1; fadeAt = performance.now(); fadeCv.style.opacity = fade;
  cur = i; ensure(cur); show(cur); updateText();
  saveState({ scene: SCENES[cur].name }); onSceneChange();
  driftLast = performance.now(); scheduleThumb();
  if (still) render(0);
}
function render(dt) {
  const inst = instances[cur];
  if (inst.kind === 'canvas') {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  inst.draw(t, dt);
  if (fade > 0) { fade = Math.max(0, 1 - (performance.now() - fadeAt) / 1400); fadeCv.style.opacity = fade; }
}

/* Favourites and Drift: star the scenes you like; Drift moves between them every so often */
const moreBtn = el('moreBtn');
moreBtn.addEventListener('click', () => { const on = !document.body.classList.contains('more'); document.body.classList.toggle('more', on); moreBtn.setAttribute('aria-pressed', String(on)); });
el('shareBtn').addEventListener('click', async () => {
  const url = location.origin + location.pathname + '#' + slug(SCENES[cur]);
  try {
    if (navigator.share) { await navigator.share({ title: 'Slow Windows: ' + SCENES[cur].name, url }); return; }
    await navigator.clipboard.writeText(url); setStatus('Link copied: ' + url);
  } catch (e) { if (e && e.name !== 'AbortError') setStatus(url); }
});
setArtworkSource(() => thumbs[SCENES[cur].name] || null);
const favBtn = el('favBtn'), driftBtn = el('driftBtn');
function drawFav() { const on = favs.has(SCENES[cur].name); favBtn.textContent = (on ? '★' : '☆') + ' Favourite'; favBtn.setAttribute('aria-pressed', String(on)); }
function toggleFav() {
  const name = SCENES[cur].name;
  if (favs.has(name)) favs.delete(name); else favs.add(name);
  cards[cur].star.hidden = !favs.has(name); saveState({ favs: [...favs] }); drawFav();
}
favBtn.addEventListener('click', toggleFav);
let drift = !!state.drift, driftMin = state.driftMin || 20, driftLast = performance.now();
function setDrift(v) { drift = v; driftBtn.setAttribute('aria-pressed', String(v)); saveState({ drift: v }); driftLast = performance.now(); }
driftBtn.addEventListener('click', () => setDrift(!drift));
setDrift(drift);
// Drift prefers favourites, and among those the scenes that suit the hour (bright by day, dark at night).
let driftPick = -1;
function pickDrift() {
  const all = SCENES.map((s, i) => i).filter(i => i !== cur);
  const favPool = all.filter(i => favs.has(SCENES[i].name));
  const base = favPool.length ? favPool : all;
  const want = daylight() > .5 ? 'day' : 'night';
  const suited = base.filter(i => (SCENES[i].mood || 'any') === 'any' || SCENES[i].mood === want);
  const list = suited.length ? suited : base;
  return list[Math.floor(Math.random() * list.length)];
}
function driftNext() { const i = driftPick >= 0 ? driftPick : pickDrift(); driftPick = -1; go(i); }

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
function frame(now) {
  const real = (now - last) / 1000, dt = Math.min(.05, real); last = now; t += dt;
  tickWeather(dt); sampleMusic(dt); tickFades(now); watchFps(real);
  if (drift) {
    const left = driftMin * 60000 - (now - driftLast);
    if (left < 3000 && driftPick < 0) { driftPick = pickDrift(); const mt = byKey[SCENES[driftPick].music]; if (follow && mt && canPlay(mt)) playTrack(mt); }   // the music leads the scene by a few seconds
    if (left <= 0) driftNext();
  }
  tickSleep(now);
  if (diagOn() && now - diagAt > 500) { diagAt = now; drawDiag(); }
  render(dt);
  requestAnimationFrame(frame);
}
if (still) setInterval(() => { tickFades(performance.now()); sampleMusic(.1); }, 100);
setInvalidate(() => { if (still) render(0); });

/* Settings: weather and time of day overrides, the drift interval, music saved for offline */
const setBtn = el('setBtn'), setMenu = el('setMenu'), wx = el('wx'), wxAuto = el('wxAuto');
const TOD = { auto: null, night: 0, dusk: .5, day: 1 };
function applyWeather(v) {
  setWeatherOverride(v); wxAuto.setAttribute('aria-pressed', String(v === null));
  if (v !== null) wx.value = v;
  saveState({ weather: v });
}
wx.addEventListener('input', () => applyWeather(Number(wx.value)));
wxAuto.addEventListener('click', () => applyWeather(null));
applyWeather(typeof state.weather === 'number' ? state.weather : null);
const todButtons = [...el('todSeg').querySelectorAll('button')];
function applyTod(k) {
  if (!(k in TOD)) k = 'auto';
  setDaylightOverride(TOD[k]); todButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tod === k))); saveState({ tod: k });
}
todButtons.forEach(b => b.addEventListener('click', () => applyTod(b.dataset.tod)));
applyTod(state.tod || 'auto');
const driftButtons = [...el('driftSeg').querySelectorAll('button')];
function applyDriftMin(m) { driftMin = m; driftButtons.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.min === m))); saveState({ driftMin: m }); }
driftButtons.forEach(b => b.addEventListener('click', () => applyDriftMin(+b.dataset.min)));
applyDriftMin(driftMin);
// Fetch every bundled track into the cache the service worker serves from, so the music plays offline too.
el('offlineBtn').addEventListener('click', async () => {
  if (!('caches' in window)) { setStatus("This browser can't store files for offline use."); return; }
  const files = TRACKS.filter(x => x.file).map(x => M + x.file);
  try {
    const c = await caches.open('slow-windows-v1');
    for (let i = 0; i < files.length; i++) {
      setStatus(`Saving music for offline use: ${i + 1} of ${files.length}`);
      if (await c.match(files[i])) continue;
      const r = await fetch(files[i]); if (!r.ok) throw new Error(r.status);
      await c.put(files[i], r);
    }
    setStatus('Music saved. The scenes and the bundled tracks now work without a connection.');
  } catch (e) { setStatus("Couldn't save the music. Check the connection and try again."); }
});
setBtn.addEventListener('click', () => {
  const open = setMenu.hidden; closeMenus(); setMenu.hidden = !open; setBtn.setAttribute('aria-expanded', String(!setMenu.hidden));
  if (!setMenu.hidden && wxAuto.getAttribute('aria-pressed') === 'true') wx.value = weather;
  if (!setMenu.hidden) el('weekLine').textContent = weekLine();
});
// Sleep timer: music and ambience fade over the last two minutes, then the scene dims until the next tap or key.
let sleepAt = 0, winding = false;
const sleepButtons = [...el('sleepSeg').querySelectorAll('button')];
function setSleep(min) {
  sleepAt = min ? performance.now() + min * 60000 : 0; winding = false;
  sleepButtons.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.sleep === min)));
  if (!min) { setAmbienceMute(false); document.body.classList.remove('sleep'); }
  else setStatus(`Stopping in ${min} minutes.`);
}
sleepButtons.forEach(b => b.addEventListener('click', () => setSleep(+b.dataset.sleep)));
function tickSleep(now) {
  if (!sleepAt) return;
  const left = sleepAt - now;
  if (!winding && left < 120000) { winding = true; fadeOutAll(110); setAmbienceMute(true, 110); setStatus('Winding down: the music fades over two minutes.'); }
  if (left <= 0) { sleepAt = 0; document.body.classList.add('sleep'); sleepButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sleep === '0'))); setStatus('Stopped. Tap or press a key to wake the scene; press Play for music.'); }
}
// Local weather and sun, opt in: one location prompt, then Open-Meteo hourly. Coordinates are rounded and kept only in this browser.
const localBtn = el('localBtn'), localNote = el('localNote');
function drawLocal(info) {
  localBtn.setAttribute('aria-pressed', String(localOn)); localBtn.textContent = localOn ? 'Using my location' : 'Use my location';
  if (info) localNote.textContent = `${info.mm > 0 ? `${info.mm.toFixed(1)} mm/h of rain` : `${info.cloud}% cloud, dry`} · sunrise ${info.sunrise}, sunset ${info.sunset}`;
}
localBtn.addEventListener('click', async () => {
  if (localOn) { disableLocal(); drawLocal(); localNote.textContent = 'Off. Weather follows the cycle; the sun keeps the fixed times.'; return; }
  localNote.textContent = 'Asking for your location…';
  try { drawLocal(await enableLocal()); wxAuto.setAttribute('aria-pressed', 'false'); }
  catch (e) { localNote.textContent = /denied|permission/i.test(String(e && e.message)) ? 'Location was refused. Allow it in the browser to use this.' : "Couldn't fetch the weather. Try again later."; drawLocal(); }
});
drawLocal();
// Completed focus blocks, kept locally, summarised as a line in Settings.
function weekLine() {
  const log = state.sessions || [], week = Date.now() - 7 * 86400000, recent = log.filter(s => s.at > week);
  if (!recent.length) return 'No focus blocks this week yet.';
  const day = ts => new Date(ts).toDateString(), days = new Set(log.map(s => day(s.at)));
  let streak = 0; for (let d = new Date(); days.has(d.toDateString()); d.setDate(d.getDate() - 1)) streak++;
  if (!streak && days.has(day(Date.now() - 86400000))) { streak = 1; for (let d = new Date(Date.now() - 86400000); days.has(d.toDateString()); d.setDate(d.getDate() - 1)) streak++; }
  return `${recent.length} block${recent.length === 1 ? '' : 's'} · ${recent.reduce((a, s) => a + s.min, 0)} min · ${streak} day streak`;
}
// Shortcuts overlay and the diagnostics toggle.
const help = el('help');
function showHelp(on = help.hidden) { help.hidden = !on; if (on) el('helpClose').focus(); }
el('helpBtn').addEventListener('click', () => { closeMenus(); showHelp(true); });
el('helpClose').addEventListener('click', () => showHelp(false));
const diagBtn = el('diagBtn');
function setDiagOn(on) { toggleDiag(on); diagBtn.setAttribute('aria-pressed', String(on)); if (on) drawDiag(); }
diagBtn.addEventListener('click', () => setDiagOn(!diagOn()));
function drawDiag() {
  const s = SCENES[cur], inst = instances[cur], st = stageOf(inst), amb = ambienceState();
  setDiag([
    `${s.name} · ${inst.kind} ${st.width || st.videoWidth || '?'}×${st.height || st.videoHeight || '?'} · DPR ${DPR}${lowPower ? ' · low power' : ''}${lively ? ' · lively' : ''}`,
    `${lastFps.toFixed(0)} fps · ${W}×${H} css px · ${gpuName()}`,
    `weather ${weather.toFixed(2)} · daylight ${daylight().toFixed(2)}${localOn ? ' (local)' : ''}`,
    `music ${musicPlaying ? 'playing' : 'off'} · level ${musicLevel.toFixed(2)} · bass ${bands.bass.toFixed(2)} mid ${bands.mid.toFixed(2)} treble ${bands.treble.toFixed(2)}`,
    `ambience ${amb.kind} · level ${amb.level.toFixed(2)} · ${amb.layers} layer${amb.layers === 1 ? '' : 's'}`,
  ]);
}

/* Focus timer: a focus block, then a break that dims the scene; the break starts on its own, the next block waits for you.
   It survives a reload: a running block picks up where the clock says it should be. */
const timer = { f: 25, b: 5, mode: 'focus', left: 25 * 60, running: false, last: 0 };
if (state.timer && state.timer.f) {
  const s = state.timer;
  timer.f = s.f; timer.b = s.b; timer.left = s.left ?? timer.f * 60;
  if (s.mode) timer.mode = s.mode;
  if (s.running && s.at) { timer.running = true; timer.left -= (Date.now() - s.at) / 1000; }
}
const tBtn = el('tStart'), tMore = el('tMore'), tMenu = el('tMenu');
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
function toggleTimer() {
  timer.running = !timer.running; timer.last = performance.now();
  if (timer.running) askNotify();
  const c = audioCtx(); if (timer.running && c && c.state === 'suspended') c.resume().catch(() => {});
  drawTimer(); saveTimer();
}
function resetTimer() { timer.mode = 'focus'; timer.left = timer.f * 60; timer.running = false; setDuck(false); drawTimer(); saveTimer(); }
let lastSave = 0;
timer.last = performance.now();
setInterval(() => {
  if (!timer.running) return;
  const now = performance.now(); timer.left -= (now - timer.last) / 1000; timer.last = now;
  if (timer.left <= 0) {
    if (timer.mode === 'focus') { const log = (state.sessions || []).slice(-499); log.push({ at: Date.now(), min: timer.f, scene: SCENES[cur].name }); saveState({ sessions: log }); timer.mode = 'break'; timer.left = timer.b * 60; chime([660, 880]); setStatus('Focus block done. Break started.'); notify('Focus block done', `Break for ${timer.b} minutes.`); setDuck(true); }
    else { timer.mode = 'focus'; timer.left = timer.f * 60; timer.running = false; chime([660]); setStatus('Break over. Press the timer to start the next focus block.'); notify('Break over', 'Press the timer to start the next focus block.'); setDuck(false); }
    saveTimer();
  }
  if (now - lastSave > 10000) { lastSave = now; saveTimer(); }
  drawTimer();
}, 250);
tBtn.addEventListener('click', toggleTimer);
function closeMenus() { tMenu.hidden = true; tMore.setAttribute('aria-expanded', 'false'); setMenu.hidden = true; setBtn.setAttribute('aria-expanded', 'false'); }
tMore.addEventListener('click', () => { const open = tMenu.hidden; closeMenus(); tMenu.hidden = !open; tMore.setAttribute('aria-expanded', String(!tMenu.hidden)); });
tMenu.querySelectorAll('button[data-f]').forEach(b => b.addEventListener('click', () => {
  timer.f = +b.dataset.f; timer.b = +b.dataset.b; resetTimer(); closeMenus();
}));
el('tReset').addEventListener('click', () => { resetTimer(); closeMenus(); });
document.addEventListener('pointerdown', e => { if (!e.target.closest('.timer, .settings')) closeMenus(); });
window.addEventListener('pagehide', saveTimer);
setDuck(timer.mode === 'break');
drawTimer();

const clock = el('clock');
const tick = () => { const d = new Date(); clock.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
tick(); setInterval(tick, 10000);

/* The controls fade after five quiet seconds; any movement, key or focus brings them back. */
let idleTimer;
function wake() {
  if (document.body.classList.contains('sleep')) { document.body.classList.remove('sleep'); setAmbienceMute(false); }
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('idle'), 5000);
  keepAwake();
}
['pointermove', 'pointerdown', 'keydown', 'touchstart', 'focusin'].forEach(e => window.addEventListener(e, wake, { passive: true }));

/* Ambient sound: starts on the first gesture, follows the scene, its level is remembered */
const amb = el('amb'); amb.value = ambienceLevel;
amb.addEventListener('input', () => setAmbienceLevel(Number(amb.value)));
for (const r of [amb, el('vol'), wx]) { const say = () => r.setAttribute('aria-valuetext', Math.round(r.value * 100) + '%'); r.addEventListener('input', say); say(); }
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
    case '?': showHelp(); break;
    case '`': setDiagOn(!diagOn()); break;
    case 'Escape': if (!help.hidden) showHelp(false); else if (libOpen()) openLib(false); else closeMenus(); break;
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

// A scene link in the hash switches scenes (so the back button walks through them).
window.addEventListener('hashchange', () => { const i = SCENES.findIndex(s => '#' + slug(s) === location.hash); if (i >= 0) go(i); });

// Installable and usable offline once the service worker has seen the files. Fails quietly where it isn't allowed.
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

show(cur);
updateText();
resize();
if (still) render(0); else { render(0); requestAnimationFrame(t2 => { last = t2; requestAnimationFrame(frame); }); }
wake();
scheduleThumb();
