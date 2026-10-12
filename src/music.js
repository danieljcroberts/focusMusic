// Music: CC tracks from the Music For Programming mixes (bundled or streamed from archive.org)
// plus a live source that picks random CC-licensed netlabel releases from the Internet Archive.
import TRACKS from './data/tracks.json';
import { M } from './assets.js';
import { state, saveState } from './state.js';
import { setStatus } from './status.js';
import { loadOwn, ownTracks, ownURL, removeOwn, clearOwn, ownBytes, keeps } from './mine.js';
import * as ST from './soundtracks.js';

const el = id => document.getElementById(id);
export { TRACKS };

// Three players. Two are routed through an analyser (bundled files and archive.org allow cross-origin audio) so tracks can
// crossfade and scenes can react to the music; the third is a plain player for sources that block cross-origin audio.
const mkPlayer = cors => { const a = new Audio(); a.preload = 'none'; if (cors) a.crossOrigin = 'anonymous'; a._g = 1; return a; };
const players = [mkPlayer(true), mkPlayer(true), mkPlayer(false)];
let audio = players[0], master = .8;
const corsOk = url => url.startsWith(M) || url.startsWith('blob:') || /^https:\/\/archive\.org\//.test(url);
let actx = null, analyser = null, fdata = null;
export function audioCtx() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return actx; }
function wireAnalyser() {
  if (analyser || !audioCtx()) return;
  try {
    analyser = actx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = .6;
    analyser.minDecibels = -90; analyser.maxDecibels = -12;   // headroom: loud music no longer pins every low bin at the top
    fdata = new Uint8Array(analyser.frequencyBinCount);
    for (const p of players.slice(0, 2)) actx.createMediaElementSource(p).connect(analyser);
    analyser.connect(actx.destination);
  } catch (e) { analyser = null; }
}

// musicLevel (0–1) follows the loudness of what is playing; scenes use it for rain intensity and mist.
// bands splits it into bass, mid and treble for the scenes that move with the music.
export let musicLevel = 0, musicPlaying = false;
export const bands = { bass: 0, mid: 0, treble: 0 };
const SILENCE = new Uint8Array(256);
// The analyser's 256 bins, or silence when nothing is on the graph.
// The waveform: 512 samples of the sound itself (128 is silence), for oscilloscopes and visualisers.
let wdata = null;
const FLAT = new Uint8Array(512).fill(128);
export const waveform = () => {
  if (!(analyser && musicPlaying && players.slice(0, 2).some(p => !p.paused && p.readyState > 2))) return FLAT;
  if (!wdata) wdata = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(wdata);
  return wdata;
};
export const spectrum = () => (analyser && musicPlaying && players.slice(0, 2).some(p => !p.paused && p.readyState > 2)) ? fdata : SILENCE;
// Automatic gain per band: each reading is placed between that band's recent floor and its recent peak, so the bands
// follow the beat of quiet and loud tracks alike instead of sitting at the top (or the bottom) for a whole song.
const agcState = { bass: { lo: .3, hi: .6 }, mid: { lo: .2, hi: .5 }, treble: { lo: .05, hi: .25 } };
function agc(k, v, dt) {
  const s = agcState[k];
  s.hi = v > s.hi ? s.hi + (v - s.hi) * Math.min(1, dt * 8) : s.hi - (s.hi - v) * Math.min(1, dt * .25);   // peaks rise fast, fall over a few seconds
  s.lo = v < s.lo ? s.lo + (v - s.lo) * Math.min(1, dt * 4) : s.lo + (v - s.lo) * Math.min(1, dt * .15);   // the floor follows the quiet parts
  const range = Math.max(.08, s.hi - s.lo);
  return Math.max(0, Math.min(1, (v - s.lo) / range));
}
function average(a, from, to) { let s = 0; for (let i = from; i < to; i++) s += a[i]; return s / (to - from) / 255; }
export function sampleMusic(dt) {
  musicPlaying = players.some(p => !p.paused && !p.ended && p.readyState > 2);
  let target = 0;
  if (musicPlaying) {
    const onGraph = players.slice(0, 2).some(p => !p.paused && p.readyState > 2);
    if (analyser && onGraph) {
      analyser.getByteFrequencyData(fdata);
      let lo = 0, all = 0; const nLo = 12;
      for (let i = 0; i < fdata.length; i++) { all += fdata[i]; if (i < nLo) lo += fdata[i]; }
      target = Math.min(1, Math.max(0, ((lo / nLo / 255) * .6 + (all / fdata.length / 255) * 1.2 - .06) * 1.6));
    } else target = .45; // a plain player gives no data, so sit in the middle
  }
  musicLevel += (target - musicLevel) * Math.min(1, dt * (target > musicLevel ? 6 : 1.2));
  const d = spectrum(), now = performance.now() / 1000;
  const want = d !== SILENCE
    ? { bass: agc('bass', average(d, 1, 6), dt), mid: agc('mid', average(d, 6, 48), dt), treble: agc('treble', average(d, 48, 160), dt) }
    : { bass: musicLevel * (.5 + .3 * Math.sin(now * 2.1)), mid: musicLevel * (.45 + .25 * Math.sin(now * 3.3)), treble: musicLevel * (.3 + .2 * Math.sin(now * 5.1)) }; // a plain player: a gentle pulse instead
  for (const k of ['bass', 'mid', 'treble']) bands[k] += (want[k] - bands[k]) * Math.min(1, dt * (want[k] > bands[k] ? 14 : 3.5));
}

