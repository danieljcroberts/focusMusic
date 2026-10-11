// The soundtrack chip and menu in the player, the "Your music" wizard, and the soundtrack editor.
// The wizard asks one thing per screen: how the music is organised, where each folder goes, whether to keep the free
// tracks, then copies, sorts what it couldn't place, and shows a summary. Everything stays on this device.
import * as ST from './soundtracks.js';
import { addOwn, ownTracks, isAudio } from './mine.js';
import { measure } from './measure.js';
import { musicPlaying, nextTrack, previewOwn, togglePlay } from './music.js';
import { state, saveState } from './state.js';
import { setStatus } from './status.js';
import { registerMenu, closeMenus } from './menus.js';

const el = id => document.getElementById(id);
const h = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids.filter(k => k != null)); return n; };
const btn = (text, onClick, cls = 'pbtn') => { const b = h('button', { type: 'button', className: cls, textContent: text }); b.addEventListener('click', onClick); return b; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const counts = s => {
  const own = s.own.filter(id => ownTracks().some(e => e.id === id)).length, free = ST.freeTracks(s).length;
  return { own, free, text: [own && `${own} of yours`, free && `${free} free`, s.live && 'random finds'].filter(Boolean).join(' + ') || 'empty' };
};

/* The chip and its menu */
const stBtn = el('stBtn'), stMenu = el('stMenu');
function drawChip() { const s = ST.current(); el('stName').textContent = s.name; el('stDot').style.background = s.color; stBtn.title = `Soundtrack: ${s.name} (${counts(s).text})`; }
function choose(id) {
  ST.setCurrent(id); closeMenus();
  const s = ST.current();
  setStatus(`Soundtrack: ${s.name}.`);
  if (musicPlaying) nextTrack();          // switch now, with the usual crossfade
}
function fillMenu() {
  stMenu.textContent = '';
  stMenu.append(h('span', { className: 'lbl', textContent: 'Soundtrack' }));
  for (const s of ST.soundtracks()) {
    const c = counts(s);
    const b = h('button', { type: 'button', className: 'opt' }, h('i', { style: `background:${s.color}` }), s.name, h('small', { textContent: c.own || c.free || s.live ? (c.own ? `${c.own} yours` : 'free') : 'empty' }));
    b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(s.id === ST.current().id));
    b.addEventListener('click', () => choose(s.id));
    stMenu.append(b);
  }
  stMenu.append(h('hr'), btn('+ New soundtrack', () => { closeMenus(); openEditor({ create: true }); }, ''), btn('Edit soundtracks', () => { closeMenus(); openEditor(); }, ''), btn('Add your music…', () => { closeMenus(); openWizard(); }, ''));
}
registerMenu(stBtn, stMenu, fillMenu);
ST.onChange(drawChip);
drawChip();

/* The overlay shared by the wizard and the editor */
const wiz = el('wiz'), body = el('wizBody');
let onClose = null;
function show(title, ...kids) { el('wizTitle').textContent = title; body.textContent = ''; body.append(...kids); wiz.hidden = false; body.scrollTop = 0; }
function hide() { wiz.hidden = true; const f = onClose; onClose = null; if (f) f(); }
el('wizClose').addEventListener('click', hide);
wiz.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); hide(); } });
export const wizardOpen = () => !wiz.hidden;

/* The wizard */
let W = null;   // { mode: 'folders' | 'loose' | 'target', target, groups: [{ name, files, to }], keep, made: Map }
const filePicker = folder => {
  const inp = h('input', { type: 'file', multiple: true, hidden: true, accept: 'audio/*,.mp3,.m4a,.aac,.ogg,.opus,.flac,.wav' });
  if (folder) { inp.webkitdirectory = true; inp.setAttribute('webkitdirectory', ''); }
  return inp;
};
function pick(folder, then) {
  const inp = filePicker(folder); body.append(inp);
  inp.addEventListener('change', () => { const files = [...inp.files].filter(isAudio); inp.remove(); if (files.length) then(files); else setStatus('No music files found there.'); });
  inp.click();
}
const MB = files => files.reduce((a, f) => a + f.size, 0) / 1e6;
const sizeNote = files => { const mb = MB(files); return mb > 1500 ? `${(mb / 1000).toFixed(1)} GB will be copied onto this device. Make sure there is room.` : `${mb.toFixed(0)} MB will be copied onto this device.`; };

