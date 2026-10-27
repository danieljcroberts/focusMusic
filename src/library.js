// The music library: every track you can play here, yours and the free ones, to browse, search and pick from, and
// the way in for your own music. A search box; All, Yours and Loved; a row of genre chips; a sort. Each track a row
// with its cover, title and artist, genre and length: a tap plays it, ⋯ holds the rest (play next, love, never play,
// its source, remove). Import music takes files (or a drop on a computer), sorts them into genres by their tags and a
// quick listen, and shows them for a check before they are added; Import a folder… opens the full guide.
import { TRACKS, playTrack, playOwn, playNext, never, setNever, coverFor, canPlay, trackKey, currentKey, setLibView, openLib } from './music.js';
import * as ST from './soundtracks.js';
import { ownTracks, addOwn, removeOwn, isAudio, fmtDur, keeps } from './mine.js';
import { measure } from './measure.js';
import { state, saveState } from './state.js';
import { setStatus } from './status.js';

const el = id => document.getElementById(id);
const h = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids.filter(k => k != null)); return n; };
const clock = s => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '';
const GENRES = ST.BUILT_IN.filter(b => b.id !== 'loved');
const genreName = id => (ST.byId(id) || {}).name || 'Misc';

let tab = state.libTab || 'all', genre = 'all', sort = state.libSort || 'title', q = '', showLinks = false;
const list = el('libList');

// Every track as one shape: { k, t, a, genre, len, own, play(), ok, link }.
function rows() {
  const free = TRACKS.map(t => ({ k: trackKey(t), t: t.t, a: t.a, genre: t.genre, len: t.len, energy: t.db !== undefined ? t.db + (t.beat || 0) * 6 : null, ok: canPlay(t), link: !t.file && !t.stream, src: t.src, item: t, play: () => playTrack(t), next: () => playNext(t), never: never.has(trackKey(t)) }));
  const mine = ownTracks().map(e => ({ k: 'own:' + e.id, t: e.t, a: e.a, genre: (ST.memberOf(e.id).find(s => s.builtIn && s.id !== 'loved') || {}).id || 'misc', len: e.dur, energy: e.energy ?? null, ok: true, own: e, item: { own: true, id: e.id, t: e.t, a: e.a, art: e.art },
    play: () => playOwn(e), next: () => playNext({ own: true, id: e.id, t: e.t, a: e.a }) }));
  return [...mine, ...free];
}
function visible() {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  let rs = rows().filter(r => (tab === 'all' || (tab === 'mine' ? r.own : ST.isLoved(r.k))) && (genre === 'all' || r.genre === genre) && (showLinks || !r.link)
    && words.every(w => `${r.t} ${r.a} ${genreName(r.genre)}`.toLowerCase().includes(w)));
  const by = { title: (x, y) => x.t.localeCompare(y.t), artist: (x, y) => x.a.localeCompare(y.a) || x.t.localeCompare(y.t), len: (x, y) => (y.len || 0) - (x.len || 0), energy: (x, y) => (y.energy ?? -99) - (x.energy ?? -99) }[sort];
  rs = rs.sort(by);
  return rs;
}

// Covers are drawn when a row scrolls into view, not all at once.
const lazy = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { const im = e.target; im.src = coverFor(im._item, true) || ''; lazy.unobserve(im); } }, { root: list, rootMargin: '200px' });

let menu = null;
function closeMenu() { if (menu) { menu.remove(); menu = null; } }
function openMenu(r, btn) {
  closeMenu();
  const act = (label, fn, cls = '') => { const b = h('button', { type: 'button', textContent: label, className: cls }); b.addEventListener('click', e => { e.stopPropagation(); closeMenu(); fn(); }); return b; };
  const loved = ST.isLoved(r.k);
  menu = h('div', { className: 'tmenu libmenu', role: 'menu' },
    act('Play now', () => r.play()),
    act('Play next', () => r.next()),
    act(loved ? '♥ Loved (tap to unlove)' : '♡ Love', () => { ST.setLoved(r.k, !loved); render(); }),
    r.own ? null : act(r.never ? 'Play it again' : 'Never play', () => setNever(r.item, !r.never)),
    r.src ? act('Source and credit ↗', () => window.open(r.src, '_blank', 'noopener')) : null,
    r.own ? act('Remove from this device', async () => { await removeOwn(r.own.id); ST.prune(ownTracks().map(x => x.id)); render(); setStatus(`Removed: ${r.t}.`); }, 'danger') : null);
  btn.closest('li').append(menu);
}
document.addEventListener('pointerdown', e => { if (menu && !e.target.closest('.libmenu, .more')) closeMenu(); });

