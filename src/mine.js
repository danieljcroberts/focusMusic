// Your music: audio files the viewer adds from their own device. They are copied into the browser's private file storage
// (the origin private file system) so they survive restarts and work offline, and they never leave the device.
// Where that storage is missing, files are kept for this session only.
import { kvSet, kvAll } from './store.js';

const AUDIO = /\.(mp3|m4a|aac|ogg|oga|opus|flac|wav|webm)$/i;
const opfs = !!(navigator.storage && navigator.storage.getDirectory);
let index = [];                 // [{ id, name, a, t, size }]
const session = new Map();      // id -> File, when files can't be stored
export let keeps = opfs;        // whether added files survive a restart

async function folder() { const root = await navigator.storage.getDirectory(); return root.getDirectoryHandle('music', { create: true }); }
const save = () => kvSet('mine:index', index);
export const ownTracks = () => index;

export async function loadOwn() {
  if (!opfs) return index;
  const all = await kvAll('mine:index');
  index = Array.isArray(all['mine:index']) ? all['mine:index'] : [];
  return index;
}

// Artist, title and genre from ID3v2 tags (TPE1, TIT2, TCON), which most MP3s carry; otherwise from an "Artist - Title" file name.
function text(bytes, enc) {
  try {
    if (enc === 0) return new TextDecoder('latin1').decode(bytes);
    if (enc === 1) return new TextDecoder('utf-16').decode(bytes);
    if (enc === 2) return new TextDecoder('utf-16be').decode(bytes);
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) { return ''; }
}
async function tags(file) {
  const out = {};
  try {
    const b = new Uint8Array(await file.slice(0, 131072).arrayBuffer());
    if (b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return out;      // "ID3"
    const ver = b[3], size = (b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9];
    let i = 10;
    while (i + 10 < Math.min(b.length, size + 10)) {
      const id = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const n = ver === 4 ? (b[i + 4] << 21) | (b[i + 5] << 14) | (b[i + 6] << 7) | b[i + 7] : (b[i + 4] << 24) | (b[i + 5] << 16) | (b[i + 6] << 8) | b[i + 7];
      if (n <= 0) break;
      if (id === 'TIT2' || id === 'TPE1' || id === 'TCON') {
        // ID3v2.4 frames may carry a 4-byte length first and be "unsynchronised" (0xFF 0x00 stands for 0xFF).
        const fl = b[i + 9];
        let d = b.subarray(i + 10 + (ver === 4 && fl & 1 ? 4 : 0), i + 10 + n);
        if (b[5] & 0x80 || (ver === 4 && fl & 2)) d = d.filter((v, k) => !(v === 0 && k && d[k - 1] === 0xff));
        out[id] = text(d.subarray(1), d[0]).replace(/\0/g, '').trim();
      }
      i += 10 + n;
    }
  } catch (e) {}
  return out;
}
function fromName(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/^\s*\d{1,3}[\s.\-_]+/, '').trim();
  const m = base.split(/\s+[-–]\s+/);
  return m.length >= 2 ? { a: m[0], t: m.slice(1).join(' - ') } : { a: '', t: base };
}

export const isAudio = f => AUDIO.test(f.name) || (f.type || '').startsWith('audio/');
// Add files (from a file picker or a folder picker). Reports progress. Returns one entry per audio file, in order:
// the new entry, or the one already here for a file added before, so callers can sort them into soundtracks.
// opts.measure(file) may return extra fields (energy, tempo) to keep with the entry.
export async function addOwn(files, progress = () => {}, opts = {}) {
  const list = [...files].filter(isAudio);
  const out = [];
  let added = 0, dir = null;
  if (opfs) { try { dir = await folder(); if (navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { dir = null; } }
  for (let k = 0; k < list.length; k++) {
    const f = list[k];
    progress(k + 1, list.length, f.name);
    const have = index.find(e => e.name === f.name && e.size === f.size);
    if (have) { out.push(have); continue; }                                     // already here
    const tg = await tags(f), nm = fromName(f.name);
    const e = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), name: f.name, a: tg.TPE1 || nm.a || 'Unknown artist', t: tg.TIT2 || nm.t, size: f.size, genre: (tg.TCON || '').replace(/^\(\d+\)/, '') };
    if (opts.measure) { try { Object.assign(e, await opts.measure(f)); } catch (err) {} }
    let stored = false;
    if (dir) {
      try {
        const h = await dir.getFileHandle(e.id, { create: true }), w = await h.createWritable();
        await w.write(f); await w.close(); stored = true;
      } catch (err) { keeps = false; }
    }
    if (!stored) session.set(e.id, f);
    index.push(e); added++; out.push(e);
  }
  index.sort((x, y) => (x.a + x.t).localeCompare(y.a + y.t));
  if (opfs) await save();
  out.added = added;
  return out;
}
export async function ownURL(e) {
  if (session.has(e.id)) return URL.createObjectURL(session.get(e.id));
  const h = await (await folder()).getFileHandle(e.id);
  return URL.createObjectURL(await h.getFile());
}
export async function removeOwn(id) {
  index = index.filter(e => e.id !== id); session.delete(id);
  if (opfs) { try { await (await folder()).removeEntry(id); } catch (e) {} await save(); }
}
export async function clearOwn() {
  for (const e of index.slice()) await removeOwn(e.id);
}
export const ownBytes = () => index.reduce((s, e) => s + (e.size || 0), 0);
