// Measures every free track and records it in src/data/tracks.json: loudness (`db`, RMS dBFS of a 40 s slice from the
// middle), tempo (`bpm`) and how strong and steady the beat is (`beat`, 0 to 1), from an onset envelope. The app uses
// them for the Workout pace filter, calmer music at bedtime, beat-paced workout scenes and smarter crossfades.
// Then it lists tracks that look out of place in their soundtrack. Needs ffmpeg. Re-run after adding tracks.
//   node scripts/analyse-music.mjs [--all]      (--all measures again tracks that already have values)
import { readFileSync, writeFileSync } from 'node:fs';
import { analyse } from './energy-lib.mjs';
const path = new URL('../src/data/tracks.json', import.meta.url);
const T = JSON.parse(readFileSync(path, 'utf8')), all = process.argv.includes('--all');
const local = t => t.file && new URL('../public/assets/music/' + t.file, import.meta.url).pathname;
const todo = T.filter(t => (t.stream || t.file) && (all || t.bpm === undefined));
let i = 0, done = 0;
async function worker() {
  while (i < todo.length) {
    const t = todo[i++], lp = local(t), { existsSync } = await import('node:fs'), e = await analyse(lp && existsSync(lp) ? lp : t.stream);
    if (e) { t.db = e.db; t.bpm = e.bpm; t.beat = e.beat; done++; }
    process.stdout.write(`\r${done} of ${todo.length} measured`);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
writeFileSync(path, JSON.stringify(T, null, 2) + '\n');
console.log();
// Tracks that look out of place: energetic ones in calm soundtracks, gentle ones in Workout.
const calm = new Set(['ambient', 'minimalist', 'classical', 'lofi']);
for (const t of T.filter(t => t.bpm)) {
  if (calm.has(t.genre) && t.db > -9 && t.beat > .6) console.log(`loud and driving for ${t.genre}: ${t.a} — ${t.t} (${t.db} dB, ${t.bpm} BPM, beat ${t.beat})`);
  if (t.genre === 'energy' && (t.db < -12 || t.beat < .3)) console.log(`gentle for Workout: ${t.a} — ${t.t} (${t.db} dB, beat ${t.beat})`);
}
