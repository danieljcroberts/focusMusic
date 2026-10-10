// Named presets: one tap sets the scene, the track, the ambience level, Lively and the timer durations.
// Kept per viewer; a dozen at most.
import { state, saveState } from './state.js';
import { setStatus } from './status.js';
import { currentTrack, playTrack, canPlay, TRACKS } from './music.js';
import { level as ambienceLevel, setAmbienceLevel } from './ambience.js';
import { timerDurations, setTimerDurations } from './timer.js';

const el = id => document.getElementById(id);
const listEl = el('presetList'), nameEl = el('presetName');
let opts = null;
const presets = () => state.presets || [];

function draw() {
  listEl.textContent = '';
  presets().forEach((p, i) => {
    const wrap = document.createElement('span'); wrap.className = 'p';
    const use = document.createElement('button'); use.type = 'button'; use.textContent = p.name; use.title = `${p.scene}${p.track ? ' · ' + p.track.split('|')[1] : ''}`;
    use.addEventListener('click', () => apply(p));
    const x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', `Delete preset ${p.name}`);
    x.addEventListener('click', () => { const all = presets().slice(); all.splice(i, 1); saveState({ presets: all }); draw(); });
    wrap.append(use, x); listEl.append(wrap);
  });
}
function apply(p) {
  opts.goToName(p.scene);
  setAmbienceLevel(p.ambience); opts.syncAmbience();
  opts.setLively(!!p.lively);
  if (p.timer) setTimerDurations(p.timer);
  const t = p.track && TRACKS.find(x => x.a + '|' + x.t === p.track);
  if (t && canPlay(t)) playTrack(t);
  setStatus(`Preset "${p.name}" applied.`);
}
el('presetSave').addEventListener('click', () => {
  const name = nameEl.value.trim() || `Preset ${presets().length + 1}`;
  const t = currentTrack();
  const p = { name, scene: opts.sceneName(), track: t && !t.live && !t.own ? t.a + '|' + t.t : null, ambience: ambienceLevel, lively: opts.lively(), timer: timerDurations() };
  const all = presets().filter(x => x.name !== name); all.push(p);
  saveState({ presets: all.slice(-12) }); nameEl.value = ''; draw();
  setStatus(`Saved "${name}".`);
});
export function initPresets(o) { opts = o; draw(); }
