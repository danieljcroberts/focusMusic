// Two ways to choose a scene besides swiping.
// Shelves: a panel of thumbnail rows, opened from the scenes button in the bar or the scene's name: a search box, then
// Right now (scenes that suit the hour, the weather and the season), Favourites, Recent, and a row for every group.
// Filmstrip: holding the scene brings up a strip of thumbnails along the bottom; the scene behind changes as the strip
// settles on each one, without touching the music, and tapping the scene again (or Done) keeps it.
import { state, saveState } from './state.js';
import { daylight } from './daylight.js';
import { weather } from './weather.js';
import { isWinter } from './season.js';

const el = id => document.getElementById(id);
let M = null;   // what main.js lends: SCENES, cur(), go(i, quiet), commit(), thumb(i), included(name), openGrid(), haptic()

export function initSceneMenu(deps) { M = deps; }

// Recent scenes, newest first, kept for the Recent row.
export function noteRecent(name) {
  const list = (state.recentScenes || []).filter(n => n !== name); list.unshift(name);
  saveState({ recentScenes: list.slice(0, 16) });
}

function tile(i, onPick) {
  const s = M.SCENES[i], b = document.createElement('button');
  b.type = 'button'; b.className = 'stile'; b.dataset.i = i;
  const t = document.createElement('span'); t.className = 'pt'; t.style.background = s.sw;
  const im = document.createElement('img'); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.src = M.thumb(i);
  im.addEventListener('error', () => { im.hidden = true; }, { once: true });
  const n = document.createElement('span'); n.className = 'nm'; n.textContent = s.name;
  t.append(im); b.append(t, n);
  b.setAttribute('aria-pressed', String(i === M.cur()));
  b.addEventListener('click', () => onPick(i, b));
  return b;
}
const shown = () => M.SCENES.map((s, i) => i).filter(i => M.included(M.SCENES[i].name));

// Scenes for right now: the hour (day or night scenes), rain and storms in wet weather, snow in winter. The music-led
// groups sit out. A fixed shuffle for the hour breaks ties, so the row is steady while open and fresh an hour later.
const MUSIC_LED = new Set(['Classic visualisers', 'Trip', '80s', 'Workout']);
function rightNow() {
  const day = daylight() > .5, wet = weather > .65, winter = isWinter(), hour = new Date().toISOString().slice(0, 13);
  const jitter = name => { let h = 0; for (const c of name + hour) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0) / 4294967296; };
  return shown().filter(i => !MUSIC_LED.has(M.SCENES[i].group) && i !== M.cur()).map(i => {
    const s = M.SCENES[i], text = `${s.key} ${s.name} ${s.desc || ''}`.toLowerCase();
    let sc = s.mood === (day ? 'day' : 'night') ? 2 : s.mood === 'any' || !s.mood ? 1 : -2;
    if (wet && ['rain', 'storm', 'tent'].includes(s.sound)) sc += 2;
    if (!wet && day && s.sound === 'rain') sc -= .5;
    if (winter && /snow|winter|polar|frost/.test(text)) sc += 1.5;
    return { i, sc: sc + jitter(s.name) * 1.5 };
  }).sort((a, b) => b.sc - a.sc).slice(0, 12).map(x => x.i);
}

