// Music: CC tracks from the Music For Programming mixes (bundled or streamed from archive.org)
// plus a live source that picks random CC-licensed netlabel releases from the Internet Archive.
import { BeatClock } from './beat.js';
import TRACKS from './data/tracks.json';
import { M } from './assets.js';
import { state, saveState } from './state.js';
import { note } from './diag.js';
import { setStatus } from './status.js';
import { loadOwn, ownTracks, ownURL } from './mine.js';
import * as ST from './soundtracks.js';
import { trackWeight, pickWeighted, withSceneLove } from './shuffle.js';
import { localTrack } from './downloads.js';
import { drawCover } from './covers.js';

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
// Sound presets for where you are listening: a phone's speaker can't play deep bass, so it is cut and the low middle,
// which it can play, lifted; headphones get a little more weight and air; Night is softer at both ends.
export const EQ = { flat: [0, 0, 0], speaker: [-5, 4, 1], headphones: [3, 0, 1.5], night: [-3, 0, -3] };
let eq = null; export let eqName = EQ[state.eq] ? state.eq : 'flat';
function applyEq() { if (!eq) return; const [l, m, h] = EQ[eqName]; eq.low.gain.setTargetAtTime(l, actx.currentTime, .1); eq.mid.gain.setTargetAtTime(m, actx.currentTime, .1); eq.high.gain.setTargetAtTime(h, actx.currentTime, .1); }
export function setEq(name) { if (!EQ[name]) return; eqName = name; saveState({ eq: name }); applyEq(); }
function wireAnalyser() {
  if (analyser || !audioCtx()) return;
  try {
    analyser = actx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = .6;
    analyser.minDecibels = -90; analyser.maxDecibels = -12;   // headroom: loud music no longer pins every low bin at the top
    fdata = new Uint8Array(analyser.frequencyBinCount);
    // Each player's level is a gain node, not the element's volume: a gain node ramps smoothly, where stepping the
    // element's volume crackles on some phones. The element stays at full volume once wired.
    for (const p of players.slice(0, 2)) { const g = actx.createGain(); g.gain.value = p.volume; p._gain = g; p.volume = 1; actx.createMediaElementSource(p).connect(g); g.connect(analyser); }
    eq = { low: actx.createBiquadFilter(), mid: actx.createBiquadFilter(), high: actx.createBiquadFilter() };
    eq.low.type = 'lowshelf'; eq.low.frequency.value = 120; eq.mid.type = 'peaking'; eq.mid.frequency.value = 400; eq.mid.Q.value = .9; eq.high.type = 'highshelf'; eq.high.frequency.value = 6000;
    analyser.connect(eq.low); eq.low.connect(eq.mid); eq.mid.connect(eq.high); eq.high.connect(actx.destination);
    applyEq();
    listenForBeats();
  } catch (e) { analyser = null; }
}
// The beat clock listens on the audio thread, not once a frame: an AudioWorklet measures the low end (below about
// 160 Hz, the kick) every 512 samples and posts how sharply it rose, timed by the audio clock. That keeps the clock on
// the beat at any frame rate, even while a heavy scene draws every other frame. Without AudioWorklet it falls back to
// sampling the analyser each frame.
const ONSET_WORKLET = `class Onset extends AudioWorkletProcessor {
  constructor() { super(); this.n = 0; this.e = 0; this.prev = 0; this.peak = 1e-3; this.buf = []; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) for (let i = 0; i < ch.length; i++) {
      this.e += ch[i] * ch[i];
      if (++this.n === 512) {
        const rms = Math.sqrt(this.e / 512); this.peak = Math.max(rms, this.peak * .9995);
        this.buf.push(Math.max(0, rms - this.prev) / this.peak); this.prev = rms; this.n = 0; this.e = 0;
        if (this.buf.length === 4) { this.port.postMessage({ t: currentTime + (i + 1) / sampleRate, hop: 512 / sampleRate, f: this.buf }); this.buf = []; }
      }
    }
    return true;
  }
}
registerProcessor('sw-onset', Onset);`;
let heardAt = -1e9, audioT = 0;
async function listenForBeats() {
  if (!actx.audioWorklet) return;
  try {
    const url = URL.createObjectURL(new Blob([ONSET_WORKLET], { type: 'application/javascript' }));
    await actx.audioWorklet.addModule(url); URL.revokeObjectURL(url);
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = .7;
    const node = new AudioWorkletNode(actx, 'sw-onset', { numberOfOutputs: 1 }), mute = actx.createGain(); mute.gain.value = 0;
    analyser.connect(lp); lp.connect(node); node.connect(mute); mute.connect(actx.destination);   // silent, but on the graph so it runs
    node.port.onmessage = ({ data }) => {
      const on = musicPlaying, bpm = currentBpm();
      if (curTrack !== beatTrack) { beatTrack = curTrack; beatClock.newTrack(); }
      for (const f of data.f) beatClock.update(on ? f : 0, data.hop, bpm, on);
      heardAt = performance.now(); audioT = data.t;
    };
  } catch (e) { /* no worklet: the per-frame fallback in sampleMusic carries on */ }
}
const worklet = () => performance.now() - heardAt < 400;

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
// Whether music is playing right now, read from the players themselves (musicPlaying is only refreshed while drawing).
export const playingNow = () => players.some(p => !p.paused && !p.ended);
// The beat clock (src/beat.js), fed each frame with how sharply the low end rose: scenes that move in step read it.
const beatClock = new BeatClock();
let lowPrev = null, beatTrack = null;
function lowFlux() {
  if (!lowPrev) lowPrev = new Float32Array(4);
  let f = 0;
  for (let i = 1; i < 4; i++) { const v = fdata[i] / 255; f += Math.max(0, v - lowPrev[i]) * (i === 1 ? 1.4 : 1); lowPrev[i] = v; }   // about 40 to 300 Hz, the kick's thump weighted most
  return f / 3;
}
// Where the music is in its beats, as heard: the analyser hears a little before the speaker plays, so subtract that.
// beats counts up continuously; one is the beat of the bar the strongest kicks fall on; lock is 0 to 1.
export function beatPos() {
  const lat = actx ? (actx.outputLatency || 0) + (actx.baseLatency || 0) : 0, since = worklet() ? Math.max(0, Math.min(.2, actx.currentTime - audioT)) : 0;
  return { beats: beatClock.shown + (since - lat) * beatClock.bpm / 60, one: beatClock.one, bpm: beatClock.bpm, lock: beatClock.lock, lat };
}
export function sampleMusic(dt) {
  musicPlaying = players.some(p => !p.paused && !p.ended && p.readyState > 2);
  const fallback = !worklet();
  if (fallback && curTrack !== beatTrack) { beatTrack = curTrack; beatClock.newTrack(); }
  let target = 0, flux = 0, heard = false;
  if (musicPlaying) {
    const onGraph = players.slice(0, 2).some(p => !p.paused && p.readyState > 2);
    if (analyser && onGraph) {
      analyser.getByteFrequencyData(fdata);
      flux = lowFlux(); heard = true;
      let lo = 0, all = 0; const nLo = 12;
      for (let i = 0; i < fdata.length; i++) { all += fdata[i]; if (i < nLo) lo += fdata[i]; }
      target = Math.min(1, Math.max(0, ((lo / nLo / 255) * .6 + (all / fdata.length / 255) * 1.2 - .06) * 1.6));
    } else target = .45; // a plain player gives no data, so sit in the middle
  }
  if (fallback) beatClock.update(flux, dt, currentBpm(), heard);
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
// The crossfade between tracks that run into each other, in seconds (0 joins them tightly), and a volume limit.
export let xfade = [-1, 0, 3, 8, 12].includes(state.xfade) ? state.xfade : -1;   // -1: auto, from each track's energy
// A track's energy from its measurement (scripts/analyse-music.mjs): 0 gentle to 1 loud and driving; .4 when unmeasured.
export const energyOf = t => t && t.db !== undefined ? Math.max(0, Math.min(1, (t.db + 18) / 12 * .6 + (t.beat || 0) * .5)) : .4;
// The crossfade for the playing track: auto makes it short between driving tracks and long between gentle ones.
const fadeSecs = () => xfade >= 0 ? xfade : energyOf(curTrack) > .7 ? 2 : energyOf(curTrack) > .45 ? 5 : 10;
// Bedtime and the sleep timer ask for calm: the shuffle then leans hard toward the quietest, slowest tracks.
let calm = false;
export function setCalm(v) { calm = !!v; }
// The playing track's tempo, for scenes that keep in step with it (0 when unknown or nothing plays).
export const currentBpm = () => (curTrack && curTrack.bpm && players.some(p => !p.paused)) ? curTrack.bpm : 0;
// The Workout soundtrack's pace: any, steady (115 to 140 BPM), fast (140 to 160) or sprint (160 and up).
export const PACES = { any: [0, 999], steady: [115, 140], fast: [140, 160], sprint: [160, 999] };
export let pace = PACES[state.pace] ? state.pace : 'any';
export function setPace(p) { pace = PACES[p] ? p : 'any'; saveState({ pace }); }
export function setCrossfade(v) { xfade = v; saveState({ xfade: v }); }
export let volCap = [1, .8, .6].includes(state.volCap) ? state.volCap : 1;
export function setVolCap(v) { volCap = v; saveState({ volCap: v }); players.forEach(p => setGain(p, p._g)); }
function setGain(p, g) {
  p._g = g; const v = Math.max(0, Math.min(1.5 * volCap, g * Math.min(master, volCap) * duck * (p._norm || 1)));
  if (p._gain) p._gain.gain.setTargetAtTime(v, actx.currentTime, .03); else p.volume = Math.min(1, v);
}
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
let sceneKey = null, sceneTone = null, sceneName = null;
const recent = [];
export function setScene(k, tone, scene) { sceneKey = k; sceneTone = tone || null; sceneName = scene || null; }
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

const ui = { play: el('play'), next: el('next'), progs: [el('barSeek')], title: el('npTitle'), meta: el('npMeta'),  vol: el('vol'), lib: el('lib'), list: el('libList'), seek: el('seek') };
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
// What you do with each track: plays through (p) and quick skips (s), kept per track. The shuffle leans toward the
// tracks you let play and away from the ones you skip, and hearted tracks come up a little more often.
const stats = state.trackStats || {};
const keyOf = t => t ? (t.own ? 'own:' + t.id : key(t)) : null;
let startedAt = 0;
function tally(k, f) { if (!k) return; const e = stats[k] || (stats[k] = { p: 0, s: 0 }); e[f]++; saveState({ trackStats: stats }); }
const weightOf = k => trackWeight(stats[k], ST.isLoved(k), (sceneLoves[sceneName] || []).includes(k)) * (calm ? Math.exp(-4 * energyOf(byKey[k])) * 3 : 1);
const weighted = (list, k) => pickWeighted(list, list.map(x => weightOf(k(x))));
// Tracks hearted while a scene was on come back more when that scene is on again.
let sceneLoves = state.sceneLoves || {};
const noteSceneLove = (k, on) => { if (!sceneName) return; sceneLoves = withSceneLove(sceneLoves, sceneName, k, on); saveState({ sceneLoves }); };
// Hearing comfort: an hour of playing near full volume brings a gentle note, once until the volume comes down.
let loudFor = 0, loudTold = false;
setInterval(() => {
  if (!musicPlaying) return;
  if (Math.min(master, volCap) >= .85) { loudFor += 5; if (loudFor >= 3600 && !loudTold) { loudTold = true; setStatus('An hour at high volume: if you are on headphones, a little lower is kinder to your ears. A volume limit is under Music.'); note('hearing reminder shown'); } }
  else { loudFor = Math.max(0, loudFor - 10); if (loudFor === 0) loudTold = false; }
}, 5000);
export const found = () => state.found || [];
let liveUrl = null;
export const currentLoved = () => !!curTrack && ST.isLoved(curTrack.live ? key(curTrack) : keyOf(curTrack));
export function toggleLove() {
  if (!curTrack) return null;
  if (curTrack.live) {   // a random find: keep it, with its credit, so the Loved soundtrack can play it again
    const k = key(curTrack), on = !ST.isLoved(k);
    const list = found().filter(f => key(f) !== k);
    if (on && liveUrl) list.push({ a: curTrack.a, t: curTrack.t, lic: curTrack.lic, src: curTrack.src, stream: liveUrl, genre: 'misc', mood: 'calm', conf: 'confirmed', found: true });
    saveState({ found: list }); ST.setLoved(k, on); noteSceneLove(k, on); renderLib();
    window.dispatchEvent(new CustomEvent('sw-loved', { detail: on })); return on;
  }
  const k = keyOf(curTrack), on = !ST.isLoved(k); ST.setLoved(k, on); noteSceneLove(k, on);
  window.dispatchEvent(new CustomEvent('sw-loved', { detail: on })); return on;
}
// Levelling: each track's loudness is measured the first time it plays and kept, so the next time it starts at the
// right level and quiet and loud tracks sit together. A track measured now eases to its level over a few seconds.
const loud = state.loudness || {};
const TARGET = .075;   // the median of the bundled tracks, as the analyser reads it (about -18 dB)
const normFor = t => { const k = keyOf(t), r = k && loud[k]; return r ? Math.max(.55, Math.min(1.7, TARGET / r)) : 1; };
let meas = { k: null, sum: 0, n: 0 }, tdata = null;
setInterval(() => {
  const p = audio;
  if (!analyser || !p._gain || p.paused || !curTrack || curTrack.live || fades.length) return;
  const k = keyOf(curTrack);
  if (meas.k !== k) meas = { k, sum: 0, n: 0 };
  if (!loud[k] && p.currentTime > 3) {
    if (!tdata) tdata = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(tdata);
    let sq = 0; for (let i = 0; i < tdata.length; i++) sq += tdata[i] * tdata[i];
    const g = p._gain.gain.value; if (g > .05) { meas.sum += sq / tdata.length / (g * g); meas.n++; }
    if (meas.n >= 80) { loud[k] = +Math.sqrt(meas.sum / meas.n).toFixed(4); saveState({ loudness: loud }); }   // about sixteen seconds
  }
  const want = normFor(curTrack);
  if (Math.abs((p._norm || 1) - want) > .005) { p._norm = (p._norm || 1) + (want - (p._norm || 1)) * .08; setGain(p, p._g); }
}, 200);
// Free tracks you never want: kept by key in the state; skipped by the picker, the scene's pick and the cycle.
export const never = new Set(state.never || []);
export function setNever(t, on) { const k = key(t); if (on) never.add(k); else never.delete(k); saveState({ never: [...never] }); renderLib(); }
const allowed = t => playable(t) && ST.freeAllows(t) && !never.has(key(t));
// The cycle: within a soundtrack, nothing comes round again until everything else has played once.
let cycle = { id: null, done: new Set() };
function cycleOk(id, k) { if (cycle.id !== id) cycle = { id, done: new Set() }; return !cycle.done.has(k); }
function cycleMark(k) { cycle.done.add(k); }

// Lock screen and hardware keys show the track and control playback.
const ms = 'mediaSession' in navigator ? navigator.mediaSession : null;
let artwork = () => null;   // main.js supplies the current scene's thumbnail
// A cover for a free track: a small square in its genre's colour with the artist's initials, drawn once and kept.
const covers = new Map();
// plain: without the title and artist on it, for small places like the player bar (the lock screen keeps them).
export function coverFor(t, plain = false) {
  if (t.own && t.art) return t.art;   // your own track's embedded cover wins
  const k = (t.own ? 'own:' + t.id : key(t)) + (plain ? '#plain' : ''); if (covers.has(k)) return covers.get(k);
  let url = null;
  try {
    const own = t.own ? ownTracks().find(e => e.id === t.id) : null;
    const gid = t.own ? (ST.memberOf(t.id).find(s => s.builtIn) || {}).id || 'misc' : t.live ? 'ambient' : t.genre;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    drawCover(c, { title: plain ? '' : t.t, artist: t.a, genre: gid, color: (ST.BUILT_IN.find(b => b.id === gid) || {}).color || (own && '#8fa0a8') || '#6f8fd8' });
    url = c.toDataURL('image/jpeg', .86);
  } catch (e) {}
  covers.set(k, url); return url;
}
export function setArtworkSource(fn) { artwork = fn; }
// The focus timer's state, shown on the lock screen in place of the album line while a block runs.
let lockLine = '';
export function setLockLine(text) { if (text === lockLine) return; lockLine = text; announce(); }
// The cover of the playing track, when it carries one (your own MP3s with embedded art).
export function trackInfo() {
  const t = curTrack; if (!t) return null;
  if (t.own) { const e = ownTracks().find(x => x.id === t.id) || {}; return { t: t.t, a: t.a, kind: 'Your music', lic: '', lines: [e.genre && `Genre tag: ${e.genre}`, e.dur && `${Math.round(e.dur / 60)} min`, e.size && `${(e.size / 1e6).toFixed(1)} MB`, `In: ${ST.memberOf(t.id).map(s => s.name).join(', ') || 'no soundtrack'}`].filter(Boolean), more: [] }; }
  const base = TRACKS.find(x => key(x) === key(t)) || t;
  const genre = (ST.BUILT_IN.find(b => b.id === base.genre) || {}).name;
  return { t: t.t, a: t.a, kind: t.live ? 'A random find on the Internet Archive' : base.file ? 'Bundled with the app' : 'Streams from archive.org', lic: t.lic, src: t.src,
    lines: [genre && `Soundtrack: ${genre}`, base.ep && base.ep.length && `Heard in Music For Programming episode${base.ep.length > 1 ? 's' : ''} ${base.ep.join(', ')}`, base.note].filter(Boolean),
    more: TRACKS.filter(x => x.a === t.a && key(x) !== key(t)) };
}
export const currentArt = (plain = true) => (curTrack || resume) ? coverFor(curTrack || resume, plain) : null;   // the waiting track's cover too
export function announce(t = curTrack) {
  if (!ms || !t) return;
  try {
    const cover = coverFor(t), art = artwork();
    ms.metadata = new MediaMetadata({ title: t.t, artist: t.a, album: lockLine || (t.live ? 'Internet Archive · ' + t.lic : 'Music For Programming mixes · ' + t.lic), artwork: cover ? [{ src: cover, sizes: '256x256', type: 'image/jpeg' }] : art ? [{ src: art, sizes: '160x90', type: 'image/jpeg' }] : [] });
  } catch (e) {}
}
if (ms) {
  for (const [action, fn] of [['play', () => togglePlay()], ['pause', () => togglePlay()], ['nexttrack', () => nextTrack()], ['previoustrack', () => prevTrack()]]) {
    try { ms.setActionHandler(action, fn); } catch (e) {}
  }
}

// One small request tells us whether outside APIs and audio are reachable.
let probeDone;
// Streams you have heard are kept in a cache the service worker serves ranges from, up to a cap, oldest out first.
const STREAMS = 'slow-windows-streams', STREAM_CAP = 300e6;
export let keepStreams = !!state.keepStreams;
export function setKeepStreams(v) { keepStreams = v; saveState({ keepStreams: v }); }
async function keepStream(t) {
  if (!keepStreams || !t.stream || !('caches' in window)) return;
  try {
    const c = await caches.open(STREAMS);
    if (await c.match(t.stream)) return;
    const r = await fetch(t.stream, { mode: 'cors' }); if (!r.ok) return;
    const buf = await r.arrayBuffer();
    await c.put(t.stream, new Response(buf, { headers: { 'Content-Type': r.headers.get('Content-Type') || 'audio/mpeg', 'Content-Length': String(buf.byteLength), 'x-kept': String(Date.now()) } }));
    note(`kept ${t.t} for offline (${(buf.byteLength / 1e6).toFixed(0)} MB)`);
    // Trim to the cap, oldest first.
    const keys = await c.keys(); const entries = [];
    for (const k of keys) { const r2 = await c.match(k); entries.push({ k, at: Number(r2.headers.get('x-kept')) || 0, size: Number(r2.headers.get('Content-Length')) || 0 }); }
    entries.sort((a, b) => a.at - b.at); let total = entries.reduce((a, e) => a + e.size, 0);
    for (const e of entries) { if (total <= STREAM_CAP) break; await c.delete(e.k); total -= e.size; }
  } catch (e) {}
}
export async function cachedStreams() { try { const c = await caches.open(STREAMS); return (await c.keys()).length; } catch (e) { return 0; } }
export async function probe() {
  let done; probeDone = new Promise(r => { done = r; });
  try {
    const r = await fetch('https://archive.org/advancedsearch.php?q=identifier%3Araam004&fl%5B%5D=identifier&rows=1&output=json', { cache: 'no-store' });
    iaOnline = r.ok;
  } catch (e) { iaOnline = false; }
  renderLib(); done();
}

// Starts a track. When a place in it is wanted (picking up where you left off), the element loads its metadata first,
// seeks there silently, and only then plays, fading in: otherwise a moment of the track's start would be heard before
// the jump, and the jump itself would click. The promise of that play() is kept, so a refusal can be noticed.
let pendingPlay = Promise.resolve();
function begin(p, seekTo, fade) {
  if (seekTo == null) { pendingPlay = p.play(); pendingPlay.catch(() => {}); rampTo(p, 1, fade, false); return; }
  // The fade only starts once playback has: a fade that ran while the track was still loading would leave it
  // starting mid-waveform at full volume, which clicks.
  pendingPlay = new Promise((res, rej) => {
    const place = () => { try { if (isFinite(p.duration)) p.currentTime = Math.min(seekTo, Math.max(0, p.duration - 5)); } catch (e) {} };
    const go = () => {
      place();
      p.play().then(async () => {
        if (Math.abs(p.currentTime - seekTo) > 3) place();
        // Silence while the audio engine spins up: its first moments after a cold start can crackle on phones.
        if (actx) { try { await actx.resume(); } catch (e) {} }
        await new Promise(r => setTimeout(r, 350));
        rampTo(p, 1, fade, false); res();
      }, rej);
    };
    if (p.readyState >= 1) go(); else { p.addEventListener('loadedmetadata', go, { once: true }); p.preload = 'metadata'; p.load(); }   // the players don't preload on their own
  });
  pendingPlay.catch(() => {});
}
function start(url, tight = false) {
  hasSrc = true; queued = false; startedAt = performance.now();
  const cors = corsOk(url), prev = audio, seekTo = resumeAt; resumeAt = null;
  const slow = slowNext, auto = autoNext; slowNext = false; autoNext = false;
  const xf = fadeSecs();
  if (auto && xf === 0) tight = true;
  const join = auto && xf > 0 ? xf : null;
  const fadeIn = tight ? .08 : seekTo != null ? 1.2 : slow ? 8 : join || FADE, fadeOut = tight ? .08 : slow ? 8 : join || FADE;
  const next = cors ? (players[0] === prev ? players[1] : players[0]) : players[2];
  if (cors) wireAnalyser();
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  if (next === prev) { prev._norm = normFor(curTrack); setGain(prev, 0); prev.src = url; begin(prev, seekTo, seekTo == null ? .4 : 1.2); return; }
  if (!prev.paused) rampTo(prev, 0, fadeOut, true); else prev.pause();
  audio = next; next._norm = normFor(curTrack); setGain(next, 0); next.src = url; begin(next, seekTo, fadeIn);
}
export function playTrack(t) {
  if (!t) return;
  if (!playable(t)) {
    setStatus(t.stream ? (iaOnline === null ? 'Checking the connection to archive.org. Try again in a moment.' : BLOCKED) : 'This track is only on its source page. Open the link to listen.');
    return;
  }
  source = 'mix'; setStatus(''); curTrack = t;
  cycleMark(key(t)); remember({ kind: 'mix', t });
  recent.push(key(t)); if (recent.length > 4) recent.shift();
  ui.title.textContent = `${t.t} — ${t.a}`;
  setMeta([t.lic, eps(t), t.file ? 'bundled' : 'streaming'], t.src, 'Source ↗');
  announce(t);
  start(t.file ? (localTrack(t.file) || M + t.file) : t.stream);   // a copy kept on this device first (Android app)
  markLib();
  if (!t.file) setTimeout(() => { if (curTrack === t) keepStream(t); }, 20000);   // a track you stayed with
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
      source = 'live'; liveUrl = url; remember({ kind: 'live', t: curTrack, url, meta: ui.meta.textContent });
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
export async function playOwn(e) {
  const prevOwn = curTrack && curTrack.own;
  source = 'own'; setStatus('');
  curTrack = { own: true, id: e.id, a: e.a, t: e.t, lic: 'Your music', art: e.art || null };
  cycleMark('own:' + e.id); remember({ kind: 'own', e });
  recent.push('own:' + e.id); if (recent.length > 4) recent.shift();
  ui.title.textContent = `${e.t} — ${e.a}`;
  setMeta(['your music', (e.size / 1e6).toFixed(1) + ' MB']);
  announce(curTrack);
  try {
    const url = await ownURL(e), old = ownBlob; ownBlob = url;
    start(url, queued && !!(prevOwn));
    if (old) setTimeout(() => URL.revokeObjectURL(old), 4000);   // after the crossfade
  } catch (err) { setStatus("That file couldn't be opened. It may have been removed; add it again from the Library."); }
  markLib();
}
// The next track: first a source, each one that is on getting an equal share however many tracks it holds (the live archive
// half a share, so it adds variety without taking over), then a track from it that wasn't one of the last few.
function pickNext(relaxed = false) {
  const isCur = k => curTrack && (curTrack.own ? 'own:' + curTrack.id : key(curTrack)) === k;
  const st = ST.current(), mine = new Set(st.own);
  const ok = k => !isCur(k) && (relaxed || (!recent.includes(k) && cycleOk(st.id, k)));
  const pools = [];
  let free = [...TRACKS, ...(st.like === 'loved' ? found() : [])].filter(t => allowed(t) && ok(key(t)));
  if (st.id === 'energy' && pace !== 'any') {   // the Workout pace: tracks in its tempo range, when there are any
    const [lo, hi] = PACES[pace], fit = free.filter(t => Math.round(t.bpm) >= lo && Math.round(t.bpm) < hi);   // 139.8 is a 140 track
    if (fit.length) free = fit;
  }
  const own = ownTracks().filter(e => mine.has(e.id) && ok('own:' + e.id));
  // Your music gets the larger share once there is a fair amount of it; the free tracks fill in around it.
  if (own.length) pools.push([own.length >= 8 ? 2 : 1, () => playOwn(weighted(own, e => 'own:' + e.id))]);
  if (free.length) pools.push([1, () => playTrack(weighted(free, key))]);
  if (st.live && iaOnline !== false) pools.push([.5, () => nextLive()]);
  if (!pools.length) {
    if (!relaxed) { cycle = { id: st.id, done: new Set() }; return pickNext(true); }   // the cycle is complete: start a new one
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
// What started when, for the end-of-block summary.
const played = [];
export const playedSince = ts => played.filter(p => p.at >= ts);
function remember(entry) {
  { const t = entry.kind === 'own' ? entry.e : entry.t; if (t && !replaying) { played.push({ at: Date.now(), t: t.t, a: t.a }); if (played.length > 60) played.shift(); } }
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
// Up next: tracks you asked for, played in order before the shuffle resumes.
const upNext = [];
export const queue = () => upNext;
export function playNext(item) { upNext.push(item); drawUpNext(); setStatus(`Up next: ${item.t} — ${item.a}.`); }
export function clearQueue() { upNext.length = 0; drawUpNext(); }
// The queue under Music: each track with up, down and remove.
function drawUpNext() {
  const box = el('upNext'), ol = el('upNextList'); if (!box) return;
  box.hidden = !upNext.length; ol.textContent = '';
  upNext.forEach((q, i) => {
    const li = document.createElement('li'), name = document.createElement('span'); name.textContent = `${q.t} — ${q.a}`;
    const btn = (txt, label, fn, off) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'rm'; b.textContent = txt; b.setAttribute('aria-label', label); b.disabled = !!off; b.addEventListener('click', () => { fn(); drawUpNext(); }); return b; };
    li.append(name,
      btn('↑', `Move ${q.t} up`, () => upNext.splice(i - 1, 0, upNext.splice(i, 1)[0]), i === 0),
      btn('↓', `Move ${q.t} down`, () => upNext.splice(i + 1, 0, upNext.splice(i, 1)[0]), i === upNext.length - 1),
      btn('×', `Remove ${q.t} from the queue`, () => upNext.splice(i, 1)));
    ol.append(li);
  });
}
// One switch can ask for a longer, slower crossfade (a break starting, say).
let slowNext = false;
export function nextTrackSlowly() { slowNext = true; nextTrack(); }
export function nextTrack() {
  // A Next within ten seconds of a track starting counts as a skip; the automatic ones (the track ending) as a play.
  if (curTrack && !curTrack.live) { if (queued || audio.ended) tally(keyOf(curTrack), 'p'); else if (performance.now() - startedAt < 10000) tally(keyOf(curTrack), 's'); }
  if (upNext.length) { const q = upNext.shift(); drawUpNext(); if (q.own) { const e = ownTracks().find(x => x.id === q.id); if (e) return playOwn(e); } else return playTrack(q); }
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
let queued = false, stopAtEnd = false, autoNext = false;
export function setStopAtEnd(v) { stopAtEnd = v; }
export const stoppingAtEnd = () => stopAtEnd;
setInterval(() => {
  if (!hasSrc || audio.paused || queued || source === 'live' || !isFinite(audio.duration) || !audio.duration || stopAtEnd) return;
  // Your own tracks join tightly, as an album's do; the free tracks crossfade eight seconds early.
  const lead = curTrack && curTrack.own ? .35 : fadeSecs() > 0 ? fadeSecs() : .35;
  if (audio.duration - audio.currentTime < lead) { queued = true; autoNext = true; nextTrack(); }
}, curTrack && curTrack.own ? 100 : 500);
// The sleep timer fades everything out over `seconds` and stops it.
export function fadeOutAll(seconds) { for (const p of players) if (!p.paused) rampTo(p, 0, seconds, true); }
// Where you left off: the current mix track and position are saved every few seconds; the first Play after a reload
// resumes it (a shared link can queue a track the same way).
// Picking up where you left off. What was playing (a free track or one of your own) and where in it is saved every few
// seconds and when the page goes into the background. On the next open the app tries to carry straight on: the installed
// app is allowed to, and so is a browser after a gesture, so if the browser refuses, the first tap anywhere resumes it.
let resume = null, resumeAt = null, resumeOwn = null;
export function queueResume(t, at) { resume = t; resumeAt = at; ui.title.textContent = `${t.t} — ${t.a}`; setMeta(['press Play to resume', t.lic], t.src, 'Source ↗'); }
function saveNow(playing) {
  if (!hasSrc || !curTrack || curTrack.live) return;
  saveState({ np: curTrack.own ? { own: curTrack.id, t: Math.floor(audio.currentTime), playing } : { key: key(curTrack), t: Math.floor(audio.currentTime), playing } });
}
setInterval(() => { if (!audio.paused) saveNow(true); }, 2000);
for (const p of players) p.addEventListener('pause', () => { if (p === audio) saveNow(false); });
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(!audio.paused); });
window.addEventListener('pagehide', () => saveNow(!audio.paused));
// The default genre (held down in the cover's menu): the app opens on it. The last track carries on only if it is in it.
if (state.defaultSt && ST.byId(state.defaultSt)) ST.setCurrent(state.defaultSt);
const inCurrent = np => np.own ? ST.current().own.includes(np.own) : !!(byKey[np.key] && ST.freeAllows(byKey[np.key]));
if (state.np && (!state.defaultSt || inCurrent(state.np))) {
  if (state.np.key && byKey[state.np.key]) queueResume(byKey[state.np.key], state.np.t || 0);
  else if (state.np.own) resumeOwn = state.np;     // its entry arrives once your music has loaded
}
// Otherwise a track from the genre is ready from the first moment: its name and cover on the bar, and Play starts it.
// Streams count before the archive.org check is done (Play waits for it); your own music once it has loaded.
function loadOne() {
  if (resume || resumeOwn || curTrack) return;
  const free = ST.freeTracks().filter(t => (t.file || t.stream) && !never.has(key(t)));
  if (free.length) { queueResume(weighted(free, key), 0); setMeta(['press Play', resume.lic], resume.src, 'Source ↗'); return; }
  const mine = ownTracks().filter(e => ST.current().own.includes(e.id));
  if (mine.length) { const e = weighted(mine, x => 'own:' + x.id); resume = { own: true, id: e.id, a: e.a, t: e.t, lic: 'Your music' }; resumeAt = 0; ui.title.textContent = `${e.t} — ${e.a}`; setMeta(['press Play', 'your music']); }
}
loadOne();
window.addEventListener('sw-own-loaded', loadOne);
// A new genre chosen while nothing plays: a track from it takes the place of the one that was waiting.
let loadedFor = ST.current().id;
ST.onChange(() => { const id = ST.current().id; if (id === loadedFor) return; loadedFor = id; if (!hasSrc && !curTrack) { resume = null; resumeOwn = null; loadOne(); } });
// Streams need the archive.org check to have finished before they count as playable; a few seconds at most.
const readyFor = async t => { if (t && t.stream && iaOnline === null && probeDone) await Promise.race([probeDone, new Promise(r => setTimeout(r, 6000))]); return t.own || playable(t); };
async function carryOn() {
  if (!resume || !state.np || !state.np.playing) return;
  const r = resume, at = resumeAt;
  if (!(await readyFor(r)) || resume !== r) return;
  try {
    resumeAt = at;
    if (r.own) { const e = ownTracks().find(x => x.id === r.id); if (!e) return; resume = null; await playOwn(e); } else { resume = null; playTrack(r); }
    // The browser says no with a rejected play(); otherwise it is on its way, however long the track takes to load.
    await pendingPlay;
    if (actx && actx.state === 'suspended') { await actx.resume().catch(() => {}); if (actx.state === 'suspended') throw new Error('blocked'); }
    setStatus(`Carrying on: ${r.t} — ${r.a}.`); note(`resumed ${r.t} at ${at || 0}s on its own`);
  } catch (e) {
    // The browser wants a gesture first: hold the place, and go on at the first one.
    audio.pause(); resume = r; resumeAt = null; ui.meta.textContent = 'tap anywhere to carry on'; setStatus(`Tap anywhere to carry on with ${r.t}.`); note(`resume of ${r.t} at ${at || 0}s waits for a tap (${e && e.name || e})`);   // the place is set, or will be when the metadata is in
    const go = () => { if (resume === r) togglePlay(); };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, go, { once: true, passive: true });
  }
}
window.addEventListener('sw-own-loaded', () => {
  if (resumeOwn) { const e = ownTracks().find(x => x.id === resumeOwn.own); if (e) { resume = { own: true, id: e.id, a: e.a, t: e.t, lic: 'Your music' }; resumeAt = resumeOwn.t || 0; ui.title.textContent = `${e.t} — ${e.a}`; setMeta(['press Play to resume', 'your music']); } resumeOwn = null; }
  carryOn();
});
export function togglePlay() {
  if (hasSrc && !audio.ended) { if (audio.paused) { setGain(audio, 0); audio.play().catch(() => {}); rampTo(audio, 1, .8, false); } else audio.pause(); return; }
  if (resume) {
    const r = resume; resume = null;
    if (r.own) { const e = ownTracks().find(x => x.id === r.id); if (e) { playOwn(e); return; } }
    else if (playable(r)) { playTrack(r); return; }
    else if (r.stream && iaOnline === null) { const at = resumeAt; readyFor(r).then(ok => { if (ok) { resumeAt = at; playTrack(r); } else pickNext(); }); return; }   // the check is still running
    resumeAt = null;
  }
  if (follow) { const t = pickFor(sceneKey, sceneTone); if (t) { playTrack(t); return; } }   // the scene's track, if its source is on
  pickNext();
}
// The seek bar follows the current player and scrubs it. Hidden until a track has a known length.
let scrubbing = false;
// Where the playing track is, and moving within it: for the seek line on the player bar.
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const trackClock = clock;
export const trackPos = () => (hasSrc && audio.duration > 0 && isFinite(audio.duration)) ? { at: audio.currentTime, dur: audio.duration } : null;
export function seekFraction(f) { const p = trackPos(); if (!p) return false; audio.currentTime = Math.max(0, Math.min(.999, f)) * p.dur; return true; }
ui.seek.addEventListener('pointerdown', () => { scrubbing = true; });
ui.seek.addEventListener('change', () => { if (hasSrc && audio.duration) audio.currentTime = audio.duration * ui.seek.value / 1000; scrubbing = false; });
setInterval(() => {
  const ok = hasSrc && audio.duration > 0 && isFinite(audio.duration);
  ui.seek.hidden = !ok;
  if (ok && !scrubbing) ui.seek.value = Math.round(audio.currentTime / audio.duration * 1000);
  for (const pg of ui.progs) if (!pg.classList.contains('drag')) { const f = ok ? audio.currentTime / audio.duration : 0; pg.firstChild.style.width = `${(f * 100).toFixed(2)}%`; pg.setAttribute('aria-valuenow', String(Math.round(f * 100))); pg.setAttribute('aria-valuetext', ok ? `${clock(audio.currentTime)} of ${clock(audio.duration)}` : 'Nothing playing'); }
}, 250);
for (const p of players) {
  const shown = on => { ui.play.setAttribute('aria-pressed', String(on)); ui.play.setAttribute('aria-label', on ? 'Pause' : 'Play'); window.dispatchEvent(new CustomEvent('sw-playstate', { detail: on })); };
  p.addEventListener('play', () => { if (p === audio) { shown(true); if (ms) ms.playbackState = 'playing'; } });
  p.addEventListener('pause', () => { if (p === audio) { shown(false); if (ms) ms.playbackState = 'paused'; } });
  p.addEventListener('playing', () => { if (p === audio) errors = 0; });
  p.addEventListener('ended', () => { if (p !== audio) return; if (stopAtEnd) { stopAtEnd = false; window.dispatchEvent(new CustomEvent('sw-track-ended-stop')); return; } nextTrack(); });
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
// The library's list is drawn by library.js, which registers itself here (it imports this module, so not the other way).
let libView = null;
export function setLibView(v) { libView = v; v.render(); }
export const trackKey = t => keyOf(t);
export const currentKey = () => curTrack && !curTrack.live ? keyOf(curTrack) : null;
export function renderLib() { if (libView) libView.render(); }
function markLib() { if (libView) libView.mark(); }
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
