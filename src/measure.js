// Measures how energetic a track is, on the device, from about a minute of its sound: loudness, how much it moves
// (the strength of its onsets) and its tempo. Used only to suggest a soundtrack; the viewer always has the last word.
// Decodes two windows, the start and the middle of the file, so a quiet intro doesn't make a lively track read as calm,
// and a long track costs no more than a short one. The livelier window counts. Returns {} when it can't decode.
const norm = (v, lo, hi) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));

export async function measure(file) {
  const a = await window_(file, 0);
  // The middle slice only decodes for formats that can start anywhere (MP3); the rest keep the start.
  let b = {}; if (file.size > 7000000) { try { b = await window_(file, Math.floor(file.size / 2)); } catch (e) { b = {}; } }
  if (typeof b.energy === 'number' && (typeof a.energy !== 'number' || b.energy > a.energy)) return b;
  return a;
}
async function window_(file, at) {
  const buf = await file.slice(at, at + 2800000).arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 22050);
  const ab = await ctx.decodeAudioData(buf);
  const d = ab.getChannelData(0), sr = ab.sampleRate;
  const start = d.length > sr * 40 ? Math.floor(sr * 10) : 0;              // skip a quiet intro when there is enough
  const end = Math.min(d.length, start + sr * 60), hop = 512;
  const rms = [];
  for (let i = start; i + hop <= end; i += hop) { let s = 0; for (let k = i; k < i + hop; k++) s += d[k] * d[k]; rms.push(Math.sqrt(s / hop)); }
  if (rms.length < 64) return {};
  const mean = rms.reduce((a, v) => a + v, 0) / rms.length;
  const flux = rms.map((v, i) => i ? Math.max(0, v - rms[i - 1]) : 0);
  const fluxMean = flux.reduce((a, v) => a + v, 0) / flux.length;
  // Tempo: the lag between 60 and 180 bpm at which the onsets line up best with themselves.
  const fps = sr / hop, f = flux.map(v => v - fluxMean);
  let best = 0, bestLag = 0, zero = 0;
  for (let i = 0; i < f.length; i++) zero += f[i] * f[i];
  for (let lag = Math.round(fps * 60 / 180); lag <= Math.round(fps * 60 / 60); lag++) {
    let s = 0; for (let i = lag; i < f.length; i++) s += f[i] * f[lag > 0 ? i - lag : i];
    if (s > best) { best = s; bestLag = lag; }
  }
  const bpm = bestLag ? Math.round(60 * fps / bestLag) : 0, beat = zero ? best / zero : 0;
  const loud = 20 * Math.log10(mean + 1e-6);
  // Onset density: how many clear attacks per second, relative to the track's own level.
  const thr = fluxMean * 2.5; let hits = 0; for (let i = 1; i < flux.length - 1; i++) if (flux[i] > thr && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) hits++;
  const rate = hits / (flux.length / fps);
  // A steady beat counts most, then how busy it is; loudness mostly reflects mastering, so it counts least.
  const energy = .6 * norm(beat, .07, .25) + .3 * norm(rate, 3.5, 6.3) + .1 * norm(loud, -26, -10);
  return { energy: +energy.toFixed(2), bpm: beat > .12 ? bpm : 0 };
}
