// Downloads the bundled tracks into public/assets/music, which is not in git.
// Each is the unmodified original from the netlabel release on archive.org (most are no-derivatives).
import { readFileSync, existsSync, mkdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TRACKS = JSON.parse(readFileSync(join(root, 'src/data/tracks.json'), 'utf8'));
const dir = join(root, 'public/assets/music');
mkdirSync(dir, { recursive: true });

let fetched = 0, failed = 0;
for (const t of TRACKS.filter(t => t.file)) {
  const dest = join(dir, t.file);
  if (existsSync(dest) && statSync(dest).size > 0) { console.log(`have    ${t.file}`); continue; }
  if (!t.stream) { console.error(`no URL  ${t.file}`); failed++; continue; }
  process.stdout.write(`fetch   ${t.file} … `);
  try {
    const r = await fetch(t.stream, { redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    console.log(`${(statSync(dest).size / 1e6).toFixed(1)} MB`);
    fetched++;
  } catch (e) {
    console.log(`failed (${e.message})`);
    if (existsSync(dest)) unlinkSync(dest);
    failed++;
  }
}
console.log(`${fetched} fetched, ${failed} failed`);
process.exit(failed ? 1 : 0);
