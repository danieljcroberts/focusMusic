// Pixel-art and cosy scenes drawn in code: a little train, a fishing pier, an arcade, a rainy TV,
// a cat on the sill, a record player, a typewriter and a jellyfish tank.
import { W, H, ctx, lowPower, lively } from '../view.js';
import { rand, hash, mix, rgb, layer, glow, plain } from '../util.js';
import { weather } from '../weather.js';
import { daylight, skyMix } from '../daylight.js';
import { bands, musicPlaying, currentTrack } from '../music.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const pack = c => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
const stale = built => Math.abs(daylight() - built) > .04;

// Pixel art: a small buffer at `s` CSS pixels per art pixel, covering the screen, scaled up with crisp edges.
function pixBuf(s) {
  s = Math.max(2, Math.round(s));
  const w = Math.ceil(W / s), h = Math.ceil(H / s), [c, g] = plain(w, h);
  return { c, g, w, h, s };
}
const pixScale = target => Math.max(W, H) / target;
function blit(p) { ctx.imageSmoothingEnabled = false; ctx.drawImage(p.c, 0, 0, p.w * p.s, p.h * p.s); ctx.imageSmoothingEnabled = true; }
function px(g, c, x, y, w = 1, h = 1) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
function pline(g, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let n = 0; n < 2000; n++) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
function pdisc(g, cx, cy, r) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let y = -r; y <= r; y++) { const hw = Math.round(Math.sqrt(Math.max(0, r * r - y * y)) - .2); g.fillRect(cx - hw, cy + y, hw * 2 + 1, 1); }
}
// A banded pixel sky with a 2×2 ordered dither between the bands.
function pixSky(g, w, h, top, mid, low, bandsN = 8) {
  const id = g.createImageData(w, h), u = new Uint32Array(id.data.buffer), bay = [0, .5, .75, .25];
  const cols = Array.from({ length: bandsN + 1 }, (_, i) => { const q = i / bandsN; return pack(q < .6 ? mix(top, mid, q / .6) : mix(mid, low, (q - .6) / .4)); });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const f = y / Math.max(1, h - 1) * bandsN + bay[(x & 1) + ((y & 1) << 1)] - .5;
    u[y * w + x] = cols[clamp(Math.round(f), 0, bandsN)];
  }
  g.putImageData(id, 0, 0);
}
// A 3×5 pixel font for signs and arcade screens.
const FONT = { A: [2, 5, 7, 5, 5], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], R: [6, 5, 6, 5, 5], I: [7, 2, 2, 2, 7], H: [5, 5, 7, 5, 5],
  O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], N: [6, 5, 5, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], G: [3, 4, 5, 5, 3], U: [5, 5, 5, 5, 7], Y: [5, 5, 2, 2, 2],
  0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 3, 1, 7], 4: [5, 5, 7, 1, 1], 5: [7, 4, 7, 1, 7], 6: [7, 4, 7, 5, 7], 7: [7, 1, 1, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7] };
function ptext(g, str, x, y, sc = 1) {
  for (const ch of String(str)) {
    const rows = FONT[ch];
    if (rows) for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (rows[r] & (4 >> b)) g.fillRect(x + b * sc, y + r * sc, sc, sc);
    x += 4 * sc;
  }
}