export function openWizard(target = null) {
  W = { mode: target ? 'target' : null, target, groups: [], keep: 'mix', made: new Map() };
  if (target) return stepPick();
  show('Your music',
    h('p', { className: 'step', textContent: 'Step 1 of 4' }),
    h('p', { textContent: 'Add music from this device to your soundtracks: Deep focus, Easy work, Energise and Wind down, or new ones of your own.' }),
    h('p', { className: 'muted', textContent: 'Your files are copied into the app on this device, so they play offline. Nothing is uploaded, and they use space on your phone like any other copy.' }),
    h('div', { className: 'actions' }, btn('Not now', hide), btn('Continue', stepHow, 'pbtn primary')));
}
function stepHow() {
  const choice = (title, text, folders) => {
    const b = h('button', { type: 'button', className: 'pbtn choice' }, h('b', { textContent: title }), h('span', { textContent: text }));
    b.addEventListener('click', () => { W.mode = folders ? 'folders' : 'loose'; stepPick(); });
    return b;
  };
  show('Your music',
    h('p', { className: 'step', textContent: 'Step 2 of 4' }),
    h('p', { textContent: 'How is your music organised?' }),
    choice('I have a folder for each type', 'For example Music/Focus, Music/Classical, Music/Running. You pick the folder that holds them, and each one becomes or joins a soundtrack.', true),
    choice('It is all in one place', 'You pick a folder or some files. The app listens to each track, suggests a soundtrack, and asks you about the ones it is unsure of.', false),
    h('div', { className: 'actions' }, btn('Back', openWizard)));
}
function stepPick() {
  const intro = W.mode === 'folders' ? 'Choose the folder that holds your type folders (or one type folder on its own).'
    : W.mode === 'target' ? `Choose music to add to "${ST.byId(W.target).name}".` : 'Choose a folder of music, or some files.';
  const got = files => {
    if (W.mode === 'folders') {
      // Group by the first folder below the one chosen; files right in it form a group named after it.
      const groups = new Map();
      for (const f of files) {
        const parts = (f.webkitRelativePath || f.name).split('/');
        const name = parts.length >= 3 ? parts[1] : parts.length === 2 ? parts[0] : 'Chosen files';
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(f);
      }
      W.groups = [...groups].map(([name, fs]) => ({ name, files: fs, to: ST.matchName(name) || 'new' }));
      stepMap();
    } else {
      W.groups = [{ name: 'Chosen', files, to: W.mode === 'target' ? W.target : null }];
      W.mode === 'target' ? stepCopy() : stepKeep();
    }
  };
  show('Your music',
    h('p', { className: 'step', textContent: W.mode === 'target' ? 'Add music' : 'Step 2 of 4' }),
    h('p', { textContent: intro }),
    h('div', { className: 'actions' },
      btn('Back', W.mode === 'target' ? hide : stepHow),
      h('span', {}, W.mode === 'folders' ? null : btn('Choose files', () => pick(false, got)), ' ', btn('Choose a folder', () => pick(true, got), 'pbtn primary'))));
}
function stepMap() {
  const all = W.groups.flatMap(g => g.files);
  const rows = W.groups.map(g => {
    const sel = h('select', { 'aria-label': `Soundtrack for ${g.name}` });
    for (const s of ST.soundtracks()) sel.append(h('option', { value: s.id, textContent: s.name }));
    sel.append(h('option', { value: 'new', textContent: `New soundtrack: ${g.name}` }), h('option', { value: 'skip', textContent: 'Skip this folder' }));
    sel.value = g.to; sel.addEventListener('change', () => { g.to = sel.value; });
    return h('tr', {}, h('td', {}, g.name, h('small', { textContent: plural(g.files.length, 'track') })), h('td', {}, sel));
  });
  show('Your music',
    h('p', { className: 'step', textContent: 'Step 3 of 4' }),
    h('p', { textContent: `Found ${plural(W.groups.length, 'folder')} with ${plural(all.length, 'track')}. Check where each folder goes; change any that are wrong.` }),
    h('table', {}, ...rows),
    h('p', { className: 'muted', textContent: sizeNote(all) }),
    h('div', { className: 'actions' }, btn('Back', stepPick), btn('Continue', stepKeep, 'pbtn primary')));
}
function stepKeep() {
  const opt = (value, title, text) => {
    const b = h('button', { type: 'button', className: 'pbtn choice' }, h('b', { textContent: title }), h('span', { textContent: text }));
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(W.keep === value));
    b.addEventListener('click', () => { W.keep = value; stepKeep(); });
    return b;
  };
  const all = W.groups.flatMap(g => g.files);
  show('Your music',
    h('p', { className: 'step', textContent: W.mode === 'folders' ? 'Step 4 of 4' : 'Step 3 of 4' }),
    h('p', { textContent: 'Keep the free tracks that come with the app in these soundtracks?' }),
    opt('mix', 'Mix them in (recommended)', 'Your music plays most of the time, with the free tracks in between. Good while your collection is small.'),
    opt('only', 'Only my music', 'The soundtracks you add to play only your own tracks. You can change this per soundtrack later.'),
    W.mode === 'loose' ? h('p', { className: 'muted', textContent: sizeNote(all) }) : null,
    h('div', { className: 'actions' }, btn('Back', W.mode === 'folders' ? stepMap : stepPick), btn('Add my music', stepCopy, 'pbtn primary')));
}
async function stepCopy() {
  const bar = h('span'), line = h('p', { className: 'muted', textContent: 'Starting…' });
  show('Adding your music', h('p', { textContent: 'Copying onto this device. Keep the app open until it finishes.' }), h('div', { className: 'bar' }, bar), line);
  onClose = null;
  const total = W.groups.reduce((a, g) => a + (g.to === 'skip' ? 0 : g.files.length), 0);
  let done = 0; const touched = new Set(); W.unsure = []; W.added = 0;
  for (const g of W.groups) {
    if (g.to === 'skip') continue;
    let to = g.to;
    if (to === 'new') { to = W.made.get(g.name) || ST.create(g.name, ST.matchName(g.name)); W.made.set(g.name, to); }
    const entries = await addOwn(g.files, (i, of, name) => { bar.style.width = `${Math.round((done + i) / total * 100)}%`; line.textContent = `${done + i} of ${total}: ${name}`; },
      { measure: W.mode === 'loose' ? measure : null });
    done += g.files.length; W.added += entries.added || 0;
    if (to) { ST.addOwnTo(to, entries.map(e => e.id)); touched.add(to); }
    else for (const e of entries) {                       // all in one place: sort by suggestion, keep the unsure ones to ask about
      if (ST.memberOf(e.id).length) { ST.memberOf(e.id).forEach(s => touched.add(s.id)); continue; }
      const sg = ST.suggest(e);
      if (sg.sure) { ST.addOwnTo(sg.id, [e.id]); touched.add(sg.id); } else W.unsure.push({ e, guess: sg.id });
    }
  }
  W.touched = touched;
  if (W.mode !== 'target') for (const id of touched) { const s = ST.byId(id); if (s && (s.builtIn || s.like)) ST.update(id, { free: W.keep === 'mix' }); }
  window.dispatchEvent(new CustomEvent('sw-own-changed'));
  if (W.unsure.length) stepSort(0); else stepDone();
}
function stepSort(i) {
  if (i >= W.unsure.length) return stepDone();
  const { e, guess } = W.unsure[i];
  const put = id => { ST.addOwnTo(id, [e.id]); W.touched.add(id); stepSort(i + 1); };
  const choices = h('div', { className: 'stbtns' }, ...ST.soundtracks().map(s => {
    const b = btn(s.name, () => put(s.id), s.id === guess ? 'pbtn primary' : 'pbtn');
    return b;
  }));
  show('Where does this go?',
    h('p', { className: 'step', textContent: `${i + 1} of ${W.unsure.length} the app was unsure about` }),
    h('p', {}, h('b', { textContent: e.t }), ' — ', e.a),
    h('div', { className: 'actions' }, btn('▶ Listen', () => previewOwn(e.id)), h('span', { className: 'muted', textContent: guess ? `Best guess: ${ST.byId(guess).name}` : '' })),
    choices,
    h('div', { className: 'actions' }, btn('Skip this one', () => stepSort(i + 1)), btn(`Put the rest in their best guess`, () => { for (const u of W.unsure.slice(i)) { ST.addOwnTo(u.guess, [u.e.id]); W.touched.add(u.guess); } stepDone(); })));
}
function stepDone() {
  const rows = [...W.touched].map(id => ST.byId(id)).filter(Boolean).map(s => h('tr', {}, h('td', {}, h('i', { style: `display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px;background:${s.color}` }), s.name), h('td', { className: 'muted', textContent: counts(s).text })));
  const first = [...W.touched][0];
  show('All set',
    h('p', { textContent: W.added ? `Added ${plural(W.added, 'track')}.` : 'Everything was already here; the soundtracks are updated.' }),
    rows.length ? h('table', {}, ...rows) : null,
    h('p', { className: 'muted', textContent: 'Switch soundtracks from the chip next to Play. To add more later, use "Add your music…" in that menu; files already here are skipped.' }),
    h('div', { className: 'actions' }, btn('Edit soundtracks', () => openEditor()), btn('Start listening', () => { if (first) ST.setCurrent(first); hide(); if (!musicPlaying) togglePlay(); else nextTrack(); }, 'pbtn primary')));
}

