// Hunts the Internet Archive's netlabels for workout music: the most downloaded Creative Commons releases in driving
// genres, every track of a usable length measured for loudness, tempo and beat strength (scripts/energy-lib.mjs).
//   node scripts/find-workout.mjs [--items 160] [--per 4] [--out /tmp/workout-candidates.json]
// Results are cached in the output file, so a second run carries on where the first stopped. Pick from them with
// --pick, which prints a balanced set (steady, fast and sprint paces; two tracks an artist at most) as tracks.json entries.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { analyse } from './energy-lib.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const ITEMS = Number(opt('--items', 160)), PER = Number(opt('--per', 4)), OUT = opt('--out', '/tmp/workout-candidates.json');
const GENRES = opt('--genres', '') ? opt('--genres').split(',') : ['drum and bass', 'drum & bass', 'dnb', 'neurofunk', 'jump up', 'drumstep', 'dubstep', 'breakbeat', 'big beat', 'breaks',
  'electro house', 'electro', 'hardstyle', 'hardcore', 'hard techno', 'techno', 'hard trance', 'psytrance', 'trance', 'industrial',
  'electronic rock', 'rock', 'metal', 'punk', 'house', 'tech house', 'nu disco', 'trap', 'hip hop', 'chiptune'];

// Labels and releases whose themes don't belong in a calm, general app (gore and shock metal).
const BLOCK = /torn ?flesh|TFR\d|gore|grind|vulgar|sangrient|splatter|cannibal|corpse|necro/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function json(url) {
  for (let i = 0; i < 5; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { /* retry */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}
const first = v => [].concat(v ?? [])[0];
const secs = L => !L ? 0 : String(L).includes(':') ? String(L).split(':').reduce((a, v) => a * 60 + Number(v), 0) : Number(L);
const lic = u => { const m = (u || '').match(/licenses\/([a-z-]+)\/([\d.]+)(\/([a-z]{2}))?/i); return m ? `CC ${m[1].toUpperCase()} ${m[2]}${m[4] ? ' ' + m[4].toUpperCase() : ''}` : /publicdomain\/zero/.test(u) ? 'CC0' : null; };

const db = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { items: {}, tracks: {} };
const save = () => writeFileSync(OUT, JSON.stringify(db));

if (args.includes('--remeasure')) {
  // Measure again the tracks loud enough to be in the running (after a change to energy-lib.mjs).
  const todo = Object.values(db.tracks).filter(t => t.m && t.m.db >= -12.5);
  let done = 0;
  const worker = async () => { while (todo.length) { const t = todo.shift(); t.m = await analyse(t.stream) || t.m; if (++done % 20 === 0) { save(); process.stderr.write(`${done} measured again\n`); } } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  save(); process.stderr.write('done\n');
} else if (!args.includes('--pick')) {
  // 1. Releases: the most downloaded in each genre.
  for (const g of GENRES) {
    const q = `collection:netlabels AND mediatype:audio AND licenseurl:*creativecommons* AND subject:("${g}")`;
    const r = await json(`https://archive.org/advancedsearch.php?${new URLSearchParams({ q, output: 'json', rows: 40, sort: 'downloads desc' })}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=downloads`);
    for (const d of r?.response?.docs || []) {
      const it = db.items[d.identifier] ||= { id: d.identifier, title: first(d.title), creator: first(d.creator), downloads: d.downloads || 0, genres: [] };
      if (!it.genres.includes(g)) it.genres.push(g);
    }
    process.stderr.write(`${g}: ${r?.response?.docs?.length ?? 'failed'}\n`);
  }
  save();
  // 2. Tracks of the top releases, then 3. measure them, four at a time.
  // The most downloaded overall, and with --per-genre N also the top N of every genre, so quieter scenes get a look in.
  const all = Object.values(db.items).filter(i => !BLOCK.test(`${i.id} ${i.title} ${i.creator}`)).sort((a, b) => b.downloads - a.downloads);
  const top = new Set(all.slice(0, ITEMS));
  const perGenre = Number(opt('--per-genre', 0));
  if (perGenre) for (const g of GENRES) all.filter(i => i.genres.includes(g)).slice(0, perGenre).forEach(i => top.add(i));
  const items = [...top];
  const queue = [];
  for (const it of items) {
    if (!it.files) {
      const m = await json('https://archive.org/metadata/' + encodeURIComponent(it.id));
      const url = first(m?.metadata?.licenseurl) || '';
      it.lic = lic(url);
      it.files = !it.lic ? [] : (m.files || []).filter(f => f.source === 'original' && /\.mp3$/i.test(f.name))
        .map(f => ({ name: f.name, t: f.title || f.name.split('/').pop().replace(/\.mp3$/i, '').replace(/^\d+[\s._-]*/, '').replace(/_+/g, ' '), a: first(f.creator || f.artist) || first(m.metadata.creator) || it.creator, L: Math.round(secs(f.length)), kb: secs(f.length) ? Math.round(f.size * 8 / secs(f.length) / 1000) : 0 }))
        .filter(f => f.L >= 150 && f.L <= 480 && f.kb >= 160);
      it.title = first(m?.metadata?.title) || it.title; save();
    }
    for (const f of it.files.slice(0, 12)) queue.push({ it, f });
  }
  // Up to PER tracks a release, the measuring spread across releases so a big album doesn't crowd out the rest.
  const byItem = {}; const todo = queue.filter(({ it, f }) => { const k = `${it.id}/${f.name}`; if (db.tracks[k]) return false; byItem[it.id] = (byItem[it.id] || 0) + 1; return byItem[it.id] <= PER * 2; });
  process.stderr.write(`${items.length} releases, ${todo.length} tracks to measure\n`);
  let done = 0;
  const worker = async () => {
    while (todo.length) {
      const { it, f } = todo.shift(), k = `${it.id}/${f.name}`;
      const stream = 'https://archive.org/download/' + encodeURIComponent(it.id) + '/' + f.name.split('/').map(encodeURIComponent).join('/');
      const m = await analyse(stream);
      db.tracks[k] = { item: it.id, ...f, stream, m };
      if (++done % 20 === 0) { save(); process.stderr.write(`${done} measured\n`); }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  save(); process.stderr.write(`done: ${Object.keys(db.tracks).length} tracks measured in all\n`);
} else {
  // A balanced pick: driving tracks only, scored on popularity, loudness and beat, spread across the three paces.
  const want = { steady: [115, 140, Number(opt('--steady', 12))], fast: [140, 160, Number(opt('--fast', 14))], sprint: [160, 190, Number(opt('--sprint', 14))] };
  const skip = new Set((opt('--skip', '') || '').split(',').filter(Boolean));
  const maxDl = Math.max(...Object.values(db.items).map(i => i.downloads || 1));
  const rows = Object.values(db.tracks).filter(t => t.m && t.m.db >= Number(opt("--db", -11)) && t.m.beat >= .5 && t.m.bpm >= 115 && !skip.has(t.item) && !BLOCK.test(`${t.item} ${t.t} ${db.items[t.item].title}`)).map(t => {
    const it = db.items[t.item];
    const pop = Math.log10(1 + (it.downloads || 0)) / Math.log10(1 + maxDl);
    const energy = Math.min(1, (t.m.db + 16) / 10) * .5 + t.m.beat * .5;
    return { t, it, score: pop * .55 + energy * .45 };
  }).sort((a, b) => b.score - a.score);
  const artists = {}, releases = {}, picked = [];
  for (const [pace, [lo, hi, n]] of Object.entries(want)) {
    let got = 0;
    for (const r of rows) {
      if (got >= n) break;
      const bpm = r.t.m.bpm, a = String(r.t.a || r.it.creator || '').toLowerCase();
      if (bpm < lo || bpm >= hi || picked.includes(r) || (artists[a] || 0) >= 2 || (releases[r.it.id] || 0) >= 2) continue;
      picked.push(r); artists[a] = (artists[a] || 0) + 1; releases[r.it.id] = (releases[r.it.id] || 0) + 1; got++; r.pace = pace;
    }
  }
  if (args.includes('--table')) for (const r of picked) console.log([r.pace, r.t.m.bpm, r.t.m.db, r.t.m.beat, r.it.downloads, r.score.toFixed(2), r.it.genres.slice(0, 3).join('/'), r.t.L, `${r.t.a} — ${r.t.t}`, r.it.lic].join(' | '));
  else console.log(JSON.stringify(picked.map(({ t, it }) => ({
    a: t.a, t: t.t, lic: it.lic, mood: 'bright', ep: [], src: 'https://archive.org/details/' + it.id, stream: t.stream, conf: 'confirmed', genre: 'energy',
    note: `From "${it.title}" on archive.org (about ${t.m.bpm} BPM); licence as stated on the release.`, len: t.L, db: t.m.db, bpm: t.m.bpm, beat: t.m.beat,
  })), null, 1));
}
