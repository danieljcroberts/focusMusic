// Classic visualisers: the desktop music-player plugins of the turn of the century, drawn in code.
// Each one reads the analyser's waveform and spectrum, and falls back to a gentle sine signal when nothing is playing.
import { W, H, DPR, ctx, lowPower, lively } from '../view.js';
import { rand, layer, plain } from '../util.js';
import { bands, musicLevel, spectrum, waveform } from '../music.js';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;

// One shared signal per frame: the real one when music is on the analyser, a sine stand-in when it is quiet,
// crossfaded so starting or stopping a track never jumps.
const S = { wave: new Float32Array(512), spec: new Float32Array(256), bass: 0, mid: 0, treble: 0, level: 0, idle: 1 };
let idle = 1;
function signal(t, dt) {
  const sp = spectrum(), wv = waveform();
  let sum = 0; for (let i = 0; i < 96; i += 3) sum += sp[i];
  const live = musicLevel > .02 && sum > 0;
  idle += ((live ? 0 : 1) - idle) * Math.min(1, dt * 1.5);
  const f = idle, fb = .22 + .38 * Math.pow(.5 + .5 * Math.sin(t * 5.2), 8);
  const kick = .7 + bands.bass * .45 + fb * .5;
  for (let i = 0; i < 256; i++) {
    const fake = Math.exp(-i / 70) * (.5 + .22 * Math.sin(t * 1.3 + i * .11) + .16 * Math.sin(t * 2.3 - i * .05) + .08 * Math.sin(t * 4.1 + i * .37)) * (i < 14 ? kick : .7 + bands.mid * .4);
    S.spec[i] = (sp[i] / 255) * (1 - f) + clamp(fake) * f;
  }
  const amp = .5 + fb * .7;
  for (let i = 0; i < 512; i++) {
    const p = i / 512 * TAU;
    const fake = (.26 * Math.sin(p * 3 + t * 1.1) + .13 * Math.sin(p * 7 - t * 1.7) + .07 * Math.sin(p * 13 + t * 2.9) + .03 * Math.sin(p * 29 - t * 4.3)) * amp;
    S.wave[i] = ((wv[i] ?? 128) - 128) / 128 * (1 - f) + fake * f;
  }
  S.bass = Math.max(bands.bass, fb * f); S.mid = Math.max(bands.mid, (.25 + .1 * Math.sin(t * .7)) * f);
  S.treble = Math.max(bands.treble, (.2 + .08 * Math.sin(t * 1.1)) * f); S.level = Math.max(musicLevel, .35 * f); S.idle = f;
  return S;
}
// A bass punch: how far the bass has jumped above its own recent average, rising fast and easing off.
function puncher() {
  let avg = 0, env = 0;
  return (bass, dt) => {
    avg += (bass - avg) * Math.min(1, dt * 1.2);
    const hit = clamp((bass - avg - .03) * 3.2);
    env += (hit - env) * Math.min(1, dt * (hit > env ? 16 : 2.6));
    return env;
  };
}
// A reduced-resolution buffer for trails, at most `cap` pixels on its long side.
function buffer(cap) {
  const k = Math.min(1, cap / Math.max(W, H));
  const [c, g] = plain(W * k, H * k);
  return { c, g, k, w: c.width, h: c.height };
}