function render() {
  const rs = visible(), cur = currentKey();
  list.textContent = '';
  el('libCount').textContent = `${rs.length} track${rs.length === 1 ? '' : 's'}${rs.length ? ` · ${fmtDur(rs.reduce((a, r) => a + (r.len || 0), 0))}` : ''}`;
  if (!rs.length) {
    list.append(h('p', { className: 'empty', textContent: tab === 'mine' && !ownTracks().length ? 'None of your own music yet. Import some above: it stays on this device.' : tab === 'loved' ? 'Nothing loved yet. Tap ♡ on a track you like.' : 'No tracks match.' }));
  } else {
    const ol = h('ol', { className: 'tracks' });
    for (const r of rs) {
      const img = h('img', { alt: '', className: 'cv' }); img._item = r.item; lazy.observe(img);
      const more = h('button', { type: 'button', className: 'more', textContent: '⋯' }); more.setAttribute('aria-label', `More for ${r.t}`);
      more.addEventListener('click', e => { e.stopPropagation(); menu && menu.parentNode === more.closest('li') ? closeMenu() : openMenu(r, more); });
      const meta = [genreName(r.genre), r.own ? 'yours' : null, r.link ? 'on its page' : null].filter(Boolean).join(' · ');
      const li = h('li', { className: 'trk' }, img, h('div', { className: 'tx' }, h('b', { textContent: r.t }), h('span', { textContent: `${r.a} · ${meta}` })), h('span', { className: 'len', textContent: clock(r.len) }), more);
      li.dataset.k = r.k; li.tabIndex = 0; li.setAttribute('role', 'button'); li.setAttribute('aria-label', `Play ${r.t} by ${r.a}`);
      if (r.k === cur) li.classList.add('on');
      if (r.never) li.classList.add('never');
      if (!r.ok) li.classList.add('off');
      const go = () => { if (r.link) { window.open(r.src, '_blank', 'noopener'); return; } if (!r.ok) { setStatus('This track streams from archive.org, which can\'t be reached right now.'); return; } r.play(); };
      li.addEventListener('click', go); li.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      ol.append(li);
    }
    list.append(ol);
  }
  const links = rows().filter(r => r.link).length;
  if (links && !showLinks && tab === 'all') { const b = h('button', { type: 'button', className: 'pbtn showlinks', textContent: `Show ${links} more that play on their own pages` }); b.addEventListener('click', () => { showLinks = true; render(); }); list.append(b); }
  list.append(h('p', { className: 'fine', textContent: 'The free tracks are Creative Commons: credit the artist, keep it non-commercial for NC licences, and play ND tracks unedited. Your own music is copied into the app on this device and never uploaded.' }));
  drawChips();
}
function mark() { const cur = currentKey(); list.querySelectorAll('li.trk').forEach(li => li.classList.toggle('on', li.dataset.k === cur)); }

// The genre chips, with counts for what the tab shows.
function drawChips() {
  const box = el('libGenres'); box.textContent = '';
  const base = rows().filter(r => (tab === 'all' || (tab === 'mine' ? r.own : ST.isLoved(r.k))) && (showLinks || !r.link));
  const chip = (id, name, n) => { const b = h('button', { type: 'button', textContent: n === null ? name : `${name} ${n}` }); b.setAttribute('aria-pressed', String(genre === id)); b.addEventListener('click', () => { genre = id; render(); }); return b; };
  box.append(chip('all', 'All genres', null));
  for (const g of GENRES) { const n = base.filter(r => r.genre === g.id).length; if (n || genre === g.id) box.append(chip(g.id, g.name, n)); }
}

