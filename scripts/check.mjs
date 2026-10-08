// Checks that the scene and track data agree with each other and with the files on disk.
// Run with `npm run check`. Exits non-zero on any error.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { SCENES } = await import(join(root, 'src/data/scenes.js'));
const TRACKS = JSON.parse(readFileSync(join(root, 'src/data/tracks.json'), 'utf8'));
const SCENE_DIR = join(root, 'public/assets/scenes');
const MUSIC_DIR = join(root, 'public/assets/music');
// Mirrors KINDS in src/ambience.js, which cannot be imported here because it touches the audio API.
const SOUNDS = new Set(['none', 'rain', 'wind', 'sea', 'fire', 'cafe', 'train', 'storm', 'pond', 'aquarium', 'road', 'hum', 'space']);

const errors = [], warnings = [];
const err = m => errors.push(m);
const warn = m => warnings.push(m);

// Tracks
const trackKeys = new Set();
const CONF = new Set(['confirmed', 'likely']);
for (const t of TRACKS) {
  const k = `${t.a}|${t.t}`;
  if (trackKeys.has(k)) err(`duplicate track: ${k}`);
  trackKeys.add(k);
  if (!t.lic) err(`track has no licence: ${k}`);
  if (!CONF.has(t.conf)) err(`track has unknown conf "${t.conf}": ${k}`);
  if (!t.src) err(`track has no source link: ${k}`);
  if (t.file && !t.stream) warn(`bundled track has no stream URL to fetch from: ${k}`);
}

// Scenes
const names = new Set(), keys = new Set();
for (const s of SCENES) {
  if (names.has(s.name)) err(`duplicate scene name: ${s.name}`);
  names.add(s.name);
  if (keys.has(s.key)) err(`duplicate scene key: ${s.key}`);
  keys.add(s.key);
  if (!trackKeys.has(s.music)) err(`scene "${s.name}" names a track that is not in tracks.json: ${s.music}`);
  if (!s.bgs) {
    if (!s.art || typeof s.art.who !== 'string') err(`scene "${s.name}" has no art credit`);
    else if (s.art.who !== 'Original, drawn in code' && !s.art.lic) err(`scene "${s.name}" credits art without a licence`);
  }
  if (!s.desc) err(`scene "${s.name}" has no description`);
  if (!SOUNDS.has(s.sound)) err(`scene "${s.name}" has an unknown sound "${s.sound}"`);
  if (!['day', 'night', 'any'].includes(s.mood)) err(`scene "${s.name}" has an unknown mood "${s.mood}"`);
  if (!/^#[0-9a-f]{6}$/i.test(s.sw || '')) err(`scene "${s.name}" has no swatch colour`);
  if (s.src && !existsSync(join(SCENE_DIR, s.src))) err(`scene "${s.name}" image is missing: ${s.src}`);
}

// Every scene asset named in the source exists. Scene art is referenced by bare file name.
const ASSET = /'([\w.-]+\.(?:png|jpe?g|webp|mp4|webm|gif))'/g;
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p; });
const referenced = new Set();
for (const file of walk(join(root, 'src')).filter(f => f.endsWith('.js'))) {
  for (const m of readFileSync(file, 'utf8').matchAll(ASSET)) referenced.add(m[1]);
}
for (const f of referenced) if (!existsSync(join(SCENE_DIR, f))) err(`asset referenced in src/ is missing from public/assets/scenes: ${f}`);
for (const f of readdirSync(SCENE_DIR)) if (!referenced.has(f)) warn(`unused file in public/assets/scenes: ${f}`);

// Bundled music. A fresh clone has none; a partial set means a track is missing.
const bundled = TRACKS.filter(t => t.file);
if (!existsSync(MUSIC_DIR) || readdirSync(MUSIC_DIR).length === 0) {
  warn(`no bundled music yet; run \`npm run fetch-music\` to download the ${bundled.length} tracks`);
} else {
  for (const t of bundled) if (!existsSync(join(MUSIC_DIR, t.file))) err(`bundled track is missing from public/assets/music (run \`npm run fetch-music\`): ${t.file}`);
  const want = new Set(bundled.map(t => t.file));
  for (const f of readdirSync(MUSIC_DIR)) if (!want.has(f)) warn(`file in public/assets/music is not in tracks.json: ${f}`);
}

for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
console.log(`${SCENES.length} scenes, ${TRACKS.length} tracks, ${referenced.size} scene assets: ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