/* Pixel Train Journey: a little steam train crossing countryside, over a bridge and through a tunnel now and then */
export function pixelTrainScene() {
  let p, sky, built = -1, pal = {}, P32 = {}, fgCv, fgG, fgId, fgU, stars = [], clouds = [], smoke = [], puff = 0, X = 0;
  const PER = 420, F0 = 150;
  const BASE = { far: [128, 166, 182], near: [98, 152, 82], nearTop: [124, 176, 96], tree: [46, 96, 52], treeLit: [82, 140, 64], trunk: [92, 64, 44], hedge: [52, 92, 46],
    wheat: [216, 190, 98], wheat2: [196, 166, 82], green: [112, 170, 74], green2: [96, 152, 64], plough: [128, 96, 66], plough2: [116, 86, 58], verge: [104, 156, 70],
    flower: [244, 240, 224], flower2: [236, 124, 146], water: [78, 138, 200], water2: [168, 210, 238], ballast: [118, 108, 98], sleeper: [72, 52, 42], rail: [198, 200, 208],
    pole: [96, 72, 54], wire: [54, 56, 66], iron: [70, 64, 72], stone: [152, 144, 134], stone2: [112, 104, 98], body: [158, 46, 48], bodyDark: [104, 28, 34], roof: [54, 44, 52],
    engine: [44, 70, 54], engineLit: [76, 112, 86], brass: [224, 184, 94], dark: [30, 26, 30], cottage: [228, 218, 198], roofRed: [164, 74, 62], cloud: [250, 250, 252], smoke: [236, 236, 238] };
  const tone = (c, d) => skyMix(mix(c, [12, 16, 40], .74), mix(c, [130, 80, 104], .3), c, d);
  const feature = wx => {
    const k = Math.floor(wx / PER), l = wx - k * PER, L = k % 2 ? 64 : 76;
    return l >= F0 && l < F0 + L ? { tunnel: k % 2 !== 0, s: k * PER + F0, L } : null;
  };
  function build() {
    const d = daylight(); built = d;
    const { w, ty } = p;
    let g; [sky, g] = plain(w, ty + 1);
    pixSky(g, w, ty + 1, skyMix([6, 10, 30], [62, 60, 128], [86, 146, 222], d), skyMix([14, 22, 52], [180, 112, 140], [150, 196, 236], d), skyMix([26, 36, 70], [250, 172, 112], [206, 228, 242], d));
    if (d > .35) { g.fillStyle = css(skyMix([0, 0, 0], [255, 170, 110], [255, 244, 200], d)); pdisc(g, w * .78, ty * (.75 - .5 * clamp((d - .5) * 2, 0, 1)), 5); }
    else { g.fillStyle = '#e8ecff'; pdisc(g, w * .2, ty * .22, 4); g.fillStyle = css(skyMix([6, 10, 30], [62, 60, 128], [86, 146, 222], d)); pdisc(g, w * .2 + 2, ty * .22 - 1, 3); }
    pal = {}; P32 = {};
    for (const k in BASE) { const c = tone(BASE[k], d); pal[k] = css(c); P32[k] = pack(c); }
    pal.win = css(skyMix([255, 214, 120], [255, 210, 140], [178, 206, 226], d));
  }
  return {
    init() {
      p = pixBuf(pixScale(260)); p.ty = Math.round(p.h * .6);
      [fgCv, fgG] = plain(p.w, p.h - p.ty - 3);
      fgId = fgG.createImageData(p.w, p.h - p.ty - 3); fgU = new Uint32Array(fgId.data.buffer);
      stars = Array.from({ length: Math.round(p.w * p.ty / 90) }, () => ({ x: Math.floor(rand(0, p.w)), y: Math.floor(rand(0, p.ty * .7)), ph: rand(0, TAU) }));
      clouds = Array.from({ length: 5 }, () => ({ x: rand(0, p.w + 40), y: Math.floor(rand(4, p.ty * .45)), w: Math.floor(rand(10, 22)), v: rand(.6, 1.6) }));
      smoke = []; build();
    },
    draw(t, dt) {
      if (stale(built)) build();
      const { g, w, h, s, ty } = p, d = built, night = clamp(1 - d * 1.6, 0, 1), speed = lively ? 24 : 14;
      X += dt * speed;
      g.drawImage(sky, 0, 0);
      if (night > 0) for (const st of stars) { g.globalAlpha = night * (.4 + .4 * Math.sin(t * .8 + st.ph)); px(g, '#f0f2ff', st.x, st.y); }
      g.globalAlpha = .9 - .5 * night; g.fillStyle = pal.cloud;
      for (const c of clouds) {
        const x = Math.round(((c.x - X * .05 - t * c.v) % (w + 40) + w + 40) % (w + 40) - 20);
        g.fillRect(x, c.y, c.w, 2); g.fillRect(x + 2, c.y - 1, c.w - 5, 1); g.fillRect(x + 4, c.y - 2, Math.floor(c.w / 3), 1);
      }
      g.globalAlpha = 1;
      // Far hills, then nearer hills with trees, then hedgerows and the odd cottage.
      g.fillStyle = pal.far;
      for (let x = 0; x < w; x++) { const wx = x + X * .12, top = Math.round(ty - 20 - 8 * Math.sin(wx * .021) - 5 * Math.sin(wx * .057 + 2)); g.fillRect(x, top, 1, ty - top); }
      for (let x = 0; x < w; x++) {
        const wx = x + X * .3, top = Math.round(ty - 10 - 6 * Math.sin(wx * .036 + 1) - 3 * Math.sin(wx * .093));
        g.fillStyle = pal.near; g.fillRect(x, top, 1, ty - top); g.fillStyle = pal.nearTop; g.fillRect(x, top, 1, 1);
      }
      for (let k = Math.floor(X * .3 / 7) - 1; k < (X * .3 + w) / 7 + 1; k++) {
        if (hash(k, 1) > .3) continue;
        const wx = k * 7 + 3, x = wx - X * .3, top = Math.round(ty - 10 - 6 * Math.sin(wx * .036 + 1) - 3 * Math.sin(wx * .093));
        g.fillStyle = pal.tree; pdisc(g, x, top - 1, 2);
      }
      for (let k = Math.floor(X * .6 / 12) - 1; k < (X * .6 + w) / 12 + 1; k++) {
        const r = hash(k, 2), x = Math.round(k * 12 - X * .6 + hash(k, 4) * 6);
        if (r < .05) {
          px(g, pal.cottage, x, ty - 7, 9, 6); g.fillStyle = pal.roofRed;
          for (let i = 0; i < 4; i++) g.fillRect(x - 1 + i, ty - 8 - i, 11 - i * 2, 1);
          px(g, pal.dark, x + 6, ty - 4, 2, 3); px(g, night > .3 ? '#ffd27a' : pal.win, x + 2, ty - 5, 2, 2);
        } else if (r < .55) {
          const rr = r < .3 ? 3 : 2;
          px(g, pal.trunk, x, ty - 3, 1, 3); g.fillStyle = pal.tree; pdisc(g, x, ty - 3 - rr, rr);
          g.fillStyle = pal.treeLit; g.fillRect(x - rr + 1, ty - 4 - rr * 2 + 1, rr, 1);
        } else if (r < .8) { g.fillStyle = pal.hedge; g.fillRect(x - 3, ty - 2, 7, 2); g.fillRect(x - 2, ty - 3, 5, 1); }
      }
      // The fields: a ground plane in perspective, furrows converging on the horizon, a river under each bridge.
      const fy0 = ty + 3, fh = h - fy0, wd = w / 2, wt = Math.floor(t * 3);
      for (let y = 0; y < fh; y++) {
        const q = y / fh, v = 1 + 1.8 * q, row = y * w;
        for (let x = 0; x < w; x++) {
          const wx = (x - wd) / v + X + wd;
          let c;
          if (q < .05) c = P32.verge;
          else {
            const k = Math.floor(wx / PER), l = wx - k * PER;
            if (!(k & 1) && l > F0 + 10 && l < F0 + 66) c = (Math.imul(Math.floor(wx * .5) + wt, 374761393) + y * 668265263) >>> 0 & 15 ? P32.water : P32.water2;
            else {
              const plot = Math.floor(wx / 64), lp = wx - plot * 64, kind = (Math.imul(plot, 1103515245) + 12345) >>> 16 & 3;
              if (lp < 1.6) c = P32.hedge;
              else if (kind === 0) c = Math.floor(wx / 3) & 1 ? P32.wheat : P32.wheat2;
              else if (kind === 1) c = Math.floor(wx / 4) & 1 ? P32.green : P32.green2;
              else if (kind === 2) c = Math.floor(wx / 2) & 1 ? P32.plough : P32.plough2;
              else { const hh = (Math.imul(Math.floor(wx * 1.5), 374761393) + Math.imul(y, 668265263)) >>> 0; c = hh % 61 === 0 ? P32.flower : hh % 89 === 0 ? P32.flower2 : P32.verge; }
            }
          }
          fgU[row + x] = c;
        }
      }
      fgG.putImageData(fgId, 0, 0); g.drawImage(fgCv, 0, fy0);
      // The line: ballast, sleepers and rail, with a girder bridge over each river.
      px(g, pal.ballast, 0, ty + 1, w, 2); g.fillStyle = pal.sleeper;
      for (let x = -((Math.floor(X) % 4)); x < w; x += 4) g.fillRect(x, ty + 1, 2, 1);
      px(g, pal.rail, 0, ty, w, 1);
      const k0 = Math.floor((X - 100) / PER), k1 = Math.floor((X + w) / PER);
      for (let k = k0; k <= k1; k++) {
        if (k & 1) continue;
        const sx = Math.round(k * PER + F0 - X);
        px(g, pal.iron, sx + 8, ty + 1, 60, 2); px(g, pal.stone, sx + 4, ty + 1, 4, 7); px(g, pal.stone, sx + 68, ty + 1, 4, 7);
        for (const o of [28, 48]) { px(g, pal.stone, o + sx, ty + 3, 3, 6); px(g, pal.stone2, o + sx + 2, ty + 3, 1, 6); }
        g.fillStyle = pal.iron; g.fillRect(sx + 8, ty - 8, 60, 1);
        for (let i = 0; i <= 6; i++) { g.fillRect(sx + 8 + i * 10, ty - 8, 1, 8); if (i < 6) pline(g, sx + 8 + i * 10, i & 1 ? ty - 8 : ty - 1, sx + 18 + i * 10, i & 1 ? ty - 1 : ty - 8); }
      }
      // Telegraph poles and their sagging wires.
      g.fillStyle = pal.wire;
      for (let x = 0; x < w; x++) { const u = (((x + X) % 46) + 46) % 46 / 46, sag = Math.round(12 * u * (1 - u)); g.fillRect(x, ty - 19 + sag, 1, 1); }
      for (let k = Math.floor(X / 46); k <= Math.floor((X + w) / 46) + 1; k++) {
        if (feature(k * 46)) continue;
        const x = Math.round(k * 46 - X);
        px(g, pal.pole, x, ty - 20, 1, 19); px(g, pal.pole, x - 2, ty - 19, 5, 1); px(g, pal.cottage, x - 2, ty - 20, 1, 1); px(g, pal.cottage, x + 2, ty - 20, 1, 1);
      }
      // The train: two carriages, a tender and the engine, wheels turning, rods going round.
      const x0 = Math.round(w / 2 - 39), fr = Math.floor(X / 2) % 3, rod = Math.round(Math.sin(X * .5));
      const wheel = (x, big) => { px(g, pal.dark, x, ty - (big ? 3 : 2), big ? 3 : 2, big ? 3 : 2); px(g, pal.rail, x + (big ? fr % 2 + .5 : fr % 2), ty - (big ? 2 : 2), 1, 1); };
      for (const cx of [x0, x0 + 22]) {
        px(g, pal.roof, cx + 1, ty - 12, 18, 1); px(g, pal.body, cx, ty - 11, 20, 7); px(g, pal.bodyDark, cx, ty - 6, 20, 1);
        for (let i = 0; i < 4; i++) px(g, pal.win, cx + 2 + i * 5, ty - 10, 3, 3);
        px(g, pal.dark, cx + 1, ty - 4, 18, 1); wheel(cx + 3); wheel(cx + 15);
        px(g, pal.dark, cx + 20, ty - 6, 2, 1);
      }
      const td = x0 + 44, en = x0 + 55;
      px(g, pal.engine, td, ty - 9, 10, 5); px(g, pal.dark, td + 1, ty - 10, 8, 1); px(g, pal.dark, td + 2, ty - 11, 3, 1); px(g, pal.dark, td, ty - 4, 10, 1); wheel(td + 1); wheel(td + 6);
      px(g, pal.dark, td + 10, ty - 6, 1, 1);
      px(g, pal.roof, en - 1, ty - 14, 10, 1); px(g, pal.engine, en, ty - 13, 8, 9); px(g, pal.win, en + 2, ty - 12, 3, 3);
      px(g, pal.engine, en + 8, ty - 10, 13, 6); px(g, pal.engineLit, en + 8, ty - 10, 13, 1); px(g, pal.brass, en + 12, ty - 10, 1, 6);
      px(g, pal.brass, en + 13, ty - 12, 3, 2); px(g, pal.dark, en + 18, ty - 13, 2, 3); px(g, pal.dark, en + 17, ty - 14, 4, 1);
      px(g, pal.dark, en + 20, ty - 10, 2, 6); px(g, pal.bodyDark, en + 21, ty - 5, 2, 2); px(g, pal.brass, en + 21, ty - 9, 1, 1);
      px(g, pal.dark, en, ty - 4, 22, 1); px(g, pal.dark, en + 22, ty - 3, 1, 2);
      wheel(en + 2); wheel(en + 9, true); wheel(en + 14, true); px(g, pal.rail, en + 10 + rod, ty - 2, 6, 1);
      // Smoke from the chimney, left behind as the train goes on. None inside the tunnel.
      puff -= dt;
      const chimX = en + 19, inTun = (wx) => { const f = feature(wx); return f && f.tunnel; };
      if (puff <= 0) { puff = .22; if (!inTun(chimX + X)) smoke.push({ x: chimX, y: ty - 15, life: 0, dr: rand(-.3, .3) }); }
      g.fillStyle = pal.smoke;
      for (const m of smoke) {
        m.life += dt / 2.6; m.x -= speed * dt * .85; m.y -= (4 + 3 * (1 - m.life)) * dt; m.x += m.dr * dt;
        g.globalAlpha = (1 - m.life) * (.85 - .35 * night); pdisc(g, m.x, m.y, Math.round(1 + m.life * 2.6));
      }
      g.globalAlpha = 1; smoke = smoke.filter(m => m.life < 1);
      // Tunnel hills sit in front of the line.
      for (let k = k0; k <= k1; k++) {
        if (!(k & 1)) continue;
        const sx = Math.round(k * PER + F0 - X), L = 64;
        for (let x = Math.max(0, sx - 18); x < Math.min(w, sx + L + 18); x++) {
          const ramp = x < sx ? (x - sx + 18) / 18 : x >= sx + L ? (sx + L + 18 - x) / 18 : 1;
          const hh = Math.round(3 + Math.pow(ramp, .7) * (22 + 3 * Math.sin((x + X) * .15))), top = ty + 3 - hh;
          px(g, pal.near, x, top, 1, hh); px(g, pal.nearTop, x, top, 1, 1);
        }
        for (const e of [sx - 2, sx + L]) { g.fillStyle = pal.stone; g.fillRect(e, ty - 17, 3, 20); g.fillStyle = pal.stone2; for (let y = ty - 16; y < ty + 3; y += 2) g.fillRect(e + (y & 2 ? 0 : 2), y, 1, 1); }
        g.fillStyle = pal.tree; for (const o of [12, 31, 47]) pdisc(g, sx + o, ty - 23 + Math.round(3 * Math.sin((sx + o + X) * .15)), 2);
      }
      blit(p);
      // Lit windows and the headlamp after dark.
      if (night > .05) {
        ctx.globalCompositeOperation = 'lighter';
        for (const cx of [x0, x0 + 22]) for (let i = 0; i < 4; i++) {
          const wx = cx + 3.5 + i * 5; if (inTun(wx + X)) continue;
          glow(ctx, wx * s, (ty - 8.5) * s, 5 * s, [255, 200, 110], .3 * night);
        }
        if (!inTun(en + 22 + X)) { glow(ctx, (en + 21.5) * s, (ty - 8.5) * s, 9 * s, [255, 226, 160], .45 * night); glow(ctx, (en + 34) * s, (ty - 6) * s, 14 * s, [255, 226, 160], .12 * night); }
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  };
}

/* Fishing Pier: someone fishing off the end of a wooden pier as the sun goes down and the stars come out */
export function pierScene() {
  let p, sky, skyAt = -1, stars = [], gulls = [], drops = [], rings = [], bite = { next: 14, t: -1 }, geo;
  const darkness = t => clamp(.12 + t / 420, 0, 1);
  function build(pr) {
    skyAt = pr;
    const { w, h } = p, hy = geo.hy;
    let g; [sky, g] = plain(w, h);
    const top = mix([70, 80, 156], [8, 10, 32], pr), mid = mix([206, 124, 146], [44, 36, 86], pr), low = mix([255, 176, 96], [130, 62, 84], pr);
    pixSky(g, w, hy, top, mid, low, 9);
    g.fillStyle = css(mix([255, 214, 130], [255, 120, 70], pr));
    g.save(); g.beginPath(); g.rect(0, 0, w, hy); g.clip(); pdisc(g, geo.sunX, hy - 3 + pr * 12, geo.sunR); g.restore();
    g.fillStyle = css(mix([96, 60, 96], [16, 14, 32], pr));
    for (let x = 0; x < w * .3; x++) { const hh = Math.round(4 * Math.sin(x / (w * .3) * Math.PI) + 1.5 * Math.sin(x * .4)); if (hh > 0) g.fillRect(x, hy - hh, 1, hh); }
    const wtop = mix(low, [40, 30, 60], .35), wbot = mix([40, 40, 90], [4, 6, 18], pr);
    const id = g.createImageData(w, h - hy), u = new Uint32Array(id.data.buffer), bay = [0, .5, .75, .25];
    for (let y = 0; y < h - hy; y++) for (let x = 0; x < w; x++) {
      const q = clamp(Math.round(Math.sqrt(y / (h - hy)) * 6 + bay[(x & 1) + ((y & 1) << 1)] - .5), 0, 6) / 6;
      u[y * w + x] = pack(mix(wtop, wbot, q));
    }
    g.putImageData(id, 0, hy);
  }
  return {
    init() {
      p = pixBuf(pixScale(250));
      const { w, h } = p, port = w < h, hy = Math.round(h * (port ? .48 : .5)), dy = hy + Math.round((h - hy) * (port ? .22 : .3));
      geo = { hy, dy, x0: Math.round(w * (port ? .52 : .55)), sunX: Math.round(w * (port ? .3 : .32)), sunR: port ? 6 : 7 };
      stars = Array.from({ length: Math.round(w * hy / 70) }, () => ({ x: Math.floor(rand(0, w)), y: Math.floor(rand(0, hy * .8)), th: rand(.3, .95), ph: rand(0, TAU) }));
      gulls = Array.from({ length: 3 }, (_, i) => ({ x: rand(0, w), y: rand(hy * .25, hy * .7), v: rand(2.5, 4.5) * (i === 1 ? -1 : 1), ph: rand(0, 20) }));
      skyAt = -1;
    },
    draw(t, dt) {
      const pr = darkness(t);
      if (Math.abs(pr - skyAt) > .02 || !sky) build(pr);
      const { g, w, h, s } = p, { hy, dy, x0, sunX } = geo;
      g.drawImage(sky, 0, 0);
      for (const st of stars) {
        const a = clamp((pr - st.th) * 4, 0, 1) * (.55 + .35 * Math.sin(t * .7 + st.ph));
        if (a > .02) { g.globalAlpha = a; px(g, '#eef0ff', st.x, st.y); }
      }
      g.globalAlpha = 1;
      // Shimmer on the water, warm in the sun's path and cool elsewhere.
      const warm = css(mix([255, 210, 140], [255, 140, 100], pr)), cool = css(mix([226, 190, 220], [110, 110, 170], pr));
      for (let y = hy + 1; y < h; y += 1) {
        const q = (y - hy) / (h - hy), n = 1 + Math.floor(q * 4);
        for (let k = 0; k < n; k++) {
          const dir = hash(y, k + 9) > .5 ? 1 : -1, x = ((hash(y, k) * w * 2 + dir * t * (1.5 + q * 4)) % w + w) % w;
          const len = 1 + Math.floor(hash(k, y) * (2 + q * 5)), a = .25 + .3 * Math.sin(t * 1.3 + y * .7 + k * 2);
          if (a <= 0) continue;
          g.globalAlpha = a * (1 - pr * .6); px(g, cool, x, y, len, 1);
        }
        const spread = 1 + q * 9 + Math.sin(t * 2 + y) * 1.2, sx = sunX + Math.sin(t * 1.1 + y * .9) * 1.5;
        g.globalAlpha = (1 - q) * (.8 - pr * .55); px(g, warm, sx - spread, y, Math.max(1, Math.round(spread * 2 * (.5 + .5 * Math.sin(y * 1.7 + t * 3)))), 1);
      }
      g.globalAlpha = 1;
      // A distant buoy light, slowly breathing.
      g.globalAlpha = .3 + .3 * Math.sin(t * 1.2); px(g, '#ff7a6a', Math.round(w * .82), hy + 2); g.globalAlpha = 1;
      // Gulls: mostly gliding, a few lazy wingbeats now and then.
      g.fillStyle = css(mix([50, 36, 60], [150, 150, 180], pr * .4));
      for (const gl of gulls) {
        gl.x += gl.v * dt; if (gl.x > w + 6) gl.x = -6; if (gl.x < -6) gl.x = w + 6;
        const y = Math.round(gl.y + Math.sin(t * .4 + gl.ph) * 3), x = Math.round(gl.x);
        const flap = Math.sin(t * .5 + gl.ph) > .6 && Math.sin(t * 7 + gl.ph) > 0;
        if (flap) { g.fillRect(x - 2, y + 1, 1, 1); g.fillRect(x - 1, y, 3, 1); g.fillRect(x + 2, y + 1, 1, 1); }
        else { g.fillRect(x - 2, y, 1, 1); g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x, y, 1, 1); g.fillRect(x + 1, y - 1, 1, 1); g.fillRect(x + 2, y, 1, 1); }
      }
      // The pier.
      const wood = css(mix([132, 90, 62], [44, 32, 34], pr)), woodD = css(mix([84, 54, 42], [22, 16, 20], pr)), post = css(mix([70, 46, 36], [18, 14, 18], pr));
      for (let x = x0 + 1; x < w; x += 9) {
        px(g, post, x, dy + 2, 2, 9); g.globalAlpha = .35; px(g, post, x + Math.round(Math.sin(t * 1.5 + x) * .6), dy + 12, 2, 4); g.globalAlpha = 1;
        g.globalAlpha = .35; px(g, cool, x - 1, dy + 11, 4, 1); g.globalAlpha = 1;
      }
      px(g, wood, x0, dy, w - x0, 1); px(g, woodD, x0, dy + 1, w - x0, 1);
      g.fillStyle = woodD; for (let x = x0 + 3; x < w; x += 4) g.fillRect(x, dy, 1, 1);
      for (let x = x0 + 12; x < w; x += 9) px(g, post, x, dy - 4, 1, 4);
      px(g, post, x0 + 12, dy - 4, w - x0 - 12, 1);
      const lampX = x0 + 9;
      px(g, post, lampX, dy - 12, 1, 12); px(g, post, lampX - 1, dy - 13, 3, 1);
      px(g, css(mix([120, 100, 70], [255, 200, 110], pr)), lampX - 1, dy - 12, 3, 2);
      // The angler: straw hat, blue jacket, legs over the end, a bucket beside them.
      const skin = css(mix([224, 176, 140], [70, 52, 56], pr)), coat = css(mix([62, 86, 128], [22, 26, 44], pr)), hat = css(mix([214, 176, 90], [70, 60, 46], pr));
      px(g, coat, x0, dy - 5, 3, 5); px(g, skin, x0, dy - 7, 2, 2); px(g, hat, x0 - 1, dy - 8, 4, 1); px(g, hat, x0, dy - 9, 2, 1);
      px(g, css(mix([60, 56, 70], [16, 16, 24], pr)), x0 - 1, dy, 2, 3); px(g, coat, x0 - 1, dy - 3, 1, 1);
      px(g, css(mix([150, 156, 166], [36, 40, 50], pr)), x0 + 4, dy - 2, 2, 2);
      // Bites: the float nibbles, goes under with a splash, and the rod bends.
      bite.next -= dt;
      if (bite.t < 0 && bite.next <= 0) bite.t = 0;
      let bend = 0, under = false, jig = 0;
      if (bite.t >= 0) {
        bite.t += dt; const bt = bite.t;
        if (bt < 1.4) jig = Math.sin(bt * 14) > .3 ? 1 : 0;
        else if (bt < 2.6) { under = true; bend = ease((bt - 1.4) / .3); }
        else bend = 1 - ease((bt - 2.6) / 1.6);
        if (bt >= 1.4 && bt - dt < 1.4) {
          rings.push({ r: 0 });
          for (let i = 0; i < 6; i++) drops.push({ x: 0, y: 0, vx: rand(-6, 6), vy: rand(-14, -8), life: 0 });
        }
        if (bt > 4.4) { bite.t = -1; bite.next = rand(16, 34); }
      }
      const hx = x0 - 1, hy2 = dy - 3, tipX = x0 - 16 - bend * 2, tipY = dy - 16 + bend * 7;
      const bx = x0 - 25 + Math.round(bend * 2), by = dy + 7 + Math.round(Math.sin(t * 1.6) * .6) + jig;
      g.fillStyle = css(mix([50, 36, 30], [12, 10, 12], pr));
      for (let i = 0; i <= 18; i++) {
        const u = i / 18, cx = hx - 7, cy = hy2 - 11 + bend * 6;
        g.fillRect(Math.round((1 - u) * (1 - u) * hx + 2 * u * (1 - u) * cx + u * u * tipX), Math.round((1 - u) * (1 - u) * hy2 + 2 * u * (1 - u) * cy + u * u * tipY), 1, 1);
      }
      g.fillStyle = `rgba(230,230,240,${.5 - .2 * pr})`;
      for (let i = 1; i < 14; i++) { const u = i / 14; g.fillRect(Math.round(tipX + (bx - tipX) * u), Math.round(tipY + (by - tipY) * u + Math.sin(u * Math.PI) * (3 - bend * 3)), 1, 1); }
      if (!under) { px(g, '#e04a3a', bx, by - 1); px(g, css(mix([240, 240, 240], [120, 120, 130], pr)), bx, by); }
      for (const r of rings) {
        r.r += dt * 3; g.globalAlpha = clamp(1 - r.r / 6, 0, 1) * .6; g.fillStyle = cool;
        const rr = Math.round(r.r); g.fillRect(bx - rr * 2, by + 1, 1, 1); g.fillRect(bx + rr * 2, by + 1, 1, 1); g.fillRect(bx - rr, by + 1 + Math.ceil(rr / 3), rr * 2 + 1, 1);
      }
      rings = rings.filter(r => r.r < 6);
      g.fillStyle = '#e8f0ff';
      for (const dr of drops) { dr.life += dt; dr.vy += 30 * dt; dr.x += dr.vx * dt; dr.y += dr.vy * dt; g.globalAlpha = .8; if (dr.y < 1) px(g, '#e8f0ff', bx + dr.x, by + dr.y); }
      drops = drops.filter(d => d.y < 1 && d.life < 2);
      g.globalAlpha = 1;
      blit(p);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, (lampX + .5) * s, (dy - 11) * s, 26 * s, [255, 190, 110], .1 + .4 * pr);
      glow(ctx, (lampX + .5) * s, (dy + 12) * s, 10 * s, [255, 190, 110], .12 * pr);
      glow(ctx, sunX * s, (hy - 1) * s, 60 * s, [255, 150, 90], .25 * (1 - pr));
      ctx.globalCompositeOperation = 'source-over';
    }
  };
}

