// 80s: music visualisers after 1984 album covers, neon night drives, vector monitors, laser shows and Memphis prints.
import { W, H, ctx, lowPower, lively } from '../view.js';
import { rand, hash, mix, rgb, layer, glow, plain } from '../util.js';
import { bands, musicLevel, spectrum, waveform, musicPlaying } from '../music.js';

const TAU = Math.PI * 2;
const wrap = (v, n) => ((v % n) + n) % n;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const hsv = (h, s, v) => {
  const f = n => { const k = (n + h * 6) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return [f(5), f(3), f(1)];
};

// The music as these scenes hear it: the real bands while something plays, a gentle made-up groove when it is quiet.
function listener() {
  let slow = 0, cool = 0, kick = 0, beats = 0, idleBeat = -1;
  const o = { bass: 0, mid: 0, treble: 0, level: 0, kick: 0, beat: false, beats: 0, live: false };
  return (t, dt) => {
    o.live = musicLevel > .02 || bands.bass + bands.mid + bands.treble > .03;
    o.beat = false; cool -= dt;
    if (o.live) {
      o.bass = bands.bass; o.mid = bands.mid; o.treble = bands.treble;
      o.level = Math.max(musicLevel, (bands.bass + bands.mid) * .5);
      slow += (o.bass - slow) * Math.min(1, dt * 1.6);
      if (cool <= 0 && o.bass > .18 && o.bass - slow > .06) { o.beat = true; cool = .3; }
    } else {
      const bp = t * 1.45, ph = wrap(bp, 1), n = Math.floor(bp);
      if (n !== idleBeat) { idleBeat = n; o.beat = true; }
      o.bass = .2 + .2 * Math.exp(-ph * 6); o.mid = .3 + .12 * Math.sin(t * .7);
      o.treble = .2 + .1 * Math.sin(t * 1.3 + 1); o.level = .3 + .08 * Math.sin(t * .4);
    }
    if (o.beat) { kick = 1; beats++; }
    kick *= Math.exp(-dt * 4.5);
    o.kick = kick; o.beats = beats;
    return o;
  };
}

// 64 bands, low to high, 0..1, grouped from the analyser; or made up from sines when nothing is playing.
const realSpec = new Float32Array(64), fakeSpec = new Float32Array(64);
function spec64(t, s) {
  const d = spectrum(); let sum = 0;
  for (let i = 0; i < 64; i++) {
    const a = Math.floor(Math.pow(i / 64, 1.6) * 200), b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / 64, 1.6) * 200));
    let m = 0; for (let k = a; k < b; k++) if (d[k] > m) m = d[k];
    realSpec[i] = m / 255; sum += m;
  }
  if (sum > 0) return realSpec;
  for (let i = 0; i < 64; i++) {
    const v = (.6 - i / 64 * .35) * (.55 + .45 * Math.sin(t * (.9 + i * .07) + i * 1.7)) + (i < 10 ? s.bass * .5 : 0);
    fakeSpec[i] = clamp(v, 0, 1);
  }
  return fakeSpec;
}
// 256 samples of the waveform, -1..1; a soft sum of sines when it is flat.
const realWave = new Float32Array(256), fakeWave = new Float32Array(256);
function wave256(t, s) {
  const d = waveform(); let dev = 0;
  for (let i = 0; i < 256; i++) { const v = ((d[i * 2] ?? 128) - 128) / 128; realWave[i] = v; dev += Math.abs(v); }
  if (dev > 1.5) return realWave;
  const a = .25 + .5 * s.bass;
  for (let i = 0; i < 256; i++) {
    const x = i / 256;
    fakeWave[i] = a * (.6 * Math.sin(x * TAU * 3 + t * 2.1) + .3 * Math.sin(x * TAU * 7 - t * 3.3) + .15 * Math.sin(x * TAU * 13 + t * 5));
  }
  return fakeWave;
}

