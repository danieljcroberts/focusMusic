// Ambient sound, generated in Web Audio from filtered noise and a few sine blips: nothing to download, nothing to license.
// Each scene names a kind in its metadata; the layers crossfade when the scene changes, and some follow the weather.
import { audioCtx } from './music.js';
import { weather } from './weather.js';
import { state, saveState } from './state.js';

export const KINDS = ['none', 'rain', 'wind', 'sea', 'fire', 'cafe', 'train', 'storm', 'pond', 'aquarium', 'road', 'hum', 'space', 'tent', 'underwater', 'shore', 'crickets', 'forest'];

let ctx = null, master = null, bus = null, buffers = {}, live = [], timers = [], kind = 'none';
// Sounds you add on top of the scene's own, each at its own level. Brown noise and binaural tones are only here.
export const EXTRA_KINDS = { rain: 'Rain', wind: 'Wind', sea: 'Sea', fire: 'Fire', cafe: 'Café', train: 'Train', storm: 'Storm', pond: 'Pond', road: 'Road', hum: 'Hum', space: 'Space', tent: 'Rain on a tent', underwater: 'Underwater', shore: 'Shore and gulls', crickets: 'Crickets', forest: 'Birdsong', brown: 'Brown noise', binaural: 'Binaural (headphones)' };
const extras = new Map();   // kind -> { gain, layers, timers, v }
export let level = typeof state.ambience === 'number' ? state.ambience : .35;

function buffer(type) {
  if (buffers[type]) return buffers[type];
  const n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (type === 'white') d[i] = w;
    else { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }   // brown: integrated white, kept in range
  }
  return buffers[type] = b;
}
// A looping noise source through one filter and one gain. `mod(t, w)` returns [gain, freq] each tick.
function noise(type, filter, freq, q, gain, mod) {
  const src = ctx.createBufferSource(); src.buffer = buffer(type); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = filter; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(master); src.start();
  return { g, f, base: gain, mod, stop() { src.stop(); } };
}
function tone(freq, gain) {
  const o = ctx.createOscillator(); o.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = 0;
  o.connect(g); g.connect(master); o.start();
  return { g, base: gain, stop() { o.stop(); } };
}
// Short one-off sounds: a crackle, a plink, a bubble, a thunder roll.
function burst(type, filter, freq, q, gain, attack, decay) {
  const src = ctx.createBufferSource(); src.buffer = buffer(type); src.loopStart = Math.random() * 2; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = filter; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(), t = ctx.currentTime;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + attack + decay);
  src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + attack + decay + .05);
}
function blip(f0, f1, gain, dur) {
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
}
// Repeat fn at random intervals until the scene changes.
function every(min, max, fn) {
  const run = () => { fn(); timers.push(setTimeout(run, (min + Math.random() * (max - min)) * 1000)); };
  timers.push(setTimeout(run, Math.random() * max * 1000));
}

// A quick tone that sweeps between two pitches, starting `delay` seconds from now: a cricket's pulse or a note of birdsong.
function chirp(f0, f1, gain, dur, delay = 0, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(.012, dur / 3)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
}
// A cricket: a train of three or four short pulses at one pitch.
function cricket(f, gain) { const n = 3 + Math.floor(Math.random() * 2); for (let i = 0; i < n; i++) chirp(f, f * .98, gain, .018, i * .034); }
// A phrase of birdsong: a few quick whistled notes, each sliding, the pattern different every time.
function songPhrase() {
  const base = 2200 + Math.random() * 2200, n = 3 + Math.floor(Math.random() * 5), up = Math.random() < .5, g = .012 + Math.random() * .012;
  let at = 0;
  for (let i = 0; i < n; i++) {
    const d = .06 + Math.random() * .1, f = base * (1 + (Math.random() - .5) * .35);
    chirp(f, f * (up ? 1.3 : .72), g, d, at); at += d + .03 + Math.random() * .06;
  }
}