/* Arcade at Closing Time: a row of cabinets in an empty arcade, each screen still running its attract mode */
export function arcadeScene() {
  let p, base, cabs = [], geo, board, piece, stepT = 0;
  const KINDS = ['maze', 'shooter', 'racer', 'blocks', 'pong', 'title'];
  const TRIM = [[230, 70, 110], [70, 170, 230], [240, 180, 60], [160, 90, 230], [80, 200, 130], [240, 120, 60]];
  const GLOW = { maze: [70, 100, 255], shooter: [80, 255, 140], racer: [120, 200, 255], blocks: [200, 100, 255], pong: [220, 230, 255], title: [255, 120, 170] };
  const PIECES = [[[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]]];
  const BLOCKC = ['#ff6a8a', '#ffd25a', '#6ae0ff', '#a07aff', '#7affa0'];
  const tri = (x, n) => { const m = x % (2 * n); return m < n ? m : 2 * n - m; };
  function newPiece(cols) { const k = Math.floor(rand(0, PIECES.length)); return { k, cells: PIECES[k], x: Math.floor(rand(0, cols - 3)), y: -2 }; }
  function hit(pc, dx, dy, cols, rows) { return pc.cells.some(([cx, cy]) => { const x = pc.x + cx + dx, y = pc.y + cy + dy; return x < 0 || x >= cols || y >= rows || (y >= 0 && board[y][x] >= 0); }); }
  function screen(g, kind, x, y, w, h, t, dt) {
    g.fillStyle = '#05040c'; g.fillRect(x, y, w, h);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (kind === 'maze') {
      g.fillStyle = '#3050ff';
      g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
      const ix = x + 5, iy = y + 5, iw = w - 10, ih = h - 10; g.fillRect(ix, iy, iw, 1); g.fillRect(ix, iy + ih - 1, iw, 1); g.fillRect(ix, iy, 1, ih); g.fillRect(ix + iw - 1, iy, 1, ih);
      const pw = w - 6, ph = h - 6, per = 2 * (pw + ph), at = u => { u = ((u % per) + per) % per; return u < pw ? [x + 2 + u, y + 2] : u < pw + ph ? [x + 2 + pw, y + 2 + u - pw] : u < 2 * pw + ph ? [x + 2 + pw - (u - pw - ph), y + 2 + ph] : [x + 2, y + 2 + ph - (u - 2 * pw - ph)]; };
      const pos = (t * 7) % per;
      g.fillStyle = '#ffd0b0'; for (let u = 1; u < per; u += 3) if (u > pos) { const [a, b] = at(u); g.fillRect(Math.round(a), Math.round(b), 1, 1); }
      const [pxx, pyy] = at(pos); g.fillStyle = '#ffe04a'; g.fillRect(Math.round(pxx) - 1, Math.round(pyy) - 1, 3, 3);
      if (Math.floor(t * 6) % 2) { g.fillStyle = '#05040c'; g.fillRect(Math.round(pxx) + 1, Math.round(pyy), 1, 1); }
      const [gx, gy] = at(pos - 9); g.fillStyle = '#ff5a7a'; g.fillRect(Math.round(gx) - 1, Math.round(gy) - 1, 3, 2); g.fillRect(Math.round(gx) - 1, Math.round(gy) + 1, 1, 1); g.fillRect(Math.round(gx) + 1, Math.round(gy) + 1, 1, 1);
    } else if (kind === 'shooter') {
      g.fillStyle = '#556'; for (let i = 0; i < 6; i++) g.fillRect(x + Math.floor(hash(i, 1) * w), y + Math.floor((hash(i, 2) * h + t * 2) % h), 1, 1);
      const cols = Math.max(3, Math.floor((w - 4) / 5)), ox = Math.round(tri(t * 2, w - cols * 5 + 1)), oy = 2 + Math.floor((t / 6) % 3), fr = Math.floor(t * 1.5) % 2, wave = Math.floor(t / 12);
      g.fillStyle = '#7aff9a';
      for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) {
        if (hash(c + r * 7, wave) < .2) continue;
        const ax = x + ox + c * 5, ay = y + oy + r * 4;
        g.fillRect(ax, ay, 3, 1); g.fillRect(ax + (fr ? 0 : 1), ay + 1, fr ? 3 : 1, 1);
      }
      const sx = x + Math.round(tri(t * 3 + 4, w - 4)) + 1; g.fillStyle = '#e8f0ff'; g.fillRect(sx, y + h - 2, 3, 1); g.fillRect(sx + 1, y + h - 3, 1, 1);
      const bt = t % 1.6; if (bt < 1) { g.fillStyle = '#fff'; g.fillRect(sx + 1, y + h - 4 - Math.floor(bt * h), 1, 1); }
    } else if (kind === 'racer') {
      const hz = Math.round(h * .38), cv = Math.sin(t * .3);
      g.fillStyle = '#1a1850'; g.fillRect(x, y, w, hz); g.fillStyle = '#ff9a5a'; g.fillRect(x + Math.round(w * .6), y + hz - 3, 3, 2);
      for (let r = hz; r < h; r++) {
        const q = (r - hz) / (h - hz), st = Math.floor(2 / (q + .08) + t * 8) & 1, hw = 1 + q * w * .42, c = x + w / 2 + cv * (1 - q) * (1 - q) * w * .35;
        g.fillStyle = st ? '#2f8a3a' : '#257030'; g.fillRect(x, y + r, w, 1);
        g.fillStyle = st ? '#6a6a76' : '#5c5c68'; g.fillRect(Math.round(c - hw), y + r, Math.round(hw * 2), 1);
        g.fillStyle = st ? '#ff4a4a' : '#fff'; g.fillRect(Math.round(c - hw), y + r, 1, 1); g.fillRect(Math.round(c + hw) - 1, y + r, 1, 1);
        if (st) { g.fillStyle = '#ffffff'; g.fillRect(Math.round(c), y + r, 1, 1); }
      }
      const carX = x + Math.round(w / 2 - 2 + Math.sin(t * .7) * 2); g.fillStyle = '#ff3a5a'; g.fillRect(carX, y + h - 3, 4, 2); g.fillStyle = '#ffd0d8'; g.fillRect(carX + 1, y + h - 4, 2, 1);
    } else if (kind === 'blocks') {
      const cols = Math.floor((w - 2) / 2), rows = Math.floor((h - 2) / 2);
      if (!board || board.length !== rows || board[0].length !== cols) { board = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, () => r > rows - 4 && Math.random() < .6 ? Math.floor(rand(0, 5)) : -1)); piece = newPiece(cols); }
      stepT += dt;
      if (stepT > .45) {
        stepT = 0;
        if (Math.random() < .25) { const dx = Math.random() < .5 ? -1 : 1; if (!hit(piece, dx, 0, cols, rows)) piece.x += dx; }
        if (!hit(piece, 0, 1, cols, rows)) piece.y++;
        else {
          for (const [cx, cy] of piece.cells) if (piece.y + cy >= 0) board[piece.y + cy][piece.x + cx] = piece.k;
          board = board.filter(r => r.some(v => v < 0)); while (board.length < rows) board.unshift(Array(cols).fill(-1));
          piece = newPiece(cols);
          if (board[2].some(v => v >= 0)) board = board.map(() => Array(cols).fill(-1));
        }
      }
      g.fillStyle = '#2a2050'; g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] >= 0) { g.fillStyle = BLOCKC[board[r][c]]; g.fillRect(x + 1 + c * 2, y + 1 + r * 2, 2, 2); }
      g.fillStyle = BLOCKC[piece.k]; for (const [cx, cy] of piece.cells) if (piece.y + cy >= 0) g.fillRect(x + 1 + (piece.x + cx) * 2, y + 1 + (piece.y + cy) * 2, 2, 2);
    } else if (kind === 'pong') {
      g.fillStyle = '#556'; for (let r = 0; r < h; r += 2) g.fillRect(x + Math.floor(w / 2), y + r, 1, 1);
      const bx = 2 + tri(t * 9, w - 5), by = 1 + tri(t * 6.3, h - 3);
      g.fillStyle = '#e8f0ff';
      g.fillRect(x + 1, y + Math.round(clamp(by - 1.5 + Math.sin(t) * .8, 0, h - 4)), 1, 4); g.fillRect(x + w - 2, y + Math.round(clamp(by - 2 - Math.sin(t * .7), 0, h - 4)), 1, 4);
      g.fillRect(x + Math.round(bx), y + Math.round(by), 1, 1);
      if (h > 14 && w > 18) { g.globalAlpha = .6; ptext(g, Math.floor(t / 20) % 10, x + Math.floor(w / 2) - 5, y + 2); ptext(g, Math.floor(t / 27 + 3) % 10, x + Math.floor(w / 2) + 3, y + 2); g.globalAlpha = 1; }
    } else {
      g.fillStyle = '#334'; for (let i = 0; i < 8; i++) g.fillRect(x + Math.floor(hash(i, 3) * w), y + Math.floor((hash(i, 4) * h + t * (3 + i)) % h), 1, 1);
      const cols = ['#ffcf5a', '#ff8a5a', '#ff5a8a', '#b05aff'];
      for (let i = 0; i < 4; i++) { g.fillStyle = cols[(i + Math.floor(t * .7)) % 4]; g.fillRect(x + 3, y + 3 + i * 2, w - 6, 1); }
      g.fillStyle = '#e8f0ff'; if (w >= 20) ptext(g, 'HI', x + Math.floor((w - 15) / 2), y + h - 7);
      g.globalAlpha = .5 + .5 * Math.sin(t * 1.2); g.fillStyle = '#ffe04a'; if (w >= 20) ptext(g, '90', x + Math.floor((w - 15) / 2) + 8, y + h - 7); g.globalAlpha = 1;
    }
    g.restore();
    g.fillStyle = 'rgba(0,0,0,.28)'; for (let r = 1; r < h; r += 2) g.fillRect(x, y + r, w, 1);
  }
  return {
    init() {
      const s = Math.max(2, Math.round(Math.min(W / 190, H / 120)));
      p = pixBuf(s); const { w, h } = p, port = w < h;
      const n = port || w < 170 ? 5 : 6, gap = port ? 3 : 5, cw = Math.min(Math.floor(((port ? w - 8 : w * .84) - gap * (n - 1)) / n), 36), ch = Math.round(cw * 2.05);
      const floorY = Math.round(h * (port ? .64 : .74)), bottom = floorY + Math.max(3, Math.round(cw * .2)), x0 = Math.floor((w - (n * cw + gap * (n - 1))) / 2);
      geo = { floorY, bottom, cw, ch };
      let g; [base, g] = plain(w, h);
      pixSky(g, w, floorY, [8, 6, 16], [26, 16, 40], [40, 22, 52], 6);
      g.fillStyle = '#1e1228'; g.fillRect(0, floorY - Math.round((floorY) * .22), w, Math.round(floorY * .22));
      g.fillStyle = '#3a2440'; g.fillRect(0, floorY - Math.round(floorY * .22) - 1, w, 1);
      g.fillStyle = '#160d1e'; for (let x = 3; x < w; x += 8) g.fillRect(x, floorY - Math.round(floorY * .22), 1, Math.round(floorY * .22));
      // The carpet: a dark ground with the usual neon squiggles and triangles.
      const id = g.createImageData(w, h - floorY), u = new Uint32Array(id.data.buffer);
      for (let y = 0; y < h - floorY; y++) {
        const fade = .14 + .3 * Math.pow(1 - y / (h - floorY), 2);
        for (let x = 0; x < w; x++) {
          const lx = (x + (Math.floor(y / 10) & 1) * 7) % 14, ly = y % 10;
          let c = [16, 12, 34];
          if ((lx === 2 && ly >= 2 && ly <= 4) || (ly === 4 && lx >= 2 && lx <= 4) || (lx - 2 === 4 - ly && lx >= 2 && lx <= 4)) c = [240, 70, 150];
          else if (lx >= 7 && lx <= 12 && ly === 6 + ((lx >> 1) & 1)) c = [60, 200, 230];
          else if ((lx === 10 && ly === 2) || (lx === 4 && ly === 8)) c = [240, 210, 70];
          else if (lx === 12 && ly === 1) c = [150, 90, 240];
          u[y * w + x] = pack(c.length && c[0] === 16 ? c : mix([16, 12, 34], c, fade));
        }
      }
      g.putImageData(id, 0, floorY);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, floorY, w, 2);
      cabs = [];
      for (let i = 0; i < n; i++) {
        const x = x0 + i * (cw + gap), y = bottom - ch, trim = TRIM[(i + (port ? 1 : 0)) % TRIM.length], kind = KINDS[i];
        g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x - 1, bottom - 1, cw + 2, 3);
        g.fillStyle = '#1c1826'; g.fillRect(x, y, cw, ch);
        g.fillStyle = '#121019'; g.fillRect(x + 2, y + 7, cw - 4, ch - 7);
        g.fillStyle = css(trim); g.fillRect(x, y, 1, ch); g.fillRect(x + cw - 1, y, 1, ch);
        g.fillStyle = css(mix(trim, [255, 255, 255], .35)); g.fillRect(x + 1, y + 1, cw - 2, 5);
        g.fillStyle = css(mix(trim, [0, 0, 0], .4)); for (let k = 0; k < 3; k++) g.fillRect(x + 3 + k * Math.floor((cw - 6) / 3), y + 2 + (k & 1), Math.floor((cw - 6) / 4), 3);
        const sw = cw - 8, sh = Math.round(sw * .8), sx = x + 4, sy = y + 8;
        g.fillStyle = '#08070c'; g.fillRect(sx - 1, sy - 1, sw + 2, sh + 2);
        const cp = sy + sh + 3;
        g.fillStyle = '#2c2638'; g.fillRect(x - 1, cp, cw + 2, 4); g.fillStyle = '#3c3448'; g.fillRect(x - 1, cp, cw + 2, 1); g.fillStyle = '#16121c'; g.fillRect(x - 1, cp + 4, cw + 2, 1);
        g.fillStyle = '#111'; g.fillRect(x + 5, cp - 1, 1, 2); g.fillStyle = css(trim); g.fillRect(x + 4, cp - 2, 3, 1);
        for (let k = 0; k < 3; k++) { g.fillStyle = ['#ff5a5a', '#5ad0ff', '#ffd05a'][k]; g.fillRect(x + cw - 12 + k * 3, cp + 1, 2, 1); }
        const cd = cp + 8; g.fillStyle = '#25202f'; g.fillRect(x + Math.floor(cw / 2) - 4, cd, 8, 7);
        g.fillStyle = '#ff3a2a'; g.fillRect(x + Math.floor(cw / 2) - 3, cd + 2, 1, 2); g.fillRect(x + Math.floor(cw / 2) + 2, cd + 2, 1, 2);
        cabs.push({ kind, sx, sy, sw, sh, x, y, trim, glow: GLOW[kind] });
      }
      // The neon sign above the row.
      const sc = port ? 3 : w > 120 ? 2 : 1, tw = 6 * 4 * sc - sc, sxx = Math.floor((w - tw) / 2), syy = Math.max(3, Math.round((bottom - ch) * (port ? .55 : .35)) - 2 * sc);
      g.fillStyle = '#120a18'; g.fillRect(sxx - 4, syy - 3, tw + 8, 5 * sc + 6); g.fillStyle = '#2a1830'; g.fillRect(sxx - 4, syy - 3, tw + 8, 1);
      g.fillStyle = '#ff4aa0'; ptext(g, 'ARCADE', sxx, syy, sc);
      geo.sign = { x: sxx + tw / 2, y: syy + 2.5 * sc, w: tw };
      board = null; stepT = 0;
    },
    draw(t, dt) {
      const { g, s } = p;
      g.drawImage(base, 0, 0);
      for (const c of cabs) screen(g, c.kind, c.sx, c.sy, c.sw, c.sh, t, dt);
      blit(p);
      ctx.globalCompositeOperation = 'lighter';
      const sg = geo.sign;
      glow(ctx, sg.x * s, sg.y * s, sg.w * s * .9, [255, 70, 160], .2 + .03 * Math.sin(t * .6));
      for (let i = 0; i < cabs.length; i++) {
        const c = cabs[i], cx = (c.sx + c.sw / 2) * s, cy = (c.sy + c.sh / 2) * s, a = .2 + .04 * Math.sin(t * 1.1 + i * 1.7);
        glow(ctx, cx, cy, geo.cw * s * 1.1, c.glow, a);
        ctx.save(); ctx.translate(cx, (geo.bottom + 4) * s); ctx.scale(1, .32);
        glow(ctx, 0, 0, geo.cw * s * 1.5, c.glow, a * .8); ctx.restore();
        glow(ctx, (c.x + geo.cw / 2) * s, (c.y + 3) * s, geo.cw * s * .7, c.trim, .1);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  };
}

