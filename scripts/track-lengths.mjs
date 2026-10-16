// Records each free track's length in seconds as `len` in src/data/tracks.json, for the totals shown in the app.
// Bundled tracks are measured from public/assets/music with ffprobe; streamed ones from their archive.org item metadata.
// Tracks on an artist's own page (no file, no stream) are left without a length. Re-run after adding tracks.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), path = join(root, 'src/data/tracks.json');
const TRACKS = JSON.parse(readFileSync(path, 'utf8'));
const secs = L => !L ? 0 : String(L).includes(':') ? String(L).split(':').reduce((a, v) => a * 60 + Number(v), 0) : Number(L);
const meta = {};
let found = 0, missing = [];
for (const t of TRACKS) {
  if (t.len && !process.argv.includes('--all')) continue;
  let len = 0;
  const local = t.file && join(root, 'public/assets/music', t.file);
  if (local && existsSync(local)) {
    try { len = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', local]).toString().trim()); } catch (e) {}
  }
  const m = !len && t.stream && /archive\.org\/download\/([^/]+)\/(.+)$/.exec(t.stream);
  if (m) {
    const id = decodeURIComponent(m[1]), name = m[2].split('/').map(decodeURIComponent).join('/');
    try {
      meta[id] = meta[id] || await (await fetch('https://archive.org/metadata/' + encodeURIComponent(id))).json();
      const f = (meta[id].files || []).find(f => f.name === name);
      len = secs(f && f.length);
    } catch (e) {}
  }
  if (len > 0) { t.len = Math.round(len); found++; } else if (t.file || t.stream) missing.push(`${t.a} — ${t.t}`);
}
writeFileSync(path, JSON.stringify(TRACKS, null, 2) + '\n');
console.log(`${found} length(s) recorded`);
if (missing.length) console.log(`no length for:\n  ${missing.join('\n  ')}`);
