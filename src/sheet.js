// The sheet: everything that isn't Play, Next, the soundtrack or the scene lives here, in five sections. Each section's
// summary line says what it is doing now, so a glance covers the lot. A bottom sheet on phones, a side panel otherwise.
import { excluded } from './excluded.js';
import { state, saveState } from './state.js';
import { follow, setFollow, currentTrack, musicPlaying } from './music.js';
import * as ST from './soundtracks.js';
import { drift, driftMin, favs } from './drift.js';
import { weather } from './weather.js';
import { localOn } from './local.js';
import { lowPower, lively } from './view.js';
import { finishOn } from './finish.js';

const el = id => document.getElementById(id);
const sheet = el('sheet'), btn = el('menuBtn');
let onOpen = [], timer = null;
export const sheetOpen = () => !sheet.hidden;
export function openSheet(open = sheet.hidden) {
  sheet.hidden = !open; btn.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('sheet-open', open);
  clearInterval(timer);
  if (open) { onOpen.forEach(f => f()); summarise(); timer = setInterval(summarise, 1000); el('sheetClose').focus(); }
  else btn.focus();
}
// Modules register what to refresh when the sheet opens (timer inputs, the weather slider, the week line).
export const whenSheetOpens = f => { onOpen.push(f); };
btn.addEventListener('click', () => openSheet());
el('sheetClose').addEventListener('click', () => openSheet(false));
document.addEventListener('pointerdown', e => { if (sheetOpen() && !e.target.closest('.sheet, .wiz, .lib, .help, #about, .picker, #menuBtn')) openSheet(false); });
// Search: type a word and only the sections that mention it stay, opened, with the matching controls marked.
// A few everyday words point at the controls that use other names.
const ALIASES = { alarm: ['sunrise alarm', 'wake me'], wake: ['wake me'], volume: ['volume limit', 'music volume'], loud: ['volume limit'], quiet: ['quiet focus', 'volume limit'], sleep: ['sleep timer', 'bedtime'], bed: ['bedtime'], noise: ['add a sound'], eq: ['speaker', 'headphones'], bass: ['speaker'], backup: ['back up', 'restore'], sync: ['send settings', 'receive settings'], phone: ['send settings'], qr: ['send settings'], export: ['back up'], photo: ['photos'], set: ['scene sets'], playlist: ['scene sets', 'soundtracks'], shuffle: ['soundtracks'], battery: ['low power'], fade: ['between tracks'], gap: ['between tracks'], crossfade: ['between tracks'], offline: ['offline', 'keep streams'], weather: ['weather', 'use my location'], location: ['use my location'], help: ['shortcuts', 'tour'], tour: ['tour'], hide: ['choose scenes'], update: ['check for updates'], hiit: ['intervals'], interval: ['intervals'], workout: ['intervals'], task: ["today's tasks"], todo: ["today's tasks"], version: ['check for updates'], wallpaper: ['wallpaper', 'save as a picture'], widget: ['focus timer'], pip: ['picture-in-picture'], tilt: ['look around'], parallax: ['look around'], gyro: ['look around'], float: ['picture-in-picture'], dark: ['listen only'], picture: ['photos', 'save as a picture'], postcard: ['save as a picture'], screenshot: ['save as a picture'], black: ['listen only'], listen: ['listen only'], screen: ['listen only'], exclude: ['choose scenes'], include: ['choose scenes'], remove: ['choose scenes'] };
const search = document.createElement('input'); search.type = 'search'; search.className = 'sheetsearch'; search.placeholder = 'Search: alarm, volume, photos…'; search.setAttribute('aria-label', 'Search the settings');
sheet.querySelector('.body').prepend(search);
const secs = [...sheet.querySelectorAll('details.sec')];
search.addEventListener('input', () => {
  const q = search.value.trim().toLowerCase();
  sheet.querySelectorAll('.hit').forEach(n => n.classList.remove('hit'));
  if (!q) { secs.forEach(d => { d.hidden = false; d.open = !!(state.sheetOpen || {})[d.id]; }); return; }
  const words = [q, ...(ALIASES[q] || (Object.entries(ALIASES).find(([k]) => k.startsWith(q)) || [])[1] || [])];
  let first = null;
  for (const d of secs) {
    const nodes = [...d.querySelectorAll('button, .lbl, label, select, summary .k')].filter(n => words.some(w => (n.textContent + ' ' + (n.title || '') + ' ' + (n.getAttribute('aria-label') || '')).toLowerCase().includes(w)));
    d.hidden = !nodes.length; d.open = !!nodes.length;
    nodes.forEach(n => n.classList.add('hit')); if (!first && nodes.length) first = nodes[0];
  }
  if (first) first.scrollIntoView({ block: 'nearest' });
});
// Sections remember whether they were open.
for (const d of sheet.querySelectorAll('details')) {
  d.open = !!(state.sheetOpen || {})[d.id];
  d.addEventListener('toggle', () => saveState({ sheetOpen: Object.assign({}, state.sheetOpen || {}, { [d.id]: d.open }) }));
}