// The tabs, the search and the sort.
for (const b of el('libTabs').querySelectorAll('button')) b.addEventListener('click', () => { tab = b.dataset.tab; saveState({ libTab: tab }); drawTabs(); render(); });
const drawTabs = () => el('libTabs').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
drawTabs();
el('libSearch').addEventListener('input', e => { q = e.target.value; render(); });
el('libSort').value = sort; el('libSort').addEventListener('change', e => { sort = e.target.value; saveState({ libSort: sort }); render(); });

/* Importing: pick files (or drop them here), see where each will go, and add them. */
const imp = el('libImportBox');
async function importFiles(files) {
  files = [...files].filter(isAudio);
  if (!files.length) { setStatus('Those aren\'t audio files.'); return; }
  const bar = h('i'), line = h('span', { className: 'note', textContent: `Reading 1 of ${files.length}…` });
  imp.replaceChildren(h('div', { className: 'progress' }, bar), line);
  const entries = await addOwn(files, (i, of, name) => { bar.style.width = `${Math.round(i / of * 100)}%`; line.textContent = `Reading ${i} of ${of}: ${name}`; }, { measure });
  // Where each goes: a genre it already has; its own genre tag; the genre being browsed; or a guess from how lively it
  // sounds (only the clear cases are reliable, so the list below lets you change any of them).
  const picks = entries.map(e => {
    const had = (ST.memberOf(e.id).find(s => s.builtIn && s.id !== 'loved') || {}).id, sg = ST.suggest(e);
    return { e, to: had || (sg.sure ? sg.id : genre !== 'all' ? genre : sg.id) };
  });
  const ol = h('ol', { className: 'review' });
  for (const p of picks) {
    const sel = h('select', {}); sel.setAttribute('aria-label', `Genre for ${p.e.t}`);
    for (const g of GENRES) sel.append(new Option(g.name, g.id, false, g.id === p.to));
    sel.addEventListener('change', () => { p.to = sel.value; });
    ol.append(h('li', {}, h('div', { className: 'tx' }, h('b', { textContent: p.e.t }), h('span', { textContent: `${p.e.a}${p.e.dur ? ` · ${clock(p.e.dur)}` : ''}` })), sel));
  }
  const done = h('button', { type: 'button', className: 'pbtn primary', textContent: `Add ${picks.length} track${picks.length === 1 ? '' : 's'}` });
  const cancel = h('button', { type: 'button', className: 'pbtn', textContent: 'Cancel' });
  done.addEventListener('click', () => {
    for (const p of picks) ST.addOwnTo(p.to, [p.e.id]);
    setStatus(`Added ${picks.length} track${picks.length === 1 ? '' : 's'} to your music.`); resetImport(); tab = 'mine'; drawTabs(); render();
  });
  cancel.addEventListener('click', async () => { for (const p of picks) if (entries.fresh && entries.fresh.has(p.e.id)) await removeOwn(p.e.id); resetImport(); render(); });
  imp.replaceChildren(h('p', { className: 'note', textContent: `Check where each goes, then add them.${keeps ? '' : ' (This browser keeps them for this session only.)'}` }), ol, h('div', { className: 'row' }, done, cancel));
}
function resetImport() {
  const pick = h('button', { type: 'button', className: 'pbtn primary', textContent: '+ Import music' }), folder = h('button', { type: 'button', className: 'pbtn', textContent: 'Import a folder…' });
  const input = h('input', { type: 'file', multiple: true, accept: 'audio/*,.mp3,.m4a,.flac,.wav,.ogg,.aac,.opus', hidden: true });
  pick.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files.length) importFiles(input.files); });
  folder.addEventListener('click', () => { openLib(false); window.dispatchEvent(new CustomEvent('sw-wizard')); });
  imp.replaceChildren(h('div', { className: 'row' }, pick, folder, input), h('span', { className: 'note', textContent: 'Or drop files here. They stay on this device.' }));
}
resetImport();
// Dropping files onto the library imports them.
const lib = el('lib');
lib.addEventListener('dragover', e => { if ([...(e.dataTransfer.items || [])].some(i => i.kind === 'file')) { e.preventDefault(); lib.classList.add('dropping'); } });
lib.addEventListener('dragleave', e => { if (e.target === lib) lib.classList.remove('dropping'); });
lib.addEventListener('drop', e => { e.preventDefault(); lib.classList.remove('dropping'); if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files); });

setLibView({ render, mark });
