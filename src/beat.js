// A beat clock locked to the music: it counts beats at the track's tempo and nudges itself onto the kicks it hears.
// Each frame it is given the onset strength of the low end (how much the bass rose since the last frame) and the
// track's measured tempo, if known. Peaks in the onset strength are kicks. Where in the beat each one lands goes into a
// histogram weighted by its strength, so the beat is wherever the strongest, most regular hits are, not an off-beat bass
// or a hat; once found, kicks near it fine-tune the phase (a phase-locked loop) and trim the tempo so it doesn't drift.
// Without a measured tempo it estimates one from the last eight seconds
// of onsets. It also learns which beat of four the strongest kicks fall on, so a stroke every four beats starts on the one.
// Pure arithmetic with no audio code, so the tests can drive it with made-up kicks.

const RATE = 50, SPAN = 8 * RATE;   // the onset history for estimating tempo: 50 samples a second, eight seconds
const BINS = 20;                    // where in the beat onsets land, in twentieths of a beat
const wrap = x => x - Math.round(x); // to between -0.5 and 0.5

export class BeatClock {
  constructor() { this.reset(); }
  reset() {
    this.t = 0; this.raw = 0; this.off = 0; this.shown = 0; this.hist = new Float32Array(BINS); this.bpm = 120; this.trim = 0;
    this.lock = 0;                                 // 0 to 1: how many recent beats had a kick on them
    this.beatNo = 0; this.hit = false;
    this.bar = [0, 0, 0, 0]; this.one = 0;         // strength of kicks on each beat of the bar, and the strongest
    this.prev = 0; this.prev2 = 0; this.mean = 0; this.dev = .02; this.lastOnset = -1;
    this.env = new Float32Array(SPAN); this.envAt = 0; this.envSlot = 0; this.live = 0; this.liveConf = 0; this.sinceEst = 0;
  }
  // A new track: keep counting (no jump on screen) but forget the lock and the bar.
  newTrack() { this.lock = 0; this.trim = 0; this.hist.fill(0); this.bar = [0, 0, 0, 0]; this.liveConf = 0; this.env.fill(0); }

  tempo(measured) {
    const base = measured || (this.liveConf > .3 ? this.live : 0) || 120;
    return base * (1 + this.trim);
  }

  // flux: onset strength this frame (0 and up); dt: seconds since the last frame; measured: the track's BPM or 0;
  // listening: whether there is real audio to listen to (otherwise the clock just runs on).
  update(flux, dt, measured = 0, listening = true) {
    dt = Math.min(dt, .25); this.t += dt;
    this.bpm = this.tempo(measured);
    const perSec = this.bpm / 60;
    this.raw += dt * perSec;
    const n = Math.floor(this.raw - this.off + .25);   // a beat counts as missed a quarter beat after it passes
    if (n !== this.beatNo) { if (!this.hit) this.lock *= .9; this.hit = false; this.beatNo = n; }
    if (listening) {
      this.history(flux, dt);
      // A kick is a local peak in onset strength, well above its recent level, not too soon after the last one.
      const thr = this.mean + 2.2 * this.dev + .01, at = this.t - dt;
      if (this.prev > thr && this.prev >= flux && this.prev > this.prev2 && at - this.lastOnset > .3 / perSec) {
        this.onset(this.prev, this.raw - 1.5 * dt * perSec);   // the kick came, on average, half a frame before the frame that heard it
        this.lastOnset = at;
      }
      const k = Math.min(1, dt * 1.5);   // the recent level and spread, over a second or so
      this.mean += (flux - this.mean) * k; this.dev += (Math.abs(flux - this.mean) - this.dev) * k;
      this.prev2 = this.prev; this.prev = flux;
      if (!measured && (this.sinceEst += dt) > 1) { this.sinceEst = 0; this.estimate(); }
    } else this.lock *= Math.max(0, 1 - dt * .2);
    // What the scenes see: the phase, eased so corrections never jump.
    this.shown += dt * perSec;
    const gap = this.raw - this.off - this.shown;
    this.shown += Math.abs(gap) > 2 ? gap : gap * Math.min(1, dt * 5);
    return this.shown;
  }