/* The soundtrack editor */
export function openEditor(opts = {}) {
  const cards = ST.soundtracks().map(s => {
    const c = counts(s);
    const name = h('input', { type: 'text', value: s.name, 'aria-label': 'Soundtrack name', maxLength: 32 });
    name.addEventListener('change', () => ST.update(s.id, { name: name.value.trim() || s.name }));
    const tog = (label, key, title) => { const b = btn(label, () => { ST.update(s.id, { [key]: !s[key] }); openEditor(); }, 'pbtn tog'); b.setAttribute('aria-pressed', String(!!s[key])); b.title = title; return b; };
    const opts2 = h('div', { className: 'opts' });
    if (s.builtIn) opts2.append(tog('Free tracks', 'free', 'Mix in the free tracks that come with the app'));
    else {
      const like = h('select', { 'aria-label': 'Free tracks to mix in' });
      like.append(h('option', { value: '', textContent: 'No free tracks' }), ...['focus', 'work', 'energise', 'wind'].map(k => h('option', { value: k, textContent: `Free tracks like ${ST.byId(k).name}` })));
      like.value = s.like || '';
      like.addEventListener('change', () => { ST.update(s.id, { like: like.value || null, free: !!like.value }); openEditor(); });
      opts2.append(like);
    }
    opts2.append(tog('Random finds', 'live', 'Add random Creative Commons finds from the Internet Archive (needs a connection)'));
    const mine = ownTracks().filter(e => s.own.includes(e.id));
    const tracks = h('div', { className: 'tracks' }, ...mine.map(e => h('div', {}, h('span', { textContent: `${e.t} — ${e.a}` }), btn('remove', () => { ST.removeOwnFrom(s.id, e.id); openEditor(); }, ''))));
    let armed = false;
    const del = s.builtIn ? null : btn('Delete', ev => { if (!armed) { armed = true; ev.target.textContent = 'Tap again to delete'; return; } ST.remove(s.id); openEditor(); });
    return h('div', { className: 'stcard' },
      h('div', { className: 'top' }, h('i', { style: `background:${s.color}` }), name, h('small', { className: 'muted', textContent: c.text })),
      opts2,
      mine.length ? tracks : h('p', { className: 'muted', textContent: 'None of your own tracks yet.' }),
      h('div', { className: 'actions' }, h('span', {}, btn('Play this', () => { hide(); choose(s.id); if (!musicPlaying) togglePlay(); }), ' ', btn('Add music…', () => openWizard(s.id))), del));
  });
  const newName = h('input', { type: 'text', placeholder: 'Name, e.g. Classical', maxLength: 32, 'aria-label': 'New soundtrack name' });
  const newLike = h('select', { 'aria-label': 'Free tracks to mix in' });
  newLike.append(h('option', { value: '', textContent: 'No free tracks' }), ...['focus', 'work', 'energise', 'wind'].map(k => h('option', { value: k, textContent: `Free tracks like ${ST.byId(k).name}` })));
  const create = h('div', { className: 'stcard' }, h('b', { textContent: 'New soundtrack' }), newName, newLike,
    h('div', { className: 'actions' }, h('span'), btn('Create and add music', () => { if (!newName.value.trim()) { newName.focus(); return; } const id = ST.create(newName.value, newLike.value || null); openWizard(id); }, 'pbtn primary')));
  show('Soundtracks', ...(opts.create ? [create, ...cards] : [...cards, create]));
  if (opts.create) newName.focus();
}

