// Settings that live in the sheet: weather and time-of-day overrides, local weather, offline music, the film finish,
// the shortcut list and the diagnostics toggle. The sleep timer and drift interval live in their modules.
import { M } from './assets.js';
import { state, saveState } from './state.js';
import { setStatus } from './status.js';
import { weather, setWeatherOverride } from './weather.js';
import { setDaylightOverride } from './daylight.js';
import { TRACKS, keepStreams, setKeepStreams, cachedStreams } from './music.js';
import { localOn, enableLocal, disableLocal } from './local.js';
import { diagOn, toggleDiag } from './diag.js';
import { finishOn, setFinish } from './finish.js';
import { weekLine, weekBars, weekIntents } from './timer.js';
import { closeMenus } from './menus.js';
import { whenSheetOpens } from './sheet.js';
import { lookAround, setLookAround } from './tilt.js';
import { openAbout } from './about.js';

const el = id => document.getElementById(id);
const wx = el('wx'), wxAuto = el('wxAuto');
const TOD = { auto: null, night: 0, dusk: .5, day: 1 };

function applyWeather(v) {
  setWeatherOverride(v); wxAuto.setAttribute('aria-pressed', String(v === null));
  if (v !== null) wx.value = v;
  saveState({ weather: v });
}
wx.addEventListener('input', () => applyWeather(Number(wx.value)));
wxAuto.addEventListener('click', () => applyWeather(null));
applyWeather(typeof state.weather === 'number' ? state.weather : null);
const say = () => wx.setAttribute('aria-valuetext', Math.round(wx.value * 100) + '%'); wx.addEventListener('input', say); say();

const todButtons = [...el('todSeg').querySelectorAll('button')];
function applyTod(k) {
  if (!(k in TOD)) k = 'auto';
  setDaylightOverride(TOD[k]); todButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tod === k))); saveState({ tod: k });
}
todButtons.forEach(b => b.addEventListener('click', () => applyTod(b.dataset.tod)));
applyTod(state.tod || 'auto');

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

// Fetch every bundled track into the cache the service worker serves from, so the music plays offline too.
el('offlineBtn').addEventListener('click', async () => {
  if (!('caches' in window)) { setStatus("This browser can't store files for offline use."); return; }
  const files = TRACKS.filter(x => x.file).map(x => M + x.file);
  try {
    const c = await caches.open('slow-windows-v2');
    for (let i = 0; i < files.length; i++) {
      setStatus(`Saving music for offline use: ${i + 1} of ${files.length}`);
      if (await c.match(files[i])) continue;
      const r = await fetch(files[i]); if (!r.ok) throw new Error(r.status);
      await c.put(files[i], r);
    }
    setStatus('Music saved. The bundled tracks now work without a connection.');
  } catch (e) { setStatus("Couldn't save the music. Check the connection and try again."); }
});

