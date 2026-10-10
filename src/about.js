// About and credits: every artist, photographer and composer whose work appears, with the licence and a link,
// built from the same data the scenes and the library use so it cannot drift from what is shown.
// Also the first-run hint, shown once to a new visitor.
import { SCENES } from './scenes/index.js';
import { BGS } from './scenes/glass-shared.js';
import { TRACKS } from './music.js';
import { state, saveState } from './state.js';

const el = id => document.getElementById(id);
const panel = el('about'), list = el('aboutList');

function link(href, text) { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text; return a; }
function section(title, rows) {
  const sec = document.createElement('section');
  const h = document.createElement('h3'); h.textContent = title;
  const ul = document.createElement('ul');
  for (const r of rows) {
    const li = document.createElement('li');
    const t = document.createElement('div'); t.className = 't'; t.textContent = r.title;
    const m = document.createElement('div'); m.className = 'm';
    m.append([r.who, r.lic].filter(Boolean).join(' · '));
    if (r.url) m.append(' · ', link(r.url, 'Source ↗'));
    li.append(t, m); ul.append(li);
  }
  sec.append(h, ul); return sec;
}

function build() {
  // Art: one row per distinct credit, listing the scenes that use it.
  const art = new Map();
  const add = (info, scene) => {
    if (!info || !info.lic) return;   // drawn in code needs no credit
    const k = info.who + '|' + info.url;
    if (!art.has(k)) art.set(k, { ...info, scenes: [] });
    if (!art.get(k).scenes.includes(scene)) art.get(k).scenes.push(scene);
  };
  for (const s of SCENES) {
    if (s.bgs) for (const b of Object.values(BGS)) add(b.art, s.name);
    else add(s.art, s.name);
  }
  const artRows = [...art.values()].map(a => ({ title: a.who, who: 'In ' + a.scenes.join(', '), lic: a.lic, url: a.url }));
  const playable = TRACKS.filter(t => t.file || t.stream);
  const musicRows = playable.map(t => ({ title: `${t.t} — ${t.a}`, who: t.file ? 'bundled' : 'streamed', lic: t.lic, url: t.src }));
  list.textContent = '';
  const intro = document.createElement('p'); intro.className = 'intro';
  intro.textContent = 'Slow Windows is free and will stay free. Scenes without a credit below are drawn in code. Everything else is used under the licence shown; thank you to every artist here.';
  list.append(intro,
    section(`Art, photographs and footage (${artRows.length})`, artRows),
    section(`Music that plays here (${musicRows.length})`, musicRows),
    section('Code', [
      { title: 'three.js (Open Water, Snowfall, Starfield)', who: 'three.js authors', lic: 'MIT', url: 'https://github.com/mrdoob/three.js' },
      { title: 'Weather and sunrise (optional)', who: 'Open-Meteo', lic: 'CC BY 4.0 data', url: 'https://open-meteo.com' },
      { title: 'Live source', who: 'Internet Archive netlabels', lic: 'per item, shown while playing', url: 'https://archive.org/details/netlabels' },
      { title: 'Source code and full credits', who: 'GitHub', lic: '', url: 'https://github.com/danieljcroberts/focusMusic/blob/main/CREDITS.md' },
    ]));
}

export const aboutOpen = () => !panel.hidden;
export function openAbout(open = panel.hidden) {
  if (open && !list.childElementCount) build();
  panel.hidden = !open; document.body.classList.toggle('lib-open', open);
  if (open) el('aboutClose').focus();
}
el('aboutClose').addEventListener('click', () => openAbout(false));

// First visit: one quiet card on how it works, then never again.
const hint = el('hint1');
if (!state.seenHint) hint.hidden = false;
el('hint1Ok').addEventListener('click', () => { hint.hidden = true; saveState({ seenHint: true }); });
