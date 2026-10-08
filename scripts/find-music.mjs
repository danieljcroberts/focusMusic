// Finds Creative Commons tracks on the Internet Archive's netlabel collection and prints them as tracks.json entries.
//   node scripts/find-music.mjs ambient piano            search terms (matched against the item's title, description and tags)
//   node scripts/find-music.mjs --tag drone --rows 20    a subject tag instead; --rows is how many releases to look at (default 10)
// Every result is marked conf "likely": open the source link and confirm the licence before adding it.
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const rows = Number(opt('--rows', 10)), tag = opt('--tag', null);
const words = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--rows' && args[i - 1] !== '--tag').join(' ');
if (!words && !tag) { console.error('give search terms or --tag'); process.exit(2); }
const q = `collection:netlabels AND mediatype:audio AND licenseurl:*creativecommons* AND ${tag ? `subject:(${tag})` : `(${words})`}`;
const search = `https://archive.org/advancedsearch.php?${new URLSearchParams({ q, output: 'json', rows, sort: 'downloads desc' })}&fl[]=identifier&fl[]=title&fl[]=creator`;
const secs = L => !L ? 0 : String(L).includes(':') ? String(L).split(':').reduce((a, v) => a * 60 + Number(v), 0) : Number(L);
const first = v => [].concat(v ?? [])[0];
const lic = u => { const m = (u || '').match(/licenses\/([a-z-]+)\/([\d.]+)/i); return m ? 'CC ' + m[1].toUpperCase() + ' ' + m[2] : /publicdomain\/zero/.test(u) ? 'CC0' : 'Creative Commons'; };

const out = [];
const docs = (await (await fetch(search)).json()).response.docs;
for (const doc of docs) {
  const m = await (await fetch('https://archive.org/metadata/' + encodeURIComponent(doc.identifier))).json();
  const url = first(m.metadata && m.metadata.licenseurl) || '';
  if (!/creativecommons/.test(url)) continue;
  const files = (m.files || [])
    .filter(f => f.source === 'original' && /\.mp3$/i.test(f.name))
    .map(f => { const L = secs(f.length); return { ...f, L, kb: L ? f.size * 8 / L / 1000 : 0 }; })
    .filter(f => f.L >= 90 && f.L <= 1800 && f.kb >= 185)
    .slice(0, 3);
  for (const f of files) {
    out.push({
      a: first(f.creator || f.artist || m.metadata.creator) || 'Unknown artist',
      t: f.title || f.name.split('/').pop().replace(/\.mp3$/i, '').replace(/_+/g, ' '),
      lic: lic(url), ep: [], src: 'https://archive.org/details/' + doc.identifier,
      stream: 'https://archive.org/download/' + encodeURIComponent(doc.identifier) + '/' + f.name.split('/').map(encodeURIComponent).join('/'),
      conf: 'likely', note: `Found by scripts/find-music.mjs in "${first(m.metadata.title) || doc.identifier}" (${Math.round(f.L / 60)} min, ${Math.round(f.kb)} kbps). Confirm the licence on the item page.`,
    });
  }
}
console.log(JSON.stringify(out, null, 2));
console.error(`${out.length} track(s) from ${docs.length} release(s). Paste the ones you want into src/data/tracks.json.`);