// Every scene's code, art, video and thumbnail, so all of them open without a connection (not just the ones seen so far).
el('offlineScenesBtn').addEventListener('click', async () => {
  if (!('caches' in window)) { setStatus("This browser can't store files for offline use."); return; }
  try {
    const { files } = await (await fetch('offline.json', { cache: 'no-store' })).json();
    const c = await caches.open('slow-windows-v2');
    for (let i = 0; i < files.length; i++) {
      setStatus(`Saving scenes for offline use: ${i + 1} of ${files.length}`);
      if (await c.match(files[i])) continue;
      const r = await fetch(files[i]); if (!r.ok) throw new Error(r.status);
      await c.put(files[i], r);
    }
    setStatus('Every scene is saved on this device and opens without a connection.');
  } catch (e) { setStatus("Couldn't save the scenes. Check the connection and try again."); }
});
const ksBtn = el('keepStreamsBtn');
const drawKs = async () => { ksBtn.setAttribute('aria-pressed', String(keepStreams)); const n = await cachedStreams(); ksBtn.textContent = `Keep streams I've heard${n ? ` (${n} kept)` : ''}`; };
ksBtn.addEventListener('click', () => { setKeepStreams(!keepStreams); drawKs(); });
drawKs(); whenSheetOpens(drawKs);
// Backup: everything you have set up, as one file. Your own music and photos stay where they are (they are large and
// on this device); the soundtracks remember them by file, so re-adding the same files puts them back in place.
el('exportBtn').addEventListener('click', () => {
  const { np, ...keep } = state; void np;
  const blob = new Blob([JSON.stringify({ app: 'slow-windows', version: 1, at: new Date().toISOString(), state: keep }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `slow-windows-settings-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); setStatus('Settings saved as a file. Restore it on another device under App.');
});
el('importBtn').addEventListener('click', () => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.addEventListener('change', async () => {
    try {
      const d = JSON.parse(await inp.files[0].text());
      if (d.app !== 'slow-windows' || !d.state) throw new Error('not a Slow Windows backup');
      saveState(d.state); setStatus('Settings restored. Reloading…'); setTimeout(() => location.reload(), 900);
    } catch (e) { setStatus("That file isn't a Slow Windows backup."); }
  });
  inp.click();
});
const lookBtn = el('lookBtn');
const drawLook = () => lookBtn.setAttribute('aria-pressed', String(lookAround));
lookBtn.addEventListener('click', () => { setLookAround(!lookAround); drawLook(); setStatus(lookAround ? 'Look around: tilt the phone, or move the mouse, in the layered scenes.' : 'Look around off.'); });
drawLook();
const finishBtn = el('finishBtn');
function drawFinish() { finishBtn.setAttribute('aria-pressed', String(finishOn)); }
finishBtn.addEventListener('click', () => { setFinish(!finishOn); drawFinish(); });
drawFinish();

// Shortcuts overlay and the diagnostics toggle.
const help = el('help');
export function showHelp(on = help.hidden) { help.hidden = !on; if (on) el('helpClose').focus(); }
export const helpOpen = () => !help.hidden;
el('helpBtn').addEventListener('click', () => { closeMenus(); showHelp(true); });
el('aboutBtn').addEventListener('click', () => { closeMenus(); openAbout(true); });
el('helpClose').addEventListener('click', () => showHelp(false));
const diagBtn = el('diagBtn');
let drawDiag = () => {};
export function setDiagOn(on) { toggleDiag(on); diagBtn.setAttribute('aria-pressed', String(on)); if (on) drawDiag(); }
diagBtn.addEventListener('click', () => setDiagOn(!diagOn()));

function drawWeek() {
  const bars = weekBars(), max = Math.max(25, ...bars.map(b => b.min)), box = el('weekBars');
  box.textContent = '';
  for (const b of bars) {
    const col = document.createElement('span'); col.className = 'wk';
    const bar = document.createElement('i'); bar.style.height = `${Math.round(b.min / max * 100)}%`; bar.title = `${b.min} min`;
    const lab = document.createElement('small'); lab.textContent = b.label;
    col.append(bar, lab); box.append(col);
  }
  const mg = el('monthGrid'); mg.textContent = '';
  const log = state.sessions || [], start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 34 - ((start.getDay() + 6) % 7) + 6);
  for (let k = 0; k < 35; k++) {
    const d = new Date(start); d.setDate(start.getDate() + k); const day = d.toDateString();
    const min = log.filter(s => new Date(s.at).toDateString() === day).reduce((a, s) => a + s.min, 0);
    const c = document.createElement('i'); c.title = `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}: ${min} min`;
    c.style.opacity = d > new Date() ? '.08' : String(min ? .3 + Math.min(1, min / 120) * .7 : .12); if (min) c.className = 'on'; mg.append(c);
  }
  const ul = el('weekIntents'); ul.textContent = '';
  const ints = weekIntents(); if (ints.length > 1 || (ints[0] && ints[0][0] !== 'Unlabelled')) for (const [k, m] of ints.slice(0, 5)) { const li = document.createElement('li'); li.textContent = `${k} · ${m} min`; ul.append(li); }
}
whenSheetOpens(() => {
  if (wxAuto.getAttribute('aria-pressed') === 'true') wx.value = weather;
  el('weekLine').textContent = weekLine(); drawWeek();
});
export function initSettings(opts) { drawDiag = opts.drawDiag; }
