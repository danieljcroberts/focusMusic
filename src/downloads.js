// Music kept on this device in the Android app. The app leaves the bundled tracks out (Google Play's size limit) and
// streams them from the live site; "Download music to this phone" keeps a copy of each in the app's own storage, so they
// play with no connection. The player asks localTrack(file) first and falls back to streaming.
import { kvSet, kvAll, kvDel } from './store.js';

const urls = new Map();   // file name -> object URL of the kept copy
let loaded = false;
export async function loadDownloads() {
  if (loaded) return; loaded = true;
  try { for (const [k, blob] of Object.entries(await kvAll('dl:'))) if (blob instanceof Blob) urls.set(k.slice(3), URL.createObjectURL(blob)); } catch (e) {}
}
export const localTrack = file => urls.get(file) || null;
export const downloadedCount = () => urls.size;
// Download every file not yet kept, reporting progress as (done, total, file). Stops at the first failure.
export async function downloadAll(files, base, progress = () => {}) {
  await loadDownloads();
  const todo = files.filter(f => !urls.has(f));
  for (let i = 0; i < todo.length; i++) {
    progress(i, todo.length, todo[i]);
    const r = await fetch(base + todo[i]); if (!r.ok) throw new Error(`${todo[i]}: ${r.status}`);
    const blob = await r.blob();
    await kvSet('dl:' + todo[i], blob);
    urls.set(todo[i], URL.createObjectURL(blob));
  }
  progress(todo.length, todo.length, null);
}
export async function removeDownloads() {
  for (const f of urls.keys()) await kvDel('dl:' + f);
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
}
