// Soundtracks: named collections of music by genre. Ten come built in; any number more can be made. Each draws from the
// free tracks of its genre (a soundtrack of your own borrows a genre with `like`), from the viewer's own music sorted
// into it, and optionally from random finds on the Internet Archive.
// Kept per viewer in the app's state. This module holds the data only, so music.js can use it without a cycle.
import TRACKS from './data/tracks.json';
import { state, saveState } from './state.js';

// The built-in soundtracks are genres, in alphabetical order. Every free track carries a genre in tracks.json; a soundtrack of your own
// can borrow a genre's free tracks with `like`. Each has a colour and a small line icon (a 24-unit path).
export const BUILT_IN = [
  { id: 'loved', name: 'Loved', color: '#e85a7a', icon: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z' },
  { id: 'ambient', name: 'Ambient', color: '#6f8fd8', icon: 'M3 12c3-5 6-5 9 0s6 5 9 0' },
  { id: 'downtempo', name: 'Downtempo Electronic', color: '#e8823c', icon: 'M3 9c2-4 4-4 6 0s4 4 6 0 4-4 6 0M3 16c2-4 4-4 6 0s4 4 6 0 4-4 6 0' },
  { id: 'french', name: 'French language', color: '#5b8fd6', icon: 'M12 3l-3 18M12 3l3 18M7 21h10M9.5 13h5' },
  { id: 'energy', name: 'High energy', color: '#f0503c', icon: 'M13 2L5 14h6l-1 8 9-13h-6z' },
  { id: 'jazz', name: 'Jazz', color: '#e0a040', icon: 'M9 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 15V4l6 2' },
  { id: 'lofi', name: 'Lo-fi', color: '#c08ad0', icon: 'M3 7h18v10H3zM8 12h.01M16 12h.01M8 17l-1 3M16 17l1 3' },
  { id: 'minimalist', name: 'Minimalist', color: '#9aa8ff', icon: 'M4 12h9M19 12h.01' },
  { id: 'misc', name: 'Misc', color: '#8fa0a8', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
  { id: 'classical', name: 'Modern Classical', color: '#d8c38a', icon: 'M4 6h16v12H4zM8 6v7M12 6v7M16 6v7' },
  { id: 'postrock', name: 'Post-rock', color: '#7fb7a3', icon: 'M3 20l5-10 4 6 3-4 6 8z' },
  { id: 'synth', name: 'Synthwave & Techno', color: '#e05ad0', icon: 'M3 16l4-8 4 8 4-8 4 8M4 20h16' },
];
const COLORS = ['#3fd8c8', '#d0a040', '#c05050', '#70b0e0', '#90c060', '#b080e0', '#e05ad0'];

// Words that point at a genre: a folder named with one joins that soundtrack, and a track's genre tag is read the same way.
const WORDS = {
  ambient: ['ambient', 'drone', 'atmospher', 'soundscape', 'field record', 'new age', 'space music', 'sleep', 'calm', 'relax', 'meditat'],
  minimalist: ['minimal', 'reich', 'glass', 'repetit', 'process music'],
  classical: ['classical', 'neoclassical', 'neo-classical', 'piano', 'orchestr', 'strings', 'baroque', 'chamber', 'cello', 'score', 'soundtrack'],
  downtempo: ['downtempo', 'down tempo', 'trip hop', 'trip-hop', 'idm', 'electronica', 'electronic', 'chillout', 'chill out', 'dub', 'glitch', 'braindance'],
  lofi: ['lofi', 'lo-fi', 'lo fi', 'chillhop', 'beats', 'bedroom', 'study beats', 'chill'],
  postrock: ['post-rock', 'post rock', 'postrock', 'shoegaze', 'instrumental rock', 'math rock', 'slowcore'],
  jazz: ['jazz', 'bossa', 'bebop', 'swing', 'nu jazz', 'nu-jazz', 'sax', 'big band'],
  french: ['french', 'français', 'francais', 'chanson', 'française', 'francophone', 'québec', 'quebec'],
  synth: ['synthwave', 'synth', 'techno', 'retrowave', 'outrun', 'house', 'trance', 'edm', 'electro', 'acid', 'minimal techno', 'vaporwave'],
  energy: ['high energy', 'energ', 'workout', 'gym', 'running', 'cardio', 'pump', 'hype', 'party', 'dance', 'drum and bass', 'dnb', 'jungle', 'hardcore', 'metal', 'punk', 'rock', 'upbeat', 'fast'],
};
// Which built-in a name points to, or null. The earliest, longest word found wins.
export function matchName(name) {
  const n = String(name || '').toLowerCase();
  let best = null, at = Infinity, len = 0;
  for (const [id, ws] of Object.entries(WORDS)) for (const w of ws) {
    const i = n.indexOf(w);
    if (i >= 0 && (i < at || (i === at && w.length > len))) { best = id; at = i; len = w.length; }
  }
  return best;
}

// The four activity soundtracks that came before the genres fold into them, keeping any tracks of yours.
const OLD = { focus: 'ambient', work: 'lofi', energise: 'downtempo', wind: 'ambient' };
function load() {
  const saved = Array.isArray(state.soundtracks) ? state.soundtracks : [];
  const out = BUILT_IN.map(b => {
    const mine = saved.find(s => s.id === b.id) || {};
    const { name, color, icon, like, ...rest } = mine;   // the built-in's look and genre are fixed; the rest is the viewer's
    void name; void color; void icon; void like;
    const st = { ...b, like: b.id, builtIn: true, free: true, live: false, own: [], ...rest };
    for (const old of saved) if (OLD[old.id] === b.id && !BUILT_IN.some(x => x.id === old.id)) { st.own = [...new Set([...st.own, ...(old.own || [])])]; if (old.free === false) st.free = false; }
    return st;
  });
  for (const s of saved) if (!BUILT_IN.some(b => b.id === s.id) && !OLD[s.id]) out.push({ free: false, live: false, own: [], ...s, like: OLD[s.like] || s.like || null, builtIn: false });
  return out;
}
let list = load();
let currentId = list.some(s => s.id === state.soundtrack) ? state.soundtrack : (OLD[state.soundtrack] || 'ambient');
const listeners = new Set();
function save() { saveState({ soundtracks: list.map(({ id, name, color, like, free, live, own }) => ({ id, name, color, like, free, live, own })), soundtrack: currentId }); listeners.forEach(f => f()); }
export const genres = () => BUILT_IN.filter(b => TRACKS.some(t => t.genre === b.id));   // Loved is not a genre   // the genres that have free tracks
export const onChange = f => listeners.add(f);

export const soundtracks = () => list;
export const byId = id => list.find(s => s.id === id);
export const current = () => byId(currentId) || list[0];
export function setCurrent(id) { if (byId(id)) { currentId = id; save(); } }

// Free tracks a soundtrack draws from, when its free tracks are on: those of its genre.
// Loved: the tracks you have hearted, free ones by key and your own by id (kept in the Loved soundtrack's own list).
export const loved = new Set(state.loved || []);
const tkey = t => t.a + '|' + t.t;
export const isLoved = k => loved.has(k);
export function setLoved(k, on) {
  if (on) loved.add(k); else loved.delete(k);
  saveState({ loved: [...loved] });
  if (k.startsWith('own:')) { if (on) addOwnTo('loved', [k.slice(4)]); else removeOwnFrom('loved', k.slice(4)); } else save();
}
const inGenre = (t, s) => s.like === 'loved' ? loved.has(tkey(t)) : t.genre === s.like;
export function freeTracks(s = current()) { return s.free && s.like ? [...TRACKS, ...(s.like === 'loved' ? state.found || [] : [])].filter(t => inGenre(t, s)) : []; }
export const freeAllows = (t, s = current()) => !!(s.free && s.like && inGenre(t, s));
export const ownIds = (s = current()) => s.own;

export function create(name, like = null) {
  const id = 'st' + Date.now().toString(36);
  list.push({ id, name: name.trim() || 'My soundtrack', color: COLORS[(list.length - BUILT_IN.length) % COLORS.length], icon: 'M12 5v14M5 12h14', like, free: !!like, live: false, own: [], builtIn: false });
  save(); return id;
}
export function update(id, patch) { const s = byId(id); if (s) { Object.assign(s, patch); save(); } }
export function remove(id) {
  const s = byId(id); if (!s || s.builtIn) return;
  list = list.filter(x => x.id !== id);
  if (currentId === id) currentId = 'ambient';
  save();
}
export function addOwnTo(id, ids) { const s = byId(id); if (!s) return; s.own = [...new Set([...s.own, ...ids])]; save(); }
export function removeOwnFrom(id, ownId) { const s = byId(id); if (!s) return; s.own = s.own.filter(x => x !== ownId); save(); }
export const memberOf = ownId => list.filter(s => s.own.includes(ownId));
// Put one of the viewer's tracks in a single soundtrack, taking it out of any others.
export function moveOwnTo(id, ownId) { for (const s of list) s.own = s.own.filter(x => x !== ownId); const s = byId(id); if (s) s.own.push(ownId); save(); }
// The built-in that suits a scene, from its music tone and the time of day it is for.
export const forScene = tone => tone === 'pulse' ? 'synth' : tone === 'bright' || tone === 'dark' ? 'downtempo' : tone === 'warm' ? 'lofi' : 'ambient';   // High energy is yours to choose
// The timer: a quiet genre for focus blocks, a livelier one for breaks.
export const forTimer = mode => mode === 'focus' ? 'ambient' : 'downtempo';
// Forget tracks that are no longer on the device.
export function prune(existing) { const ok = new Set(existing); let changed = false; for (const s of list) { const n = s.own.filter(i => ok.has(i)); if (n.length !== s.own.length) { s.own = n; changed = true; } } if (changed) save(); }

// A suggestion for one of the viewer's tracks: its genre tag first, then its measured energy. sure = no need to ask.
export function suggest(e) {
  const g = matchName(e.genre);
  if (g) return { id: g, sure: true };
  if (typeof e.energy === 'number') {
    // Only the clear cases are placed without asking; the measurement can't tell calm from lively reliably in between.
    if (e.energy <= .15) return { id: 'ambient', sure: true };
    return { id: e.energy < .4 ? 'ambient' : e.energy < .65 ? 'lofi' : e.energy < .85 ? 'downtempo' : 'energy', sure: false };
  }
  return { id: 'misc', sure: false };
}