/* Settings entries, the timer, and tracks added before soundtracks existed */
el('stEditBtn').addEventListener('click', () => { closeMenus(); openEditor(); });
el('stWizBtn').addEventListener('click', () => { closeMenus(); openWizard(); });
window.addEventListener('sw-wizard', () => openWizard());
const timerBtn = el('stTimerBtn');
const drawTimerBtn = () => timerBtn.setAttribute('aria-pressed', String(!!state.stTimer));
timerBtn.addEventListener('click', () => { saveState({ stTimer: !state.stTimer }); drawTimerBtn(); });
drawTimerBtn();
window.addEventListener('sw-timer', e => {
  if (!state.stTimer) return;
  const id = e.detail === 'focus' ? 'focus' : 'energise';
  if (ST.current().id !== id) { ST.setCurrent(id); if (musicPlaying) nextTrack(); }
});
window.addEventListener('sw-own-loaded', () => {
  if (state.stMigrated) return;
  const loose = ownTracks().filter(e => !ST.memberOf(e.id).length);
  for (const e of loose) ST.addOwnTo(ST.suggest(e).id, [e.id]);
  saveState({ stMigrated: true });
  if (loose.length) setStatus(`Your ${plural(loose.length, 'track')} were sorted into soundtracks. Check them under Edit soundtracks in the soundtrack menu.`);
});