/* Spectrum Bars: chunky segmented bars under a bevelled metal panel, peak caps hanging and dropping, a scope trace above */
export function spectrumBarsScene() {
  let back, lit, N = 0, segs = 0, box, bars, peaks, vel, hold;
  return {
    init() {
      const m = Math.max(16, Math.min(W, H) * .04), portrait = H > W;
      const pw = Math.min(W - m * 2, 1180), ph = portrait ? Math.min(H * .56, pw * 1.3) : Math.min(H * .74, pw * .56);
      const px = (W - pw) / 2, py = (H - ph) / 2;
      const s = Math.min(pw, ph * 1.6) / 900;
      const title = Math.max(16, 22 * s), pad = Math.max(10, 18 * s), bev = Math.max(3, 5 * s);
      const dx = px + pad, dy = py + title + pad * .6, dw = pw - pad * 2, dh = ph - title - pad * 1.6;
      const scopeH = dh * (portrait ? .2 : .24), ip = Math.max(6, 10 * s);
      N = W < 600 ? 18 : W < 1000 ? 26 : 32;
      const bx = dx + ip, by = dy + scopeH + ip, bw = dw - ip * 2, bh = dh - scopeH - ip * 2;
      const gap = Math.max(2, bw / N * .18), cw = (bw - gap * (N - 1)) / N;
      segs = Math.max(12, Math.min(26, Math.round(bh / Math.max(7, 11 * s))));
      const sh = bh / segs;
      box = { px, py, pw, ph, dx, dy, dw, dh, scopeH, ip, bx, by, bw, bh, gap, cw, sh, s };
      bars = new Float32Array(N); peaks = new Float32Array(N); vel = new Float32Array(N); hold = new Float32Array(N);

      let g; [back, g] = layer(W, H);
      const bg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * .75);
      bg.addColorStop(0, '#1a1d24'); bg.addColorStop(1, '#050608');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
      // The panel: a soft shadow, brushed metal, a bevel.
      g.save(); g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 40 * s; g.shadowOffsetY = 14 * s;
      rr(px, py, pw, ph, 8 * s); g.fillStyle = '#2b2f36'; g.fill(); g.restore();
      const metal = g.createLinearGradient(0, py, 0, py + ph);
      metal.addColorStop(0, '#6b717c'); metal.addColorStop(.08, '#4a4f58'); metal.addColorStop(.5, '#353941'); metal.addColorStop(1, '#24272d');
      rr(px, py, pw, ph, 8 * s); g.fillStyle = metal; g.fill();
      g.save(); rr(px, py, pw, ph, 8 * s); g.clip();
      for (let k = 0; k < ph; k += 2) { g.fillStyle = `rgba(255,255,255,${rand(0, .035)})`; g.fillRect(px, py + k, pw, 1); }
      g.restore();
      g.lineWidth = bev * .4;
      g.strokeStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(px + 4, py + ph - 2); g.lineTo(px + 1.5, py + 1.5); g.lineTo(px + pw - 4, py + 1.5); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.moveTo(px + pw - 1.5, py + 4); g.lineTo(px + pw - 1.5, py + ph - 1.5); g.lineTo(px + 4, py + ph - 1.5); g.stroke();
      // Title strip: ridged grip lines and three small knobs.
      const ty = py + title * .5 + pad * .25;
      g.fillStyle = 'rgba(0,0,0,.35)';
      const knobR = title * .22, kx = px + pw - pad - knobR;
      for (let k = 0; k < 4; k++) {
        const y = ty - title * .18 + k * title * .12;
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(px + pad, y, pw - pad * 3 - knobR * 8, 1);
        g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(px + pad, y + 1, pw - pad * 3 - knobR * 8, 1);
      }
      for (let k = 0; k < 3; k++) {
        const x = kx - k * knobR * 2.8;
        const kg = g.createRadialGradient(x - knobR * .3, ty - knobR * .3, 0, x, ty, knobR);
        kg.addColorStop(0, '#9aa1ac'); kg.addColorStop(1, '#30343b');
        g.fillStyle = kg; g.beginPath(); g.arc(x, ty, knobR, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.stroke();
      }
      // Screws in the corners.
      for (const [x, y] of [[px + pad * .5, py + ph - pad * .5], [px + pw - pad * .5, py + ph - pad * .5]]) {
        const r = Math.max(2.5, 4 * s);
        g.fillStyle = '#7d838d'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - r * .7, y - r * .2); g.lineTo(x + r * .7, y + r * .2); g.stroke();
      }
      // The recessed display.
      rr(dx - bev, dy - bev, dw + bev * 2, dh + bev * 2, 4 * s);
      const rim = g.createLinearGradient(dx, dy, dx + dw, dy + dh);
      rim.addColorStop(0, '#15171b'); rim.addColorStop(1, '#8a909a');
      g.fillStyle = rim; g.fill();
      rr(dx, dy, dw, dh, 2 * s); g.fillStyle = '#040607'; g.fill();
      g.fillStyle = 'rgba(70,255,120,.05)';
      for (let y = dy + 4; y < dy + dh; y += 6 * Math.max(1, s)) for (let x = dx + 4; x < dx + dw; x += 6 * Math.max(1, s)) g.fillRect(x, y, 1, 1);
      g.strokeStyle = 'rgba(70,255,120,.12)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(dx + ip, dy + scopeH); g.lineTo(dx + dw - ip, dy + scopeH); g.stroke();
      // Unlit segments, and the lit column that each bar copies from.
      const col = p => p < .55 ? [Math.round(30 + 400 * p), 225, 60] : p < .8 ? [245, Math.round(225 - (p - .55) * 300), 40] : [240, Math.round(150 - (p - .8) * 500), 34];
      let lg; [lit, lg] = layer(cw, bh);
      for (let k = 0; k < segs; k++) {
        const p = (k + .5) / segs, y = bh - (k + 1) * sh, c = col(p);
        lg.fillStyle = `rgb(${c})`; lg.fillRect(0, y + sh * .12, cw, sh * .76);
        lg.fillStyle = 'rgba(255,255,255,.25)'; lg.fillRect(0, y + sh * .12, cw, sh * .18);
        for (let i = 0; i < N; i++) { g.fillStyle = `rgba(${c},.09)`; g.fillRect(bx + i * (cw + gap), by + y + sh * .12, cw, sh * .76); }
      }
    },
    draw(t, dt) {
      const sg = signal(t, dt), b = box;
      ctx.drawImage(back, 0, 0, W, H);
      // Log-spaced bands, tilted up toward the treble where the analyser reads low.
      const lo = 2, hi = 190;
      for (let i = 0; i < N; i++) {
        const a = Math.floor(lo * Math.pow(hi / lo, i / N)), z = Math.max(a + 1, Math.floor(lo * Math.pow(hi / lo, (i + 1) / N)));
        let m = 0; for (let j = a; j < z; j++) if (sg.spec[j] > m) m = sg.spec[j];
        const v = clamp(Math.pow(m, 1.35) * (1 + i / N * .7) * 1.08);
        if (v > bars[i]) bars[i] += (v - bars[i]) * Math.min(1, dt * 22); else bars[i] = Math.max(v, bars[i] - dt * 1.4);
        if (bars[i] >= peaks[i]) { peaks[i] = bars[i]; vel[i] = 0; hold[i] = .55; }
        else if ((hold[i] -= dt) < 0) { vel[i] += dt * 1.6; peaks[i] = Math.max(bars[i], peaks[i] - vel[i] * dt); }
      }
      const r = DPR;
      for (let i = 0; i < N; i++) {
        const n = Math.round(bars[i] * segs), x = b.bx + i * (b.cw + b.gap);
        if (n > 0) { const hh = n * b.sh; ctx.drawImage(lit, 0, (b.bh - hh) * r, b.cw * r, hh * r, x, b.by + b.bh - hh, b.cw, hh); }
        const pk = Math.min(segs - 1, Math.round(peaks[i] * segs));
        if (pk > 0) {
          const y = b.by + b.bh - (pk + 1) * b.sh + b.sh * .12;
          ctx.fillStyle = pk / segs > .8 ? '#ffd0c0' : pk / segs > .55 ? '#fff4c0' : '#d8ffe0';
          ctx.fillRect(x, y, b.cw, b.sh * .4);
        }
      }
      // The scope trace above the bars.
      const cy = b.dy + b.scopeH / 2, sx = b.dx + b.ip, sw = b.dw - b.ip * 2, amp = b.scopeH * .42;
      ctx.save(); ctx.beginPath(); ctx.rect(b.dx, b.dy, b.dw, b.scopeH); ctx.clip();
      ctx.beginPath();
      for (let i = 0; i < 256; i++) { const x = sx + sw * i / 255, y = cy - clamp(sg.wave[i * 2], -1, 1) * amp; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(80,255,130,.18)'; ctx.lineWidth = 5 * Math.max(.6, b.s); ctx.stroke();
      ctx.strokeStyle = 'rgba(150,255,170,.9)'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.restore();
    }
  };
}