const lfo = (t, rate, ph = 0) => .5 + .5 * Math.sin(t * rate * 6.283 + ph);
// A gull's call: a quick rise then a long falling cry, through a band filter so it sounds far off.
function gull(delay = 0) {
  const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + delay, f0 = 1300 + Math.random() * 400;
  o.type = 'triangle'; f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = 1.4;
  o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.45, t + .07); o.frequency.exponentialRampToValueAtTime(f0 * .65, t + .42);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + .45);
  o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + .5);
}
const RECIPES = {
  rain: () => [
    noise('white', 'lowpass', 1800, .5, .45, (t, w) => [(.25 + .75 * w) * (.9 + .1 * lfo(t, .13)), 1200 + 1800 * w]),
    noise('white', 'bandpass', 4200, .8, .12, (t, w) => [w * (.8 + .2 * lfo(t, .21)), 4200]),
  ],
  wind: () => [
    noise('brown', 'lowpass', 500, .7, .55, t => [.4 + .6 * lfo(t, .06) * lfo(t, .017, 1), 250 + 700 * lfo(t, .05)]),
  ],
  sea: () => [
    noise('brown', 'lowpass', 700, .6, .6, t => [.25 + .75 * Math.pow(lfo(t, .085), 1.6), 400 + 500 * lfo(t, .085)]),
    noise('white', 'bandpass', 2500, .6, .08, t => [Math.pow(lfo(t, .085, .6), 2.2), 2500]),
  ],
  fire: () => { every(.04, .3, () => burst('white', 'bandpass', 2500 + Math.random() * 2500, 1.2, .18 + Math.random() * .2, .004, .03 + Math.random() * .06)); return [noise('brown', 'lowpass', 320, .7, .35, t => [.8 + .2 * lfo(t, .4), 320])]; },
  cafe: () => { every(4, 14, () => blip(2600 + Math.random() * 1500, 2400, .03, .25)); return [noise('brown', 'lowpass', 260, .8, .3, t => [.7 + .3 * lfo(t, .3), 220 + 120 * lfo(t, .11)])]; },
  train: () => {
    let k = 0; every(.55, .55, () => { k++; const hard = k % 4 < 2; burst('brown', 'bandpass', 700, 1, hard ? .35 : .18, .005, .07); });
    return [noise('brown', 'lowpass', 220, .8, .5, t => [.9 + .1 * lfo(t, 1.8), 220])];
  },
  storm: () => { every(14, 40, () => burst('brown', 'lowpass', 110, .5, .9, .4, 2.5 + Math.random() * 2)); return [...RECIPES.rain(), ...RECIPES.wind()]; },
  pond: () => { every(.2, 1.6, () => blip(1500 + Math.random() * 1200, 700 + Math.random() * 300, .06, .18)); return [noise('white', 'lowpass', 1400, .5, .22, (t, w) => [(.3 + .7 * w), 1000 + 1200 * w])]; },
  aquarium: () => { every(.15, 1, () => blip(300 + Math.random() * 200, 800 + Math.random() * 500, .05, .09)); return [noise('brown', 'lowpass', 180, .8, .28, t => [.85 + .15 * lfo(t, .5), 180])]; },
  road: () => [noise('brown', 'lowpass', 200, .8, .4, t => [.8 + .2 * lfo(t, .05), 160 + 120 * lfo(t, .08)])],
  hum: () => [noise('brown', 'lowpass', 150, .8, .3, t => [.9 + .1 * lfo(t, .04), 150]), tone(55, .05), tone(82.5, .025)],
  brown: () => [noise('brown', 'lowpass', 900, .5, .6, null)],
  // Two steady tones, one in each ear, ten hertz apart: the beat between them is an alpha rhythm. Needs headphones.
  binaural: () => {
    const mk = (f, pan) => { const o = ctx.createOscillator(); o.frequency.value = f; const p = ctx.createStereoPanner(); p.pan.value = pan; const g = ctx.createGain(); g.gain.value = 0; o.connect(p); p.connect(g); g.connect(master); o.start(); return { g, base: .12, stop() { o.stop(); } }; };
    return [mk(200, -1), mk(210, 1), noise('brown', 'lowpass', 400, .5, .08, null)];
  },
  space: () => [noise('brown', 'lowpass', 110, .8, .25, t => [.7 + .3 * lfo(t, .03), 90 + 60 * lfo(t, .021)]), tone(55, .07), tone(55.7, .05), tone(110.3, .02)],
  // Rain on the fly sheet, heard from inside: close, dull taps on taut fabric over a soft hiss, heavier with the weather.
  tent: () => {
    every(.03, .09, () => { if (Math.random() < .35 + .6 * weather) burst('white', 'bandpass', 900 + Math.random() * 1400, 2.2, .1 + Math.random() * .14, .002, .05 + Math.random() * .05); });
    return [noise('white', 'lowpass', 1100, .5, .22, (t, w) => [(.3 + .7 * w) * (.9 + .1 * lfo(t, .11)), 800 + 700 * w]), noise('brown', 'lowpass', 160, .7, .25, t => [.7 + .3 * lfo(t, .07), 160])];
  },
  // Under the sea: a deep muffled swell that comes and goes, and the odd low bubble.
  underwater: () => {
    every(1.5, 6, () => blip(160 + Math.random() * 120, 420 + Math.random() * 200, .04, .12));
    return [noise('brown', 'lowpass', 140, .9, .5, t => [.35 + .65 * Math.pow(lfo(t, .07), 1.5), 90 + 90 * lfo(t, .07)]), noise('white', 'lowpass', 420, .6, .05, t => [lfo(t, .07, .5), 420])];
  },
  // A sheltered shore: small waves lapping close and quick, with gulls now and then.
  shore: () => {
    every(9, 28, () => { const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) gull(i * (.5 + Math.random() * .3)); });
    return [noise('brown', 'lowpass', 600, .6, .45, t => [.3 + .7 * Math.pow(lfo(t, .16), 2), 350 + 400 * lfo(t, .16)]), noise('white', 'bandpass', 3000, .7, .06, t => [Math.pow(lfo(t, .16, .7), 3), 3000])];
  },
  // A warm night: crickets near and far, each with its own pitch and pace, over a faint breeze.
  crickets: () => {
    for (let i = 0; i < 4; i++) { const f = 3900 + Math.random() * 1100, g = .006 + Math.random() * .012, gap = .5 + Math.random() * .5; every(gap * .8, gap * 1.3, () => { if (Math.random() < .85) cricket(f, g); }); }
    return [noise('brown', 'lowpass', 380, .6, .22, t => [.6 + .4 * lfo(t, .05), 300 + 150 * lfo(t, .03)])];
  },
  // Woodland by day: leaves in the wind and birds calling, near and far.
  forest: () => {
    every(1.2, 5, songPhrase);
    every(6, 18, () => { const f = 1100 + Math.random() * 300; chirp(f, f * .8, .02, .35); chirp(f * .8, f * .78, .016, .5, .5); });   // a wood pigeon, far off
    return [noise('white', 'bandpass', 1600, .5, .07, t => [.4 + .6 * Math.pow(lfo(t, .07), 2), 1300 + 600 * lfo(t, .05)]), noise('brown', 'lowpass', 300, .7, .2, t => [.6 + .4 * lfo(t, .04), 300])];
  },
  none: () => [],
};