/* CRT Rain: a rainy city window at night, seen on an old television */
export function crtRainScene() {
  let buf, bg, city, redC, redG, cyanC, cyanG, scan, vig, drops = [], drips = [], blinks = [], bw, bh, k, geo;
  return {
    init() {
      k = W > 700 ? 3 : 2; bw = Math.ceil(W / k); bh = Math.ceil(H / k);
      [buf, bg] = plain(bw, bh); [redC, redG] = plain(bw, bh); [cyanC, cyanG] = plain(bw, bh);
      let g; [city, g] = plain(bw, bh);
      const hz = bh * .66;
      const sk = g.createLinearGradient(0, 0, 0, hz);
      sk.addColorStop(0, '#070818'); sk.addColorStop(.6, '#1e1634'); sk.addColorStop(1, '#5a3048');
      g.fillStyle = sk; g.fillRect(0, 0, bw, bh);
      blinks = [];
      for (let layerI = 0; layerI < 2; layerI++) {
        let x = -5;
        while (x < bw) {
          const bwid = rand(10, 30) * (1 + layerI * .6), top = hz - rand(bh * .08, bh * (layerI ? .42 : .3));
          g.fillStyle = layerI ? '#0c0a16' : '#171428'; g.fillRect(x, top, bwid, bh - top);
          for (let wy = top + 3; wy < bh; wy += 4) for (let wx = x + 2; wx < x + bwid - 2; wx += 3) {
            if (Math.random() < (layerI ? .2 : .14)) {
              const warm = Math.random() < .75; g.fillStyle = warm ? 'rgba(255,200,120,.75)' : 'rgba(140,210,255,.7)'; g.fillRect(wx, wy, 1.5, 1.5);
              if (layerI && Math.random() < .03) blinks.push({ x: wx, y: wy, ph: rand(0, 40), warm });
            }
          }
          x += bwid + rand(0, 3);
        }
      }
      // A hotel sign down the side of the nearest building.
      const nx = bw * .78, ny = bh * .2, fs = Math.max(6, bh * .045);
      g.fillStyle = '#0b0912'; g.fillRect(nx - fs * 2.2, ny - fs * 1.8, bw, bh);
      for (let wy = ny + fs * 6; wy < bh; wy += 5) for (let wx = nx - fs * 2; wx < bw; wx += 4) if (Math.random() < .12) { g.fillStyle = 'rgba(255,190,120,.6)'; g.fillRect(wx, wy, 2, 2); }
      g.fillStyle = '#05040a'; g.fillRect(nx - fs * .8, ny - fs, fs * 1.6, fs * 6.4);
      g.font = `bold ${fs}px "IBM Plex Mono", monospace`; g.textAlign = 'center'; g.fillStyle = '#ff5ab0';
      'HOTEL'.split('').forEach((c, i) => g.fillText(c, nx, ny + i * fs * 1.15 + fs * .3));
      const ng = g.createRadialGradient(nx, ny + fs * 2.2, 0, nx, ny + fs * 2.2, fs * 5);
      ng.addColorStop(0, 'rgba(255,90,176,.22)'); ng.addColorStop(1, 'rgba(255,90,176,0)'); g.fillStyle = ng; g.fillRect(0, 0, bw, bh);
      const sg = g.createLinearGradient(0, hz - bh * .05, 0, bh);
      sg.addColorStop(0, 'rgba(255,150,90,0)'); sg.addColorStop(1, 'rgba(255,150,90,.28)'); g.fillStyle = sg; g.fillRect(0, 0, bw, bh);
      // Beads of water on the glass.
      for (let i = 0; i < bw * bh / 260; i++) {
        const x = rand(0, bw), y = rand(0, bh), r = rand(.4, 1.6);
        g.fillStyle = 'rgba(10,10,20,.35)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(220,220,255,.35)'; g.fillRect(x - r * .4, y - r * .5, Math.max(.6, r * .5), Math.max(.6, r * .5));
      }
      // The window frame.
      const fw = Math.max(2, bw * .018); g.fillStyle = '#07060a';
      g.fillRect(0, 0, bw, fw); g.fillRect(0, bh - fw * 2.5, bw, fw * 2.5); g.fillRect(0, 0, fw, bh); g.fillRect(bw - fw, 0, fw, bh);
      g.fillRect(bw * .5 - fw / 2, 0, fw, bh); g.fillRect(0, bh * .48, bw, fw * .8);
      drops = Array.from({ length: 70 }, () => ({ x: rand(0, bw), y: rand(0, bh), l: rand(4, 10) }));
      drips = Array.from({ length: 7 }, () => ({ x: rand(0, bw), y0: rand(0, bh * .6), y: 0, v: rand(4, 10), wait: rand(0, 4) }));
      for (const d of drips) d.y = d.y0;
      // Overlays at full size: scan lines and the tube's darkened corners.
      const m = Math.round(Math.min(W, H) * .035), r = Math.min(W, H) * .07;
      geo = { m, r, x: m, y: m, w: W - 2 * m, h: H - 2 * m };
      [scan, g] = layer(W, H);
      g.fillStyle = 'rgba(0,0,0,.26)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1.2);
      [vig, g] = layer(W, H);
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.hypot(W, H) * .58);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(.7, 'rgba(0,0,0,.3)'); vg.addColorStop(1, 'rgba(0,0,0,.85)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      const gl = g.createLinearGradient(geo.x, geo.y, geo.x + geo.w * .5, geo.y + geo.h * .5);
      gl.addColorStop(0, 'rgba(255,255,255,.07)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
    },
    draw(t, dt) {
      const g = bg;
      g.drawImage(city, 0, 0);
      for (const b of blinks) if (Math.sin(t * .15 + b.ph) < -.3) { g.fillStyle = '#0c0a16'; g.fillRect(b.x, b.y, 1.5, 1.5); }
      const n = Math.round(drops.length * (.35 + .65 * weather));
      g.strokeStyle = 'rgba(190,200,230,.18)'; g.lineWidth = .7; g.beginPath();
      for (let i = 0; i < n; i++) {
        const d = drops[i]; d.y += bh * .9 * dt; d.x -= bh * .12 * dt; if (d.y > bh) { d.y = -d.l; d.x = rand(0, bw * 1.1); }
        g.moveTo(d.x, d.y); g.lineTo(d.x - d.l * .13, d.y + d.l);
      }
      g.stroke();
      for (const d of drips) {
        if (d.wait > 0) d.wait -= dt; else { d.y += d.v * dt; if (Math.random() < dt * .6) d.wait = rand(.3, 1.6); }
        if (d.y > bh) { d.y0 = rand(0, bh * .6); d.y = d.y0; d.x = rand(0, bw); }
        g.strokeStyle = 'rgba(200,210,240,.16)'; g.lineWidth = 1; g.beginPath(); g.moveTo(d.x, d.y0); g.lineTo(d.x, d.y); g.stroke();
        g.fillStyle = 'rgba(230,235,255,.5)'; g.fillRect(d.x - .7, d.y - .7, 1.6, 1.8);
      }
      // Split the picture into red and cyan and land them slightly apart, as an old set does.
      redG.globalCompositeOperation = 'source-over'; redG.drawImage(buf, 0, 0); redG.globalCompositeOperation = 'multiply'; redG.fillStyle = '#ff0000'; redG.fillRect(0, 0, bw, bh);
      cyanG.globalCompositeOperation = 'source-over'; cyanG.drawImage(buf, 0, 0); cyanG.globalCompositeOperation = 'multiply'; cyanG.fillStyle = '#00ffff'; cyanG.fillRect(0, 0, bw, bh);
      const { x, y, w, h, r, m } = geo;
      const bz = ctx.createLinearGradient(0, 0, 0, H); bz.addColorStop(0, '#1d1b1a'); bz.addColorStop(1, '#0c0b0b');
      ctx.fillStyle = bz; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
      ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
      const off = Math.max(1.2, Math.min(W, H) * .003);
      ctx.drawImage(cyanC, -off * .5, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(redC, off, 0, W, H);
      ctx.globalAlpha = .12; ctx.drawImage(buf, -off * 2, -off, W + off * 4, H + off * 2); ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      // The on-screen display, VHS style.
      const fs = Math.max(15, Math.min(W, H) * .045), now = new Date(), hr = now.getHours(), pad = v => String(v).padStart(2, '0');
      const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      ctx.font = `500 ${fs}px "VT323", "IBM Plex Mono", monospace`; ctx.textBaseline = 'alphabetic';
      const osd = (txt, tx, ty, align) => {
        ctx.textAlign = align;
        ctx.fillStyle = 'rgba(255,60,80,.45)'; ctx.fillText(txt, tx - 1.5, ty);
        ctx.fillStyle = 'rgba(60,220,255,.45)'; ctx.fillText(txt, tx + 1.5, ty);
        ctx.fillStyle = 'rgba(245,245,240,.88)'; ctx.fillText(txt, tx, ty);
      };
      const ix = x + Math.max(m, fs * 1.1), iy = y + Math.max(m, fs * 1.1);
      osd('PLAY ▶', ix, iy + fs * .6, 'left'); osd('SP', x + w - Math.max(m, fs * 1.1), iy + fs * .6, 'right');
      osd(`${hr < 12 ? 'AM' : 'PM'} ${pad(hr % 12 || 12)}:${pad(now.getMinutes())}`, ix, y + h - Math.max(m, fs * 1.1) - fs * 1.15, 'left');
      osd(`${MON[now.getMonth()]}. ${pad(now.getDate())} ${now.getFullYear()}`, ix, y + h - Math.max(m, fs * 1.1), 'left');
      ctx.textAlign = 'start';
      ctx.drawImage(scan, 0, 0, W, H);
      const band = ((t * .06) % 1.3 - .15) * H, bgr = ctx.createLinearGradient(0, band - H * .08, 0, band + H * .08);
      bgr.addColorStop(0, 'rgba(255,255,255,0)'); bgr.addColorStop(.5, 'rgba(255,255,255,.035)'); bgr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bgr; ctx.fillRect(x, band - H * .08, w, H * .16);
      ctx.drawImage(vig, 0, 0, W, H);
      ctx.fillStyle = `rgba(0,0,0,${.025 + .02 * Math.sin(t * 6.1) * Math.sin(t * .9)})`; ctx.fillRect(x, y, w, h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = Math.max(2, m * .25); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x - m * .4, y - m * .4, w + m * .8, h + m * .8, r * 1.2); ctx.stroke();
    }
  };
}

/* Cat on the Windowsill: a cat watching the rain from a dim room, dozing off, woken by a passing bird */
export function catScene() {
  let room, outside, glass, built = -1, geo, streaks = [], bird = null;
  let c = 0, yaw = 0, yawT = 0, mode = 'awake', modeT = 40, lookT = 6, birdT = 25, flick = 0, flickT = 5, ear = 0, earT = 8;
  const SIT = [[-28, 0], [-33, -12], [-29, -28], [-18, -44], [-13, -58], [0, -64], [13, -58], [18, -44], [29, -28], [33, -12], [28, 0], [0, 2]];
  const CURL = [[-48, 0], [-52, -12], [-44, -26], [-28, -34], [-10, -37], [8, -37], [26, -34], [42, -26], [50, -12], [46, 0], [20, 2], [-14, 2]];
  function blob(pts) {
    const n = pts.length; ctx.beginPath();
    ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    ctx.closePath();
  }
  function build() {
    const d = daylight() * .75; built = daylight();
    const { wx, wy, ww, wh, sill, u } = geo;
    let g; [outside, g] = layer(W, H);
    const sk = g.createLinearGradient(0, wy, 0, wy + wh);
    sk.addColorStop(0, rgb(skyMix([14, 18, 30], [70, 72, 96], [126, 140, 156], d))); sk.addColorStop(1, rgb(skyMix([30, 34, 48], [120, 104, 112], [168, 176, 182], d)));
    g.fillStyle = sk; g.fillRect(wx, wy, ww, wh);
    const far = skyMix([20, 24, 36], [60, 60, 78], [104, 112, 124], d), near = skyMix([10, 12, 20], [36, 36, 50], [70, 76, 86], d);
    for (const [col, base, hmax, lit] of [[far, wy + wh * .7, wh * .2, .25], [near, wy + wh * .86, wh * .3, .4]]) {
      let x = wx - 10;
      while (x < wx + ww) {
        const bw = rand(ww * .1, ww * .2), bh = rand(hmax * .4, hmax), top = base - bh;
        g.fillStyle = rgb(col); g.fillRect(x, top, bw, wy + wh - top);
        g.beginPath(); g.moveTo(x - 2, top); g.lineTo(x + bw / 2, top - bw * .35); g.lineTo(x + bw + 2, top); g.fill();
        if (Math.random() < .6) g.fillRect(x + bw * .7, top - bw * .4, bw * .1, bw * .3);
        for (let k = 0; k < 4; k++) if (Math.random() < lit * (1.4 - d)) { g.fillStyle = rgb([255, 206, 130], .55 + .3 * (1 - d)); g.fillRect(x + rand(.15, .75) * bw, top + rand(.2, .7) * (base - top + hmax * .2), u * 3, u * 4); g.fillStyle = rgb(col); }
        x += bw + rand(0, ww * .03);
      }
    }
    g.fillStyle = rgb(skyMix([8, 12, 14], [30, 34, 34], [52, 66, 58], d));
    for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(wx + ww * (.82 + rand(-.1, .14)), wy + wh * (.45 + rand(-.12, .25)), rand(.06, .12) * ww, 0, TAU); g.fill(); }
    g.fillStyle = rgb(skyMix([160, 170, 200], [190, 180, 190], [220, 225, 230], d), .14); g.fillRect(wx, wy, ww, wh);
    [glass, g] = layer(W, H);
    for (let i = 0; i < ww * wh / 900; i++) {
      const x = wx + rand(0, ww), y = wy + rand(0, wh), r = rand(.6, 2.4) * u * .5 + .4;
      g.fillStyle = 'rgba(10,12,20,.25)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(220,230,255,.3)'; g.beginPath(); g.arc(x - r * .3, y - r * .3, r * .4, 0, TAU); g.fill();
    }
    [room, g] = layer(W, H);
    const wall = g.createLinearGradient(0, 0, W, H);
    wall.addColorStop(0, '#24170f'); wall.addColorStop(1, '#120b08'); g.fillStyle = wall; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.006)'; for (let x = 0; x < W; x += 14 * u) g.fillRect(x, 0, 6 * u, H);
    g.clearRect(wx, wy, ww, wh);
    const fw = Math.max(5, ww * .03); g.fillStyle = '#1b120c';
    g.fillRect(wx - fw, wy - fw, ww + fw * 2, fw); g.fillRect(wx - fw, wy, fw, wh); g.fillRect(wx + ww, wy, fw, wh);
    g.fillRect(wx + ww / 2 - fw * .4, wy, fw * .8, wh); g.fillRect(wx, wy + wh * .42, ww, fw * .8);
    g.fillStyle = 'rgba(160,180,210,.10)'; g.fillRect(wx - fw, wy - fw, ww + fw * 2, 1.5);
    const sl = sill;
    g.fillStyle = '#3a2618'; g.fillRect(sl.x, sl.y, sl.w, sl.h);
    g.fillStyle = '#4c3322'; g.fillRect(sl.x, sl.y, sl.w, 2);
    g.fillStyle = '#20140c'; g.fillRect(sl.x + u * 4, sl.y + sl.h, sl.w - u * 8, sl.h * .6);
    // Curtain on the right, a pot plant on the sill.
    const cg = g.createLinearGradient(wx + ww * .82, 0, wx + ww + fw * 4, 0);
    for (let k = 0; k <= 6; k++) cg.addColorStop(k / 6, k % 2 ? '#3a1e1c' : '#25120f');
    g.fillStyle = cg; g.beginPath(); g.moveTo(wx + ww + fw * 4, wy - fw * 2); g.lineTo(wx + ww * .84, wy - fw * 2);
    g.quadraticCurveTo(wx + ww * .9, wy + wh * .5, wx + ww + fw * 1.5, sl.y); g.lineTo(wx + ww + fw * 4, sl.y); g.fill();
    const px0 = wx + ww * .66, py0 = sl.y;
    g.fillStyle = '#0f1a10';
    for (let k = 0; k < 7; k++) { g.save(); g.translate(px0, py0 - 12 * u); g.rotate(-1.2 + k * .4); g.beginPath(); g.ellipse(0, -14 * u, 4.5 * u, 14 * u, 0, 0, TAU); g.fill(); g.restore(); }
    g.fillStyle = '#4a2a1c'; g.beginPath(); g.moveTo(px0 - 11 * u, py0 - 16 * u); g.lineTo(px0 + 11 * u, py0 - 16 * u); g.lineTo(px0 + 8 * u, py0); g.lineTo(px0 - 8 * u, py0); g.fill();
    g.globalCompositeOperation = 'lighter';
    glow(g, W * .02, H * .98, Math.max(W, H) * .7, [255, 160, 80], .16);
    glow(g, wx + ww / 2, sl.y, ww * .8, [140, 160, 200], .06);
    g.globalCompositeOperation = 'source-over';
  }
  function drawCat(col, dy, t) {
    const { catX, sill, u } = geo, cc = ease(c), br = 1 + .02 * Math.sin(t * 1.5) * cc;
    ctx.save(); ctx.translate(catX, sill.y + dy); ctx.scale(u, u);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round';
    const pts = SIT.map((a, i) => [a[0] + (CURL[i][0] - a[0]) * cc, (a[1] + (CURL[i][1] - a[1]) * cc) * br]);
    blob(pts); ctx.fill();
    // Tail: hanging over the front of the sill and swaying, or wrapped round when curled up.
    const sw = Math.sin(t * .7) * .5 + flick * Math.sin(t * 5) * .5, tipC = .5 + .5 * Math.sin(t * .9 + 1);
    const T0 = [[14, -2], [22, 18], [10 + sw * 8, 38], [18 + sw * 16, 52 - tipC * 6]], T1 = [[40, -6], [56, 6], [12, 10], [-32, 4]];
    const tp = T0.map((a, i) => [a[0] + (T1[i][0] - a[0]) * cc, a[1] + (T1[i][1] - a[1]) * cc]);
    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(...tp[0]); ctx.bezierCurveTo(...tp[1], ...tp[2], ...tp[3]); ctx.stroke();
    const hx = -36 * cc, hy = -74 + 48 * cc, r = 16 - 2 * cc;
    ctx.beginPath(); ctx.ellipse(hx, hy, r * 1.08, r, 0, 0, TAU); ctx.fill();
    for (const side of [-1, 1]) {
      const far = side * yaw < 0 ? 1 - .35 * Math.abs(yaw) : 1, bx = hx + side * r * .55 * (1 - .3 * Math.abs(yaw)) + yaw * r * .35, by = hy - r * .55;
      const tw = side === 1 ? ear * 3 : 0, th = r * (1.45 - .35 * cc) * far;
      ctx.beginPath(); ctx.moveTo(bx - r * .34, by + r * .2); ctx.lineTo(bx + side * r * .18 + yaw * r * .2 + tw, hy - th); ctx.lineTo(bx + r * .34, by + r * .2); ctx.fill();
    }
    if (Math.abs(yaw) > .05) {
      ctx.beginPath(); ctx.ellipse(hx + yaw * r * .98, hy + r * .25, r * .42 * Math.abs(yaw) + .5, r * .32, 0, 0, TAU); ctx.fill();
      if (col !== geo.rim && Math.abs(yaw) > .4) {
        ctx.strokeStyle = 'rgba(180,190,210,.22)'; ctx.lineWidth = .5; const sx = hx + yaw * r * 1.3, s = Math.sign(yaw);
        ctx.beginPath(); ctx.moveTo(sx, hy + r * .3); ctx.lineTo(sx + s * r * .9, hy + r * .1); ctx.moveTo(sx, hy + r * .38); ctx.lineTo(sx + s * r * .9, hy + r * .5); ctx.stroke();
      }
    }
    ctx.restore();
  }
  return {
    init() {
      const port = W < H, ww = Math.min(W * (port ? .8 : .5), H * .7), wh = Math.min(H * (port ? .5 : .62), ww * (port ? 1.35 : 1.05)), wx = (W - ww) / 2, wy = H * (port ? .14 : .1);
      const u = wh * .0045, sill = { x: wx - ww * .07, y: wy + wh, w: ww * 1.14, h: Math.max(8, wh * .045) };
      geo = { wx, wy, ww, wh, u, sill, catX: wx + ww * .36, rim: 'rgba(150,170,205,.55)' };
      streaks = Array.from({ length: 60 }, () => ({ x: rand(0, 1), y: rand(0, 1), l: rand(.03, .08), v: rand(.5, 1) }));
      build();
    },
    draw(t, dt) {
      if (stale(built)) build();
      const { wx, wy, ww, wh, catX } = geo;
      // The cat's day: watching, glancing about, dozing, and waking for birds.
      modeT -= dt; birdT -= dt; flickT -= dt; earT -= dt;
      if (mode === 'awake' && modeT <= 0 && !bird) { mode = 'sleep'; modeT = rand(35, 70); yawT = 0; }
      if (!bird && ((mode === 'sleep' && modeT <= 0) || (mode === 'awake' && birdT <= 0))) {
        const dir = Math.random() < .5 ? 1 : -1;
        bird = { x: dir > 0 ? wx - 20 : wx + ww + 20, v: dir * ww * rand(.16, .24), y: wy + wh * rand(.12, .32), ph: rand(0, 6) };
      }
      if (bird) {
        bird.x += bird.v * dt;
        if (mode === 'sleep' && Math.abs(bird.x - catX) < ww * .35) { mode = 'awake'; modeT = rand(40, 80); }
        if (mode === 'awake') yawT = clamp((bird.x - catX) / (ww * .35), -1, 1);
        if (bird.x < wx - 40 || bird.x > wx + ww + 40) { bird = null; birdT = rand(25, 55); yawT = 0; lookT = rand(3, 6); }
      } else if (mode === 'awake') {
        lookT -= dt;
        if (lookT <= 0) { yawT = yawT ? 0 : [-.85, -.45, .5, .9][Math.floor(rand(0, 4))]; lookT = yawT ? rand(2.5, 5) : rand(6, 14); }
      }
      if (flickT <= 0) { flick = 1; flickT = rand(5, 12); }
      flick = Math.max(0, flick - dt * .5);
      if (earT <= 0) { ear = 1; earT = rand(6, 15); }
      ear = Math.max(0, ear - dt * 3);
      c += ((mode === 'sleep' ? 1 : 0) - c) * Math.min(1, dt * .5);
      yaw += (yawT * (1 - c) - yaw) * Math.min(1, dt * 2);
      ctx.drawImage(outside, 0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
      if (bird) {
        const y = bird.y + Math.sin(t * 2 + bird.ph) * wh * .015, fl = Math.sin(t * 9 + bird.ph), s = geo.u * 2.2;
        ctx.strokeStyle = 'rgba(20,22,30,.85)'; ctx.fillStyle = 'rgba(20,22,30,.85)'; ctx.lineWidth = s * .9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.ellipse(bird.x, y, s * 2, s * .9, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bird.x - s * 4, y - fl * s * 3); ctx.quadraticCurveTo(bird.x - s * 1.5, y - s * 2 * fl - s, bird.x, y);
        ctx.quadraticCurveTo(bird.x + s * 1.5, y - s * 2 * fl - s, bird.x + s * 4, y - fl * s * 3); ctx.stroke();
      }
      const n = Math.round(streaks.length * (.3 + .7 * weather));
      ctx.strokeStyle = 'rgba(200,215,235,.22)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = streaks[i]; s.y += s.v * dt * .9; if (s.y > 1.1) { s.y = -.1; s.x = rand(0, 1); }
        const x = wx + s.x * ww, y = wy + s.y * wh; ctx.moveTo(x, y); ctx.lineTo(x - wh * .01, y + s.l * wh);
      }
      ctx.stroke();
      ctx.drawImage(glass, 0, 0, W, H);
      ctx.restore();
      ctx.drawImage(room, 0, 0, W, H);
      drawCat(geo.rim, -1.4, t);
      drawCat('#0a0706', 0, t);
    }
  };
}

