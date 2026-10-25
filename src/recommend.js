// Recommended tracks to buy: a few hand-picked commercial tracks for each genre (src/data/recommended.json, built by
// scripts/find-recommended.mjs), shown under the genres in the cover's menu. A card for each: its cover, a 30-second
// preview from Apple, Buy on Bandcamp (where the artist sells there) or in Apple's store, and "I've bought it", which
// adds the downloaded file to the genre so it plays like the rest. The stores do the selling; the links carry no
// affiliate codes and the app earns nothing, which keeps it non-commercial and its free music's licences intact.
import REC from './data/recommended.json';
import * as ST from './soundtracks.js';
import { addOwn } from './mine.js';
import { musicPlaying, togglePlay } from './music.js';
import { state, saveState } from './state.js';
import { setStatus } from './status.js';
import { NATIVE, nativeOpenExternal } from './native.js';

const h = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids.filter(k => k != null)); return n; };
const keyOf = r => `${r.a}|${r.t}`;
const bought = r => !!(state.recBought || {})[keyOf(r)];
// The genre a soundtrack draws its recommendations from: its own, or the genre it borrows.
export const recGenre = s => REC[s.id] ? s.id : s.like && REC[s.like] ? s.like : null;

function open(url) {
  if (NATIVE) nativeOpenExternal(url).catch(() => setStatus("Couldn't open the store."));
  else window.open(url, '_blank', 'noopener');
}

// The row of covers under the genres; null when the genre has none.
export function recRow(genre, onOpen) {
  const list = REC[genre]; if (!list || !list.length) return null;
  const row = h('div', { className: 'recrow', role: 'list' });
  for (const r of list) {
    const b = h('button', { type: 'button', className: 'rec' }, h('img', { src: r.art, alt: '', loading: 'lazy' }), h('span', { className: 'rt', textContent: r.t }), h('span', { className: 'ra', textContent: r.a }));
    b.setAttribute('role', 'listitem'); b.setAttribute('aria-label', `${r.t} by ${r.a}${bought(r) ? ', in your music' : ''}. Preview or buy.`);
    if (bought(r)) b.classList.add('owned');
    b.addEventListener('click', e => { e.stopPropagation(); if (onOpen) onOpen(); openCard(r, genre); });
    row.append(b);
  }
  return h('div', { className: 'recs' }, h('span', { className: 'lbl', textContent: 'Recommended to buy' }), row);
}

/* The card: preview, buy, and add it once bought. */
let card = null, audio = null, resumeAfter = false, tick = 0;
function stopPreview() {
  if (audio) { audio.pause(); audio.src = ''; audio = null; }
  clearInterval(tick);
  if (resumeAfter && !musicPlaying) togglePlay();
  resumeAfter = false;
}
function closeCard() { stopPreview(); if (card) { card.remove(); card = null; } }
export function openCard(r, genre) {
  closeCard();
  const play = h('button', { type: 'button', className: 'pbtn primary rplay', textContent: '▶ Preview' }), bar = h('i');
  const prog = h('span', { className: 'rprog' }, bar);
  play.addEventListener('click', () => {
    if (audio && !audio.paused) { stopPreview(); play.textContent = '▶ Preview'; bar.style.width = '0'; return; }
    if (musicPlaying) { togglePlay(); resumeAfter = true; }   // the app's music waits while the preview plays
    audio = new Audio(r.preview); audio.play().catch(() => setStatus("The preview couldn't play. Check the connection."));
    play.textContent = '❚❚ Stop';
    tick = setInterval(() => { if (!audio) return; bar.style.width = `${Math.min(100, audio.currentTime / (audio.duration || 30) * 100)}%`; }, 200);
    audio.addEventListener('ended', () => { stopPreview(); play.textContent = '▶ Preview'; bar.style.width = '0'; });
  });
  const buy = h('div', { className: 'row wrap' });
  if (r.bandcamp) { const b = h('button', { type: 'button', className: 'pbtn primary', textContent: 'Buy on Bandcamp' }); b.addEventListener('click', () => open(r.bandcamp)); buy.append(b); }
  const ap = h('button', { type: 'button', className: r.bandcamp ? 'pbtn' : 'pbtn primary', textContent: r.bandcamp ? 'Apple Music' : 'Buy in Apple Music' }); ap.addEventListener('click', () => open(r.itunes)); buy.append(ap);
  // Bought it: choose the downloaded file and it joins this genre, credited, playing like the rest.
  const file = h('input', { type: 'file', accept: 'audio/*,.mp3,.m4a,.flac,.wav,.ogg,.aac', hidden: true });
  const add = h('button', { type: 'button', className: 'pbtn', textContent: bought(r) ? 'In your music ✓ (add again)' : "I've bought it: add the file" });
  add.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    if (!file.files.length) return;
    add.disabled = true; add.textContent = 'Adding…';
    try {
      const entries = await addOwn(file.files);
      if (!entries.length) throw new Error('not audio');
      ST.addOwnTo(genre, entries.map(e => e.id));
      saveState({ recBought: Object.assign({}, state.recBought || {}, { [keyOf(r)]: true }) });
      setStatus(`Added: ${r.t} is in ${(ST.byId(genre) || {}).name || 'your music'} now.`);
      add.textContent = 'In your music ✓';
    } catch (e) { setStatus("That file couldn't be added. Choose the audio file you downloaded."); add.textContent = "I've bought it: add the file"; }
    add.disabled = false;
  });
  const close = h('button', { type: 'button', className: 'pbtn', textContent: 'Close' }); close.addEventListener('click', closeCard);
  card = h('div', { className: 'wiz reccard', role: 'dialog' },
    h('div', { className: 'box' },
      h('header', {}, h('h2', { textContent: r.t }), close),
      h('div', { className: 'body' },
        h('div', { className: 'rhead' }, h('img', { src: r.art.replace('300x300bb', '600x600bb'), alt: `${r.album} cover` }),
          h('div', {}, h('b', { textContent: r.a }), h('span', { textContent: `${r.album}${r.year ? ` · ${r.year}` : ''}` }), h('div', { className: 'row' }, play, prog))),
        h('span', { className: 'lbl', textContent: 'Buy' }), buy,
        h('span', { className: 'lbl', textContent: 'Bought it?' }), add, file,
        h('p', { className: 'muted', textContent: 'Previews are 30 seconds, from Apple. Buying happens in the store; Slow Windows earns nothing from it. Your files stay on this device.' }))));
  card.setAttribute('aria-label', `${r.t} by ${r.a}`);
  card.addEventListener('click', e => { if (e.target === card) closeCard(); });
  document.body.append(card);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && card) closeCard(); });