  // An onset at raw phase `raw`: where it fell in the beat, and how far from where the clock puts the beat.
  onset(strength, raw) {
    const f = raw - Math.floor(raw), bin = Math.floor(f * BINS) % BINS, w = strength * strength;
    for (let i = 0; i < BINS; i++) this.hist[i] *= .96;
    this.hist[bin] += w; this.hist[(bin + 1) % BINS] += w * .5; this.hist[(bin + BINS - 1) % BINS] += w * .5;
    // The beat is the strongest place in the histogram; move there if it is clearly stronger than where we are.
    let peak = 0; for (let i = 1; i < BINS; i++) if (this.hist[i] > this.hist[peak]) peak = i;
    const here = Math.floor((((this.off % 1) + 1) % 1) * BINS) % BINS;
    const pc = (peak + .5) / BINS, d = wrap(pc - this.off);
    if (Math.abs(d) > .12 && this.hist[peak] > this.hist[here] * 1.4) { this.off += d; this.lock *= .5; this.beatNo = Math.floor(this.raw - this.off + .25); }
    // Fine tuning from onsets near the beat.
    const e = wrap(raw - this.off), near = Math.abs(e) < .12;
    if (near) {
      if (!this.hit) { this.lock += (1 - this.lock) * .12; this.hit = true; }
      this.off += e * .2;
      this.trim = Math.max(-.04, Math.min(.04, this.trim - e * .012));
      const b = ((Math.round(raw - this.off) % 4) + 4) % 4;
      for (let i = 0; i < 4; i++) this.bar[i] *= .97;
      this.bar[b] += strength;
      const best = this.bar.indexOf(Math.max(...this.bar));
      if (this.bar[best] > this.bar[this.one] * 1.3) this.one = best;
    }
  }

  // Beats counted from the one: a stroke every n beats lands on the bar's first beat.
  fromOne() { return this.shown - this.one; }

  // The onset history, sampled evenly in time so the tempo estimate doesn't depend on the frame rate.
  history(flux, dt) {
    this.envAt += dt * RATE;
    while (this.envAt >= 1) { this.envAt -= 1; this.envSlot = (this.envSlot + 1) % SPAN; this.env[this.envSlot] = 0; }
    this.env[this.envSlot] = Math.max(this.env[this.envSlot], flux);
  }
  // Tempo from the onset history: the lag (between 70 and 180 BPM) at which it best matches itself, refined between
  // samples, with lags near 120 BPM preferred a little to settle between a tempo and its double or half.
  estimate() {
    const n = SPAN, x = new Float32Array(n);
    let m = 0; for (let i = 0; i < n; i++) { x[i] = this.env[(this.envSlot + 1 + i) % n]; m += x[i]; }
    m /= n; let v = 0; for (let i = 0; i < n; i++) { x[i] -= m; v += x[i] * x[i]; }
    if (v < 1e-6) { this.liveConf *= .8; return; }
    const lo = Math.floor(RATE * 60 / 180), hi = Math.ceil(RATE * 60 / 70), r = [];
    for (let lag = lo - 1; lag <= hi + 1; lag++) { let s = 0; for (let i = lag; i < n; i++) s += x[i] * x[i - lag]; r[lag] = s / v; }
    let best = -1, bestS = -Infinity;
    for (let lag = lo; lag <= hi; lag++) {
      const bpm = RATE * 60 / lag, w = Math.exp(-.5 * Math.pow(Math.log2(bpm / 120) / .9, 2));
      const s = r[lag] * (.6 + .4 * w);
      if (s > bestS && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) { bestS = s; best = lag; }
    }
    if (best < 0) return;
    const a = r[best - 1], b = r[best], c = r[best + 1], den = a - 2 * b + c;
    const lag = best + (den ? .5 * (a - c) / den : 0), bpm = RATE * 60 / lag;
    this.liveConf += ((r[best] > .15 ? 1 : 0) - this.liveConf) * .3;
    this.live = this.live ? this.live + (bpm - this.live) * (Math.abs(bpm - this.live) > 8 ? 1 : .3) : bpm;
  }
}