function ensure() {
  if (ctx) return true;
  ctx = audioCtx(); if (!ctx) return false;
  bus = ctx.createGain(); bus.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = level; master.connect(bus);
  setInterval(() => {
    const t = performance.now() / 1000, w = weather;
    for (const L of [...live, ...[...extras.values()].flatMap(x => x.layers)]) if (L.mod && !L.fading) { const [g, f] = L.mod(t, w); L.g.gain.setTargetAtTime(L.base * g, ctx.currentTime, .15); if (L.f && f) L.f.frequency.setTargetAtTime(f, ctx.currentTime, .3); }
  }, 100);
  return true;
}
function fadeOut(layers) {
  for (const L of layers) { L.fading = true; L.g.gain.cancelScheduledValues(ctx.currentTime); L.g.gain.setTargetAtTime(0, ctx.currentTime, .6); }
  setTimeout(() => layers.forEach(L => { try { L.stop(); } catch (e) {} }), 3000);
}
function build() {
  timers.forEach(clearTimeout); timers = [];
  fadeOut(live); live = [];
  if (!ensure() || level <= 0) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  live = (RECIPES[kind] || RECIPES.none)();
  for (const L of live) { const g = L.mod ? L.mod(performance.now() / 1000, weather)[0] : 1; L.g.gain.setTargetAtTime(L.base * g, ctx.currentTime, 1.2); }
}