/* What the music follows: one choice in place of three toggles. */
const followButtons = [...el('followSeg').querySelectorAll('button')];
const NOTES = {
  none: 'The soundtrack only changes when you pick one.',
  scene: 'Each scene suggests a built-in soundtrack from its mood: calm scenes Ambient, warm ones Lo-fi, lively ones Downtempo Electronic or Synthwave & Techno. A soundtrack of your own stays put.',
  timer: 'Ambient during focus blocks, Downtempo Electronic in breaks.',
  both: 'The scene suggests a built-in soundtrack; the timer switches between Ambient and Downtempo Electronic.',
};
export const followMode = () => state.stScene && state.stTimer ? 'both' : state.stScene ? 'scene' : state.stTimer ? 'timer' : 'none';
export function setFollowMode(k) {
  saveState({ stScene: k === 'scene' || k === 'both', stTimer: k === 'timer' || k === 'both' });
  drawFollow();
}
// Whether a scene change also changes the track: off by default, so a new scene keeps the music going.
const trackBtn = el('stTrackBtn');
export function setSceneTrack(v) { setFollow(v); trackBtn.setAttribute('aria-pressed', String(v)); if (sheetOpen()) summarise(); }
trackBtn.addEventListener('click', () => setSceneTrack(!follow));
trackBtn.setAttribute('aria-pressed', String(follow));
function drawFollow() { const k = followMode(); followButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.follow === k))); el('followNote').textContent = NOTES[k]; if (sheetOpen()) summarise(); }
followButtons.forEach(b => b.addEventListener('click', () => setFollowMode(b.dataset.follow)));
drawFollow();

/* The summary lines. */
const FOLLOW_WORDS = { none: 'follows nothing', scene: 'follows the scene', timer: 'follows the timer', both: 'follows the scene and the timer' };
function summarise() {
  const t = currentTrack();
  el('sumNow').textContent = t ? `${musicPlaying ? '' : 'paused · '}${t.t} — ${t.a}` : 'Nothing playing';
  el('sumMusic').textContent = `${ST.current().name} · ${FOLLOW_WORDS[followMode()]}${follow ? ' · scenes change the track' : ''}`;
  const tl = el('tStart').textContent, count = el('tCount').textContent, sleep = [...el('sleepSeg').querySelectorAll('button')].find(b => b.getAttribute('aria-pressed') === 'true');
  el('sumTimer').textContent = [tl, count, sleep && sleep.dataset.sleep !== '0' ? `sleep in ${sleep.textContent}` : ''].filter(Boolean).join(' · ');
  const tod = [...el('todSeg').querySelectorAll('button')].find(b => b.getAttribute('aria-pressed') === 'true'), auto = el('wxAuto').getAttribute('aria-pressed') === 'true';
  el('sumScene').textContent = [drift ? `drift every ${driftMin} min` : 'no drift', `${favs.size} favourite${favs.size === 1 ? '' : 's'}`, excluded.size ? `${excluded.size} left out` : '', auto ? `weather ${Math.round(weather * 100)}% (auto)` : `weather ${Math.round(weather * 100)}%`, tod && tod.dataset.tod !== 'auto' ? tod.textContent.toLowerCase() : '', localOn ? 'local sky' : '', lively ? 'lively' : '', finishOn ? '' : 'no film finish'].filter(Boolean).join(' · ');
  el('sumApp').textContent = [lowPower ? 'low power' : '', document.fullscreenElement ? 'full screen' : el('fsAutoBtn').getAttribute('aria-pressed') === 'true' ? 'full screen on tap' : ''].filter(Boolean).join(' · ') || 'all as usual';
}