/* Shelves */
const shelves = el('shelves'), rows = el('shelfRows'), search = el('shelfSearch');
function row(title, idx, note) {
  if (!idx.length) return;
  const sec = document.createElement('section'), h = document.createElement('h3'), r = document.createElement('div');
  h.textContent = title; if (note) { const s = document.createElement('span'); s.textContent = note; h.append(s); }
  r.className = 'srow'; r.setAttribute('role', 'list'); r.setAttribute('aria-label', title);
  for (const i of idx) r.append(tile(i, pickFromShelf));
  sec.append(h, r); rows.append(sec);
  const on = r.querySelector('[aria-pressed="true"]'); if (on) requestAnimationFrame(() => { r.scrollLeft = on.offsetLeft - r.clientWidth / 2 + on.offsetWidth / 2; });
}
function pickFromShelf(i) { closeShelves(); if (i !== M.cur()) M.go(i); }
function fillShelves() {
  rows.replaceChildren();
  const q = search.value.trim().toLowerCase();
  if (q) {
    const words = q.split(/\s+/), hits = shown().filter(i => { const s = M.SCENES[i], t = `${s.name} ${s.group} ${s.desc || ''} ${s.sound} ${s.mood} ${s.tone}`.toLowerCase().replace(/cozy/g, 'cozy cosy'); return words.every(w => t.includes(w)); });
    if (!hits.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = `No scenes match "${search.value.trim()}".`; rows.append(p); return; }
    const sec = document.createElement('section'), h = document.createElement('h3'), g = document.createElement('div');
    h.textContent = `${hits.length} scene${hits.length === 1 ? '' : 's'}`; g.className = 'sgrid';
    for (const i of hits) g.append(tile(i, pickFromShelf));
    sec.append(h, g); rows.append(sec);
    return;
  }
  const byName = new Map(M.SCENES.map((s, i) => [s.name, i])), ok = i => i !== undefined && M.included(M.SCENES[i].name);
  row('Right now', rightNow(), daylight() > .5 ? 'suits the day' : 'suits the night');
  row('Favourites', (state.favs || []).map(n => byName.get(n)).filter(ok));
  row('Recent', (state.recentScenes || []).map(n => byName.get(n)).filter(i => ok(i) && i !== M.cur()));
  const groups = [...new Set(M.SCENES.map(s => s.group))];
  for (const g of groups) row(g, shown().filter(i => M.SCENES[i].group === g));
}
export function openShelves() {
  closeStrip(true);
  search.value = ''; fillShelves();
  shelves.hidden = false; document.body.classList.add('choosing-scene');
  rows.scrollTop = 0;
}
export function closeShelves() { shelves.hidden = true; document.body.classList.remove('choosing-scene'); }
export const shelvesOpen = () => !shelves.hidden;
search.addEventListener('input', fillShelves);
search.addEventListener('keydown', e => { if (e.key === 'Escape') closeShelves(); });
el('shelvesClose').addEventListener('click', closeShelves);
el('shelfGrid').addEventListener('click', () => { closeShelves(); M.openGrid(); });
shelves.addEventListener('click', e => { if (e.target === shelves) closeShelves(); });

/* Filmstrip */
const strip = el('strip'), track = el('stripTrack'), stripName = el('stripName');
let startScene = -1, openedAt = 0, settle = 0, tiles = [];
export const stripOpen = () => !strip.hidden;
export function openStrip() {
  closeShelves();
  track.replaceChildren(); tiles = [];
  let g = '';
  for (const i of shown()) {
    const s = M.SCENES[i];
    if (s.group !== g) { g = s.group; const d = document.createElement('span'); d.className = 'sgrp'; d.textContent = g; track.append(d); }
    const b = tile(i, onStripTap); track.append(b); tiles.push(b);
  }
  startScene = M.cur(); openedAt = performance.now();
  strip.hidden = false; document.body.classList.add('choosing-scene', 'stripping');
  const on = tiles.find(b => Number(b.dataset.i) === M.cur());
  if (on) track.scrollLeft = on.offsetLeft - track.clientWidth / 2 + on.offsetWidth / 2;
  label(M.cur());
}
function label(i) { const s = M.SCENES[i]; stripName.replaceChildren(Object.assign(document.createElement('b'), { textContent: s.name }), Object.assign(document.createElement('span'), { textContent: s.group })); }
function centred() {
  const mid = track.scrollLeft + track.clientWidth / 2;
  let best = null, d = Infinity;
  for (const b of tiles) { const c = b.offsetLeft + b.offsetWidth / 2, dd = Math.abs(c - mid); if (dd < d) { d = dd; best = b; } }
  return best;
}
// When the strip comes to rest, the scene behind becomes the one in the middle.
track.addEventListener('scroll', () => {
  clearTimeout(settle);
  settle = setTimeout(() => {
    const b = centred(); if (!b) return;
    const i = Number(b.dataset.i);
    tiles.forEach(t => t.setAttribute('aria-pressed', String(t === b)));
    label(i);
    if (i !== M.cur()) { M.go(i, true); M.haptic(); }
  }, 160);
}, { passive: true });
// A mouse wheel scrolls the strip sideways.
track.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { track.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
function onStripTap(i, b) {
  if (performance.now() - openedAt < 500) return;   // the lift of the hold that opened the strip
  if (b === centred() && i === M.cur()) { closeStrip(); return; }
  track.scrollTo({ left: b.offsetLeft - track.clientWidth / 2 + b.offsetWidth / 2, behavior: 'smooth' });
}
// Closing keeps the scene on screen; the music, Drift and Recent hear about it now, not for every scene passed.
export function closeStrip(silent = false) {
  if (strip.hidden) return;
  clearTimeout(settle);
  strip.hidden = true; document.body.classList.remove('stripping'); if (!shelvesOpen()) document.body.classList.remove('choosing-scene');
  if (!silent && M.cur() !== startScene) M.commit();
}
el('stripDone').addEventListener('click', () => closeStrip());
// A tap on the scene above the strip keeps what is showing.
document.addEventListener('pointerdown', e => {
  if (strip.hidden || performance.now() - openedAt < 500 || e.target.closest('#strip')) return;
  closeStrip();
}, true);