/* Record Player: a turntable on a wooden desk, the record turning while music plays */
export function recordScene() {
  let desk, vinyl, label, sheen, geo, ang = 0, w = 0, q = 0, arm = { a: 0, lift: 0, state: 'rest', hold: 0 }, trackKey = null;
  const RPM = 33.333 / 60 * TAU;
  const LABELS = [[232, 214, 170], [214, 96, 64], [46, 110, 120], [230, 170, 60], [128, 66, 96], [70, 90, 150]];
  function angleFor(r) {
    const { cx, cy, pv, L } = geo, D = Math.hypot(cx - pv.x, cy - pv.y);
    return Math.atan2(cy - pv.y, cx - pv.x) - Math.acos(clamp((L * L + D * D - r * r) / (2 * L * D), -1, 1));
  }
  function paintLabel() {
    const tr = currentTrack(), title = tr && tr.t ? tr.t : 'Slow Windows', artist = tr && tr.a ? tr.a : 'side A';
    trackKey = tr ? tr.a + '|' + tr.t : null;
    const Rl = geo.Rl, col = LABELS[Math.floor(hash(title.length, title.charCodeAt(0) || 1) * LABELS.length)], light = col[0] * .3 + col[1] * .59 + col[2] * .11 > 140;
    let g; [label, g] = layer(Rl * 2, Rl * 2);
    g.fillStyle = rgb(col); g.beginPath(); g.arc(Rl, Rl, Rl, 0, TAU); g.fill();
    g.strokeStyle = rgb(light ? [60, 40, 30] : [255, 240, 220], .35); g.lineWidth = Math.max(1, Rl * .015);
    g.beginPath(); g.arc(Rl, Rl, Rl * .9, 0, TAU); g.stroke();
    const ink = light ? '#2a1c14' : '#fbf1e2';
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fit = (txt, font, maxW) => { g.font = font; if (g.measureText(txt).width <= maxW) return [txt]; const words = txt.split(' '), lines = ['']; for (const wd of words) { const tryL = (lines[lines.length - 1] + ' ' + wd).trim(); if (g.measureText(tryL).width <= maxW || !lines[lines.length - 1]) lines[lines.length - 1] = tryL; else lines.push(wd); } return lines.slice(0, 2).map(l => { while (g.measureText(l).width > maxW && l.length > 3) l = l.slice(0, -2) + '…'; return l; }); };
    const tf = `500 ${Rl * .17}px "Bricolage Grotesque", system-ui, sans-serif`, tl = fit(title, tf, Rl * 1.4);
    g.font = tf; tl.forEach((l, i) => g.fillText(l, Rl, Rl - Rl * .42 + (i - (tl.length - 1) / 2) * Rl * .19));
    const af = `${Rl * .11}px "IBM Plex Mono", monospace`, al = fit(artist, af, Rl * 1.3);
    g.font = af; al.forEach((l, i) => g.fillText(l, Rl, Rl + Rl * .38 + i * Rl * .13));
    g.font = `${Rl * .08}px "IBM Plex Mono", monospace`; g.globalAlpha = .7;
    g.fillText('33⅓', Rl - Rl * .55, Rl); g.fillText('A', Rl + Rl * .55, Rl); g.globalAlpha = 1;
  }
  return {
    init() {
      const ph = Math.min(H * .78, W * .94 / 1.25), pw = ph * 1.25, port = W < H, x0 = (W - pw) / 2, y0 = (port ? H * .44 : H * .5) - ph / 2;
      const cx = x0 + ph * .52, cy = y0 + ph * .5, R = ph * .405, Rp = ph * .43;
      geo = { ph, pw, x0, y0, cx, cy, R, Rp, Rl: R * .34, pv: { x: x0 + ph * 1.07, y: y0 + ph * .2 }, L: ph * .66 };
      geo.aRest = Math.PI / 2 + .04; if (arm.state === 'rest') arm.a = geo.aRest;
      let g; [desk, g] = layer(W, H);
      g.fillStyle = '#4a2c1a'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 160; i++) {
        const y = rand(0, H), a = rand(.03, .09), dark = Math.random() < .6;
        g.strokeStyle = dark ? `rgba(30,14,6,${a})` : `rgba(160,100,60,${a})`; g.lineWidth = rand(.6, 3);
        g.beginPath(); for (let x = -10; x <= W + 10; x += 30) g.lineTo(x, y + Math.sin(x * .004 + i) * 6 + Math.sin(x * .02 + i * 2) * 1.5); g.stroke();
      }
      g.globalCompositeOperation = 'lighter'; glow(g, W * .08, -H * .05, Math.max(W, H) * .95, [255, 180, 100], .3); g.globalCompositeOperation = 'source-over';
      const vg = g.createRadialGradient(W * .3, H * .25, Math.min(W, H) * .2, W * .5, H * .5, Math.hypot(W, H) * .7);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,3,0,.75)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
      // A sleeve peeking out and a mug, when there's room.
      {
        g.save(); if (port) { g.translate(W * .62, y0 + ph * 1.75); g.rotate(-.1); } else { g.translate(x0 + pw + ph * .12, y0 + ph * .75); g.rotate(.12); }
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-ph * .2 + 8, -ph * .3 + 10, ph * .6, ph * .6);
        g.fillStyle = '#d9cdb4'; g.fillRect(-ph * .2, -ph * .3, ph * .6, ph * .6);
        for (let k = 0; k < 5; k++) { g.fillStyle = rgb(LABELS[k + 1], .85); g.beginPath(); g.arc(ph * .1, 0, ph * (.24 - k * .045), 0, TAU); g.fill(); }
        g.restore();
        const mx = port ? W * .24 : x0 - ph * .2, my = port ? y0 - ph * .32 : y0 + ph * .2, mr = ph * (port ? .11 : .085);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(mx + 6, my + 8, mr * 1.05, 0, TAU); g.fill();
        g.fillStyle = '#e8e2d6'; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
        g.fillStyle = '#e8e2d6'; g.fillRect(mx + mr * .8, my - mr * .18, mr * .6, mr * .36);
        g.fillStyle = '#2a170c'; g.beginPath(); g.arc(mx, my, mr * .82, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,220,180,.12)'; g.beginPath(); g.ellipse(mx - mr * .3, my - mr * .3, mr * .3, mr * .15, -.6, 0, TAU); g.fill();
      }
      // The plinth.
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.roundRect(x0 + ph * .02, y0 + ph * .035, pw, ph, ph * .04); g.fill();
      const pg = g.createLinearGradient(x0, y0, x0 + pw, y0 + ph);
      pg.addColorStop(0, '#3a3634'); pg.addColorStop(1, '#1c1a19'); g.fillStyle = pg;
      g.beginPath(); g.roundRect(x0, y0, pw, ph, ph * .04); g.fill();
      g.strokeStyle = 'rgba(255,240,220,.12)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(x0 + 1, y0 + 1, pw - 2, ph - 2, ph * .04); g.stroke();
      g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(cx, cy, Rp * 1.03, 0, TAU); g.fill();
      const { pv } = geo, pr = ph * .055;
      const mg = g.createRadialGradient(pv.x - pr * .3, pv.y - pr * .3, 0, pv.x, pv.y, pr);
      mg.addColorStop(0, '#d8d4cc'); mg.addColorStop(1, '#5a5650'); g.fillStyle = mg; g.beginPath(); g.arc(pv.x, pv.y, pr, 0, TAU); g.fill();
      const rx = pv.x + Math.cos(geo.aRest) * geo.L * .78, ry = pv.y + Math.sin(geo.aRest) * geo.L * .78;
      g.fillStyle = '#111'; g.beginPath(); g.arc(rx, ry, ph * .018, 0, TAU); g.fill();
      g.fillStyle = '#8a857c'; g.beginPath(); g.arc(x0 + ph * .08, y0 + ph * .9, ph * .03, 0, TAU); g.fill();
      g.fillStyle = '#26231f'; g.beginPath(); g.roundRect(x0 + ph * .15, y0 + ph * .885, ph * .1, ph * .035, 3); g.fill(); g.beginPath(); g.roundRect(x0 + ph * .27, y0 + ph * .885, ph * .1, ph * .035, 3); g.fill();
      g.fillStyle = 'rgba(255,240,220,.45)'; g.font = `${Math.max(8, ph * .022)}px "IBM Plex Mono", monospace`; g.textAlign = 'center';
      g.fillText('33', x0 + ph * .2, y0 + ph * .955); g.fillText('45', x0 + ph * .32, y0 + ph * .955); g.textAlign = 'start';
      // The record and platter, drawn once and turned each frame.
      const size = Rp * 2 + 4; let v; [vinyl, v] = layer(size, size); const o = size / 2;
      const rim = v.createLinearGradient(0, 0, size, size); rim.addColorStop(0, '#cfcac2'); rim.addColorStop(.5, '#77726b'); rim.addColorStop(1, '#b8b3aa');
      v.fillStyle = rim; v.beginPath(); v.arc(o, o, Rp, 0, TAU); v.fill();
      v.fillStyle = '#2a2826'; for (let i = 0; i < 120; i++) { const a = i / 120 * TAU; v.fillRect(o + Math.cos(a) * Rp * .975 - .8, o + Math.sin(a) * Rp * .975 - .8, 1.6, 1.6); }
      v.fillStyle = '#0c0c0d'; v.beginPath(); v.arc(o, o, R, 0, TAU); v.fill();
      v.lineWidth = .6;
      for (let r = R * .36; r < R * .985; r += Math.max(1.1, R / 240)) { v.strokeStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${rand(.02, .07)})`; v.beginPath(); v.arc(o, o, r, 0, TAU); v.stroke(); }
      for (const f of [.52, .64, .75, .86]) { v.strokeStyle = 'rgba(0,0,0,.6)'; v.lineWidth = R * .008; v.beginPath(); v.arc(o, o, R * f, 0, TAU); v.stroke(); v.strokeStyle = 'rgba(255,255,255,.05)'; v.lineWidth = .7; v.beginPath(); v.arc(o, o, R * f + R * .005, 0, TAU); v.stroke(); }
      v.strokeStyle = 'rgba(255,255,255,.12)'; v.lineWidth = 1; v.beginPath(); v.arc(o, o, R - .5, 0, TAU); v.stroke();
      [sheen, g] = layer(W, H);
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.arc(cx, cy, geo.Rl * 1.05, 0, TAU, true);
      if (g.createConicGradient) {
        const cg = g.createConicGradient(-.9, cx, cy);
        cg.addColorStop(0, 'rgba(255,230,200,0)'); cg.addColorStop(.07, 'rgba(255,230,200,.13)'); cg.addColorStop(.15, 'rgba(255,230,200,0)');
        cg.addColorStop(.5, 'rgba(255,230,200,0)'); cg.addColorStop(.57, 'rgba(255,230,200,.07)'); cg.addColorStop(.65, 'rgba(255,230,200,0)'); cg.addColorStop(1, 'rgba(255,230,200,0)');
        g.fillStyle = cg;
      } else {
        const lg = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R); lg.addColorStop(0, 'rgba(255,230,200,.08)'); lg.addColorStop(.5, 'rgba(255,230,200,0)'); lg.addColorStop(1, 'rgba(255,230,200,.05)'); g.fillStyle = lg;
      }
      g.fill();
      paintLabel();
    },
    draw(t, dt) {
      const tr = currentTrack(), key = tr ? tr.a + '|' + tr.t : null;
      if (key !== trackKey) { paintLabel(); q = 0; if (arm.state === 'play') arm.state = 'cue'; }
      const playing = !!musicPlaying, target = playing ? RPM : 0;
      w = w < target ? Math.min(target, w + 2.6 * dt) : Math.max(target, w - .8 * dt);
      ang += w * dt;
      const { cx, cy, R, Rp, Rl, pv, L, ph } = geo, want = angleFor(R * (.95 - .58 * q)), mv = (to, sp) => { arm.a += clamp(to - arm.a, -sp * dt, sp * dt); return Math.abs(to - arm.a) < .002; };
      if (arm.state === 'rest') { arm.lift = Math.max(0, arm.lift - dt * 1.5); if (playing && w > RPM * .8) arm.state = 'cue'; }
      else if (arm.state === 'cue') {
        if (!playing) arm.state = 'return';
        else { arm.lift = Math.min(1, arm.lift + dt * 1.2); if (arm.lift > .95 && mv(want, .25)) arm.state = 'drop'; }
      } else if (arm.state === 'drop') {
        arm.lift = Math.max(0, arm.lift - dt * .6); if (!playing) arm.state = 'return'; else if (arm.lift === 0) arm.state = 'play';
      } else if (arm.state === 'play') {
        if (!playing) { arm.state = 'lifting'; arm.hold = 0; } else { q = Math.min(1, q + dt / 720); arm.a = want; }
      } else if (arm.state === 'lifting') {
        arm.lift = Math.min(1, arm.lift + dt * 1.2); arm.hold += dt;
        if (playing) arm.state = 'drop'; else if (arm.hold > 2.5) arm.state = 'return';
      } else if (arm.state === 'return') {
        arm.lift = Math.min(1, arm.lift + dt * 1.2);
        if (playing) arm.state = 'cue'; else if (arm.lift > .95 && mv(geo.aRest, .3)) arm.state = 'rest';
      }
      ctx.drawImage(desk, 0, 0, W, H);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
      const sz = Rp * 2 + 4; ctx.drawImage(vinyl, -sz / 2, -sz / 2, sz, sz); ctx.drawImage(label, -Rl, -Rl, Rl * 2, Rl * 2);
      ctx.restore();
      ctx.drawImage(sheen, 0, 0, W, H);
      const sp = ctx.createRadialGradient(cx - R * .006, cy - R * .006, 0, cx, cy, R * .022); sp.addColorStop(0, '#f4f0e8'); sp.addColorStop(1, '#6a665e');
      ctx.fillStyle = sp; ctx.beginPath(); ctx.arc(cx, cy, R * .022, 0, TAU); ctx.fill();
      if (playing) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, geo.x0 + ph * .08, geo.y0 + ph * .82, ph * .03, [255, 150, 60], .7); ctx.globalCompositeOperation = 'source-over'; }
      ctx.fillStyle = playing ? '#ffb060' : '#4a3020'; ctx.beginPath(); ctx.arc(geo.x0 + ph * .08, geo.y0 + ph * .82, ph * .007, 0, TAU); ctx.fill();
      // The tonearm, its shadow growing as it lifts.
      const ca = Math.cos(arm.a), sa = Math.sin(arm.a), nx = pv.x + ca * L, ny = pv.y + sa * L;
      const tube = (dx, dy, col, wid) => {
        ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = wid;
        ctx.beginPath(); ctx.moveTo(pv.x - ca * ph * .09 + dx, pv.y - sa * ph * .09 + dy); ctx.lineTo(nx - ca * ph * .05 + dx, ny - sa * ph * .05 + dy); ctx.stroke();
        ctx.save(); ctx.translate(nx + dx, ny + dy); ctx.rotate(arm.a + .38); ctx.fillStyle = col; ctx.fillRect(-ph * .055, -ph * .018, ph * .075, ph * .036); ctx.restore();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pv.x - ca * ph * .1 + dx, pv.y - sa * ph * .1 + dy, ph * .04, 0, TAU); ctx.fill();
      };
      const so = ph * (.012 + .03 * arm.lift);
      tube(so, so * 1.3, `rgba(0,0,0,${.4 - .18 * arm.lift})`, ph * .016);
      tube(0, 0, '#bdb8ae', ph * .014);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = ph * .004;
      ctx.beginPath(); ctx.moveTo(pv.x - ca * ph * .05, pv.y - sa * ph * .05 - ph * .003); ctx.lineTo(nx - ca * ph * .06, ny - sa * ph * .06 - ph * .003); ctx.stroke();
      ctx.save(); ctx.translate(nx, ny); ctx.rotate(arm.a + .38); ctx.fillStyle = '#26242a'; ctx.fillRect(-ph * .05, -ph * .014, ph * .06, ph * .028); ctx.restore();
      ctx.fillStyle = '#3a3836'; ctx.beginPath(); ctx.arc(pv.x - ca * ph * .1, pv.y - sa * ph * .1, ph * .032, 0, TAU); ctx.fill();
      const cap = ctx.createRadialGradient(pv.x - 2, pv.y - 2, 0, pv.x, pv.y, ph * .025); cap.addColorStop(0, '#eeeae2'); cap.addColorStop(1, '#77736b');
      ctx.fillStyle = cap; ctx.beginPath(); ctx.arc(pv.x, pv.y, ph * .025, 0, TAU); ctx.fill();
    }
  };
}

// Public-domain poems for the typewriter:
// William Wordsworth, "I Wandered Lonely as a Cloud" (1807), first two stanzas.
// Emily Dickinson, "'Hope' is the thing with feathers" (published 1891).
// Christina Rossetti, "Who Has Seen the Wind?" from Sing-Song (1872).
// Robert Louis Stevenson, "Rain" and "Windy Nights" from A Child's Garden of Verses (1885).
// Emily Dickinson, "I'm Nobody! Who are you?" (published 1891).
const POEMS = [
  ['I WANDERED LONELY AS A CLOUD', '', 'I wandered lonely as a cloud', "That floats on high o'er vales and hills,", 'When all at once I saw a crowd,', 'A host, of golden daffodils;',
    'Beside the lake, beneath the trees,', 'Fluttering and dancing in the breeze.', '', 'Continuous as the stars that shine', 'And twinkle on the milky way,',
    'They stretched in never-ending line', 'Along the margin of a bay:', 'Ten thousand saw I at a glance,', 'Tossing their heads in sprightly dance.', '', '        William Wordsworth'],
  ['HOPE', '', '"Hope" is the thing with feathers -', 'That perches in the soul -', 'And sings the tune without the words -', 'And never stops - at all -', '',
    'And sweetest - in the Gale - is heard -', 'And sore must be the storm -', 'That could abash the little Bird', 'That kept so many warm -', '',
    "I've heard it in the chillest land -", 'And on the strangest Sea -', 'Yet - never - in Extremity,', 'It asked a crumb - of me.', '', '        Emily Dickinson'],
  ['WHO HAS SEEN THE WIND?', '', 'Who has seen the wind?', 'Neither I nor you:', 'But when the leaves hang trembling,', 'The wind is passing through.', '',
    'Who has seen the wind?', 'Neither you nor I:', 'But when the trees bow down their heads,', 'The wind is passing by.', '', '        Christina Rossetti'],
  ['RAIN', '', 'The rain is raining all around,', 'It falls on field and tree,', 'It rains on the umbrellas here,', 'And on the ships at sea.', '', '        Robert Louis Stevenson'],
  ["I'M NOBODY! WHO ARE YOU?", '', "I'm Nobody! Who are you?", 'Are you - Nobody - too?', "Then there's a pair of us!", "Don't tell! they'd advertise - you know!", '',
    'How dreary - to be - Somebody!', 'How public - like a Frog -', "To tell one's name - the livelong June -", 'To an admiring Bog!', '', '        Emily Dickinson'],
  ['WINDY NIGHTS', '', 'Whenever the moon and stars are set,', 'Whenever the wind is high,', 'All night long in the dark and wet,', 'A man goes riding by.',
    'Late in the night when the fires are out,', 'Why does he gallop and gallop about?', '', '        Robert Louis Stevenson'],
];

/* Typewriter Desk: a lamp, a steaming cup, and a typewriter slowly typing out an old poem */
export function typewriterScene() {
  let bg, paper, pg, geo, pi = Math.floor(Math.random() * POEMS.length), line = 0, col = 0, wait = 1, mode = 'feed', anim = 0, strike = 0, stack = 0, keyHit = -1, crFrom = 0;
  const COLS = 42;
  function newPaper() {
    const { pw, lh, top } = geo, ph = top + lh * 20;
    [paper, pg] = layer(pw, ph);
    pg.fillStyle = '#f1e9d8'; pg.fillRect(0, 0, pw, ph);
    for (let i = 0; i < 40; i++) { pg.fillStyle = `rgba(120,100,70,${rand(.01, .03)})`; pg.fillRect(rand(0, pw), rand(0, ph), rand(10, 60), rand(1, 3)); }
    pg.font = `${geo.fs}px "Courier New", Courier, monospace`; pg.textBaseline = 'alphabetic';
  }
  return {
    init() {
      const port = W < H, S = Math.min(W, H), deskY = H * (port ? .6 : .58);
      const tw = Math.min(W * (port ? .92 : .5), H * .74), baseY = H * (port ? .9 : .93), th = tw * .36;
      const pw = Math.min(port ? W * .88 : tw * .7, 620), fs = pw / (COLS * .6 + 4), lh = fs * 1.45, cw = fs * .6, mx = (pw - COLS * cw) / 2;
      const platY = baseY - th - tw * .03;
      geo = { port, S, deskY, tw, baseY, th, pw, fs, lh, cw, mx, top: lh * 2.2, platY, strikeY: platY - tw * .03, cx: W / 2, k: port ? .3 : .9 };
      let g; [bg, g] = layer(W, H);
      const wall = g.createLinearGradient(0, 0, 0, deskY); wall.addColorStop(0, '#0e0d14'); wall.addColorStop(1, '#1d1714');
      g.fillStyle = wall; g.fillRect(0, 0, W, deskY);
      const dk = g.createLinearGradient(0, deskY, 0, H); dk.addColorStop(0, '#3a2416'); dk.addColorStop(1, '#1e120a');
      g.fillStyle = dk; g.fillRect(0, deskY, W, H - deskY);
      for (let i = 0; i < 70; i++) { const y = rand(deskY, H); g.strokeStyle = `rgba(${Math.random() < .5 ? '20,10,4' : '120,80,50'},${rand(.04, .1)})`; g.lineWidth = rand(.5, 2); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * .3, y + rand(-4, 4), W * .7, y + rand(-4, 4), W, y + rand(-3, 3)); g.stroke(); }
      g.fillStyle = 'rgba(255,220,180,.08)'; g.fillRect(0, deskY, W, 2);
      // The lamp: an angled arm and shade on the left, its light pooled on the desk.
      const lx = port ? W * .06 : W * .14, ly = deskY + S * .07, sx = lx + S * .2, sy = deskY - S * .34;
      g.globalCompositeOperation = 'lighter';
      glow(g, sx + S * .12, deskY + S * .14, S * .9, [255, 180, 100], .28);
      glow(g, sx + S * .05, sy + S * .05, S * .35, [255, 200, 130], .2);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(lx + S * .01, ly + S * .015, S * .085, S * .025, 0, 0, TAU); g.fill();
      g.fillStyle = '#1c2a22'; g.beginPath(); g.ellipse(lx, ly, S * .075, S * .022, 0, 0, TAU); g.fill();
      g.strokeStyle = '#26352c'; g.lineWidth = S * .012; g.lineCap = 'round';
      g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx - S * .04, deskY - S * .22); g.lineTo(sx, sy); g.stroke();
      g.save(); g.translate(sx, sy); g.rotate(.5);
      const sh = g.createLinearGradient(-S * .08, 0, S * .08, 0); sh.addColorStop(0, '#22382c'); sh.addColorStop(.5, '#3c5a46'); sh.addColorStop(1, '#1a2a20');
      g.fillStyle = sh; g.beginPath(); g.moveTo(-S * .03, -S * .02); g.lineTo(S * .03, -S * .02); g.lineTo(S * .09, S * .1); g.lineTo(-S * .09, S * .1); g.fill();
      g.fillStyle = '#ffe9b8'; g.beginPath(); g.ellipse(0, S * .1, S * .09, S * .018, 0, 0, TAU); g.fill();
      g.restore();
      // The cup, to the right.
      const mx2 = port ? W * .86 : W * .86, my = port ? deskY + S * .1 : deskY + S * .3, mr = S * .055;
      geo.cup = { x: mx2, y: my - mr * 1.9, r: mr };
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(mx2 + mr * .2, my + mr * .1, mr * 1.4, mr * .35, 0, 0, TAU); g.fill();
      const mg = g.createLinearGradient(mx2 - mr, 0, mx2 + mr, 0); mg.addColorStop(0, '#d8cfc0'); mg.addColorStop(.35, '#efe8dc'); mg.addColorStop(1, '#8a8276');
      g.fillStyle = mg; g.beginPath(); g.moveTo(mx2 - mr, my - mr * 1.9); g.lineTo(mx2 - mr, my - mr * .1); g.quadraticCurveTo(mx2, my + mr * .2, mx2 + mr, my - mr * .1); g.lineTo(mx2 + mr, my - mr * 1.9); g.fill();
      g.strokeStyle = '#a69e90'; g.lineWidth = mr * .22; g.beginPath(); g.arc(mx2 + mr * 1.1, my - mr, mr * .45, -1.2, 1.2); g.stroke();
      g.fillStyle = '#d8d0c2'; g.beginPath(); g.ellipse(mx2, my - mr * 1.9, mr, mr * .28, 0, 0, TAU); g.fill();
      g.fillStyle = '#3a200e'; g.beginPath(); g.ellipse(mx2, my - mr * 1.86, mr * .86, mr * .22, 0, 0, TAU); g.fill();
      newPaper(); line = 0; col = 0; mode = 'feed'; anim = 0;
    },
    draw(t, dt) {
      const { cx, tw, baseY, th, pw, fs, lh, cw, mx, top, platY, strikeY, k, cup } = geo, sp = lively ? .6 : 1;
      const page = POEMS[pi % POEMS.length];
      // Typing, line by line, with a pause and a carriage return at the end of each.
      if (mode === 'type') {
        wait -= dt;
        if (wait <= 0) {
          const text = page[line] || '';
          if (col < text.length) {
            const ch = text[col];
            if (ch !== ' ') { pg.fillStyle = `rgba(28,22,22,${rand(.68, .95)})`; pg.fillText(ch, mx + col * cw + rand(-.3, .3), top + line * lh + rand(-.4, .4)); strike = 1; keyHit = Math.floor(rand(0, 40)); }
            col++; wait = (ch === ' ' ? .14 : rand(.15, .26)) * sp;
          } else if (line + 1 < page.length) { mode = 'cr'; anim = 0; crFrom = col; }
          else { mode = 'done'; wait = 6; }
        }
      } else if (mode === 'cr') {
        anim += dt / .8;
        if (anim >= 1) { line++; col = 0; mode = 'type'; wait = .7 * sp; anim = 0; }
      } else if (mode === 'done') { wait -= dt; if (wait <= 0) { mode = 'out'; anim = 0; } }
      else if (mode === 'out') { anim += dt / 2.4; if (anim >= 1) { stack = Math.min(stack + 1, 6); pi++; newPaper(); line = 0; col = 0; mode = 'feed'; anim = 0; } }
      else if (mode === 'feed') { anim += dt / 1.8; if (anim >= 1) { mode = 'type'; wait = .8; anim = 0; } }
      strike = Math.max(0, strike - dt * 9);
      const vcol = mode === 'cr' ? crFrom * (1 - ease(anim)) : col, vline = mode === 'cr' ? line + ease(anim) : mode === 'feed' ? -3 * (1 - ease(anim)) : line;
      const shift = (COLS / 2 - vcol) * cw * k, paperX = cx - pw / 2 + shift - (mx + (COLS / 2) * cw - pw / 2) * k;
      const out = mode === 'out' ? ease(anim) : 0, paperY = strikeY - (top + vline * lh) + fs * .35 - out * H * .9;
      ctx.drawImage(bg, 0, 0, W, H);
      // Finished pages pile up beside the typewriter.
      if (!geo.port) for (let i = 0; i < stack; i++) {
        ctx.save(); ctx.translate(cx + tw * .72, baseY - tw * .05 - i * 2); ctx.rotate(-.08 + hash(i, 3) * .16);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-pw * .3 + 3, -pw * .1 + 3, pw * .6, pw * .2);
        ctx.fillStyle = '#e8dfcc'; ctx.fillRect(-pw * .3, -pw * .1, pw * .6, pw * .2); ctx.restore();
      }
      // Steam from the cup.
      ctx.lineCap = 'round';
      for (let s = 0; s < 3; s++) {
        const hs = geo.S * .25;
        for (const [lw, a] of [[cup.r * .5, .045], [cup.r * .18, .08]]) {
          ctx.strokeStyle = `rgba(255,245,235,${a})`; ctx.lineWidth = lw; ctx.beginPath();
          for (let i = 0; i <= 16; i++) {
            const f = i / 16, y = cup.y - f * hs, x = cup.x + (s - 1) * cup.r * .35 + Math.sin(f * 5 - t * .9 + s * 2.1) * cup.r * .6 * f + Math.sin(t * .3 + s) * f * cup.r * .5;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.globalAlpha = 1; ctx.stroke();
        }
      }
      // The paper, rising out of the platen, then the carriage and the machine in front.
      const visTop = Math.max(paperY, -10), clipB = platY + tw * .02;
      ctx.save(); ctx.beginPath(); ctx.rect(0, -H, W, clipB + H); ctx.clip();
      ctx.globalAlpha = 1 - out * .8;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(paperX + 4, visTop + 4, pw, clipB - visTop);
      ctx.drawImage(paper, paperX, paperY, pw, paper.height / paper.width * pw);
      ctx.globalAlpha = 1; ctx.restore();
      const carX = cx + shift - tw * .55;
      ctx.fillStyle = '#121214'; ctx.beginPath(); ctx.roundRect(carX, platY - tw * .025, tw * 1.1, tw * .05, tw * .025); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(carX + tw * .02, platY - tw * .02, tw * 1.06, tw * .006);
      for (const e of [carX - tw * .015, carX + tw * 1.115]) { ctx.fillStyle = '#1a1a1c'; ctx.beginPath(); ctx.roundRect(e - tw * .02, platY - tw * .035, tw * .04, tw * .07, tw * .01); ctx.fill(); }
      ctx.strokeStyle = '#8a8478'; ctx.lineWidth = tw * .006; ctx.beginPath(); ctx.moveTo(carX - tw * .015, platY - tw * .035); ctx.lineTo(carX - tw * .07, platY - tw * .07); ctx.stroke();
      ctx.fillStyle = '#9a9488'; ctx.fillRect(cx - pw * .5, platY + tw * .012, pw, tw * .008);
      const body = ctx.createLinearGradient(0, baseY - th, 0, baseY);
      body.addColorStop(0, '#2c3a32'); body.addColorStop(.5, '#1d2822'); body.addColorStop(1, '#121814');
      ctx.fillStyle = body; ctx.beginPath();
      ctx.moveTo(cx - tw * .5, baseY); ctx.lineTo(cx - tw * .44, baseY - th * .62); ctx.quadraticCurveTo(cx - tw * .42, baseY - th, cx - tw * .3, baseY - th);
      ctx.lineTo(cx + tw * .3, baseY - th); ctx.quadraticCurveTo(cx + tw * .42, baseY - th, cx + tw * .44, baseY - th * .62); ctx.lineTo(cx + tw * .5, baseY); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,190,.07)'; ctx.fillRect(cx - tw * .3, baseY - th, tw * .6, 2);
      ctx.fillStyle = '#0c100e'; ctx.beginPath(); ctx.ellipse(cx, baseY - th * .98, tw * .16, th * .2, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(200,196,186,.35)'; ctx.lineWidth = 1;
      for (let i = 0; i < 13; i++) { const a = Math.PI + (i + .5) / 13 * Math.PI; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * tw * .15, baseY - th * .98 + Math.sin(a) * th * .18); ctx.lineTo(cx + Math.cos(a) * tw * .06, baseY - th * .98 + Math.sin(a) * th * .06); ctx.stroke(); }
      if (strike > 0) { ctx.strokeStyle = `rgba(210,206,196,${strike})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx + (vcol - COLS / 2) * cw * (1 - k), baseY - th); ctx.lineTo(cx + (vcol - COLS / 2) * cw * (1 - k), strikeY + fs * .1); ctx.stroke(); }
      ctx.fillStyle = 'rgba(200,40,40,.8)'; ctx.fillRect(cx + (vcol - COLS / 2) * cw * (1 - k) - tw * .02, strikeY + fs * .05, tw * .04, tw * .01);
      ctx.fillStyle = 'rgba(201,169,74,.8)'; ctx.fillRect(cx - tw * .08, baseY - th * .7, tw * .16, Math.max(1, tw * .004));
      const rows = [11, 11, 10, 9]; let ki = 0;
      for (let r = 0; r < 4; r++) {
        const yy = baseY - th * (.52 - r * .12), n = rows[r], span = tw * (.62 + r * .03), kr = tw * .021;
        for (let i = 0; i < n; i++) {
          const xx = cx - span / 2 + (i + .5) * span / n, down = ki === keyHit && strike > .2 ? kr * .3 : 0; ki++;
          ctx.fillStyle = '#9a9488'; ctx.beginPath(); ctx.arc(xx, yy + down + kr * .25, kr, 0, TAU); ctx.fill();
          ctx.fillStyle = '#16181a'; ctx.beginPath(); ctx.arc(xx, yy + down, kr * .88, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(xx - kr * .2, yy + down - kr * .25, kr * .35, 0, TAU); ctx.fill();
        }
      }
      ctx.fillStyle = '#16181a'; ctx.beginPath(); ctx.roundRect(cx - tw * .2, baseY - th * .06, tw * .4, th * .05, 4); ctx.fill();
    }
  };
}

