// Soundtracks: named collections of music for what you are doing. Four come built in and can be renamed; any number
// more can be made. Each draws from the free tracks that suit it (built-ins by mood; others by the built-in they are
// "like"), from the viewer's own music sorted into it, and optionally from random finds on the Internet Archive.
// Kept per viewer in the app's state. This module holds the data only, so music.js can use it without a cycle.
import TRACKS from './data/tracks.json';
import { state, saveState } from './state.js';

// Free-track moods for the four built-ins (the moods in tracks.json).
export const LIKE = {
  focus: ['calm', 'cold', 'dark'],
  work: ['warm', 'bright', 'calm'],
  energise: ['pulse', 'bright'],
  wind: ['calm', 'warm'],
};
const BUILT_IN = [
  { id: 'focus', name: 'Deep focus', color: '#6f8fd8', like: 'focus' },
  { id: 'work', name: 'Easy work', color: '#a9c27a', like: 'work' },
  { id: 'energise', name: 'Energise', color: '#e8823c', like: 'energise' },
  { id: 'wind', name: 'Wind down', color: '#9aa8ff', like: 'wind' },
];
const COLORS = ['#e05ad0', '#3fd8c8', '#d0a040', '#c05050', '#70b0e0', '#90c060', '#b080e0'];

// Words for what you are doing: a folder named with one of these joins that built-in soundtrack.
const ACTIVITY = {
  focus: ['focus', 'deep', 'study', 'concentrat', 'think', 'reading', 'library', 'exam', 'coding', 'writing'],
  work: ['work', 'office', 'background', 'easy', 'admin', 'cafe', 'coffee', 'daytime'],
  energise: ['energ', 'upbeat', 'workout', 'gym', 'run', 'pump', 'motivat', 'power', 'cardio', 'party', 'fast', 'tempo', 'training', 'hype'],
  wind: ['wind', 'sleep', 'relax', 'evening', 'night', 'bed', 'rest', 'unwind', 'meditat', 'yoga', 'lullab', 'chill'],
};
// Words for kinds of music: used only to suggest a soundtrack for a single track from its genre tag. A folder named
// after a style (Classical, Jazz) is offered as a soundtrack of its own instead.
const STYLE = {
  focus: ['ambient', 'drone', 'classical', 'piano', 'minimal', 'neoclassical', 'instrumental', 'baroque', 'modern classical', 'soundtrack', 'score'],
  work: ['lofi', 'lo-fi', 'jazz', 'acoustic', 'folk', 'downtempo', 'bossa', 'singer', 'indie'],
  energise: ['dance', 'electronic', 'techno', 'house', 'edm', 'rock', 'pop', 'hip', 'rap', 'drum', 'trance', 'synthwave', 'funk', 'disco', 'metal', 'punk'],
  wind: ['new age', 'sleep', 'calm', 'relax', 'meditat', 'nature'],
};
// Which built-in a name points to, or null. The earliest, longest word found wins. Folders use activity words only;
// genre tags use both.
export function matchName(name, withStyle = false) {
  const n = String(name || '').toLowerCase();
  let best = null, at = Infinity, len = 0;
  const groups = withStyle ? [ACTIVITY, STYLE] : [ACTIVITY];
  for (const words of groups) for (const [id, ws] of Object.entries(words)) for (const w of ws) {
    const i = n.indexOf(w);
    if (i >= 0 && (i < at || (i === at && w.length > len))) { best = id; at = i; len = w.length; }
  }
  return best;
}

function load() {
  const saved = Array.isArray(state.soundtracks) ? state.soundtracks : [];
  const out = BUILT_IN.map(b => ({ ...b, builtIn: true, free: true, live: false, own: [], ...(saved.find(s => s.id === b.id) || {}) }));
  for (const s of saved) if (!BUILT_IN.some(b => b.id === s.id)) out.push({ free: false, live: false, own: [], ...s, builtIn: false });
  return out;
}
let list = load();
let currentId = list.some(s => s.id === state.soundtrack) ? state.soundtrack : 'focus';
const listeners = new Set();
function save() { saveState({ soundtracks: list.map(({ id, name, color, like, free, live, own }) => ({ id, name, color, like, free, live, own })), soundtrack: currentId }); listeners.forEach(f => f()); }
export const onChange = f => listeners.add(f);

export const soundtracks = () => list;
export const byId = id => list.find(s => s.id === id);
export const current = () => byId(currentId) || list[0];
export function setCurrent(id) { if (byId(id)) { currentId = id; save(); } }

// Free tracks a soundtrack draws from, when its free tracks are on.
export function freeTracks(s = current()) {
  const moods = LIKE[s.like] || [];
  return s.free && moods.length ? TRACKS.filter(t => moods.includes(t.mood)) : [];
}
export const freeAllows = (t, s = current()) => s.free && (LIKE[s.like] || []).includes(t.mood);
export const ownIds = (s = current()) => s.own;

export function create(name, like = null) {
  const id = 'st' + Date.now().toString(36);
  list.push({ id, name: name.trim() || 'My soundtrack', color: COLORS[(list.length - 4) % COLORS.length], like, free: !!like, live: false, own: [], builtIn: false });
  save(); return id;
}
export function update(id, patch) { const s = byId(id); if (s) { Object.assign(s, patch); save(); } }
export function remove(id) {
  const s = byId(id); if (!s || s.builtIn) return;
  list = list.filter(x => x.id !== id);
  if (currentId === id) currentId = 'focus';
  save();
}
export function addOwnTo(id, ids) { const s = byId(id); if (!s) return; s.own = [...new Set([...s.own, ...ids])]; save(); }
export function removeOwnFrom(id, ownId) { const s = byId(id); if (!s) return; s.own = s.own.filter(x => x !== ownId); save(); }
export const memberOf = ownId => list.filter(s => s.own.includes(ownId));
// Put one of the viewer's tracks in a single soundtrack, taking it out of any others.
export function moveOwnTo(id, ownId) { for (const s of list) s.own = s.own.filter(x => x !== ownId); const s = byId(id); if (s) s.own.push(ownId); save(); }
// The built-in that suits a scene, from its music tone and the time of day it is for.
export const forScene = (tone, mood) => tone === 'pulse' ? 'energise' : tone === 'warm' || tone === 'bright' ? 'work' : mood === 'night' && tone === 'calm' ? 'wind' : 'focus';
// Forget tracks that are no longer on the device.
export function prune(existing) { const ok = new Set(existing); let changed = false; for (const s of list) { const n = s.own.filter(i => ok.has(i)); if (n.length !== s.own.length) { s.own = n; changed = true; } } if (changed) save(); }

// A suggestion for one of the viewer's tracks: its genre tag first, then its measured energy. sure = no need to ask.
export function suggest(e) {
  const g = matchName(e.genre, true);
  if (g) return { id: g, sure: true };
  if (typeof e.energy === 'number') {
    // Only the clear cases are placed without asking; the measurement can't tell calm from lively reliably in between.
    if (e.energy >= .75) return { id: 'energise', sure: true };
    if (e.energy <= .15) return { id: 'focus', sure: true };
    return { id: e.energy < .35 ? 'focus' : e.energy < .6 ? 'work' : 'energise', sure: false };
  }
  return { id: 'work', sure: false };
}