/* Feedback Drift: the last frame zoomed, turned and folded back onto itself, the waveform smearing into tunnels and spirals */
export function feedbackScene() {
  let A, B, punch, mode = 0, next = 0, hue = rand(0, 360);
  // zoom/rot per frame at 60 fps, drift in buffer px, mirror amount, ring (1) or line (0), ripple in buffer px.
  const PRESETS = [
    { zoom: 1.028, rot: .002, dx: 0, dy: 0, mirror: 0, ring: 1, ripple: .4, bz: .03, br: .004 },
    { zoom: 1.01, rot: .018, dx: 0, dy: 0, mirror: 0, ring: .6, ripple: .2, bz: .012, br: .016 },
    { zoom: 1.006, rot: 0, dx: 1.6, dy: -.3, mirror: 0, ring: 0, ripple: 1.1, bz: .01, br: 0 },
    { zoom: 1.02, rot: .007, dx: 0, dy: 0, mirror: 1, ring: .3, ripple: .3, bz: .025, br: .006 },
  ];
  const cur = { ...PRESETS[0] };
  return {
    init() {
      const cap = lowPower ? 320 : 480;
      A = buffer(cap); B = buffer(cap); punch = puncher();
      for (const b of [A, B]) { b.g.fillStyle = '#000'; b.g.fillRect(0, 0, b.w, b.h); }
    },
    draw(t, dt) {
      const sg = signal(t, dt), p = punch(sg.bass, dt), f = dt * 60, sp = lively ? 1.5 : 1;
      if (t > next) { mode = next ? (mode + 1 + Math.floor(rand(0, PRESETS.length - 1))) % PRESETS.length : mode; next = t + rand(40, 60); }
      const want = PRESETS[mode], ease = Math.min(1, dt * .35);
      for (const k in cur) cur[k] += (want[k] - cur[k]) * ease;
      hue += dt * (6 + sg.mid * 10) * sp;
      const { g, w, h } = B, cx = w / 2, cy = h / 2, src = A.c;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      const z = Math.pow(cur.zoom + cur.bz * p, f * sp), rot = (cur.rot + cur.br * p) * f * sp;
      const decay = Math.pow(.955, f);
      const pass = (sxs, sys, alpha) => {
        g.globalAlpha = alpha;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.translate(cx + cur.dx * f * sp, cy + cur.dy * f * sp); g.rotate(rot); g.scale(z * sxs, z * sys); g.translate(-cx, -cy);
        const strips = 10, shh = h / strips;
        for (let s = 0; s < strips; s++) {
          const o = Math.sin(s * .9 + t * 1.1) * cur.ripple * (1 + p);
          g.drawImage(src, 0, s * shh, w, shh + 1, o, s * shh, w, shh + 1);
        }
      };
      pass(1, 1, decay);
      if (cur.mirror > .02) { pass(-1, 1, decay * cur.mirror * .45); pass(1, -1, decay * cur.mirror * .3); }
      // A slow colour shift on everything that is fading.
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
      g.globalCompositeOperation = 'multiply'; g.fillStyle = hsl(hue + 160, 70, 97); g.fillRect(0, 0, w, h);
      // The waveform, as a ring or a line or somewhere between.
      g.globalCompositeOperation = 'lighter';
      const R = Math.min(w, h) * (.2 + .06 * sg.level + .05 * p), amp = Math.min(w, h) * .14, ring = cur.ring;
      g.beginPath();
      for (let i = 0; i <= 128; i++) {
        const q = i / 128, wi = Math.min(511, i * 4), taper = Math.min(1, q * 8, (1 - q) * 8);
        const v = sg.wave[wi] * (ring > .5 ? taper : 1);
        const a = q * TAU + t * .2, rx = cx + Math.cos(a) * (R + v * amp), ry = cy + Math.sin(a) * (R + v * amp);
        const lx = w * (.1 + .8 * q), ly = cy + v * amp * 1.4;
        const x = lx + (rx - lx) * ring, y = ly + (ry - ly) * ring;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.lineJoin = 'round'; g.lineWidth = 1.6 * Math.max(1, w / 400);
      g.strokeStyle = hsl(hue, 90, 58 + 12 * p, .75 + .25 * sg.level); g.stroke();
      g.globalCompositeOperation = 'source-over';
      [A, B] = [B, A];
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(A.c, 0, 0, W, H);
    }
  };
}

/* Superscope: a slowly turning figure of glowing points, its radius riding the waveform, morphing between sphere, coil and knot */
export function superscopeScene() {
  let buf, sprites, punch, n = 0, P;
  const shapes = [
    (i, n) => { const y = 1 - 2 * (i + .5) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996; return [Math.cos(a) * r, y, Math.sin(a) * r]; },
    (i, n) => { const u = i / n * TAU, v = u * 23; const r = .68 + .32 * Math.cos(v); return [Math.cos(u) * r, Math.sin(v) * .32, Math.sin(u) * r]; },
    (i, n) => { const u = i / n * TAU; const r = .55 + .3 * Math.cos(3 * u); return [Math.cos(2 * u) * r, Math.sin(3 * u) * .5, Math.sin(2 * u) * r]; },
  ];
  return {
    init() {
      buf = buffer(lowPower ? 700 : 1400); punch = puncher();
      n = lowPower ? 360 : 720;
      P = shapes.map(fn => Float32Array.from({ length: n * 3 }, (_, k) => fn(Math.floor(k / 3), n)[k % 3]));
      sprites = [];
      for (let k = 0; k < 36; k++) {
        const [c, g] = plain(32, 32);
        const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        gr.addColorStop(0, hsl(k * 10, 100, 92)); gr.addColorStop(.25, hsl(k * 10, 95, 62, .8)); gr.addColorStop(1, hsl(k * 10, 90, 50, 0));
        g.fillStyle = gr; g.fillRect(0, 0, 32, 32); sprites.push(c);
      }
      buf.g.fillStyle = '#000'; buf.g.fillRect(0, 0, buf.w, buf.h);
    },
    draw(t, dt) {
      const sg = signal(t, dt), p = punch(sg.bass, dt), sp = lively ? 1.6 : 1;
      const { g, w, h, k } = buf;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(0,0,0,${1 - Math.pow(.72, dt * 60)})`; g.fillRect(0, 0, w, h);
      // Which two shapes, and how far between them: a 40 s hold with an 8 s morph.
      const cyc = Math.max(0, t) / 40, si = Math.floor(cyc) % 3, fr = cyc - Math.floor(cyc), m = clamp((fr - .8) / .2), mm = m * m * (3 - 2 * m);
      const a0 = P[si], a1 = P[(si + 1) % 3];
      const ay = t * .22 * sp, ax = .45 + .3 * Math.sin(t * .11), cY = Math.cos(ay), sY = Math.sin(ay), cX = Math.cos(ax), sX = Math.sin(ax);
      const cam = 3.2, sc = Math.min(w, h) * .31 * (1 + .16 * p + .05 * sg.level), cx = w / 2, cy = h / 2;
      const hue = t * 9, dot = 12 * k * Math.min(W, H) / 800 * (lowPower ? 1.2 : 1);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        let x = a0[j] + (a1[j] - a0[j]) * mm, y = a0[j + 1] + (a1[j + 1] - a0[j + 1]) * mm, z = a0[j + 2] + (a1[j + 2] - a0[j + 2]) * mm;
        const rr = 1 + .38 * sg.wave[Math.floor(i / n * 512)];
        x *= rr; y *= rr; z *= rr;
        const x1 = x * cY + z * sY, z1 = -x * sY + z * cY;
        const y2 = y * cX - z1 * sX, z2 = y * sX + z1 * cX;
        const d = cam / (cam + z2), depth = clamp((1 - z2) / 2);
        const px = cx + x1 * sc * d, py = cy + y2 * sc * d, s = dot * d * (.5 + depth);
        g.globalAlpha = .25 + .75 * depth;
        g.drawImage(sprites[Math.floor(((hue + depth * 140) % 360) / 10) % 36], px - s / 2, py - s / 2, s, s);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(buf.c, 0, 0, W, H);
    }
  };
}

/* Beat Starfield: flying through stars that streak and surge on the bass, a faint waveform ring at the centre */
export function beatStarsScene() {
  let stars, punch, speed = .14, tintHue = rand(0, 360), nextTint = 0, tintFrom = 0, tintTo = 0, tintAt = 0;
  return {
    init() {
      punch = puncher();
      const n = Math.round(Math.min(lowPower ? 380 : 900, W * H / 1500));
      stars = Array.from({ length: n }, () => ({ x: rand(-1, 1), y: rand(-1, 1), z: rand(.05, 1) }));
    },
    draw(t, dt) {
      const sg = signal(t, dt), p = punch(sg.bass, dt) * (1 - .5 * sg.idle), sp = lively ? 1.7 : 1;
      const target = (.12 + .85 * p + .1 * sg.level) * sp;
      speed += (target - speed) * Math.min(1, dt * (target > speed ? 5 : 1.2));
      // Every so often a tint drifts in, holds and fades back to white.
      if (t > nextTint) { tintFrom = tintTo; tintTo = tintTo > .1 ? 0 : rand(.35, .65); tintAt = t; if (tintTo) tintHue = rand(0, 360); nextTint = t + rand(14, 24); }
      const tp = clamp((t - tintAt) / 5), tint = tintFrom + (tintTo - tintFrom) * tp * tp * (3 - 2 * tp);
      ctx.fillStyle = '#020309'; ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, F = Math.max(W, H) * .55, mn = Math.min(W, H);
      const neb = ctx.createRadialGradient(cx, cy, 0, cx, cy, mn * .6);
      neb.addColorStop(0, hsl(tintHue, 60, 30, .12 * tint + .03)); neb.addColorStop(1, hsl(tintHue, 60, 20, 0));
      ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
      const expo = .05 + speed * .12;
      const paths = [[], [], [], []];
      for (const s of stars) {
        s.z -= speed * dt;
        let x = cx + s.x / s.z * F, y = cy + s.y / s.z * F;
        if (s.z < .02 || x < -40 || x > W + 40 || y < -40 || y > H + 40) {
          s.x = rand(-1, 1); s.y = rand(-1, 1); s.z = rand(.85, 1);
          continue;
        }
        const zp = s.z + speed * expo + .002, x0 = cx + s.x / zp * F, y0 = cy + s.y / zp * F;
        paths[clamp(Math.floor((1 - s.z) * 4), 0, 3)].push(x0, y0, x, y);
      }
      const col = [255 - tint * 120, 255 - tint * 120, 255].map(Math.round);
      const tc = hsl(tintHue, 80, 75);
      ctx.lineCap = 'round';
      for (let b = 0; b < 4; b++) {
        const a = paths[b]; if (!a.length) continue;
        ctx.beginPath();
        for (let i = 0; i < a.length; i += 4) { ctx.moveTo(a[i], a[i + 1]); ctx.lineTo(a[i + 2], a[i + 3]); }
        ctx.lineWidth = (.6 + b * .55) * Math.max(1, mn / 700);
        ctx.globalAlpha = .25 + b * .25;
        ctx.strokeStyle = tint > .05 ? tc : `rgb(${col})`; ctx.stroke();
        if (tint > .05) { ctx.globalAlpha = (.25 + b * .25) * (1 - tint); ctx.strokeStyle = '#fff'; ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      // The waveform ring.
      const R = mn * (.12 + .05 * sg.level + .03 * p), amp = mn * .05;
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const q = i / 160, v = sg.wave[Math.min(511, i * 3)] * Math.min(1, q * 8, (1 - q) * 8), a = q * TAU - t * .15;
        const x = cx + Math.cos(a) * (R + v * amp), y = cy + Math.sin(a) * (R + v * amp);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = hsl(tintHue, 40 + 50 * tint, 75, .16 + .2 * sg.level + .15 * p); ctx.lineWidth = 1.4; ctx.stroke();
    }
  };
}

/* Dancing Scope: the waveform wrapped round a circle in mirrored copies, glowing, turning and leaving soft trails */
export function dancingScopeScene() {
  let A, B, punch, hue = rand(0, 360);
  const ring = (g, cx, cy, R, amp, copies, off, rot, sg, M) => {
    g.beginPath();
    for (let c = 0; c < copies; c++) {
      for (let j = 0; j < M; j++) {
        const q = c % 2 ? M - 1 - j : j;
        const v = sg.wave[off + q * 2], a = rot + (c + j / (M - 1)) / copies * TAU, r = R + v * amp;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        c || j ? g.lineTo(x, y) : g.moveTo(x, y);
      }
    }
    g.closePath();
  };
  return {
    init() {
      const cap = lowPower ? 600 : 1100;
      A = buffer(cap); B = buffer(cap); punch = puncher();
      for (const b of [A, B]) { b.g.fillStyle = '#000'; b.g.fillRect(0, 0, b.w, b.h); }
    },
    draw(t, dt) {
      const sg = signal(t, dt), p = punch(sg.bass, dt), sp = lively ? 1.6 : 1, f = dt * 60;
      hue += dt * (8 + 10 * sg.mid) * sp;
      const { g, w, h } = B, cx = w / 2, cy = h / 2, mn = Math.min(w, h);
      // Trails: the last frame, a touch larger and dimmer.
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      const z = Math.pow(1.006 + .01 * p, f);
      g.globalAlpha = Math.pow(.88, f);
      g.translate(cx, cy); g.scale(z, z); g.rotate(.0015 * f * sp); g.translate(-cx, -cy);
      g.drawImage(A.c, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'lighter';
      const copies = lowPower ? 4 : 6, M = lowPower ? 48 : 80, k = mn / 700;
      const R = mn * (.27 + .07 * sg.level + .05 * p), rot = t * .12 * sp;
      g.lineJoin = 'round';
      ring(g, cx, cy, R, mn * .16, copies, 0, rot, sg, M);
      g.strokeStyle = hsl(hue, 90, 55, .22); g.lineWidth = 12 * k; g.stroke();
      g.strokeStyle = hsl(hue, 95, 62, .55); g.lineWidth = 5 * k; g.stroke();
      g.strokeStyle = hsl(hue, 80, 85, .9); g.lineWidth = 1.8 * k; g.stroke();
      ring(g, cx, cy, R * .52, mn * .09, copies + 2, 200, -rot * 1.3, sg, M / 2);
      g.strokeStyle = hsl(hue + 140, 90, 55, .25); g.lineWidth = 9 * k; g.stroke();
      g.strokeStyle = hsl(hue + 140, 85, 75, .8); g.lineWidth = 1.6 * k; g.stroke();
      g.globalCompositeOperation = 'source-over';
      [A, B] = [B, A];
      ctx.drawImage(A.c, 0, 0, W, H);
    }
  };
}