/* Jellyfish: glowing jellyfish drifting up through a dark tank, pulsing slowly, marine snow falling */
export function jellyfishScene() {
  let bg, jellies = [], snow = [];
  const HUES = [[120, 220, 255], [255, 140, 210], [180, 150, 255], [255, 170, 230], [140, 255, 220]];
  const spawn = (j, first) => {
    const S = Math.min(W, H);
    j.r = S * rand(.05, .11) * (W < H ? 1.25 : 1);
    let best = -1; for (let k = 0; k < 8; k++) { const x = rand(.08, .92) * W, dd = Math.min(W, ...jellies.filter(o => o !== j && o.x !== undefined).map(o => Math.abs(o.x - x))); if (dd > best) { best = dd; j.x = x; } } j.y = first ? rand(0, H) : H + j.r * rand(1.5, 3);
    j.hue = HUES[Math.floor(rand(0, HUES.length))]; j.ph = rand(0, 10); j.per = rand(3.2, 5); j.sw = rand(0, 6); j.n = Math.floor(rand(8, 13));
    j.len = rand(2.4, 4); j.vx = rand(-4, 4);
  };
  return {
    init() {
      let g; [bg, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#0a2236'); gr.addColorStop(.45, '#04101e'); gr.addColorStop(1, '#010409');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const x = W * rand(.1, .9), w = W * rand(.04, .12), sg = g.createLinearGradient(0, 0, 0, H * .8);
        sg.addColorStop(0, 'rgba(90,170,220,.07)'); sg.addColorStop(1, 'rgba(90,170,220,0)'); g.fillStyle = sg;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w * 2.5 - W * .1, H * .8); g.lineTo(x - W * .1, H * .8); g.fill();
      }
      glow(g, W * .5, -H * .1, Math.max(W, H) * .6, [60, 140, 200], .12);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#02060c';
      g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, H - H * .04 - Math.sin(x * .01) * H * .015 - Math.sin(x * .037) * H * .01); g.lineTo(W, H); g.fill();
      const n = lowPower ? 5 : W < H ? 6 : 8;
      jellies = Array.from({ length: n }, () => { const j = {}; spawn(j, true); return j; });
      snow = Array.from({ length: lowPower ? 50 : 140 }, () => ({ x: rand(0, W), y: rand(0, H), v: rand(5, 16), r: rand(.4, 1.6), a: rand(.12, .45), ph: rand(0, 6) }));
    },
    draw(t, dt) {
      ctx.drawImage(bg, 0, 0, W, H);
      for (const s of snow) {
        s.y += s.v * dt; s.x += Math.sin(t * .3 + s.ph) * 3 * dt; if (s.y > H + 2) { s.y = -2; s.x = rand(0, W); }
        ctx.fillStyle = `rgba(200,225,240,${s.a})`; ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      const bass = bands.bass || 0;
      jellies.sort((a, b) => a.r - b.r);
      ctx.globalCompositeOperation = 'lighter';
      for (const j of jellies) {
        const f = ((t + j.ph) % j.per) / j.per, c = f < .22 ? Math.sin(f / .22 * Math.PI / 2) : Math.cos((f - .22) / .78 * Math.PI / 2);
        j.y -= (j.r * .12 + j.r * .5 * c * c) * dt * (lively ? 1.6 : 1); j.x += (j.vx + Math.sin(t * .2 + j.sw) * 6) * dt;
        if (j.y < -j.r * (j.len + 1.5)) spawn(j, false);
        const { x, y, r, hue } = j, bw = r * (1 - .2 * c), bh = r * (.92 + .14 * c), depth = .55 + .45 * (r / (Math.min(W, H) * .11)), gl = (.08 + .1 * bass) * depth;
        const tilt = Math.sin(t * .2 + j.sw) * .12;
        ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
        glow(ctx, 0, -bh * .4, r * 2.6, hue, gl);
        // Tentacles trail behind, lagging the pulse.
        const tg = ctx.createLinearGradient(0, 0, 0, r * j.len); tg.addColorStop(0, rgb(hue, .32 * depth)); tg.addColorStop(1, rgb(hue, 0));
        ctx.strokeStyle = tg; ctx.lineWidth = Math.max(.6, r * .018);
        for (let i = 0; i < j.n; i++) {
          const x0 = -bw * .9 + i * (1.8 * bw / (j.n - 1)), L = r * j.len * (.7 + .3 * hash(i, j.n));
          ctx.beginPath(); ctx.moveTo(x0, -bh * .05);
          for (let s = 1; s <= 10; s++) { const u = s / 10; ctx.lineTo(x0 * (1 - u * .3) + Math.sin(u * 4 - t * 1.4 + i * 1.3 + j.ph) * r * .14 * u, u * L); }
          ctx.stroke();
        }
        ctx.strokeStyle = rgb(hue, .2 * depth); ctx.lineWidth = r * .07;
        for (let i = 0; i < 4; i++) {
          const x0 = (i - 1.5) * bw * .18; ctx.beginPath(); ctx.moveTo(x0, 0);
          for (let s = 1; s <= 8; s++) { const u = s / 8; ctx.lineTo(x0 * (1 + u * .6) + Math.sin(u * (3 + i) - t * (.8 + i * .15) + i * 2.4 + j.ph) * r * .16 * u, u * r * (1.2 + .25 * i % 3)); }
          ctx.stroke();
        }
        // The bell.
        const bg2 = ctx.createRadialGradient(0, -bh * .55, 0, 0, -bh * .4, bw * 1.1);
        bg2.addColorStop(0, rgb(hue, (.34 + .1 * bass) * depth)); bg2.addColorStop(.7, rgb(hue, .1 * depth)); bg2.addColorStop(1, rgb(hue, .2 * depth));
        ctx.fillStyle = bg2; ctx.beginPath(); ctx.moveTo(-bw, 0);
        ctx.bezierCurveTo(-bw, -bh * 1.1, bw, -bh * 1.1, bw, 0);
        ctx.quadraticCurveTo(bw * .5, -bh * .12, 0, -bh * .2); ctx.quadraticCurveTo(-bw * .5, -bh * .12, -bw, 0); ctx.fill();
        ctx.strokeStyle = rgb(hue, .45 * depth); ctx.lineWidth = Math.max(1, r * .025);
        ctx.beginPath(); ctx.moveTo(-bw, 0); ctx.bezierCurveTo(-bw, -bh * 1.1, bw, -bh * 1.1, bw, 0); ctx.stroke();
        for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + t * .1; glow(ctx, Math.cos(a) * bw * .28, -bh * .45 + Math.sin(a) * bh * .12, r * .2, mix(hue, [255, 255, 255], .4), .25 * depth); }
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  };
}
