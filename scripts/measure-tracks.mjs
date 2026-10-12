/* global fetch, File */
// Measures how lively each free track is (src/measure.js, run in a headless Chromium against the dev server) and writes
// `energy` and `bpm` into src/data/tracks.json. Bundled files are read locally; streamed ones from archive.org, two
// 2.8 MB ranges each (the start and the middle), so nothing large is downloaded.
// Usage: SMOKE_CHROMIUM=<path> node scripts/measure-tracks.mjs [url]   (only tracks without a measurement; ALL=1 for every track)
// Don't edit src/ while it runs: the dev server would reload the page under it.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.argv[2] || 'http://127.0.0.1:5173';
const path = join(root, 'src/data/tracks.json');
const tracks = JSON.parse(readFileSync(path, 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM });
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'load' });
let n = 0;
for (const t of tracks) {
  const src = t.file ? `${url}/assets/music/${t.file}` : t.stream;
  if (!src || (typeof t.energy === 'number' && !process.env.ALL)) continue;   // ALL=1 re-measures everything
  const r = await page.evaluate(async src => {
    const { measure } = await import('/src/measure.js');
    const CH = 2800000;
    const part = async (from) => { const res = await fetch(src, { headers: { Range: `bytes=${from}-${from + CH - 1}` } }); if (!res.ok) throw new Error(res.status); return new File([await res.blob()], 'x.mp3'); };
    let size = 0; try { const h = await fetch(src, { method: 'HEAD' }); size = Number(h.headers.get('content-length')) || 0; } catch (e) {}
    const out = [];
    try { out.push(await measure(await part(0))); } catch (e) { return { error: String(e) }; }
    if (size > 7000000) { try { out.push(await measure(await part(Math.floor(size / 2)))); } catch (e) {} }
    const best = out.filter(o => typeof o.energy === 'number').sort((a, b) => b.energy - a.energy)[0];
    return best || { error: 'no energy' };
  }, src).catch(e => ({ error: String(e) }));
  if (r.error) { console.log(`${t.a} — ${t.t}: ${r.error}`); continue; }
  t.energy = r.energy; t.bpm = r.bpm; n++;
  console.log(`${t.a} — ${t.t}: energy ${r.energy}${r.bpm ? `, ${r.bpm} bpm` : ''} (${t.mood})`);
}
await browser.close();
writeFileSync(path, JSON.stringify(tracks, null, 2) + '\n');
console.log(`${n} of ${tracks.length} tracks measured; written to src/data/tracks.json`);