const FADE = 2.5;
let fades = [];
// Breaks duck the music to a third; the change ramps over a second and a half.
let duck = 1, duckTarget = 1;
function setGain(p, g) { p._g = g; p.volume = Math.max(0, Math.min(1, g * master * duck)); }
export function setDuck(on) { duckTarget = on ? .35 : 1; }
function rampTo(p, to, dur, stopAfter) { fades = fades.filter(x => x.p !== p); fades.push({ p, from: p._g, to, t0: performance.now(), dur, stopAfter }); }
export function tickFades(now) {
  if (duck !== duckTarget) { duck += (duckTarget - duck) * .06; if (Math.abs(duck - duckTarget) < .005) duck = duckTarget; players.forEach(p => setGain(p, p._g)); }
  fades = fades.filter(x => {
    const k = Math.min(1, (now - x.t0) / (x.dur * 1000));
    setGain(x.p, x.from + (x.to - x.from) * k);
    if (k >= 1 && x.stopAfter) x.p.pause();
    return k < 1;
  });
}

// "Scene picks music": when the scene changes, crossfade to a track that suits it. Each scene names a preferred track and a
// tone (calm, warm, cold, dark, bright, pulse); tracks carry a mood. The preferred track plays unless it was heard recently,
// then another of the same mood takes its place, so a scene does not sound the same on every visit.
export let follow = !!state.follow;   // off unless the viewer turned it on
export function setFollow(v) { follow = v; saveState({ follow: v }); }
let sceneKey = null, sceneTone = null;
const recent = [];
export function setScene(k, tone) { sceneKey = k; sceneTone = tone || null; }
export const sceneTrack = () => byKey[sceneKey];
export function pickFor(key, tone) {
  const pref = byKey[key];
  if (pref && allowed(pref) && !recent.includes(key)) return pref;
  const pool = TRACKS.filter(t => allowed(t) && t.mood === tone && !recent.includes(t.a + '|' + t.t));
  if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  return pref && allowed(pref) ? pref : null;
}
export function onSceneChange() {
  // Only while music is playing: a scene change never starts music on its own, and a deliberate pause stays paused.
  if (!follow || source !== 'mix' || !hasSrc || audio.paused) return;
  const t = pickFor(sceneKey, sceneTone); if (t && t !== curTrack) playTrack(t);
}
export const trackSlug = t => (t.a + ' ' + t.t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
export const currentTrack = () => curTrack;

const ui = { play: el('play'), next: el('next'), title: el('npTitle'), meta: el('npMeta'),  vol: el('vol'), lib: el('lib'), list: el('libList'), seek: el('seek') };
let source = 'mix', curTrack = null, hasSrc = false, iaOnline = null, liveTotal = 0, loadingLive = false, errors = 0;
const key = t => t.a + '|' + t.t;
const byKey = Object.fromEntries(TRACKS.map(t => [key(t), t]));
const playable = t => !!(t.file || (t.stream && iaOnline));
export const canPlay = playable;
const eps = t => t.ep && t.ep.length ? 'MFP ' + t.ep.map(e => '#' + e).join(', ') : '';
const BLOCKED = "archive.org can't be reached from here, so streamed tracks and the live source are off. They work when the page runs with a connection outside the artifact sandbox.";
function link(href, text) { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text; return a; }
function setMeta(parts, href, label) {
  ui.meta.textContent = parts.filter(Boolean).join(' · ');
  if (href) ui.meta.append(' · ', link(href, label));
}
// What plays is the current soundtrack: its free tracks (when on), the viewer's own tracks sorted into it, and random
// finds from the Internet Archive when it asks for them. See soundtracks.js.
const allowed = t => playable(t) && ST.freeAllows(t);

// Lock screen and hardware keys show the track and control playback.
const ms = 'mediaSession' in navigator ? navigator.mediaSession : null;
let artwork = () => null;   // main.js supplies the current scene's thumbnail
export function setArtworkSource(fn) { artwork = fn; }
// The focus timer's state, shown on the lock screen in place of the album line while a block runs.
let lockLine = '';
export function setLockLine(text) { if (text === lockLine) return; lockLine = text; announce(); }
export function announce(t = curTrack) {
  if (!ms || !t) return;
  try {
    const art = artwork();
    ms.metadata = new MediaMetadata({ title: t.t, artist: t.a, album: lockLine || (t.live ? 'Internet Archive · ' + t.lic : 'Music For Programming mixes · ' + t.lic), artwork: art ? [{ src: art, sizes: '160x90', type: 'image/jpeg' }] : [] });
  } catch (e) {}
}
if (ms) {
  for (const [action, fn] of [['play', () => togglePlay()], ['pause', () => togglePlay()], ['nexttrack', () => nextTrack()], ['previoustrack', () => prevTrack()]]) {
    try { ms.setActionHandler(action, fn); } catch (e) {}
  }
}

// One small request tells us whether outside APIs and audio are reachable.
export async function probe() {
  try {
    const r = await fetch('https://archive.org/advancedsearch.php?q=identifier%3Araam004&fl%5B%5D=identifier&rows=1&output=json', { cache: 'no-store' });
    iaOnline = r.ok;
  } catch (e) { iaOnline = false; }
  renderLib();
}

function start(url) {
  hasSrc = true; queued = false;
  const cors = corsOk(url), prev = audio;
  const next = cors ? (players[0] === prev ? players[1] : players[0]) : players[2];
  if (cors) wireAnalyser();
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  if (next === prev) { setGain(prev, 1); prev.src = url; prev.play().catch(() => {}); return; }
  if (!prev.paused) rampTo(prev, 0, FADE, true); else prev.pause();
  audio = next; setGain(next, 0); next.src = url; next.play().catch(() => {});
  rampTo(next, 1, FADE, false);
}
export function playTrack(t) {
  if (!t) return;
  if (!playable(t)) {
    setStatus(t.stream ? (iaOnline === null ? 'Checking the connection to archive.org. Try again in a moment.' : BLOCKED) : 'This track is only on its source page. Open the link to listen.');
    return;
  }
  source = 'mix'; setStatus(''); curTrack = t;
  remember({ kind: 'mix', t });
  recent.push(key(t)); if (recent.length > 4) recent.shift();
  ui.title.textContent = `${t.t} — ${t.a}`;
  setMeta([t.lic, eps(t), t.file ? 'bundled' : 'streaming'], t.src, 'Source ↗');
  announce(t);
  start(t.file ? M + t.file : t.stream);
  markLib();
}

const LIVE_Q = 'collection:netlabels AND (subject:ambient OR subject:drone OR subject:downtempo OR subject:idm) AND licenseurl:*creativecommons* AND mediatype:audio';
const iaSearch = p => 'https://archive.org/advancedsearch.php?' + new URLSearchParams({ q: LIVE_Q, output: 'json', ...p }) + '&fl%5B%5D=identifier';
const secs = L => !L ? 0 : String(L).includes(':') ? String(L).split(':').reduce((a, v) => a * 60 + Number(v), 0) : Number(L);
const first = v => [].concat(v ?? [])[0];
function licLabel(u) {
  const m = (u || '').match(/licenses\/([a-z-]+)\/([\d.]+)/i);
  if (m) return 'CC ' + m[1].toUpperCase() + ' ' + m[2];
  if (/publicdomain\/zero/.test(u)) return 'CC0';
  if (/publicdomain\/mark/.test(u)) return 'Public Domain Mark';
  return 'Creative Commons';
}
// Picks a random CC-licensed netlabel release, then an original MP3 of 185 kbps or better, 1.5 to 30 minutes long.
async function nextLive() {
  if (loadingLive) return;
  if (iaOnline === false) { source = 'mix'; setStatus(BLOCKED); return; }
  loadingLive = true; setStatus('Finding a Creative Commons track on the Internet Archive…');
  try {
    if (!liveTotal) liveTotal = (await (await fetch(iaSearch({ rows: 0 }))).json()).response.numFound;
    for (let attempt = 0; attempt < 8; attempt++) {
      const page = 1 + Math.floor(Math.random() * Math.min(liveTotal, 10000));
      const d = await (await fetch(iaSearch({ rows: 1, page }))).json();
      const id = d.response.docs[0] && d.response.docs[0].identifier; if (!id) continue;
      const m = await (await fetch('https://archive.org/metadata/' + encodeURIComponent(id))).json();
      const lic = first(m.metadata && m.metadata.licenseurl) || '';
      if (!/creativecommons/.test(lic)) continue;
      const files = (m.files || [])
        .filter(f => f.source === 'original' && /\.mp3$/i.test(f.name))
        .map(f => { const L = secs(f.length); return Object.assign({}, f, { L, kb: L ? f.size * 8 / L / 1000 : 0 }); })
        .filter(f => f.L >= 90 && f.L <= 1800 && f.kb >= 185);
      if (!files.length) continue;
      const f = files[Math.floor(Math.random() * files.length)];
      const artist = first(f.creator || f.artist || m.metadata.creator) || 'Unknown artist';
      const title = f.title || f.name.split('/').pop().replace(/\.mp3$/i, '').replace(/_+/g, ' ');
      curTrack = { live: true, a: artist, t: title, lic: licLabel(lic), src: 'https://archive.org/details/' + id };
      ui.title.textContent = `${title} — ${artist}`;
      setMeta([curTrack.lic, first(m.metadata.title), Math.round(f.kb) + ' kbps'], curTrack.src, 'archive.org ↗');
      announce(curTrack);
      const url = 'https://archive.org/download/' + encodeURIComponent(id) + '/' + f.name.split('/').map(encodeURIComponent).join('/');
      source = 'live'; remember({ kind: 'live', t: curTrack, url, meta: ui.meta.textContent });
      start(url);
      setStatus(''); markLib();
      return;
    }
    setStatus("Couldn't find a suitable track just now. Press Next to try again.");
  } catch (e) {
    iaOnline = false; source = 'mix'; setStatus(BLOCKED); renderLib();
  } finally { loadingLive = false; }
}

// Your music: shuffled, each track once before any repeats.
let ownBlob = null;
async function playOwn(e) {
  source = 'own'; setStatus('');
  curTrack = { own: true, id: e.id, a: e.a, t: e.t, lic: 'Your music' };
  remember({ kind: 'own', e });
  recent.push('own:' + e.id); if (recent.length > 4) recent.shift();
  ui.title.textContent = `${e.t} — ${e.a}`;
  setMeta(['your music', (e.size / 1e6).toFixed(1) + ' MB']);
  announce(curTrack);
  try {
    const url = await ownURL(e), old = ownBlob; ownBlob = url;
    start(url);
    if (old) setTimeout(() => URL.revokeObjectURL(old), 4000);   // after the crossfade
  } catch (err) { setStatus("That file couldn't be opened. It may have been removed; add it again from the Library."); }
  markLib();
}
// The next track: first a source, each one that is on getting an equal share however many tracks it holds (the live archive
// half a share, so it adds variety without taking over), then a track from it that wasn't one of the last few.
function pickNext(relaxed = false) {
  const isCur = k => curTrack && (curTrack.own ? 'own:' + curTrack.id : key(curTrack)) === k;
  const ok = k => !isCur(k) && (relaxed || !recent.includes(k));
  const pools = [];
  const st = ST.current(), mine = new Set(st.own);
  const free = TRACKS.filter(t => allowed(t) && ok(key(t)));
  const own = ownTracks().filter(e => mine.has(e.id) && ok('own:' + e.id));
  // Your music gets the larger share once there is a fair amount of it; the free tracks fill in around it.
  if (own.length) pools.push([own.length >= 8 ? 2 : 1, () => playOwn(own[Math.floor(Math.random() * own.length)])]);
  if (free.length) pools.push([1, () => playTrack(free[Math.floor(Math.random() * free.length)])]);
  if (st.live && iaOnline !== false) pools.push([.5, () => nextLive()]);
  if (!pools.length) {
    if (!relaxed) return pickNext(true);                       // everything was played recently: allow it again
    if (curTrack && !curTrack.live) { if (curTrack.own) { const e = ownTracks().find(x => x.id === curTrack.id); if (e) return playOwn(e); } else if (allowed(curTrack)) return playTrack(curTrack); }
    setStatus(`"${st.name}" has nothing to play yet. Add music to it, or turn on its free tracks, from the soundtrack menu.`);
    return;
  }
  let r = Math.random() * pools.reduce((a, p) => a + p[0], 0);
  for (const [w, play] of pools) { if ((r -= w) < 0) return play(); }
  pools[pools.length - 1][1]();
}
// History: the last 30 tracks that started, so Previous can step back and Next can step forward again before picking anew.
const hist = [];
let histIdx = -1, replaying = false;
function remember(entry) {
  if (replaying) return;
  hist.splice(histIdx + 1); hist.push(entry);
  if (hist.length > 30) hist.shift();
  histIdx = hist.length - 1;
}
function replay(en) {
  replaying = true;
  try {
    if (en.kind === 'mix') playTrack(en.t);
    else if (en.kind === 'own') { const e = ownTracks().find(x => x.id === en.e.id); if (e) playOwn(e); else nextTrack(); }
    else { source = 'live'; curTrack = en.t; ui.title.textContent = `${en.t.t} — ${en.t.a}`; ui.meta.textContent = en.meta || en.t.lic; announce(curTrack); start(en.url); markLib(); }
  } finally { replaying = false; }
}
// For the soundtrack screens: play one of the viewer's tracks to hear it while sorting.
export async function previewOwn(id) { const e = ownTracks().find(x => x.id === id); if (e) await playOwn(e); }
export function nextTrack() {
  if (histIdx < hist.length - 1) { histIdx++; replay(hist[histIdx]); return; }
  pickNext();
}
// Previous: more than a few seconds into a track it starts the track again (as most players do); otherwise the one before.
export function prevTrack() {
  if (hasSrc && audio.currentTime > 4) { audio.currentTime = 0; if (audio.paused) audio.play().catch(() => {}); return 'restart'; }
  if (histIdx > 0) { histIdx--; replay(hist[histIdx]); return 'back'; }
  if (hasSrc) { audio.currentTime = 0; return 'restart'; }
  return null;
}
// Volume from gestures and keys: moves the slider, so the level is shown and remembered the same way.
export const volume = () => master;
export function setVolume(v) { ui.vol.value = Math.max(0, Math.min(1, v)); ui.vol.dispatchEvent(new Event('input')); }
// Gapless: eight seconds before a mix track ends, the next one starts and the two crossfade.
let queued = false;
setInterval(() => {
  if (!hasSrc || audio.paused || queued || source === 'live' || !isFinite(audio.duration) || !audio.duration) return;
  if (audio.duration - audio.currentTime < 8) { queued = true; nextTrack(); }
}, 500);
// The sleep timer fades everything out over `seconds` and stops it.
export function fadeOutAll(seconds) { for (const p of players) if (!p.paused) rampTo(p, 0, seconds, true); }
// Where you left off: the current mix track and position are saved every few seconds; the first Play after a reload
// resumes it (a shared link can queue a track the same way).
let resume = null, resumeAt = null;
export function queueResume(t, at) { resume = t; resumeAt = at; ui.title.textContent = `${t.t} — ${t.a}`; setMeta(['press Play to resume', t.lic], t.src, 'Source ↗'); }
if (state.np && byKey[state.np.key]) queueResume(byKey[state.np.key], state.np.t || 0);
setInterval(() => { if (hasSrc && !audio.paused && curTrack && !curTrack.live && !curTrack.own) saveState({ np: { key: key(curTrack), t: Math.floor(audio.currentTime) } }); }, 5000);
for (const p of players) p.addEventListener('loadedmetadata', () => { if (p === audio && resumeAt != null && isFinite(p.duration)) { try { p.currentTime = Math.min(resumeAt, p.duration - 5); } catch (e) {} resumeAt = null; } });
export function togglePlay() {
  if (hasSrc && !audio.ended) { if (audio.paused) { setGain(audio, 1); audio.play().catch(() => {}); } else audio.pause(); return; }
  if (resume) { const r = resume; resume = null; if (playable(r)) { playTrack(r); return; } resumeAt = null; }
  if (follow) { const t = pickFor(sceneKey, sceneTone); if (t) { playTrack(t); return; } }   // the scene's track, if its source is on
  pickNext();
}
// The seek bar follows the current player and scrubs it. Hidden until a track has a known length.
let scrubbing = false;
ui.seek.addEventListener('pointerdown', () => { scrubbing = true; });
ui.seek.addEventListener('change', () => { if (hasSrc && audio.duration) audio.currentTime = audio.duration * ui.seek.value / 1000; scrubbing = false; });
setInterval(() => {
  const ok = hasSrc && audio.duration > 0 && isFinite(audio.duration);
  ui.seek.hidden = !ok;
  if (ok && !scrubbing) ui.seek.value = Math.round(audio.currentTime / audio.duration * 1000);
}, 250);
for (const p of players) {
  p.addEventListener('play', () => { if (p === audio) { ui.play.textContent = 'Pause'; if (ms) ms.playbackState = 'playing'; } });
  p.addEventListener('pause', () => { if (p === audio) { ui.play.textContent = 'Play'; if (ms) ms.playbackState = 'paused'; } });
  p.addEventListener('playing', () => { if (p === audio) errors = 0; });
  p.addEventListener('ended', () => { if (p === audio) nextTrack(); });
  p.addEventListener('error', () => {
    if (p !== audio || !hasSrc) return;
    if (++errors > 3) { setStatus("Tracks aren't loading. Check the connection and press Next to retry."); errors = 0; return; }
    setStatus("That track couldn't be loaded. Moving to the next one.");
    setTimeout(nextTrack, 1200);
  });
}

ui.play.addEventListener('click', togglePlay);
ui.next.addEventListener('click', nextTrack);
try { const v = localStorage.getItem('sw-volume'); if (v !== null) ui.vol.value = v; } catch (e) {}
master = Number(ui.vol.value); players.forEach(p => setGain(p, p._g));
ui.vol.addEventListener('input', () => { master = Number(ui.vol.value); players.forEach(p => setGain(p, p._g)); try { localStorage.setItem('sw-volume', ui.vol.value); } catch (e) {} });
el('who').addEventListener('click', () => playTrack(sceneTrack()));

// The "Your music" part of the Library: add a folder or files, see what's there, play or remove a track.
function ownSection() {
  const sec = document.createElement('section'); sec.className = 'own';
  const all = ownTracks();
  const h = document.createElement('h3'); h.textContent = `Your music (${all.length})`;
  const note = document.createElement('p'); note.className = 'note';
  note.textContent = (keeps ? 'Copied into this app on this device, so it plays offline and stays after a restart. ' : 'Kept for this session only: this browser cannot store files for the app. ') +
    'Nothing is uploaded.' + (all.length ? ` ${(ownBytes() / 1e6).toFixed(0)} MB.` : '');
  const row = document.createElement('div'); row.className = 'row';
  const add = document.createElement('button'); add.type = 'button'; add.className = 'pbtn'; add.textContent = 'Add your music…';
  add.addEventListener('click', () => { openLib(false); window.dispatchEvent(new CustomEvent('sw-wizard')); });
  row.append(add);
  if (all.length) {
    const c = document.createElement('button'); c.type = 'button'; c.className = 'pbtn'; c.textContent = 'Remove all';
    let armed = false;
    c.addEventListener('click', async () => {
      if (!armed) { armed = true; c.textContent = 'Tap again to remove all'; setTimeout(() => { armed = false; c.textContent = 'Remove all'; }, 4000); return; }
      await clearOwn(); ST.prune([]); renderLib(); setStatus('Your music was removed from this device.');
    });
    row.append(c);
  }
  const ol = document.createElement('ol');
  for (const e of all) {
    const li = document.createElement('li'); li.dataset.k = 'own:' + e.id;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pl'; b.textContent = '▶'; b.setAttribute('aria-label', `Play ${e.t}`);
    b.addEventListener('click', () => playOwn(e));
    const body = document.createElement('div');
    const tt = document.createElement('div'); tt.className = 't'; tt.textContent = `${e.t} — ${e.a}`;
    const mm = document.createElement('div'); mm.className = 'm';
    const inSt = ST.memberOf(e.id).map(x => x.name);
    mm.textContent = `${inSt.length ? inSt.join(', ') : 'in no soundtrack yet'} · ${(e.size / 1e6).toFixed(1)} MB`;
    const x = document.createElement('button'); x.type = 'button'; x.className = 'rm'; x.textContent = 'Remove'; x.setAttribute('aria-label', `Remove ${e.t}`);
    x.addEventListener('click', async () => { await removeOwn(e.id); ST.prune(ownTracks().map(x => x.id)); renderLib(); });
    mm.append(' · ', x);
    body.append(tt, mm); li.append(b, body); ol.append(li);
  }
  sec.append(h, note, row, ol);
  return sec;
}
export function renderLib() {
  const groups = [
    ['Plays here', t => t.file],
    ['Streams from archive.org or ccMixter', t => t.conf === 'confirmed' && !t.file && t.stream],
    ["On the artist's or label's page", t => t.conf === 'confirmed' && !t.file && !t.stream],
    ['Likely Creative Commons, not yet confirmed', t => t.conf === 'likely' && !t.file],
  ];
  ui.list.textContent = '';
  ui.list.append(ownSection());
  for (const [label, test] of groups) {
    const items = TRACKS.filter(test); if (!items.length) continue;
    const sec = document.createElement('section');
    const h = document.createElement('h3'); h.textContent = `${label} (${items.length})`;
    const ol = document.createElement('ol');
    for (const t of items) {
      const li = document.createElement('li'); li.dataset.k = key(t);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pl'; b.textContent = '▶'; b.disabled = !playable(t);
      b.setAttribute('aria-label', `Play ${t.t} by ${t.a}`);
      b.addEventListener('click', () => playTrack(t));
      const body = document.createElement('div');
      const tt = document.createElement('div'); tt.className = 't'; tt.textContent = `${t.t} — ${t.a}`;
      const mm = document.createElement('div'); mm.className = 'm';
      mm.append([t.lic, eps(t)].filter(Boolean).join(' · '));
      if (t.src) mm.append(' · ', link(t.src, 'Source ↗'));
      if (t.stream && !t.file && iaOnline === false) { const e = document.createElement('em'); e.textContent = 'streams when run with a connection'; mm.append(' · ', e); }
      if (t.note) mm.append(document.createElement('br'), t.note);
      body.append(tt, mm); li.append(b, body); ol.append(li);
    }
    sec.append(h, ol); ui.list.append(sec);
  }
  markLib();
}
function markLib() {
  const k = curTrack && !curTrack.live ? (curTrack.own ? 'own:' + curTrack.id : key(curTrack)) : null;
  ui.list.querySelectorAll('li').forEach(li => li.classList.toggle('on', !!k && li.dataset.k === k));
}
export const libOpen = () => !ui.lib.hidden;
export function openLib(open) {
  ui.lib.hidden = !open; document.body.classList.toggle('lib-open', open);
  if (open) el('libClose').focus(); else el('libBtn').focus();
}
el('libBtn').addEventListener('click', () => openLib(ui.lib.hidden));
el('libClose').addEventListener('click', () => openLib(false));
renderLib();
probe();
loadOwn().then(() => { ST.prune(ownTracks().map(x => x.id)); renderLib(); window.dispatchEvent(new CustomEvent('sw-own-loaded')); });
ST.onChange(() => renderLib());
