// Builds src/data/recommended.json from scripts/recommended-picks.json: for each hand-picked commercial track, the
// iTunes Search API (no key, public) gives its 30-second preview, cover art and store link, and confirms it exists.
// Bandcamp links (where the artist sells there) come from scripts/recommended-bandcamp.json and are preferred for Buy.
// No affiliate tokens anywhere: the app earns nothing, which keeps it non-commercial (see the music licences).
//   node scripts/find-recommended.mjs            (node scripts/find-recommended.mjs --links: only the Bandcamp links)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const picks = JSON.parse(readFileSync(new URL('./recommended-picks.json', import.meta.url)));
const bcFile = new URL('./recommended-bandcamp.json', import.meta.url);
const bc = existsSync(bcFile) ? JSON.parse(readFileSync(bcFile)) : {};
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const outFile = new URL('../src/data/recommended.json', import.meta.url);
if (process.argv.includes('--links')) {   // only refresh the Bandcamp links, without asking Apple again
  const have = JSON.parse(readFileSync(outFile));
  for (const l of Object.values(have)) for (const e of l) e.bandcamp = bc[e.k] || null;
  writeFileSync(outFile, JSON.stringify(have, null, 1) + '\n');
  console.log('links refreshed'); process.exit(0);
}
const out = {}, missing = [], prev = existsSync(outFile) ? Object.values(JSON.parse(readFileSync(outFile))).flat() : [];
for (const [genre, list] of Object.entries(picks)) {
  out[genre] = [];
  for (const [artist, title, album, country = 'US'] of list) {   // album: optional, the release to prefer; country: the store to search
    const key = `${artist}|${title}`;
    const q = new URLSearchParams({ term: `${artist} ${title}`, entity: 'song', limit: '25', country });
    let res = [];
    // The API allows about twenty searches a minute: on a refusal, wait and try again.
    for (let i = 0; i < 6 && !res.length; i++) {
      try { const r = await fetch('https://itunes.apple.com/search?' + q); if (r.ok) res = (await r.json()).results || []; else await new Promise(w => setTimeout(w, 15000)); }
      catch (e) { await new Promise(w => setTimeout(w, 5000)); }
    }
    // The original recording: the right artist and title first, then not a remix, live take, alternative version or
    // compilation (unless the pick asks for one), then the earliest release.
    const want = norm(title), who = norm(artist), extra = /remix|live|version|slow|edit|mono|karaoke|cover|tribute|instrumental/;
    const score = r => {
      const t = norm(r.trackName), a = norm(r.artistName), c = norm(r.collectionName || '');
      if (!a.includes(who.split(' ')[0]) || !t.includes(want.slice(0, 12))) return -99;
      return (t === want ? 4 : t.startsWith(want) ? 2 : 0) + (a === who ? 3 : a.startsWith(who) ? 2 : 0)
        - (extra.test(t) && !extra.test(want) ? 3 : 0) - (/hits|best of|compilation|hotmix|essentials|playlist|various|collection/.test(c) ? 2 : 0)
        + (album && norm(r.collectionName || '').includes(norm(album)) ? 6 : 0)
        - (r.collectionArtistName && norm(r.collectionArtistName).includes('various') ? 2 : 0) - (Number((r.releaseDate || '2100').slice(0, 4)) - 1950) / 200;
    };
    const hit = res.filter(r => score(r) > -50).sort((x, y) => score(y) - score(x))[0];
    if (!hit || !hit.previewUrl) {   // not found this time (often the rate limit): keep what the last run found, if anything
      const before = prev.find(e => e.k === key); if (before) out[genre].push({ ...before, bandcamp: bc[key] || null });
      missing.push(`${genre}: ${artist} — ${title}${before ? ' (kept from before)' : ''}`); continue;
    }
    out[genre].push({ k: key, a: hit.artistName, t: hit.trackName, album: hit.collectionName, year: (hit.releaseDate || '').slice(0, 4),
      art: hit.artworkUrl100.replace('100x100bb', '300x300bb'), preview: hit.previewUrl, itunes: hit.trackViewUrl.replace(/[?&]uo=\d+/, ''), bandcamp: bc[key] || null });
    await new Promise(r => setTimeout(r, 3200));   // under the API's limit
  }
}
writeFileSync(outFile, JSON.stringify(out, null, 1) + '\n');
console.log(Object.entries(out).map(([g, l]) => `${g}: ${l.length}`).join(', '));
if (missing.length) console.log('not found:\n' + missing.join('\n'));
