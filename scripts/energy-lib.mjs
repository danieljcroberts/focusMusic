// Shared by scripts/analyse-music.mjs: loudness, tempo and beat strength of an MP3 from a 1.8 MB slice of it.
// Energy of a track from 40 s in the middle: loudness (dBFS), tempo (BPM) and beat strength, from an onset envelope.
import { spawn } from 'node:child_process';
export async function analyse(url) {
  // A slice from about a third of the way in, decoded from stdin (this ffmpeg has no https).
  let body;
  try {
    if (!/^https?:/.test(url)) {   // a local file
      const { readFileSync } = await import('node:fs'); const all = readFileSync(url), st = Math.floor(all.length * .35);
      body = all.subarray(st, st + 1800000);
    } else {
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow' }), size = Number(head.headers.get('content-length')) || 0;
    const start = Math.floor(size * .35), r = await fetch(url, { headers: { Range: `bytes=${start}-${start + 1800000}` }, redirect: 'follow' });
    body = Buffer.from(await r.arrayBuffer());
    }
  } catch (e) { return null; }
  return new Promise(res => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-t', '40', '-ac', '1', '-ar', '11025', '-f', 's16le', '-']);
    ff.stdin.on('error', () => {}); ff.stdin.end(body);
    const chunks = []; ff.stdout.on('data', c => chunks.push(c));
    const kill = setTimeout(() => ff.kill('SIGKILL'), 60000);
    ff.on('close', () => {
      clearTimeout(kill);
      const buf = Buffer.concat(chunks), n = buf.length >> 1;
      if (n < 11025 * 15) return res(null);
      const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = buf.readInt16LE(i * 2) / 32768;
      let sq = 0; for (let i = 0; i < n; i++) sq += x[i] * x[i];
      const db = 10 * Math.log10(sq / n + 1e-12);
      // Onset envelope: energy per 256-sample hop (about 43 a second) of a crude low-passed signal (the kick) and of the
      // whole signal, then its autocorrelation over the lags for 70 to 190 BPM, refined between lags so the tempo isn't
      // stuck on the steps of the hop (which at drum and bass speeds are several BPM apart).
      const hop = 256, m = Math.floor(n / hop), env = new Float32Array(m), lowE = new Float32Array(m);
      let lp = 0;
      for (let k = 0; k < m; k++) { let e = 0, el = 0; for (let i = k * hop; i < (k + 1) * hop; i++) { lp += (x[i] - lp) * .06; e += x[i] * x[i]; el += lp * lp; } env[k] = e; lowE[k] = el; }
      const flux = new Float32Array(m); for (let k = 1; k < m; k++) flux[k] = Math.max(0, Math.sqrt(lowE[k]) - Math.sqrt(lowE[k - 1])) + .5 * Math.max(0, Math.sqrt(env[k]) - Math.sqrt(env[k - 1]));
      let mean = 0; for (const v of flux) mean += v; mean /= m; for (let k = 0; k < m; k++) flux[k] -= mean;
      const fps = 11025 / hop; let sum0 = 0; for (const v of flux) sum0 += v * v;
      const lo = Math.floor(fps * 60 / 190), hi = Math.ceil(fps * 60 / 70), r = new Float32Array(hi + 2);
      for (let L = lo - 1; L <= hi + 1; L++) { let s = 0; for (let k = L; k < m; k++) s += flux[k] * flux[k - L]; r[L] = s / (sum0 || 1); }
      let L0 = -1; for (let L = lo; L <= hi; L++) if (r[L] >= r[L - 1] && r[L] >= r[L + 1] && (L0 < 0 || r[L] > r[L0])) L0 = L;   // the strongest true peak, not an edge of the range
      if (L0 < 0) return res({ db: +db.toFixed(1), bpm: 0, beat: 0 });
      const den = r[L0 - 1] - 2 * r[L0] + r[L0 + 1], lag = L0 + (den < 0 ? .5 * (r[L0 - 1] - r[L0 + 1]) / den : 0);
      const best = r[L0], bestBpm = fps * 60 / lag;
      let tempo = bestBpm; if (tempo < 100) tempo *= 2;   // half-time reads as double for workouts
      res({ db: +db.toFixed(1), bpm: +tempo.toFixed(1), beat: +best.toFixed(2) });
    });
  });
}
import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2]) console.log(await analyse(process.argv[2]));   // run directly: node scripts/energy-lib.mjs file-or-url
