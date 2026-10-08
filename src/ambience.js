// Ambient sound, generated in Web Audio from filtered noise and a few sine blips: nothing to download, nothing to license.
// Each scene names a kind in its metadata; the layers crossfade when the scene changes, and some follow the weather.
import { audioCtx } from './music.js';
import { weather } from './weather.js';
import { state, saveState } from './state.js';

export const KINDS = ['none', 'rain', 'wind', 'sea', 'fire', 'cafe', 'train', 'storm', 'pond', 'aquarium', 'road', 'hum', 'space'];

let ctx = null, master = null, buffers = {}, live = [], timers = [], kind = 'none', tick = null;
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

const lfo = (t, rate, ph = 0) => .5 + .5 * Math.sin(t * rate * 6.283 + ph);
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
  space: () => [noise('brown', 'lowpass', 110, .8, .25, t => [.7 + .3 * lfo(t, .03), 90 + 60 * lfo(t, .021)]), tone(55, .07), tone(55.7, .05), tone(110.3, .02)],
  none: () => [],
};

function ensure() {
  if (ctx) return true;
  ctx = audioCtx(); if (!ctx) return false;
  master = ctx.createGain(); master.gain.value = level; master.connect(ctx.destination);
  tick = setInterval(() => {
    const t = performance.now() / 1000, w = weather;
    for (const L of live) if (L.mod && !L.fading) { const [g, f] = L.mod(t, w); L.g.gain.setTargetAtTime(L.base * g, ctx.currentTime, .15); if (L.f && f) L.f.frequency.setTargetAtTime(f, ctx.currentTime, .3); }
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
// Called from the first pointer or key event: browsers only let sound start after a gesture.
export function startAmbience() { if (armed) return; armed = true; build(); }