// The scene's sound. Nothing plays until the viewer has interacted with the page (see start()).
let armed = false;
export function setAmbienceKind(k) { kind = KINDS.includes(k) ? k : 'none'; if (armed) build(); }
export function setAmbienceLevel(v) {
  level = Math.max(0, Math.min(1, v)); saveState({ ambience: level });
  if (!armed) return;
  if (master) master.gain.setTargetAtTime(level, ctx.currentTime, .2);
  if (level > 0 && !live.length) build(); else if (level <= 0 && live.length) { fadeOut(live); live = []; timers.forEach(clearTimeout); timers = []; }
}
// The sleep timer mutes the layers over a long ramp without forgetting the level.
export function setAmbienceMute(on, seconds = 1) { if (bus) bus.gain.setTargetAtTime(on ? 0 : 1, ctx.currentTime, Math.max(.05, seconds / 3)); }
function startExtra(k, v) {
  if (!ensure() || extras.has(k) || !RECIPES[k]) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(bus);
  const saveM = master, saveT = timers; master = gain; timers = [];
  const layers = RECIPES[k](); const t = timers; master = saveM; timers = saveT;
  for (const L of layers) { const g = L.mod ? L.mod(performance.now() / 1000, weather)[0] : 1; L.g.gain.setTargetAtTime(L.base * g, ctx.currentTime, 1.2); }
  gain.gain.setTargetAtTime(v, ctx.currentTime, .8);
  extras.set(k, { gain, layers, timers: t, v });
}
function stopExtra(k) {
  const x = extras.get(k); if (!x) return;
  x.timers.forEach(clearTimeout); x.gain.gain.setTargetAtTime(0, ctx.currentTime, .4);
  setTimeout(() => x.layers.forEach(L => { try { L.stop(); } catch (e) {} }), 2500); extras.delete(k);
}
const savedExtras = () => (state.extras || []).filter(x => EXTRA_KINDS[x.k]);
export const extraList = () => savedExtras();
export function addExtra(k) { const list = savedExtras().filter(x => x.k !== k); list.push({ k, v: .4 }); saveState({ extras: list }); if (armed) startExtra(k, .4); }
export function removeExtra(k) { saveState({ extras: savedExtras().filter(x => x.k !== k) }); stopExtra(k); }
export function setExtraLevel(k, v) {
  saveState({ extras: savedExtras().map(x => x.k === k ? { k, v } : x) });
  const x = extras.get(k); if (x) { x.v = v; x.gain.gain.setTargetAtTime(v, ctx.currentTime, .15); }
}
export const ambienceState = () => ({ kind, level, layers: live.length });
// Called from the first pointer or key event: browsers only let sound start after a gesture.
export function startAmbience() { if (armed) return; armed = true; build(); for (const x of savedExtras()) startExtra(x.k, x.v); }
