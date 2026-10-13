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
// A file's length in seconds. MP3s are read exactly from their headers (a Xing/Info frame count, or the size over a
// constant bitrate); other formats ask an audio element for the metadata. 0 when it can't be read. Remembered per file.
const DUR = new WeakMap();
const BR = [[0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448], [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256], [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]];
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
async function mp3Length(file) {
  const b = new Uint8Array(await file.slice(0, 262144).arrayBuffer());
  let i = 0;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) i = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]) + (b[5] & 0x10 ? 10 : 0);
  for (; i + 4 < b.length; i++) {
    if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) continue;
    const ver = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3, bri = b[i + 2] >> 4, sri = (b[i + 2] >> 2) & 3, mode = b[i + 3] >> 6;
    if (ver === 1 || layer === 0 || bri === 0 || bri === 15 || sri === 3) continue;
    const mpeg1 = ver === 3, sr = SR[ver][sri], kbps = BR[mpeg1 ? 3 - layer : (layer === 3 ? 1 : 3)][bri] || BR[mpeg1 ? (layer === 3 ? 0 : layer === 2 ? 1 : 2) : (layer === 3 ? 1 : 3)][bri];
    const spf = layer === 3 ? 384 : layer === 2 ? 1152 : (mpeg1 ? 1152 : 576);
    const side = mpeg1 ? (mode === 3 ? 17 : 32) : (mode === 3 ? 9 : 17), x = i + 4 + side;
    const tag = String.fromCharCode(b[x], b[x + 1], b[x + 2], b[x + 3]);
    if ((tag === 'Xing' || tag === 'Info') && (b[x + 7] & 1)) { const frames = (b[x + 8] << 24 | b[x + 9] << 16 | b[x + 10] << 8 | b[x + 11]) >>> 0; return frames * spf / sr; }
    return kbps ? (file.size - i) * 8 / (kbps * 1000) : 0;
  }
  return 0;
}
function elementLength(file) {
  return new Promise(res => {
    const a = document.createElement('audio'), url = URL.createObjectURL(file);
    const done = v => { clearTimeout(tm); URL.revokeObjectURL(url); a.removeAttribute('src'); res(v); };
    const tm = setTimeout(() => done(0), 8000);
    a.preload = 'metadata'; a.onloadedmetadata = () => setTimeout(() => done(isFinite(a.duration) ? a.duration : 0), 400); a.onerror = () => done(0); a.src = url;
  });
}
export function duration(file) {
  if (DUR.has(file)) return DUR.get(file);
  const p = (/\.mp3$/i.test(file.name) ? mp3Length(file).catch(() => 0) : elementLength(file)).then(v => (isFinite(v) && v > 0 ? v : 0));
  DUR.set(file, p); return p;
}
// Total length of some files, measured a few at a time; calls back with the running total as it goes.
export async function durations(files, onProgress = () => {}) {
  let total = 0, i = 0;
  // Each worker awaits first, then adds: "total += await" would read the old total and overwrite the others' work.
  const worker = async () => { while (i < files.length) { const f = files[i++], d = await duration(f); total += d; onProgress(total); } };
  await Promise.all(Array.from({ length: Math.min(4, files.length) }, worker));
  return total;
}
export const fmtDur = sec => { const m = Math.round(sec / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`; };
// Add files (from a file picker or a folder picker). Reports progress. Returns one entry per audio file, in order:
// the new entry, or the one already here for a file added before, so callers can sort them into soundtracks.
// opts.measure(file) may return extra fields (energy, tempo) to keep with the entry.
export async function addOwn(files, progress = () => {}, opts = {}) {
  const list = [...files].filter(isAudio);
  const out = [], fresh = new Set();
  let added = 0, dir = null;
  if (opfs) { try { dir = await folder(); if (navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { dir = null; } }
  for (let k = 0; k < list.length; k++) {
    const f = list[k];
    progress(k + 1, list.length, f.name);
    const have = index.find(e => e.name === f.name && e.size === f.size);
    if (have) { out.push(have); continue; }                                     // already here
    const tg = await tags(f), nm = fromName(f.name);
    const e = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), name: f.name, a: tg.TPE1 || nm.a || 'Unknown artist', t: tg.TIT2 || nm.t, size: f.size, genre: (tg.TCON || '').replace(/^\(\d+\)/, ''), dur: Math.round(await duration(f)) };
    if (opts.measure) { try { Object.assign(e, await opts.measure(f)); } catch (err) {} }
    let stored = false;
    if (dir) {
      try {
        const h = await dir.getFileHandle(e.id, { create: true }), w = await h.createWritable();
        await w.write(f); await w.close(); stored = true;
      } catch (err) { keeps = false; }
    }
    if (!stored) session.set(e.id, f);
    index.push(e); added++; out.push(e); fresh.add(e.id);
  }
  index.sort((x, y) => (x.a + x.t).localeCompare(y.a + y.t));
  if (opfs) await save();
  out.added = added; out.fresh = fresh;   // the count of new entries, and which they were
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