/* Synthwave Sunset */
export function synthwaveScene() {
  const hear = listener();
  let sky, hills, floor, haze, sunDisc, sunBuf, sunG, vGrad, vGlow, R = 0, hy = 0, scroll = 0, twinkle = [];
  return {
    init() {
      const m = Math.min(W, H), land = W > H;
      hy = H * (land ? .58 : .56);
      R = m * (land ? .3 : .36);
      let g; [sky, g] = layer(W, hy + 2);
      let gr = g.createLinearGradient(0, 0, 0, hy);
      gr.addColorStop(0, '#08021c'); gr.addColorStop(.4, '#24093f'); gr.addColorStop(.75, '#5c1764'); gr.addColorStop(1, '#b8337a');
      g.fillStyle = gr; g.fillRect(0, 0, W, hy + 2);
      for (let i = 0; i < (W * hy) / 2600; i++) {
        const y = Math.pow(Math.random(), 1.6) * hy * .8;
        g.fillStyle = `rgba(255,230,255,${rand(.15, .75) * (1 - y / hy)})`;
        g.beginPath(); g.arc(rand(0, W), y, rand(.3, 1.1), 0, TAU); g.fill();
      }
      twinkle = Array.from({ length: 22 }, () => ({ x: rand(0, W), y: Math.pow(Math.random(), 1.5) * hy * .6, p: rand(0, TAU), s: rand(.4, 1.1) }));
      // Mountains: a far violet range and a near one laid out in magenta wireframe, low in the middle for the sun.
      [hills, g] = layer(W, hy + 1);
      const range = (maxH, step, seed, fill, wire, edge) => {
        const pts = [];
        for (let x = -step, k = 0; x <= W + step; x += step, k++) {
          const side = Math.pow(Math.abs(x - W / 2) / (W / 2), 1.2);
          const h = maxH * (.08 + .92 * side) * (k % 2 ? .5 + .25 * hash(k, seed) : .8 + .2 * hash(k, seed + 1));
          pts.push([x + (hash(k, seed + 2) - .5) * step * .5, hy - h]);
        }
        g.fillStyle = fill; g.beginPath(); g.moveTo(-step, hy + 1);
        for (const p of pts) g.lineTo(p[0], p[1]);
        g.lineTo(W + step, hy + 1); g.fill();
        g.strokeStyle = wire; g.lineWidth = 1; g.beginPath();
        for (let f = 1; f < 4; f++) {
          const q = f / 4;
          pts.forEach((p, i) => { const y = p[1] + (hy - p[1]) * q; if (i) g.lineTo(p[0], y); else g.moveTo(p[0], y); });
        }
        for (let i = 0; i < pts.length - 1; i++) {
          const [x, y] = pts[i], nx = pts[i + 1][0];
          g.moveTo(x, y); g.lineTo(x - (nx - x) * .5, hy); g.moveTo(x, y); g.lineTo(x + (nx - x) * .5, hy);
        }
        g.stroke();
        g.strokeStyle = edge; g.lineWidth = 1.6; g.beginPath();
        pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
      };
      range(hy * .3, m * .07, 3, '#2a0c4a', 'rgba(170,80,255,.22)', 'rgba(190,110,255,.5)');
      range(hy * .18, m * .055, 9, '#12031f', 'rgba(255,60,200,.35)', 'rgba(255,90,220,.9)');
      [floor, g] = layer(W, H - hy + 1);
      gr = g.createLinearGradient(0, 0, 0, H - hy);
      gr.addColorStop(0, '#2a0838'); gr.addColorStop(.25, '#140320'); gr.addColorStop(1, '#07010d');
      g.fillStyle = gr; g.fillRect(0, 0, W, H - hy + 1);
      g.save(); g.scale(1, .35); glow(g, W / 2, 0, R * 1.6, [255, 80, 150], .35); g.restore();
      [haze, g] = layer(W, H);
      gr = g.createLinearGradient(0, hy - H * .06, 0, hy + H * .05);
      gr.addColorStop(0, 'rgba(255,90,170,0)'); gr.addColorStop(.6, 'rgba(255,120,190,.22)'); gr.addColorStop(1, 'rgba(255,90,170,0)');
      g.fillStyle = gr; g.fillRect(0, hy - H * .06, W, H * .11);
      g.fillStyle = 'rgba(0,0,0,.13)';
      for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
      [sunDisc, g] = layer(2 * R, 2 * R);
      gr = g.createLinearGradient(0, 0, 0, 2 * R);
      gr.addColorStop(0, '#fff07a'); gr.addColorStop(.35, '#ffb347'); gr.addColorStop(.65, '#ff4f8b'); gr.addColorStop(1, '#c41a8c');
      g.fillStyle = gr; g.beginPath(); g.arc(R, R, R, 0, TAU); g.fill();
      [sunBuf, sunG] = layer(2 * R, 2 * R);
      vGrad = ctx.createLinearGradient(0, hy, 0, H);
      vGrad.addColorStop(0, 'rgba(255,60,210,0)'); vGrad.addColorStop(.06, 'rgba(255,60,210,.08)'); vGrad.addColorStop(.25, 'rgba(255,70,215,.6)'); vGrad.addColorStop(1, 'rgba(255,110,230,1)');
      vGlow = ctx.createLinearGradient(0, hy, 0, H);
      vGlow.addColorStop(0, 'rgba(255,40,200,0)'); vGlow.addColorStop(.2, 'rgba(255,40,200,.2)'); vGlow.addColorStop(1, 'rgba(255,40,200,1)');
    },
    draw(t, dt) {
      const s = hear(t, dt), m = Math.min(W, H), cx = W / 2;
      scroll += dt * (.45 + 1.8 * s.bass + (lively ? .6 : 0) + .6 * s.kick);
      ctx.drawImage(sky, 0, 0, W, hy + 2);
      ctx.globalCompositeOperation = 'lighter';
      for (const st of twinkle) {
        const a = .25 + .55 * Math.pow(.5 + .5 * Math.sin(t * st.s + st.p), 3);
        ctx.fillStyle = `rgba(255,235,255,${a})`; ctx.fillRect(st.x - .8, st.y - .8, 1.6, 1.6);
      }
      // The sun: a gradient disc with horizontal cut-outs that widen downward and ripple with the mids.
      const cy = hy - R * .5;
      glow(ctx, cx, cy, R * 2, [255, 70, 150], .28 + .25 * s.level);
      ctx.globalCompositeOperation = 'source-over';
      sunG.clearRect(0, 0, 2 * R, 2 * R);
      sunG.drawImage(sunDisc, 0, 0, 2 * R, 2 * R);
      sunG.globalCompositeOperation = 'destination-out'; sunG.fillStyle = '#000';
      const drift = wrap(t * .06, 1), amp = R * (.006 + .03 * s.mid), seg = 20;
      for (let k = -1; k < 9; k++) {
        const p = (k + drift) / 9, y = R * (.98 + p * 1.05), th = R * (.012 + .07 * p * p) * (1 + .5 * s.mid);
        if (y < R * .9) continue;
        sunG.beginPath();
        for (let j = 0; j <= seg; j++) { const x = j / seg * 2 * R; sunG.lineTo(x, y + amp * Math.sin(x / R * 5 + t * 1.6 + k)); }
        for (let j = seg; j >= 0; j--) { const x = j / seg * 2 * R; sunG.lineTo(x, y + th + amp * Math.sin(x / R * 5 + t * 1.6 + k + .6)); }
        sunG.fill();
      }
      sunG.globalCompositeOperation = 'source-over';
      ctx.drawImage(sunBuf, cx - R, cy - R, 2 * R, 2 * R);
      ctx.drawImage(hills, 0, 0, W, hy + 1);
      ctx.drawImage(floor, 0, hy, W, H - hy + 1);
      // The grid: lines converge on the horizon, cross-lines race toward the viewer with the bass.
      ctx.globalCompositeOperation = 'lighter';
      const sx = m * .13, gh = H - hy, N = Math.ceil(W / sx * 3), zf = 40, zn = .25;
      const vertical = () => {
        ctx.beginPath();
        for (let i = -N; i <= N; i++) { ctx.moveTo(cx + i * sx / zf, hy + gh / zf); ctx.lineTo(cx + i * sx / zn, hy + gh / zn); }
        ctx.stroke();
      };
      const gl = .25 + .5 * s.bass + .25 * s.kick;
      ctx.strokeStyle = vGlow; ctx.globalAlpha = .1 + .22 * gl; ctx.lineWidth = 4 + 4 * s.bass; vertical();
      ctx.strokeStyle = vGrad; ctx.globalAlpha = .65 + .35 * gl; ctx.lineWidth = 1.3; vertical();
      const fr = scroll % 1;
      for (let k = 0; k < 24; k++) {
        const z = k + 1 - fr; if (z < .8) continue;
        const y = hy + gh / z, a = Math.pow(smooth(22, 2, z), 1.5) * (.55 + .45 * gl);
        ctx.strokeStyle = `rgba(255,70,215,${a * .25})`; ctx.globalAlpha = 1; ctx.lineWidth = 4 + 4 * s.bass;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.strokeStyle = `rgba(255,140,235,${a})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Horizon: a line of light that swells with the level.
      ctx.save(); ctx.translate(cx, hy); ctx.scale(1, .12);
      glow(ctx, 0, 0, W * .7, [255, 120, 180], .25 + .4 * s.level);
      ctx.restore();
      ctx.fillStyle = `rgba(255,200,240,${.35 + .4 * s.level})`; ctx.fillRect(0, hy - .5, W, 1.2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(haze, 0, 0, W, H);
    }
  };
}

/* Neon Highway */
export function neonHighwayScene() {
  const hear = listener();
  let sky, palm, hy = 0, S = 0, Sx = 0, Ch = 2.2, travel = 0, speed = 10, ground;
  const D = 4.5, NEON = [[255, 60, 190], [60, 230, 255]];
  return {
    init() {
      const m = Math.min(W, H);
      hy = H * (W > H ? .5 : .52);
      S = (H - hy) / Ch; Sx = Math.min(S, W * .3);
      let g; [sky, g] = layer(W, hy + 2);
      const gr = g.createLinearGradient(0, 0, 0, hy);
      gr.addColorStop(0, '#060318'); gr.addColorStop(.45, '#1d0b44'); gr.addColorStop(.78, '#7a1f6e'); gr.addColorStop(.93, '#e0457a'); gr.addColorStop(1, '#ff9a55');
      g.fillStyle = gr; g.fillRect(0, 0, W, hy + 2);
      for (let i = 0; i < W * hy / 3000; i++) {
        const y = rand(0, hy * .55);
        g.fillStyle = `rgba(255,240,255,${rand(.15, .7)})`; g.fillRect(rand(0, W), y, rand(.6, 1.4), rand(.6, 1.4));
      }
      glow(g, W * .72, hy * .3, m * .05, [255, 220, 240], .9);
      glow(g, W * .72, hy * .3, m * .2, [255, 120, 200], .25);
      // The city: a band of towers on the horizon with lit windows and a few neon roof lines.
      const bw0 = m * .018;
      for (let pass = 0; pass < 2; pass++) {
        for (let x = W * .08; x < W * .92;) {
          const w = bw0 * rand(1.2, 3.4), centre = 1 - Math.abs(x - W / 2) / (W * .5);
          const h = hy * (.04 + .16 * Math.pow(centre, 1.4) * rand(.4, 1)) * (pass ? 1 : 1.25);
          g.fillStyle = pass ? '#14072a' : '#2c1350';
          g.fillRect(x, hy - h, w, h + 2);
          if (pass) {
            for (let wy = hy - h + 3; wy < hy - 2; wy += 3.2) for (let wx = x + 2; wx < x + w - 2; wx += 3)
              if (Math.random() < .28) { g.fillStyle = Math.random() < .7 ? 'rgba(255,205,140,.7)' : 'rgba(140,230,255,.7)'; g.fillRect(wx, wy, 1.2, 1.4); }
            if (Math.random() < .3) { g.fillStyle = rgb(NEON[Math.random() < .5 ? 0 : 1], .9); g.fillRect(x, hy - h, w, 1.5); }
            if (Math.random() < .15) { g.fillStyle = '#14072a'; g.fillRect(x + w / 2 - .6, hy - h - h * .3, 1.2, h * .3); g.fillStyle = 'rgba(255,60,80,.9)'; g.fillRect(x + w / 2 - 1, hy - h - h * .3 - 1, 2, 2); }
          }
          x += w + (pass ? rand(0, bw0 * 1.5) : rand(-bw0, bw0));
        }
      }
      // A palm silhouette, drawn once and scaled for every tree that passes.
      [palm, g] = layer(240, 420);
      g.fillStyle = '#090313'; g.strokeStyle = '#090313';
      g.beginPath(); g.moveTo(112, 420); g.quadraticCurveTo(100, 220, 132, 92); g.lineTo(142, 94); g.quadraticCurveTo(116, 230, 132, 420); g.fill();
      for (let k = 0; k < 9; k++) {
        const a = -Math.PI / 2 + (k / 8 - .5) * 3.4 + rand(-.1, .1), L = rand(80, 110), droop = 40 + Math.abs(k / 8 - .5) * 70;
        const x0 = 137, y0 = 92, tx = x0 + Math.cos(a) * L, ty = y0 + Math.sin(a) * L * .5 + droop;
        const mx = x0 + Math.cos(a) * L * .55, my = y0 + Math.sin(a) * L * .55 - 10;
        g.beginPath();
        for (let j = 0; j <= 16; j++) {
          const u = j / 16, x = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * mx + u * u * tx, y = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * my + u * u * ty;
          const w = Math.sin(Math.PI * u) * 13 * (j % 2 ? 1 : .55);
          if (j) g.lineTo(x, y - w); else g.moveTo(x, y);
        }
        for (let j = 16; j >= 0; j--) {
          const u = j / 16, x = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * mx + u * u * tx, y = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * my + u * u * ty;
          g.lineTo(x, y + Math.sin(Math.PI * u) * 6 * (j % 2 ? 1 : .4));
        }
        g.fill();
      }
      ground = ctx.createLinearGradient(0, hy, 0, H);
      ground.addColorStop(0, '#2a0d3c'); ground.addColorStop(.1, '#110622'); ground.addColorStop(1, '#05020b');
    },
    draw(t, dt) {
      const s = hear(t, dt), cx = W / 2;
      const target = (lively ? 14 : 9) + 18 * s.bass + 8 * s.level;
      speed += (target - speed) * Math.min(1, dt * 1.5);
      travel += speed * dt;
      const X = (x, z) => cx + x * Sx / z, Y = (y, z) => hy + (Ch - y) * S / z;
      ctx.drawImage(sky, 0, 0, W, hy + 2);
      ctx.fillStyle = ground; ctx.fillRect(0, hy, W, H - hy);
      // Road surface, then its neon edges and the moving lane dashes.
      const rw = 3.6, zn = .2;
      ctx.fillStyle = '#100820';
      ctx.beginPath(); ctx.moveTo(cx, hy); ctx.lineTo(X(rw, zn), Y(0, zn)); ctx.lineTo(X(-rw, zn), Y(0, zn)); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const sheen = ctx.createLinearGradient(0, hy, 0, H);
      sheen.addColorStop(0, `rgba(255,110,170,${.3 + .2 * s.level})`); sheen.addColorStop(.25, 'rgba(255,90,170,.04)'); sheen.addColorStop(1, 'rgba(255,90,170,0)');
      ctx.fillStyle = sheen; ctx.beginPath(); ctx.moveTo(cx, hy); ctx.lineTo(X(rw, zn), Y(0, zn)); ctx.lineTo(X(-rw, zn), Y(0, zn)); ctx.fill();
      for (const side of [-1, 1]) {
        const c = NEON[side < 0 ? 0 : 1];
        for (const [w, a] of [[7, .14 + .1 * s.bass], [1.6, .85]]) {
          ctx.strokeStyle = rgb(c, a); ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(cx, hy); ctx.lineTo(X(side * rw, zn), Y(0, zn)); ctx.stroke();
        }
      }
      // Faint streaks across the verges give a sense of speed.
      const gs = 3, go = travel % gs;
      for (let z = gs - go; z < 40; z += gs) {
        if (z < .9) continue;
        const y = Y(0, z), a = smooth(40, 6, z) * .16, rx = X(rw, z);
        ctx.fillStyle = `rgba(200,90,255,${a})`;
        ctx.fillRect(0, y, cx - (rx - cx), Math.max(1, 2 / z)); ctx.fillRect(rx, y, W - rx, Math.max(1, 2 / z));
      }
      const dash = 1.4, gap = 2.6, per = dash + gap, off = travel % per;
      for (let z0 = per - off; z0 < 70; z0 += per) {
        const z1 = z0 + dash, a = smooth(70, 20, z0) * .65;
        for (const lx of [-1.2, 1.2]) {
          ctx.fillStyle = `rgba(150,240,255,${a})`;
          const zz = Math.max(z0, .3);
          ctx.beginPath(); ctx.moveTo(X(lx - .05, zz), Y(0, zz)); ctx.lineTo(X(lx + .05, zz), Y(0, zz));
          ctx.lineTo(X(lx + .05, z1), Y(0, z1)); ctx.lineTo(X(lx - .05, z1), Y(0, z1)); ctx.fill();
        }
      }
      // A car far ahead: two soft tail lights.
      const cz = 16 + 2 * Math.sin(t * .23), cxw = -1.2 * 0 + .6 * Math.sin(t * .11);
      for (const dx of [-.45, .45]) glow(ctx, X(cxw + dx, cz), Y(.5, cz), 6 + 4 * s.level, [255, 40, 60], .8);
      // Palms and neon posts streaming past on both sides, far to near.
      const items = [], base = Math.floor(travel / D);
      for (let j = 34; j >= 0; j--) {
        const idx = base + j, z = idx * D - travel;
        for (const side of [-1, 1]) {
          const zz = z + (side > 0 ? D / 2 : 0);
          if (zz > .35 && zz < 150) items.push({ z: zz, side, palm: (idx + (side > 0 ? 1 : 0)) % 2 === 0, idx });
        }
      }
      items.sort((a, b) => b.z - a.z);
      for (const it of items) {
        const z = it.z, fade = smooth(150, 60, z) * smooth(.35, 1.2, z), p = 1 / z;
        if (it.palm) {
          const x = X(it.side * 6, z), y = Y(0, z), hgt = 7 * S * p, w = hgt * 240 / 420;
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = fade;
          ctx.save(); ctx.translate(x, y); if (it.side < 0) ctx.scale(-1, 1);
          ctx.drawImage(palm, -w * .52, -hgt, w, hgt); ctx.restore();
          ctx.globalAlpha = 1;
        } else {
          const c = NEON[(it.idx + (it.side > 0 ? 1 : 0)) % 2];
          const bright = (.55 + .45 * s.kick * (.7 + .3 * hash(it.idx, it.side))) * fade;
          const px = X(it.side * 4.6, z), top = Y(5.2, z), lx0 = X(it.side * 3.2, z), lx1 = X(it.side * 4.0, z), ly = Y(5.0, z);
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = `rgba(10,4,20,${fade})`; ctx.lineWidth = Math.max(1, .12 * Sx * p);
          ctx.beginPath(); ctx.moveTo(px, Y(0, z)); ctx.lineTo(px, top); ctx.lineTo(lx0, top); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineCap = 'round'; ctx.strokeStyle = rgb(c, bright * .35); ctx.lineWidth = clamp(.3 * Sx * p, 3, 14);
          ctx.beginPath(); ctx.moveTo(lx0, ly); ctx.lineTo(lx1, ly); ctx.stroke();
          ctx.strokeStyle = rgb(mix(c, [255, 255, 255], .5), bright); ctx.lineWidth = clamp(.08 * Sx * p, 1, 4);
          ctx.beginPath(); ctx.moveTo(lx0, ly); ctx.lineTo(lx1, ly); ctx.stroke();
          glow(ctx, (lx0 + lx1) / 2, ly, clamp(1.2 * S * p, 4, Math.min(W, H) * .18), c, .3 * bright);
          if (z > 1) {
            ctx.save(); ctx.translate(X(it.side * 2.6, z), Y(0, z)); ctx.scale(1, .3);
            glow(ctx, 0, 0, 2.2 * Sx * p, c, .22 * bright); ctx.restore();
            // Its reflection on the wet road, a long soft streak toward the viewer.
            const len = clamp(2.5 * S * p, 6, H * .4);
            ctx.save(); ctx.translate(X(it.side * 3.1, z), Y(0, z) + len * .5); ctx.scale(.12, 1);
            glow(ctx, 0, 0, len, c, .16 * bright); ctx.restore();
          }
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.save(); ctx.translate(cx, hy); ctx.scale(1, .1);
      glow(ctx, 0, 0, W * .6, [255, 120, 160], .2 + .3 * s.level); ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
  };
}

// Wireframes for the vector monitor, each roughly unit-sized.
const box = () => {
  const v = []; for (let i = 0; i < 8; i++) v.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1].map(c => c * .8));
  const e = []; for (let i = 0; i < 8; i++) for (const b of [1, 2, 4]) if (!(i & b)) e.push([i, i | b]);
  return { v, e };
};
const octa = () => {
  const s = 1.25, v = [[s, 0, 0], [-s, 0, 0], [0, s, 0], [0, -s, 0], [0, 0, s], [0, 0, -s]];
  const e = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) if (Math.floor(i / 2) !== Math.floor(j / 2)) e.push([i, j]);
  return { v, e };
};
const torus = (n, k) => {
  const v = [], e = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) {
    const a = i / n * TAU, b = j / k * TAU, r = 1 + .42 * Math.cos(b);
    v.push([r * Math.cos(a), .42 * Math.sin(b), r * Math.sin(a)]);
    e.push([i * k + j, i * k + (j + 1) % k], [i * k + j, ((i + 1) % n) * k + j]);
  }
  return { v, e };
};
const tesseract = () => {
  const v = []; for (let i = 0; i < 16; i++) v.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
  const e = []; for (let i = 0; i < 16; i++) for (const b of [1, 2, 4, 8]) if (!(i & b)) e.push([i, i | b]);
  return { v, e, four: true };
};

/* Vector Arcade */
export function vectorScene() {
  const hear = listener();
  let buf, bg, bloom, blg, vign, k = .5, ax = .4, ay = 0, az = 0, dust = [], webZ = 0, proj = new Float32Array(0);
  // With no music the scene comes to rest: act eases to 0 over a second or two, its own clock stops, and the trace lies flat.
  let act = 0, clock = 6;   // the clock starts mid-cycle, so a shape is fully in view while all is still
  const still = { bass: 0, mid: 0, treble: 0, level: 0, kick: 0, beat: false, live: false };
  const COLS = [[70, 255, 120], [80, 225, 255], null, [255, 90, 220], [70, 255, 120]];
  const shapes = [box(), octa(), torus(18, 8), tesseract(), { web: true }];
  const PERIOD = 15;
  return {
    init() {
      k = lowPower ? .4 : .5;
      [buf, bg] = plain(W * k, H * k);
      [bloom, blg] = plain(W / 10, H / 10);
      let g; [vign, g] = layer(W, H);
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.hypot(W, H) * .6);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.75)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
      dust = Array.from({ length: lowPower ? 30 : 60 }, () => ({ x: rand(-5, 5), y: rand(-5, 5), z: rand(.5, 12) }));
      proj = new Float32Array(64);
    },
    draw(t0, dt0) {
      const heard = hear(t0, dt0), on = musicPlaying ? 1 : 0;
      act += (on - act) * Math.min(1, dt0 * 1.5);
      const dt = dt0 * act; clock += dt; const t = clock;
      const s = musicPlaying ? heard : still, m = Math.min(W, H), cx = W / 2, cy = H * (W > H ? .45 : .43);
      const spin = (.25 + 1.1 * s.mid) * (lively ? 1.6 : 1);
      ay += dt * spin; ax += dt * spin * .43; az += dt * spin * .17;
      const idx = wrap(Math.floor(t / PERIOD), shapes.length), local = wrap(t, PERIOD);
      const grow = smooth(0, 1.3, local) * smooth(PERIOD, PERIOD - 1.1, local);
      const shape = shapes[idx], col = COLS[idx];
      const scale = m * .2 * (1 + .22 * s.bass + .12 * s.kick) * grow;
      const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay), cc = Math.cos(az), sc = Math.sin(az);
      const rot = (x, y, z, out, o) => {
        let y1 = y * ca - z * sa, z1 = y * sa + z * ca;
        let x1 = x * cb + z1 * sb; z1 = -x * sb + z1 * cb;
        const x2 = x1 * cc - y1 * sc; y1 = x1 * sc + y1 * cc;
        const f = 3.6 / (z1 + 4.2);
        out[o] = cx + x2 * scale * f; out[o + 1] = cy + y1 * scale * f;
      };
      // Lines in two passes: the half-size buffer keeps fading trails, the main canvas gets the crisp beam.
      const lines = [];   // [x0, y0, x1, y1, colour]
      const hueCol = i => hsv(wrap(i * .037 + t * .05, 1), .75, 1);
      if (shape.web) {
        const n = 12, rings = 10, gap = 1.1;
        webZ = (webZ + dt * (.5 + 1.5 * s.bass)) % gap;
        const pts = [];
        for (let r = 0; r < rings; r++) {
          const z = r * gap - webZ + .9, row = [];
          for (let i = 0; i < n; i++) {
            const a = i / n * TAU + az * .6, rad = 1 + .25 * Math.sin(a * 3 + t);
            const f = 1.1 / z, wx = Math.cos(a) * rad, wy = Math.sin(a) * rad * .9;
            row.push([cx + wx * f * scale, cy + wy * f * scale, smooth(rings * gap, rings * gap * .4, z) * smooth(.3, 2.2, z)]);
          }
          pts.push(row);
        }
        for (let r = 0; r < rings; r++) for (let i = 0; i < n; i++) {
          const p = pts[r][i], q = pts[r][(i + 1) % n];
          lines.push([p[0], p[1], q[0], q[1], p[2]]);
          if (r < rings - 1) { const u = pts[r + 1][i]; lines.push([p[0], p[1], u[0], u[1], Math.min(p[2], u[2]) * .8]); }
        }
      } else {
        const v = shape.v;
        if (proj.length < v.length * 2) proj = new Float32Array(v.length * 2);
        if (shape.four) {
          const a = t * .35 * (1 + s.mid), c4 = Math.cos(a), s4 = Math.sin(a);
          v.forEach((p, i) => {
            const x = p[0] * c4 - p[3] * s4, w = p[0] * s4 + p[3] * c4, f = 1.4 / (2.6 - w);
            rot(x * f * .9, p[1] * f * .9, p[2] * f * .9, proj, i * 2);
          });
        } else v.forEach((p, i) => rot(p[0], p[1], p[2], proj, i * 2));
        for (const [i, j] of shape.e) lines.push([proj[i * 2], proj[i * 2 + 1], proj[j * 2], proj[j * 2 + 1], 1]);
      }
      const dense = Math.sqrt(Math.min(1, 40 / Math.max(1, lines.length)));
      const stroke = (g, sc, w, alpha) => {
        alpha *= dense; g.lineWidth = w; g.lineCap = 'round';
        if (col && !shape.web) {
          g.strokeStyle = rgb(col, alpha); g.beginPath();
          for (const L of lines) { g.moveTo(L[0] * sc, L[1] * sc); g.lineTo(L[2] * sc, L[3] * sc); }
          g.stroke();
        } else {
          lines.forEach((L, i) => { g.strokeStyle = rgb(col || hueCol(i), alpha * L[4]); g.beginPath(); g.moveTo(L[0] * sc, L[1] * sc); g.lineTo(L[2] * sc, L[3] * sc); g.stroke(); });
        }
      };
      const dc = col || [200, 220, 255];
      bg.globalCompositeOperation = 'source-over';
      bg.fillStyle = `rgba(0,0,0,${lively ? .26 : .17})`; bg.fillRect(0, 0, buf.width, buf.height);
      bg.globalCompositeOperation = 'lighter';
      stroke(bg, k, 1.6, .55);
      // Star dust drifting slowly outward, and a dim oscilloscope trace along the bottom.
      bg.fillStyle = rgb(dc, .8);
      for (const d of dust) {
        d.z -= dt * (.35 + .8 * s.bass);
        if (d.z < .4) { d.z = 12; d.x = rand(-5, 5); d.y = rand(-5, 5); }
        const f = m * .25 / d.z, x = (cx + d.x * f) * k, y = (cy + d.y * f) * k;
        const r = clamp(2.2 / d.z, .4, 1.6);
        bg.fillRect(x - r / 2, y - r / 2, r, r);
      }
      const w = wave256(t, s).map(x => x * act), oy = H * .9, ow = W * .76, ox = (W - ow) / 2, oa = H * .035;
      bg.strokeStyle = rgb(dc, .45); bg.lineWidth = 1.2; bg.beginPath();
      for (let i = 0; i < 256; i += 2) { const x = (ox + i / 255 * ow) * k, y = (oy + w[i] * oa) * k; if (i) bg.lineTo(x, y); else bg.moveTo(x, y); }
      bg.stroke();
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(buf, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      if (!lowPower) {
        blg.clearRect(0, 0, bloom.width, bloom.height);
        blg.drawImage(buf, 0, 0, bloom.width, bloom.height);
        ctx.globalAlpha = .7 + .3 * s.level; ctx.drawImage(bloom, 0, 0, W, H); ctx.globalAlpha = 1;
      }
      stroke(ctx, 1, 1.2, .85);
      if (!shape.web && col) {
        ctx.fillStyle = rgb(mix(col, [255, 255, 255], .6), .9);
        for (let i = 0; i < shape.v.length; i++) ctx.fillRect(proj[i * 2] - 1, proj[i * 2 + 1] - 1, 2, 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(vign, 0, 0, W, H);
    }
  };
}

// Tileable value noise for haze.
function hazeMap(w, h, seed) {
  const [c, g] = plain(w, h), im = g.createImageData(w, h);
  const vn = (x, y, p) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const at = (i, j) => hash(((i % p) + p) % p + seed, j + seed * 7);
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0, a = .5, f = 4;
    for (let o = 0; o < 4; o++) { n += a * vn(x / w * f, y / h * f * .5, f); a *= .5; f *= 2; }
    const i = (y * w + x) * 4;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * clamp(.2 + 1.1 * (n - .25), .12, 1));
  }
  g.putImageData(im, 0, 0);
  return c;
}

/* Laser Show */
export function laserShowScene() {
  const hear = listener();
  let hall, crowd, beamC, beamG, maskC, maskG, haze, bloom, blg, k = .5, ox = 0, oy = 0, crowdH = 0;
  const beams = [];
  const PERIOD = 13, FADE = 2.5;
  const RED = [255, 40, 70], BLUE = [70, 100, 255], GREEN = [60, 255, 110], CYAN = [60, 235, 255], PINK = [255, 70, 220];
  const modes = [
    // A fan that opens with the mids and wobbles with the waveform.
    (t, s, sp, w, wt) => {
      const n = lowPower ? 9 : 13, spread = .55 + .4 * s.mid + .15 * Math.sin(t * .31), sway = .18 * Math.sin(t * .23);
      for (let i = 0; i < n; i++) {
        const u = n > 1 ? i / (n - 1) * 2 - 1 : 0;
        beams.push(-Math.PI / 2 + sway + u * spread + .06 * w[i * 18 % 256], 0, GREEN, (.35 + .65 * sp[2 + i * 3]) * wt);
      }
    },
    // Two crossing groups, red and blue, scissoring slowly.
    (t, s, sp, w, wt) => {
      const n = lowPower ? 4 : 6, sw = .65 * Math.sin(t * .45) + .1 * s.bass;
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * (.05 + .05 * s.mid);
        beams.push(-Math.PI / 2 + sw + o, 0, RED, (.4 + .6 * sp[2 + i * 4]) * wt);
        beams.push(-Math.PI / 2 - sw - o, 0, BLUE, (.4 + .6 * sp[4 + i * 4]) * wt);
      }
    },
    // A turning cone: beams to a slowly rotating ring overhead, its mouth drawn as a loop of light.
    (t, s, sp, w, wt) => {
      const n = lowPower ? 16 : 28, rcx = W / 2, rcy = H * .2, rx = Math.min(W * .42, H * .35) * (.8 + .25 * s.bass), ry = rx * .22;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + t * .35 * (1 + s.mid), px = rcx + Math.cos(a) * rx, py = rcy + Math.sin(a) * ry;
        const front = .55 + .45 * Math.sin(a);
        beams.push(Math.atan2(py - oy, px - ox), Math.hypot(px - ox, py - oy), i % 2 ? CYAN : PINK, (.3 + .5 * sp[3 + (i % 16) * 3]) * front * wt);
      }
      beams.push(0, -1, CYAN, wt * (.5 + .4 * s.level));   // the ring itself
    },
    // A rainbow fan whose beams trace the waveform.
    (t, s, sp, w, wt) => {
      const n = lowPower ? 10 : 16;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1) * 2 - 1;
        beams.push(-Math.PI / 2 + u * (.85 + .1 * Math.sin(t * .2)) + .3 * w[i * 15 % 256], 0, hsv(wrap(i / n + t * .03, 1), .8, 1), (.35 + .65 * sp[2 + i * 3]) * wt);
      }
    },
  ];
  return {
    init() {
      const m = Math.min(W, H);
      k = lowPower ? .35 : .5;
      ox = W / 2; oy = H * .82; crowdH = H * .2;
      let g; [hall, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#04030a'); gr.addColorStop(.6, '#0a0716'); gr.addColorStop(.85, '#120a20'); gr.addColorStop(1, '#05030a');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(140,120,200,.05)'; g.lineWidth = 1; g.beginPath();
      for (let x = 0; x < W; x += m * .08) { g.moveTo(x, H * .06); g.lineTo(x + m * .04, H * .02); g.lineTo(x + m * .08, H * .06); }
      g.moveTo(0, H * .02); g.lineTo(W, H * .02); g.moveTo(0, H * .06); g.lineTo(W, H * .06); g.stroke();
      g.fillStyle = '#1a1028'; g.fillRect(0, oy + 4, W, 3);
      // The crowd: heads and shoulders, a few raised hands, rim-lit from the stage.
      [crowd, g] = layer(W, crowdH);
      const people = [];
      for (let row = 0; row < 3; row++) {
        const r0 = m * (.024 + row * .007), y0 = crowdH * (.28 + row * .22);
        for (let x = rand(-r0, r0); x < W + r0 * 2; x += r0 * rand(2.1, 3)) people.push({ x, y: y0 + rand(-r0, r0) * .4, r: r0 * rand(.85, 1.1), arm: Math.random() < .14 ? rand(-.5, .5) : null });
      }
      for (const pass of [0, 1]) {
        g.fillStyle = g.strokeStyle = pass ? '#020104' : 'rgba(150,110,255,.35)';
        const dy = pass ? 1.6 : 0;
        for (const p of people) {
          g.beginPath(); g.arc(p.x, p.y + dy, p.r, 0, TAU); g.fill();
          g.beginPath(); g.ellipse(p.x, p.y + p.r * 2.6 + dy, p.r * 2.1, p.r * 1.9, 0, Math.PI, 0); g.lineTo(p.x + p.r * 2.1, crowdH); g.lineTo(p.x - p.r * 2.1, crowdH); g.fill();
          if (p.arm !== null) {
            g.lineWidth = p.r * .32; g.lineCap = 'round';
            const sx = p.x + p.r * 1.4 * Math.sign(p.arm || 1), ex = sx + Math.sin(p.arm) * p.r * 4, ey = p.y - p.r * 3.4 + dy;
            g.beginPath(); g.moveTo(sx, p.y + p.r * 1.6 + dy); g.lineTo(ex, ey); g.stroke();
            g.beginPath(); g.arc(ex, ey - p.r * .2, p.r * .3, 0, TAU); g.fill();
          }
        }
      }
      [beamC, beamG] = plain(W * k, H * k);
      haze = hazeMap(128, 64, 5);
      [maskC, maskG] = plain(128, 64);
      [bloom, blg] = plain(W / 12, H / 12);
    },
    draw(t, dt) {
      const s = hear(t, dt), sp = spec64(t, s), w = wave256(t, s), m = Math.min(W, H);
      const clock = t * (lively ? 1.5 : 1), mi = wrap(Math.floor(clock / PERIOD), modes.length), local = wrap(clock, PERIOD);
      const f = smooth(PERIOD - FADE, PERIOD, local);
      beams.length = 0;
      modes[mi % modes.length](clock, s, sp, w, 1 - f);
      if (f > 0) modes[(mi + 1) % modes.length](clock, s, sp, w, f);
      // Beams go into a half-size buffer, which the drifting haze then masks, so they show only where there is smoke.
      const bw = beamC.width, bh = beamC.height, L = Math.hypot(W, H);
      beamG.setTransform(1, 0, 0, 1, 0, 0);
      beamG.globalCompositeOperation = 'source-over'; beamG.clearRect(0, 0, bw, bh);
      beamG.globalCompositeOperation = 'lighter';
      beamG.setTransform(k, 0, 0, k, 0, 0);
      const boost = .75 + .35 * s.level + .25 * s.kick;
      for (let i = 0; i < beams.length; i += 4) {
        const a = beams[i], len = beams[i + 1], c = beams[i + 2], inten = clamp(beams[i + 3] * boost, 0, 1.3);
        if (inten < .01) continue;
        if (len < 0) {
          beamG.strokeStyle = rgb(c, .5 * inten); beamG.lineWidth = 3;
          const rx = Math.min(W * .42, H * .35) * (.8 + .25 * s.bass);
          beamG.beginPath(); beamG.ellipse(W / 2, H * .2, rx, rx * .22, 0, 0, TAU); beamG.stroke();
          continue;
        }
        const l = len || L, ex = ox + Math.cos(a) * l, ey = oy + Math.sin(a) * l, wd = l * .012;
        const nx = -Math.sin(a) * wd, ny = Math.cos(a) * wd;
        const gr = beamG.createLinearGradient(ox, oy, ex, ey);
        gr.addColorStop(0, rgb(c, .95 * inten)); gr.addColorStop(len ? 1 : .7, rgb(c, (len ? .55 : .12) * inten)); if (!len) gr.addColorStop(1, rgb(c, 0));
        beamG.fillStyle = gr;
        beamG.beginPath(); beamG.moveTo(ox, oy); beamG.lineTo(ex + nx, ey + ny); beamG.lineTo(ex - nx, ey - ny); beamG.fill();
      }
      beamG.setTransform(1, 0, 0, 1, 0, 0);
      const hx = wrap(t * 6, 128);
      maskG.clearRect(0, 0, 128, 64);
      maskG.drawImage(haze, -hx, 0); maskG.drawImage(haze, 128 - hx, 0);
      beamG.globalCompositeOperation = 'destination-in';
      beamG.drawImage(maskC, 0, 0, bw, bh);
      ctx.drawImage(hall, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(beamC, 0, 0, W, H);
      if (!lowPower) {
        blg.clearRect(0, 0, bloom.width, bloom.height);
        blg.drawImage(beamC, 0, 0, bloom.width, bloom.height);
        ctx.globalAlpha = .9; ctx.drawImage(bloom, 0, 0, W, H); ctx.globalAlpha = 1;
      }
      // Thin bright cores, strongest near the projector.
      ctx.lineWidth = 1;
      for (let i = 0; i < beams.length; i += 4) {
        const len = beams[i + 1], inten = clamp(beams[i + 3] * boost, 0, 1); if (len < 0 || inten < .02) continue;
        const a = beams[i], l = (len || L) * .75, c = mix(beams[i + 2], [255, 255, 255], .4);
        const gr = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * l, oy + Math.sin(a) * l);
        gr.addColorStop(0, rgb(c, .6 * inten)); gr.addColorStop(1, rgb(c, 0));
        ctx.strokeStyle = gr; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a) * l, oy + Math.sin(a) * l); ctx.stroke();
      }
      const lead = beams.length ? beams[2] : GREEN;
      glow(ctx, ox, oy, m * (.05 + .05 * s.bass + .03 * s.kick), mix(lead, [255, 255, 255], .5), .7);
      glow(ctx, ox, oy, m * .35, lead, .08 + .08 * s.level);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(crowd, 0, H - crowdH - 1.5 * s.kick, W, crowdH + 2);
    }
  };
}

/* Memphis Pattern */
export function memphisScene() {
  const hear = listener();
  const INK = [[22, 22, 26], [24, 178, 166], [255, 92, 160], [255, 206, 58], [124, 108, 255]];
  const BGS = [[252, 226, 232], [215, 242, 236], [255, 243, 200], [232, 226, 255]];
  let shapes = [], flecks, perm = [0, 1, 2, 3, 4], lastShuffle = 0, size = 0;
  const TYPES = ['zig', 'squig', 'tri', 'half', 'dots', 'confetti', 'ring', 'stripes', 'cross', 'tri', 'half', 'zig'];
  return {
    init() {
      size = Math.sqrt(W * H) * .085;
      let g; [flecks, g] = layer(W, H);
      for (let i = 0; i < W * H / 900; i++) {
        g.fillStyle = rgb(INK[Math.floor(Math.random() * INK.length)], .16);
        g.save(); g.translate(rand(0, W), rand(0, H)); g.rotate(rand(0, TAU)); g.fillRect(-1.5, -.6, rand(2, 4), 1.2); g.restore();
      }
      const cell = size * 1.9, cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1;
      shapes = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = shapes.length;
        shapes.push({
          type: TYPES[(r * 5 + c * 3 + Math.floor(hash(r, c) * 4)) % TYPES.length],
          x: (c + .5 + (hash(c, r + 3) - .5) * .6 + (r % 2) * .5) * cell - cell * .5, y: (r + .5 + (hash(r, c + 9) - .5) * .6) * cell - cell * .5,
          s: size * (.6 + .5 * hash(i, 4)) * (hash(i, 11) < .15 ? 1.7 : 1), a: hash(i, 5) * TAU, va: (hash(i, 6) - .5) * .25,
          vx: 4 + 6 * hash(i, 7), vy: -3 + 6 * hash(i, 8), ci: i % INK.length, col: null, p: 0, pv: 0, band: i % 3,
        });
      }
      for (const sh of shapes) sh.col = INK[sh.ci].slice();
    },
    draw(t, dt) {
      const s = hear(t, dt), m = Math.min(W, H), pad = size * 1.4;
      const bi = wrap(t / 28, BGS.length), b0 = Math.floor(bi), bf = smooth(.75, 1, bi - b0);
      ctx.fillStyle = rgb(mix(BGS[b0], BGS[(b0 + 1) % BGS.length], bf)); ctx.fillRect(0, 0, W, H);
      ctx.drawImage(flecks, 0, 0, W, H);
      // Colours trade places now and then: every sixteen beats, at most every ten seconds.
      if (s.beat && s.beats % 16 === 0 && t - lastShuffle > 10) {
        lastShuffle = t;
        for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
      }
      const sp = lively ? 1.8 : 1, lw = Math.max(2.5, m * .008);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const sh of shapes) {
        sh.x += sh.vx * dt * sp; sh.y += sh.vy * dt * sp; sh.a += sh.va * dt * sp;
        const spanX = Math.ceil((W + pad * 2) / 1), spanY = H + pad * 2;
        if (sh.x > W + pad) sh.x -= spanX; if (sh.x < -pad) sh.x += spanX;
        if (sh.y > H + pad) sh.y -= spanY; if (sh.y < -pad) sh.y += spanY;
        // A springy pop on the beat; each shape listens to a different band.
        if (s.beat && hash(sh.x | 0, s.beats) < .55) sh.pv += 5 + 6 * (sh.band === 0 ? s.bass : sh.band === 1 ? s.mid : s.treble);
        sh.pv += (-60 * sh.p - 9 * sh.pv) * dt; sh.p += sh.pv * dt;
        const target = INK[perm[sh.ci]];
        for (let c = 0; c < 3; c++) sh.col[c] += (target[c] - sh.col[c]) * Math.min(1, dt * 2.5);
        const col = rgb(sh.col.map(Math.round)), sz = sh.s * (1 + .12 * sh.p);
        ctx.save(); ctx.translate(sh.x, sh.y); ctx.rotate(sh.a);
        const shadow = (fn) => { ctx.save(); ctx.translate(sz * .06, sz * .06); ctx.fillStyle = ctx.strokeStyle = 'rgba(22,22,26,.9)'; fn(true); ctx.restore(); ctx.fillStyle = ctx.strokeStyle = col; fn(false); };
        ctx.lineWidth = lw;
        switch (sh.type) {
          case 'zig': ctx.lineWidth = lw * 1.4; ctx.strokeStyle = col; ctx.beginPath();
            for (let i = 0; i <= 6; i++) ctx.lineTo(-sz * .6 + i * sz * .2, i % 2 ? -sz * .15 : sz * .15);
            ctx.stroke(); break;
          case 'squig': ctx.lineWidth = lw * 1.4; ctx.strokeStyle = col; ctx.beginPath();
            for (let i = 0; i <= 24; i++) { const u = i / 24; ctx.lineTo(-sz * .6 + u * sz * 1.2, Math.sin(u * TAU * 1.5 + t * .8) * sz * .14); }
            ctx.stroke(); break;
          case 'tri': shadow(() => { ctx.beginPath(); ctx.moveTo(0, -sz * .45); ctx.lineTo(sz * .42, sz * .3); ctx.lineTo(-sz * .42, sz * .3); ctx.closePath(); ctx.fill(); }); break;
          case 'half': shadow(() => { ctx.beginPath(); ctx.arc(0, sz * .12, sz * .4, Math.PI, 0); ctx.closePath(); ctx.fill(); }); break;
          case 'dots': ctx.fillStyle = col;
            for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc((i - 1.5) * sz * .2, (j - 1.5) * sz * .2, sz * .045, 0, TAU); ctx.fill(); }
            break;
          case 'confetti': ctx.strokeStyle = col; ctx.lineWidth = lw * .8;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
              const x = (i - 1.5) * sz * .26, y = (j - 1) * sz * .26, r = hash(i, j) * TAU;
              ctx.moveTo(x - Math.cos(r) * sz * .06, y - Math.sin(r) * sz * .06); ctx.lineTo(x + Math.cos(r) * sz * .06, y + Math.sin(r) * sz * .06);
            }
            ctx.stroke(); break;
          case 'ring': ctx.lineWidth = lw * 1.8; shadow(() => { ctx.beginPath(); ctx.arc(0, 0, sz * .3, 0, TAU); ctx.stroke(); }); break;
          case 'stripes':
            ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, sz * .34, 0, TAU); ctx.fill();
            ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(22,22,26,.92)';
            for (let i = -4; i <= 4; i += 2) ctx.fillRect(i * sz * .08 - sz * .03, -sz * .4, sz * .06, sz * .8);
            ctx.restore(); break;
          case 'cross': ctx.strokeStyle = col; ctx.lineWidth = lw * 1.2; ctx.beginPath();
            for (const [x, y] of [[-.22, -.22], [.22, -.22], [-.22, .22], [.22, .22]]) {
              ctx.moveTo((x - .08) * sz, y * sz); ctx.lineTo((x + .08) * sz, y * sz); ctx.moveTo(x * sz, (y - .08) * sz); ctx.lineTo(x * sz, (y + .08) * sz);
            }
            ctx.stroke(); break;
        }
        ctx.restore();
      }
    }
  };
}
