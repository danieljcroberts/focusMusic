// The Settings panel: weather and time-of-day overrides, local weather, the week's focus blocks, offline music,
// the film finish, the shortcut list and the diagnostics toggle. The sleep timer and drift interval live in their modules.
import { M } from './assets.js';
import { state, saveState } from './state.js';
import { setStatus } from './status.js';
import { weather, setWeatherOverride } from './weather.js';
import { setDaylightOverride } from './daylight.js';
import { TRACKS } from './music.js';
import { localOn, enableLocal, disableLocal } from './local.js';
import { diagOn, toggleDiag } from './diag.js';
import { finishOn, setFinish } from './finish.js';
import { weekLine } from './timer.js';
import { registerMenu, closeMenus } from './menus.js';
import { openAbout } from './about.js';

const el = id => document.getElementById(id);
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
    setStatus('Music saved. The scenes and the bundled tracks now work without a connection.');
  } catch (e) { setStatus("Couldn't save the music. Check the connection and try again."); }
});

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

registerMenu(setBtn, setMenu, () => {
  if (wxAuto.getAttribute('aria-pressed') === 'true') wx.value = weather;
  el('weekLine').textContent = weekLine();
});
export function initSettings(opts) { drawDiag = opts.drawDiag; }
