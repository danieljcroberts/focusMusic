// Places drawn in code: bamboo, lanterns over a lake, Paris roofs in the rain, a harbour and a firefly meadow.
import { W, H, ctx, lowPower, lively } from '../view.js';
import { rand, mix, rgb, layer, glow, stars } from '../util.js';
import { weather } from '../weather.js';
import { daylight, skyMix } from '../daylight.js';
import { bands, musicLevel } from '../music.js';
import { moonPhase, drawMoon } from '../moon.js';
import { isWinter, season, snowing, monthHere } from '../season.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const S = () => Math.min(W, H);
// A soft round sprite, drawn once and stamped with drawImage.
function blob(r, c, a = 1) { const [cv, g] = layer(r * 2, r * 2); glow(g, r, r, r, c, a); return cv; }
// Faint horizontal ripple strokes on water between y0 and the bottom, denser toward the viewer.
function ripples(y0, t, col, alpha, rows = 34) {
  ctx.lineCap = 'round';
  for (let k = 1; k <= rows; k++) {
    const p = k / rows, y = y0 + (H - y0) * p * p;
    ctx.strokeStyle = rgb(col, alpha * (.3 + .9 * p)); ctx.lineWidth = .6 + p;
    ctx.beginPath();
    for (let x = 0; x <= W + 24; x += 24) {
      const yy = y + Math.sin(x * .012 / (p + .15) + t * (.4 + p * .6) + k) * 1.6 * p;
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}
// Scenes that follow the clock rebuild when the light has moved noticeably since they were drawn.
const stale = built => Math.abs(daylight() - built) > .04;

/* Bamboo Forest: stalks in four depths swaying as gusts roll through, light flickering down through the leaves */
const BAMBOO = [
  { gap: .07, w: .011, col: [154, 176, 142], hi: [190, 208, 172], lo: [130, 150, 120], leaf: [[140, 166, 124], [160, 184, 140]], size: .07, amp: .5 },
  { gap: .1, w: .019, col: [108, 140, 92], hi: [160, 190, 120], lo: [78, 104, 66], leaf: [[90, 126, 70], [120, 156, 90]], size: .1, amp: .7 },
  { gap: .15, w: .032, col: [64, 104, 52], hi: [140, 180, 90], lo: [36, 62, 30], leaf: [[52, 92, 40], [86, 130, 60]], size: .15, amp: .95 },
  { gap: .27, w: .058, col: [36, 66, 30], hi: [110, 150, 64], lo: [16, 32, 14], leaf: [[30, 58, 24], [56, 92, 40]], size: .24, amp: 1.25 },
];
export function bambooScene() {
  let back, mist, shafts, ground, stalks, sprites, flat, fall, bits = [], lastT = 0;
  function sprig(D, k) {
    const sz = S() * D.size, [c, g] = layer(sz * 1.2, sz);
    g.strokeStyle = rgb(D.lo); g.lineWidth = Math.max(.7, sz * .012); g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, sz * .3); g.quadraticCurveTo(sz * .4, sz * .22, sz * 1.0, sz * .3 + k * sz * .05); g.stroke();
    const n = 5 + k;
    for (let i = 0; i < n; i++) {
      const u = .25 + .75 * i / n, bx = sz * u, by = sz * (.27 + .03 * k * u), an = i % 2 ? rand(.6, 1.4) : rand(-.2, .5), len = sz * rand(.26, .4), wd = len * .14;
      g.save(); g.translate(bx, by); g.rotate(an);
      g.fillStyle = rgb(D.leaf[i % 2]);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * .4, -wd, len, 0); g.quadraticCurveTo(len * .4, wd, 0, 0); g.fill();
      g.restore();
    }
    return { c, w: sz * 1.2, h: sz };
  }
  function stalk(c, D, spr, st, g, t, s, still) {
    const disp = still ? 0 : (Math.sin(t * .4 + st.ph) * s * .007 + g * s * (.012 + .045 * weather)) * D.amp * (lively ? 1.5 : 1);
    const xAt = y => { const u = (H - y) / H; return st.x + st.lean * (H - y) + disp * Math.pow(Math.max(0, u), 1.6); };
    const path = off => { c.beginPath(); for (let k = 0; k <= 10; k++) { const y = H + 10 - (H + 40) * k / 10; k ? c.lineTo(xAt(y) + off, y) : c.moveTo(xAt(y) + off, y); } };
    c.lineCap = 'butt';
    c.strokeStyle = rgb(D.col); c.lineWidth = st.w; path(0); c.stroke();
    c.strokeStyle = rgb(D.hi, .55); c.lineWidth = st.w * .2; path(-st.w * .22); c.stroke();
    c.strokeStyle = rgb(D.lo, .6); c.lineWidth = st.w * .22; path(st.w * .32); c.stroke();
    c.strokeStyle = rgb(D.lo, .9); c.lineWidth = Math.max(1, st.w * .12); c.beginPath();
    for (const y of st.nodes) { const x = xAt(y); c.moveTo(x - st.w * .55, y); c.lineTo(x + st.w * .55, y); }
    c.stroke();
    c.strokeStyle = rgb(D.hi, .5); c.lineWidth = Math.max(.6, st.w * .06); c.beginPath();
    for (const y of st.nodes) { const x = xAt(y); c.moveTo(x - st.w * .5, y + st.w * .14); c.lineTo(x + st.w * .5, y + st.w * .14); }
    c.stroke();
    for (const lf of st.leaves) {
      const sp = spr[lf.k], x = xAt(lf.y);
      c.save(); c.translate(x, lf.y); c.scale(lf.side, 1);
      c.rotate(lf.rot + (still ? 0 : Math.sin(t * 1.1 + lf.ph) * .04 + g * .25 * lf.side * (.3 + weather)));
      c.drawImage(sp.c, 0, -sp.h * .3, sp.w, sp.h); c.restore();
    }
  }
  const gust = (x, l, t) => {
    const p = (x / W) * 1.5 - t * .06 * (1 + weather) * (lively ? 1.8 : 1) - l * .1;
    return Math.pow(.5 + .5 * Math.sin(p * TAU), 4) * .75 + Math.pow(.5 + .5 * Math.sin(p * TAU * .37 + 1), 6) * .25;
  };
  return {
    init() {
      const s = S(); let g;
      [back, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#e4edd2'); gr.addColorStop(.45, '#b3c79e'); gr.addColorStop(.8, '#71885e'); gr.addColorStop(1, '#3a4a30');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      glow(g, W * .65, -H * .05, s * 1.1, [255, 252, 225], .55);
      [mist, g] = layer(W, H);
      const mg = g.createLinearGradient(0, 0, 0, H);
      mg.addColorStop(0, 'rgba(222,234,206,.5)'); mg.addColorStop(.5, 'rgba(200,216,182,.25)'); mg.addColorStop(1, 'rgba(160,180,140,.45)');
      g.fillStyle = mg; g.fillRect(0, 0, W, H);
      [shafts, g] = layer(W, H);
      for (let i = 0; i < 5; i++) {
        const x0 = W * (.35 + .17 * i) + rand(-1, 1) * s * .05, w0 = s * rand(.03, .08), lean = -H * .45;
        const sg = g.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, 'rgba(255,250,215,.32)'); sg.addColorStop(.85, 'rgba(255,250,215,0)');
        g.fillStyle = sg; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + w0, 0); g.lineTo(x0 + w0 * 2.2 + lean, H); g.lineTo(x0 + lean, H); g.fill();
      }
      [ground, g] = layer(W, H);
      const gg = g.createLinearGradient(0, H * .82, 0, H);
      gg.addColorStop(0, 'rgba(24,34,18,0)'); gg.addColorStop(1, 'rgba(16,24,12,.9)');
      g.fillStyle = gg; g.fillRect(0, 0, W, H);
      g.fillStyle = '#121c0e';
      for (let i = 0; i < W / 3; i++) { const x = rand(0, W), h = s * rand(.02, .07); g.beginPath(); g.moveTo(x - 2, H); g.quadraticCurveTo(x + rand(-6, 6), H - h * .6, x + rand(-10, 10), H - h); g.quadraticCurveTo(x + 1, H - h * .5, x + 2, H); g.fill(); }
      sprites = BAMBOO.map(D => [0, 1, 2].map(k => sprig(D, k)));
      stalks = BAMBOO.map((D, l) => {
        const n = Math.ceil(W / (s * D.gap)) + 1;
        return Array.from({ length: n }, (_, i) => {
          const seg = s * rand(.09, .13) * (.6 + l * .25), nodes = [];
          for (let y = H + rand(0, seg); y > -seg; y -= seg * rand(.92, 1.08)) nodes.push(y);
          const leaves = [];
          for (const y of nodes) if (y < H * (.45 + .1 * l) && Math.random() < .5 + .1 * (3 - l)) leaves.push({ y, side: Math.random() < .5 ? -1 : 1, k: Math.floor(rand(0, 3)), ph: rand(0, TAU), rot: rand(-.3, .25) });
          return { x: (i + rand(-.35, .35)) * s * D.gap, lean: rand(-.025, .025), ph: rand(0, TAU), w: s * D.w * rand(.8, 1.15), nodes, leaves };
        });
      });
      // The season: snow lying and falling in winter, yellow leaves drifting down in autumn.
      fall = isWinter() ? 'snow' : season() === 2 ? 'leaves' : null;
      if (fall === 'snow') { g = ground.getContext('2d'); const sg = g.createLinearGradient(0, H * .9, 0, H); sg.addColorStop(0, 'rgba(236,240,246,0)'); sg.addColorStop(.5, 'rgba(236,240,246,.85)'); sg.addColorStop(1, 'rgba(226,232,240,1)'); g.fillStyle = sg; g.fillRect(0, H * .9, W, H * .1); }
      bits = fall ? Array.from({ length: fall === 'snow' ? (lowPower ? 70 : 150) : 22 }, () => ({ x: rand(0, W), y: rand(0, H), z: rand(.4, 1), ph: rand(0, TAU) })) : [];
      flat = BAMBOO.map((D, l) => {
        if (l > (lowPower ? 1 : 0)) return null;
        const [c, fg] = layer(W * 1.1, H); fg.translate(W * .05, 0);
        for (const st of stalks[l]) stalk(fg, D, sprites[l], st, 0, 0, s, true);
        return c;
      });
    },
    draw(t) {
      const s = S();
      ctx.drawImage(back, 0, 0, W, H);
      let gsum = 0;
      for (let l = 0; l < BAMBOO.length; l++) {
        const D = BAMBOO[l], spr = sprites[l];
        if (flat[l]) {
          // Far stalks are drawn once and leaned as a whole; up close each one bends on its own.
          const g = gust(W / 2, l, t); gsum += g * stalks[l].length;
          const k = -(Math.sin(t * .4) * s * .007 + g * s * (.012 + .045 * weather)) * D.amp * (lively ? 1.5 : 1) / H;
          ctx.save(); ctx.transform(1, 0, k, 1, -k * H, 0); ctx.drawImage(flat[l], -W * .05, 0, W * 1.1, H); ctx.restore();
        } else for (const st of stalks[l]) { const g = gust(st.x, l, t); gsum += g; stalk(ctx, D, spr, st, g, t, s); }
        if (l < BAMBOO.length - 1) { ctx.globalAlpha = l === 0 ? .55 : .35; ctx.drawImage(mist, 0, 0, W, H); ctx.globalAlpha = 1; }
        if (l === 1) {
          // Light through the canopy, brighter as the gusts open it.
          const n = stalks.slice(0, 2).reduce((a, b) => a + b.length, 0) || 1;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = clamp(.35 + .5 * (gsum / n) + .12 * Math.sin(t * .37) + .08 * Math.sin(t * .91), 0, 1);
          ctx.drawImage(shafts, 0, 0, W, H);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.drawImage(ground, 0, 0, W, H);
      if (fall) {
        const snow = fall === 'snow', dt = Math.min(.05, Math.max(0, t - (lastT || t))); lastT = t;
        ctx.fillStyle = snow ? 'rgba(244,246,250,.85)' : '#d8b24a';
        for (const b of bits) {
          b.y += H * (snow ? .05 : .04) * b.z * dt; b.x += (Math.sin(t * .7 + b.ph) * (snow ? 10 : 30) + 20 * weather) * dt;
          if (b.y > H) { b.y = -8; b.x = rand(0, W); } if (b.x > W + 8) b.x = -8;
          if (snow) { ctx.beginPath(); ctx.arc(b.x, b.y, s * .003 * b.z, 0, TAU); ctx.fill(); }
          else { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(t * 1.3 * b.z + b.ph); ctx.beginPath(); ctx.ellipse(0, 0, s * .012 * b.z, s * .003 * b.z, 0, 0, TAU); ctx.fill(); ctx.restore(); }
        }
      }
    }
  };
}

/* Paper Lanterns: warm lanterns rising over a still lake at night, their reflections trailing below */
export function lanternsScene() {
  let sky, lamps, sprite, halo, hy, spawn = 0;
  const add = (pre) => {
    const z = Math.pow(Math.random(), .8), y0 = hy + (H - hy) * (.04 + .9 * Math.pow(z, 1.3)), sz = S() * (.012 + .038 * Math.pow(z, 1.5));
    const l = { x: rand(-.05, 1.05) * W, y0, y: y0 - sz * .8, z, sz, v: sz * rand(.35, .55), ph: rand(0, TAU), f: rand(.6, 1.1), drift: rand(-.15, .15) * sz };
    if (pre) l.y = y0 - rand(0, y0 + sz * 3);
    let i = 0; while (i < lamps.length && lamps[i].z < z) i++;
    lamps.splice(i, 0, l);
  };
  return {
    init() {
      const s = S(); hy = H * .6; let g;
      [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, hy);
      gr.addColorStop(0, '#060818'); gr.addColorStop(.5, '#141638'); gr.addColorStop(.85, '#3a2a50'); gr.addColorStop(1, '#6a3f52');
      g.fillStyle = gr; g.fillRect(0, 0, W, hy + 1);
      stars(g, Math.round(W * H / 9000), hy * .6);
      glow(g, W * .5, hy, W * .7, [200, 110, 90], .16);
      const lake = g.createLinearGradient(0, hy, 0, H);
      lake.addColorStop(0, '#3a2638'); lake.addColorStop(.25, '#141428'); lake.addColorStop(1, '#04050c');
      g.fillStyle = lake; g.fillRect(0, hy, W, H - hy);
      // Two ranges of hills, each mirrored in the water.
      for (const [hh, col, rc, f] of [[.09, '#161631', 'rgba(22,22,46,.75)', 1.6], [.055, '#0b0b1c', 'rgba(10,10,24,.85)', 2.6]]) {
        const ph = rand(0, TAU), ys = []; for (let x = 0; x <= W + 8; x += 8) ys.push(hy - H * hh * (.45 + .3 * Math.sin(x / W * f * TAU * .5 + ph) + .25 * Math.sin(x / W * f * TAU * 1.3 + ph * 2)) * (W > H ? 1 : .8));
        g.fillStyle = col; g.beginPath(); g.moveTo(0, hy + 1); ys.forEach((y, i) => g.lineTo(i * 8, y)); g.lineTo(W + 8, hy + 1); g.fill();
        if (isWinter() && hh > .06) {   // in winter, snow on the far hills catches the lantern light
          g.fillStyle = 'rgba(190,180,215,.32)'; g.beginPath(); ys.forEach((y, i) => i ? g.lineTo(i * 8, y) : g.moveTo(0, y));
          for (let i = ys.length - 1; i >= 0; i--) g.lineTo(i * 8, ys[i] + H * .012 * (.6 + .4 * Math.sin(i * 1.7))); g.fill();
        }
        g.fillStyle = rc; g.beginPath(); g.moveTo(0, hy); ys.forEach((y, i) => g.lineTo(i * 8, hy + (hy - y) * .8)); g.lineTo(W + 8, hy); g.fill();
      }
      g.fillStyle = 'rgba(255,190,150,.18)'; g.fillRect(0, hy, W, 1);
      g.fillStyle = '#05050c'; g.strokeStyle = '#05050c'; g.lineCap = 'round';
      for (let i = 0; i < 26; i++) { const x = rand(-.02, .16) * W, h = s * rand(.08, .22); g.lineWidth = rand(1, 2.2); g.beginPath(); g.moveTo(x, H + 2); g.quadraticCurveTo(x + rand(-8, 8), H - h * .6, x + rand(-14, 14), H - h); g.stroke(); }
      for (let i = 0; i < 18; i++) { const x = rand(.86, 1.02) * W, h = s * rand(.06, .18); g.lineWidth = rand(1, 2.2); g.beginPath(); g.moveTo(x, H + 2); g.quadraticCurveTo(x + rand(-8, 8), H - h * .6, x + rand(-14, 14), H - h); g.stroke(); }
      const L = 64; [sprite, g] = layer(L, L * 1.25);
      const body = new Path2D(); body.moveTo(L * .1, L * .12); body.quadraticCurveTo(L * .5, -L * .04, L * .9, L * .12); body.quadraticCurveTo(L * 1.02, L * .62, L * .8, L * 1.15); body.lineTo(L * .2, L * 1.15); body.quadraticCurveTo(-L * .02, L * .62, L * .1, L * .12); body.closePath();
      const bg = g.createLinearGradient(0, 0, 0, L * 1.2);
      bg.addColorStop(0, '#c9562a'); bg.addColorStop(.45, '#f39a48'); bg.addColorStop(.85, '#ffd890'); bg.addColorStop(1, '#fff2c4');
      g.fillStyle = bg; g.fill(body);
      g.save(); g.clip(body); glow(g, L * .5, L * 1.05, L * .55, [255, 250, 220], .7);
      g.strokeStyle = 'rgba(150,60,20,.25)'; g.lineWidth = 1.2; for (const x of [.32, .5, .68]) { g.beginPath(); g.moveTo(L * x, 0); g.lineTo(L * (x + (x - .5) * .3), L * 1.2); g.stroke(); }
      g.restore();
      g.fillStyle = 'rgba(90,40,20,.6)'; g.fillRect(L * .2, L * 1.12, L * .6, L * .05);
      halo = blob(48, [255, 160, 70]);
      lamps = []; spawn = 0;
      for (let i = 0; i < (lowPower ? 16 : 28); i++) add(true);
    },
    draw(t, dt) {
      ctx.drawImage(sky, 0, 0, W, H);
      const cap = lowPower ? 40 : 80;
      spawn += dt * (.3 + 1.1 * clamp(musicLevel, 0, 1)) * (lively ? 1.6 : 1);
      while (spawn >= 1) { spawn--; if (lamps.length < cap) add(false); }
      ripples(hy, t, [190, 170, 200], .05, 26);
      ctx.save(); ctx.beginPath(); ctx.rect(0, hy, W, H - hy); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      for (const l of lamps) {
        const ry = 2 * l.y0 - l.y, k = clamp(1 - (l.y0 - l.y) / (H * 1.1), 0, 1);
        if (ry < hy - l.sz || ry > H + l.sz * 4) continue;
        const sz = l.sz * (.55 + .45 * k), fl = .85 + .15 * Math.sin(t * l.f * 2 + l.ph), w = Math.sin(t * .8 + ry * .05) * sz * .25;
        ctx.globalAlpha = .28 * fl * k; ctx.drawImage(halo, l.x - sz * 1.6 + w, ry - sz * 4, sz * 3.2, sz * 8);
        ctx.globalAlpha = .4 * fl * k;
        for (let j = 0; j < 7; j++) { const yy = ry - sz * .5 + j * sz * .28, ww = sz * (.85 - j * .07); ctx.globalAlpha = .3 * fl * k * (1 - j / 8); ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, l.x - ww / 2 + Math.sin(t * 1.3 + j * 1.7 + l.ph) * sz * .16, yy, ww, sz * .2); }
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
      for (let i = lamps.length - 1; i >= 0; i--) {
        const l = lamps[i];
        l.y -= l.v * dt * (lively ? 1.8 : 1); l.x += (l.drift + Math.sin(t * .15 + l.ph) * l.sz * .2) * dt;
        const up = clamp((l.y0 - l.y) / (H * 1.1), 0, 1), sz = l.sz * (1 - .45 * up);
        if (l.y < -sz * 3) { lamps.splice(i, 1); continue; }
        const fl = .88 + .12 * Math.sin(t * l.f * 2 + l.ph) * Math.sin(t * l.f * .7 + l.ph * 2), a = 1 - .55 * up;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .45 * fl * a;
        ctx.drawImage(halo, l.x - sz * 2.4, l.y - sz * 2.2, sz * 4.8, sz * 4.8);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * (.75 + .25 * fl);
        ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(Math.sin(t * .7 + l.ph) * .05);
        ctx.drawImage(sprite, -sz * .5, -sz * .62, sz, sz * 1.25); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  };
}

/* Rooftops in the Rain: zinc roofs, dormers and chimney pots at night, lit windows, a chimney smoking */
export function rooftopsScene() {
  let sky, mid, near, wins, figure, nextFig, smoke, puff, drops, flue, roofs, winter;
  const snowCap = (g, x, y, w, h) => { g.fillStyle = 'rgba(232,236,246,.92)'; g.beginPath(); g.ellipse(x + w / 2, y, w / 2 + h * .4, h, 0, Math.PI, TAU); g.fill(); };
  function building(g, x0, w, top, u, list, depth) {
    const eave = top + u * 1.25, inset = u * .32;
    const face = depth ? [44, 40, 46] : [34, 33, 42], zinc = depth ? [66, 76, 92] : [50, 58, 74];
    g.fillStyle = rgb(face); g.fillRect(x0, eave, w, H - eave);
    // Tall windows on the facade, a few of them lit.
    const cols = Math.max(2, Math.floor(w / (u * .9))), cw = w / cols;
    for (let row = 0; eave + u * .5 + row * u * 1.35 < H; row++) for (let c = 0; c < cols; c++) {
      const wx = x0 + c * cw + cw * .3, wy = eave + u * .45 + row * u * 1.35, ww = cw * .4, wh = u * .82, lit = Math.random() < .22;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
      if (lit) { glow(g, wx + ww / 2, wy + wh / 2, wh * 1.1, [255, 170, 90], .12); const lg = g.createLinearGradient(0, wy, 0, wy + wh); lg.addColorStop(0, '#ffc77e'); lg.addColorStop(1, '#e48a40'); g.fillStyle = lg; list.push({ x: wx, y: wy, w: ww, h: wh }); }
      else g.fillStyle = Math.random() < .5 ? '#151824' : '#1c2030';
      g.fillRect(wx, wy, ww, wh);
      g.fillStyle = rgb(face.map(v => v * .7)); g.fillRect(wx + ww / 2 - .5, wy, 1, wh); g.fillRect(wx, wy + wh * .55, ww, 1);
      g.fillStyle = 'rgba(10,10,14,.8)'; g.fillRect(wx - u * .06, wy + wh * .62, ww + u * .12, u * .03);   // a railing
    }
    g.fillStyle = rgb(face.map(v => v * 1.3)); g.fillRect(x0 - u * .05, eave - u * .06, w + u * .1, u * .1);   // the cornice
    // The mansard: a steep zinc slope up to a flat top, seams catching a little light.
    const roof = new Path2D(); roof.moveTo(x0, eave); roof.lineTo(x0 + inset, top); roof.lineTo(x0 + w - inset, top); roof.lineTo(x0 + w, eave); roof.closePath();
    const rg = g.createLinearGradient(0, top, 0, eave); rg.addColorStop(0, rgb(zinc.map(v => v * 1.15))); rg.addColorStop(1, rgb(zinc.map(v => v * .8)));
    g.fillStyle = rg; g.fill(roof);
    if (depth) roofs.push({ path: roof, top, eave, x0, w });
    if (winter) { g.save(); g.clip(roof); g.fillStyle = 'rgba(225,230,242,.55)'; g.fillRect(x0, top, w, (eave - top) * .5); g.restore(); snowCap(g, x0 + inset, top, w - inset * 2, u * .07); snowCap(g, x0 - u * .05, eave - u * .06, w + u * .1, u * .04); }
    g.save(); g.clip(roof); g.strokeStyle = 'rgba(160,175,200,.12)'; g.lineWidth = 1;
    for (let x = x0; x < x0 + w; x += u * .14) { g.beginPath(); g.moveTo(x, eave); g.lineTo(x + (x - x0 - w / 2) * -.12, top); g.stroke(); }
    g.restore();
    const nd = Math.max(1, Math.floor(w / (u * 1.2)));
    for (let k = 0; k < nd; k++) {   // dormers
      const dx = x0 + w * (k + .5) / nd, dw = u * .42, dy = top + u * .35, dh = u * .62;
      g.fillStyle = rgb(face.map(v => v * 1.15)); g.fillRect(dx - dw / 2, dy, dw, dh);
      g.fillStyle = winter ? '#dfe4ee' : rgb(zinc.map(v => v * 1.1)); g.beginPath(); g.moveTo(dx - dw * .62, dy + 1); g.quadraticCurveTo(dx, dy - dw * .55, dx + dw * .62, dy + 1); g.fill();
      const lit = Math.random() < .3, wx = dx - dw * .3, wy = dy + dh * .15, ww = dw * .6, wh = dh * .72;
      g.fillStyle = lit ? '#ffcf86' : '#121522'; g.fillRect(wx, wy, ww, wh);
      if (lit) list.push({ x: wx, y: wy, w: ww, h: wh });
      g.fillStyle = 'rgba(20,20,26,.8)'; g.fillRect(dx - .5, wy, 1, wh);
    }
    // Chimney stacks on the flat roof, each with a row of terracotta pots.
    const nc = 1 + Math.floor(rand(0, 2.2)), stacks = [];
    for (let k = 0; k < nc; k++) {
      const cw2 = u * rand(.5, 1.1), cx = x0 + inset + rand(0, Math.max(0, w - inset * 2 - cw2)), ch = u * rand(.35, .7);
      g.fillStyle = depth ? '#4a3a36' : '#3a2e2e'; g.fillRect(cx, top - ch, cw2, ch + 1);
      g.fillStyle = depth ? '#5a4a44' : '#463834'; g.fillRect(cx - u * .04, top - ch, cw2 + u * .08, u * .06);
      if (winter) snowCap(g, cx - u * .04, top - ch, cw2 + u * .08, u * .05);
      const np = Math.max(2, Math.floor(cw2 / (u * .16)));
      for (let p = 0; p < np; p++) {
        const px = cx + cw2 * (p + .5) / np, pw = u * .085, ph = u * rand(.14, .26);
        g.fillStyle = depth ? '#8a5640' : '#6a4232'; g.fillRect(px - pw / 2, top - ch - ph, pw, ph);
        g.fillStyle = 'rgba(255,200,150,.12)'; g.fillRect(px - pw / 2, top - ch - ph, pw * .35, ph);
        stacks.push({ x: px, y: top - ch - ph });
      }
    }
    return stacks;
  }
  function row(g, base, u, list, depth) {
    let x = -rand(0, u * 2); const pots = [];
    while (x < W) { const w = u * rand(2.4, 4.6), top = base - rand(0, u * .9); pots.push(...building(g, x, w, top, u, list, depth)); x += w + rand(0, u * .2); }
    return pots;
  }
  return {
    init() {
      const s = S(), u = s / 10; let g;
      winter = isWinter(); roofs = [];
      [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, H * .6);
      gr.addColorStop(0, '#0a0d18'); gr.addColorStop(.6, '#1d2234'); gr.addColorStop(1, '#3b3646');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) glow(g, rand(0, W), rand(0, H * .4), s * rand(.12, .3), [80, 86, 104], .12);
      glow(g, W * .5, H * .6, W * .8, [150, 110, 80], .18);
      // Far skyline, and a tower far off with its light.
      const fy = H * .44;
      g.fillStyle = '#1a1c28';
      for (let x = 0; x < W;) { const w = u * rand(.4, 1.2), h = u * rand(.2, 1); g.fillRect(x, fy - h, w + 1, H - fy + h); x += w; }
      g.fillStyle = 'rgba(255,200,140,.5)';
      for (let i = 0; i < W / 12; i++) g.fillRect(rand(0, W), fy - rand(-u * .6, u * .7), 1.2, 1.2);
      const ex = W * .7, eh = Math.min(H * .2, u * 3.4), eb = fy + u * .2, ew = eh * .32;
      g.fillStyle = '#20222f'; g.beginPath(); g.moveTo(ex - ew / 2, eb); g.quadraticCurveTo(ex - ew * .12, eb - eh * .45, ex - ew * .04, eb - eh); g.lineTo(ex + ew * .04, eb - eh); g.quadraticCurveTo(ex + ew * .12, eb - eh * .45, ex + ew / 2, eb); g.lineTo(ex + ew * .3, eb); g.quadraticCurveTo(ex, eb - eh * .2, ex - ew * .3, eb); g.fill();
      g.fillRect(ex - ew * .2, eb - eh * .32, ew * .4, eh * .02); g.fillRect(ex - ew * .1, eb - eh * .6, ew * .2, eh * .015); g.fillRect(ex - .7, eb - eh * 1.08, 1.4, eh * .1);
      glow(g, ex, eb - eh * 1.08, u * .25, [255, 210, 160], .5);
      const hz = g.createLinearGradient(0, fy - u, 0, fy + u); hz.addColorStop(0, 'rgba(70,70,90,0)'); hz.addColorStop(1, 'rgba(70,70,90,.5)');
      g.fillStyle = hz; g.fillRect(0, fy - u, W, u * 2);
      wins = [];
      [mid, g] = layer(W, H); const midPots = row(g, H * .53, u, wins, 0);
      [near, g] = layer(W, H); const ul = u * 1.75, nearWins = []; const nearPots = row(g, H * .76, ul, nearWins, 1);
      // Rain sheen along the near gutters.
      g.fillStyle = 'rgba(190,205,230,.07)'; g.fillRect(0, H * .76 + ul * 1.25 - 2, W, 2);
      for (const w of nearWins) wins.push({ ...w, near: 1 });
      const cand = nearPots.filter(p => p.x > W * .15 && p.x < W * .85 && p.y > H * .3);
      const pick = cand.length ? cand : (midPots.length ? midPots : [{ x: W / 2, y: H * .5 }]);
      flue = pick[Math.floor(rand(0, pick.length))];
      flue.near = nearPots.includes(flue);
      figure = null; nextFig = rand(3, 8); smoke = [];
      puff = blob(48, [150, 152, 164]);
      drops = Array.from({ length: lowPower ? 200 : 420 }, () => ({ x: rand(0, W), y: rand(0, H), z: rand(.3, 1) }));
    },
    draw(t, dt) {
      const s = S(), u = s / 10;
      ctx.drawImage(sky, 0, 0, W, H);
      ctx.drawImage(mid, 0, 0, W, H);
      nextFig -= dt;
      if (!figure && nextFig <= 0 && wins.length) { const w = wins[Math.floor(rand(0, wins.length))]; figure = { w, p: 0, dur: rand(5, 9), dir: Math.random() < .5 ? 1 : -1, stop: rand(.35, .65) }; }
      const fig = near => {
        if (!figure || !!figure.w.near !== near) return;
        const f = figure, w = f.w; f.p += dt / f.dur;
        if (f.p >= 1) { figure = null; nextFig = rand(5, 14); return; }
        const e = f.p < .35 ? f.p / .35 * f.stop : f.p > .65 ? f.stop + (f.p - .65) / .35 * (1 - f.stop) : f.stop;   // walks in, lingers, walks on
        const x = w.x - w.w * .5 + (w.w * 2) * (f.dir > 0 ? e : 1 - e), y = w.y + w.h * .35, r = w.w * .2;
        ctx.save(); ctx.beginPath(); ctx.rect(w.x, w.y, w.w, w.h); ctx.clip();
        ctx.fillStyle = 'rgba(44,24,16,.82)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x, y + r * 2.6, r * 1.9, r * 1.8, 0, Math.PI, TAU); ctx.fill(); ctx.fillRect(x - r * 1.9, y + r * 2.6, r * 3.8, w.h);
        ctx.restore();
      };
      fig(false);
      const puffs = () => {
        if (Math.random() < dt * 3) smoke.push({ x: flue.x, y: flue.y, life: 0, max: rand(7, 10), r0: u * rand(.05, .09) * (flue.near ? 1.6 : 1) });
        for (let i = smoke.length - 1; i >= 0; i--) {
          const p = smoke[i]; p.life += dt; if (p.life >= p.max) { smoke.splice(i, 1); continue; }
          const k = p.life / p.max; p.y -= u * .22 * dt * (1 - k * .5); p.x += u * (.12 + .25 * weather) * dt * k;
          const r = p.r0 + u * .8 * k * (flue.near ? 1.4 : 1);
          ctx.globalAlpha = .45 * (1 - k) * Math.min(1, p.life * 2); ctx.drawImage(puff, p.x - r, p.y - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
      };
      if (!flue.near) puffs();
      ctx.drawImage(near, 0, 0, W, H);
      // The wet zinc: a slow band of reflected city light sliding over the near roofs, stronger the harder it rains.
      if (!winter && weather > .3) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const r of roofs) {
          const x = r.x0 + r.w * ((t * .02 + r.x0 * .001) % 1.4 - .2), sg = ctx.createLinearGradient(x - u, 0, x + u, 0);
          sg.addColorStop(0, 'rgba(150,160,190,0)'); sg.addColorStop(.5, `rgba(170,180,210,${.12 * weather})`); sg.addColorStop(1, 'rgba(150,160,190,0)');
          ctx.fillStyle = sg; ctx.fill(r.path);
        }
        ctx.restore();
      }
      fig(true);
      if (flue.near) puffs();
      if (snowing()) {   // snow instead of rain when it is snowing (or, without local weather, in winter)
        const n = Math.floor(drops.length * .5 * (.3 + .7 * weather));
        ctx.fillStyle = 'rgba(235,238,248,.75)'; ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const d = drops[i]; d.y += H * .06 * d.z * dt; d.x += Math.sin(t * .7 + i) * 10 * dt - 6 * weather * dt;
          if (d.y > H) { d.y -= H + 10; d.x = rand(0, W); } if (d.x < -10) d.x += W + 20;
          const r = s * .0035 * d.z; ctx.moveTo(d.x + r, d.y); ctx.arc(d.x, d.y, r, 0, TAU);
        }
        ctx.fill();
        return;
      }
      // Rain in two depths, slanting with the wind.
      const n = Math.floor(drops.length * (.2 + .8 * weather)), slant = .12 + .1 * weather, v = H * 1.1;
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass ? 'rgba(200,210,230,.32)' : 'rgba(170,180,205,.18)'; ctx.lineWidth = pass ? 1.2 : .8; ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const d = drops[i]; if ((d.z > .65) !== !!pass) continue;
          d.y += v * d.z * dt; d.x -= v * d.z * slant * dt;
          if (d.y > H) { d.y -= H + 30; d.x = rand(0, W * 1.2); } if (d.x < -20) d.x += W + 40;
          const len = s * .035 * d.z; ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + len * slant, d.y - len);
        }
        ctx.stroke();
      }
    }
  };
}

/* Harbour at Dawn: fishing boats rocking at their moorings, gulls circling, a lighthouse on the breakwater; the light follows the clock */
export function harbourScene() {
  let sky, boats, gulls, built = 0, hy, lh, winter, wxP = [], rings = [];
  const HULLS = [[180, 60, 48], [44, 84, 140], [40, 110, 90], [226, 224, 214], [200, 150, 60], [90, 60, 110]];
  function boatSprite(L, hull, d) {
    const lightK = .3 + .7 * d, tint = c => mix(c.map(v => v * lightK), skyMix([20, 26, 50], [120, 80, 90], [200, 200, 210], d), .25 * (1 - d));
    const w = L * 1.3, h = L * 1.1, [c, g] = layer(w, h), ox = w * .5, oy = h * .82;
    const deckS = oy - L * .14, deckB = oy - L * .2, bow = ox + L * .5, stern = ox - L * .45;
    const hullP = new Path2D(); hullP.moveTo(stern, deckS); hullP.lineTo(bow, deckB); hullP.quadraticCurveTo(bow - L * .1, oy - L * .02, bow - L * .25, oy + L * .03); hullP.lineTo(stern + L * .05, oy + L * .03); hullP.quadraticCurveTo(stern - L * .01, oy - L * .05, stern, deckS); hullP.closePath();
    g.fillStyle = rgb(tint(hull)); g.fill(hullP);
    g.save(); g.clip(hullP);
    g.fillStyle = rgb(tint([235, 232, 222]), .9); g.beginPath(); g.moveTo(stern, deckS); g.lineTo(bow, deckB); g.lineTo(bow, deckB + L * .03); g.lineTo(stern, deckS + L * .03); g.fill();
    g.fillStyle = rgb(tint([60, 30, 30])); g.fillRect(stern - 5, oy - L * .02, L * 1.2, L * .1);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(stern - 5, oy - L * .08, L * 1.2, L * .1);
    g.restore();
    const cx = ox - L * .2, cw = L * .26, ch = L * .2, cy = deckS - ch + L * .01;   // the wheelhouse
    g.fillStyle = rgb(tint([232, 230, 222])); g.fillRect(cx, cy, cw, ch);
    g.fillStyle = rgb(tint(hull)); g.fillRect(cx - L * .02, cy - L * .025, cw + L * .04, L * .03);
    g.fillStyle = d < .35 ? 'rgba(255,200,120,.9)' : rgb(tint([40, 56, 70])); for (let k = 0; k < 3; k++) g.fillRect(cx + cw * (.1 + .3 * k), cy + ch * .2, cw * .2, ch * .35);
    g.strokeStyle = rgb(tint([60, 56, 52])); g.lineWidth = Math.max(1, L * .012); g.lineCap = 'round';
    const mx = ox + L * .12, mt = deckB - L * .62;
    g.beginPath(); g.moveTo(mx, deckB + L * .02); g.lineTo(mx, mt); g.stroke();
    g.lineWidth = Math.max(.6, L * .005);
    g.beginPath(); g.moveTo(mx, mt); g.lineTo(bow, deckB); g.moveTo(mx, mt); g.lineTo(stern + L * .05, deckS); g.moveTo(mx, mt + L * .2); g.lineTo(mx + L * .3, deckB - L * .05); g.stroke();
    g.fillStyle = rgb(tint([200, 60, 50])); g.beginPath(); g.moveTo(mx, mt); g.lineTo(mx - L * .08, mt + L * .025); g.lineTo(mx, mt + L * .05); g.fill();
    return { c, w, h, ox, oy, bowX: bow - ox, bowY: deckB - oy, mast: [mx - ox, mt - oy] };
  }
  const api = {
    init() {
      const d = daylight(), s = S(); built = d; hy = H * .56; let g;
      winter = isWinter();
      wxP = Array.from({ length: lowPower ? 120 : 260 }, () => ({ x: rand(0, W), y: rand(0, H), z: rand(.3, 1) }));
      [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, hy);
      for (const [p, n, k, y] of [[0, [4, 6, 18], [40, 46, 96], [90, 150, 220]], [.6, [12, 16, 36], [170, 120, 140], [170, 205, 235]], [1, [24, 26, 46], [252, 176, 120], [222, 232, 238]]]) gr.addColorStop(p, rgb(skyMix(n, k, y, d)));
      g.fillStyle = gr; g.fillRect(0, 0, W, hy + 1);
      if (d < .5) { g.globalAlpha = 1 - d * 2; stars(g, Math.round(W * H / 3000), hy * .8); g.globalAlpha = 1; }
      const sunX = W * .62, sunA = 1 - Math.abs(d - .5) * 2;
      if (d > .15) { glow(g, sunX, hy, W * .6, skyMix([0, 0, 0], [255, 170, 110], [255, 240, 210], d), .45 * Math.max(sunA, .3)); glow(g, sunX, hy - H * .02, s * .05, skyMix([0, 0, 0], [255, 220, 170], [255, 250, 235], d), .9 * sunA); }
      else { glow(g, W * .25, H * .18, s * .25, [180, 190, 230], .2 * (.3 + .7 * (1 - Math.abs(moonPhase() * 2 - 1)))); drawMoon(g, W * .25, H * .18, s * .025, '#e8e6d8'); }   // tonight's moon
      // Far hills behind the harbour.
      g.fillStyle = rgb(skyMix([10, 12, 24], [90, 70, 96], [120, 140, 160], d));
      g.beginPath(); g.moveTo(0, hy); for (let x = 0; x <= W * .55; x += 6) g.lineTo(x, hy - H * .06 * Math.pow(1 - x / (W * .55), .7) * (.8 + .2 * Math.sin(x * .02))); g.lineTo(W * .55, hy); g.fill();
      if (winter) {   // snow on the hilltops
        g.fillStyle = rgb(skyMix([60, 64, 84], [220, 200, 210], [240, 244, 250], d), .85); g.beginPath();
        for (let x = 0; x <= W * .55; x += 6) { const y = hy - H * .06 * Math.pow(1 - x / (W * .55), .7) * (.8 + .2 * Math.sin(x * .02)); x ? g.lineTo(x, y) : g.moveTo(x, y); }
        for (let x = W * .55; x >= 0; x -= 6) { const y = hy - H * .06 * Math.pow(1 - x / (W * .55), .7) * (.8 + .2 * Math.sin(x * .02)); g.lineTo(x, y + (y - hy) * -.35 + H * .002); }
        g.fill();
      }
      const sea = g.createLinearGradient(0, hy, 0, H);
      sea.addColorStop(0, rgb(skyMix([20, 22, 42], [200, 140, 120], [170, 200, 220], d))); sea.addColorStop(.3, rgb(skyMix([10, 14, 30], [70, 60, 90], [70, 120, 150], d))); sea.addColorStop(1, rgb(skyMix([3, 5, 12], [20, 22, 40], [30, 66, 90], d)));
      g.fillStyle = sea; g.fillRect(0, hy, W, H - hy);
      if (d > .15) { g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 60; i++) { const y = hy + Math.pow(Math.random(), 1.6) * (H - hy) * .7, sp = (y - hy) / (H - hy); g.fillStyle = rgb(skyMix([0, 0, 0], [255, 180, 120], [255, 245, 220], d), .25 * sunA + .05); g.fillRect(sunX + rand(-1, 1) * s * (.03 + .2 * sp), y, s * rand(.01, .05) * (.4 + sp), 1.2); } g.globalCompositeOperation = 'source-over'; }
      // The breakwater and its lighthouse.
      const bx0 = W * .46, by = hy + H * .018, stone = skyMix([14, 14, 22], [70, 56, 70], [120, 118, 112], d);
      g.fillStyle = rgb(stone); g.beginPath(); g.moveTo(bx0, by + H * .01); g.lineTo(bx0 + s * .02, by - H * .008); g.lineTo(W * .92, by - H * .008); g.lineTo(W * .93, by + H * .01); g.fill();
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(bx0, by + H * .004, W * .93 - bx0, H * .006);
      if (winter) { g.fillStyle = rgb(skyMix([70, 74, 94], [230, 210, 215], [245, 247, 252], d), .9); g.fillRect(bx0 + s * .02, by - H * .008 - 1.5, W * .92 - bx0 - s * .02, 2.5); }
      const tx = W * .9, th = Math.min(H * .085, s * .14), tw = s * .016;
      g.fillStyle = rgb(skyMix([40, 40, 52], [200, 180, 180], [240, 238, 232], d)); g.fillRect(tx - tw / 2, by - H * .008 - th, tw, th);
      g.fillStyle = rgb(skyMix([40, 14, 18], [170, 60, 60], [200, 50, 46], d)); g.fillRect(tx - tw / 2, by - H * .008 - th * .55, tw, th * .14); g.fillRect(tx - tw * .7, by - H * .008 - th - tw * .9, tw * 1.4, tw * .9);
      lh = { x: tx, y: by - H * .008 - th - tw * .45 };
      g.fillStyle = rgb(stone, .5); g.fillRect(bx0, by + H * .012, W * .93 - bx0, 1.5);
      const n = W > H ? 5 : 4;
      const slots = n === 5 ? [2, 4, 1, 3, 0] : [2, 0, 3, 1];
      boats = Array.from({ length: n }, (_, i) => {
        const z = (i + rand(.1, .9)) / n, L = s * (.16 + .28 * z) * (W > H ? 1 : 1.05);
        return { z, L, x: clamp(W * (slots[i] + .5) / n + rand(-.05, .05) * W, L * .55, W - L * .55), y: hy + (H - hy) * (.15 + .7 * z), ph: rand(0, TAU), f: rand(.5, .8), dir: Math.random() < .5 ? 1 : -1, spr: boatSprite(L, HULLS[i % HULLS.length], d) };
      }).sort((a, b) => a.z - b.z);
      gulls = Array.from({ length: 5 }, () => ({ cx: rand(.2, .8) * W, cy: rand(.12, .38) * H, rx: s * rand(.12, .3), ry: s * rand(.04, .08), w: rand(.12, .22) * (Math.random() < .5 ? 1 : -1), ph: rand(0, TAU), sz: s * rand(.014, .024) }));
    },
    draw(t, dt) {
      if (stale(built)) api.init();
      const d = daylight(), s = S(), night = 1 - d;
      ctx.drawImage(sky, 0, 0, W, H);
      // Wet weather: an overcast veil over the sky and sea, rings on the water, and drizzle (snow in winter).
      const wet = clamp((weather - .45) / .55, 0, 1);
      if (wet > 0) {
        const vg = ctx.createLinearGradient(0, 0, 0, H), vc = skyMix([16, 18, 26], [110, 104, 112], [170, 176, 184], d);
        vg.addColorStop(0, rgb(vc, .55 * wet)); vg.addColorStop(.56, rgb(vc, .35 * wet)); vg.addColorStop(1, rgb(vc, .2 * wet));
        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
        if (!snowing()) {
          if (Math.random() < dt * 30 * wet) rings.push({ x: rand(0, W), y: hy + Math.pow(Math.random(), .7) * (H - hy), age: 0 });
          ctx.strokeStyle = rgb(skyMix([150, 160, 190], [240, 210, 190], [235, 242, 250], d)); ctx.lineWidth = 1;
          for (let i = rings.length - 1; i >= 0; i--) {
            const r = rings[i]; r.age += dt; if (r.age > 1.4) { rings.splice(i, 1); continue; }
            const k = (r.y - hy) / (H - hy), rad = s * .03 * r.age * (.3 + k);
            ctx.globalAlpha = .35 * (1 - r.age / 1.4); ctx.beginPath(); ctx.ellipse(r.x, r.y, rad, rad * .25, 0, 0, TAU); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }
      ripples(hy, t, skyMix([150, 170, 220], [255, 205, 175], [235, 245, 255], d), .08);
      const mist = 1 - Math.abs(d - .5) * 2;
      if (mist > .05) { const mg = ctx.createLinearGradient(0, hy - H * .04, 0, hy + H * .08); const mc = skyMix([60, 60, 80], [240, 200, 190], [230, 235, 240], d); mg.addColorStop(0, rgb(mc, 0)); mg.addColorStop(.5, rgb(mc, .3 * mist)); mg.addColorStop(1, rgb(mc, 0)); ctx.fillStyle = mg; ctx.fillRect(0, hy - H * .04, W, H * .12); }
      if (night > .4) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, lh.x, lh.y, s * .05 * (1 + .3 * Math.sin(t * .8)), [255, 230, 170], (.4 + .3 * Math.sin(t * .8)) * (night - .3)); ctx.globalCompositeOperation = 'source-over'; }
      for (const b of boats) {
        const sp = b.spr, ang = Math.sin(t * b.f + b.ph) * .035 + Math.sin(t * b.f * 1.7 + b.ph) * .012, bob = Math.sin(t * b.f * 1.3 + b.ph) * b.L * .008, y = b.y + bob;
        // Reflection: the boat mirrored, broken into wavering slices.
        ctx.save(); ctx.translate(b.x, y); ctx.scale(b.dir, -1); ctx.rotate(ang); ctx.globalAlpha = .32;
        const sl = Math.max(2, sp.h / 24);
        for (let yy = 0; yy < sp.oy; yy += sl) { const off = Math.sin(t * 1.4 + yy * .25 + b.ph) * b.L * .012 * (1 + (sp.oy - yy) / sp.oy); ctx.drawImage(sp.c, 0, yy * sp.c.height / sp.h, sp.c.width, sl * sp.c.height / sp.h, -sp.ox + off, yy - sp.oy, sp.w, sl + .5); }
        ctx.restore();
        // A mooring line from the bow down to a buoy.
        const bx = b.x + Math.cos(ang) * sp.bowX * b.dir - Math.sin(ang) * sp.bowY * b.dir, byy = y + Math.sin(ang) * sp.bowX + Math.cos(ang) * sp.bowY;
        const ux = b.x + b.dir * b.L * .85, uy = b.y + b.L * .04 + Math.sin(t * .9 + b.ph) * b.L * .006;
        ctx.strokeStyle = rgb(skyMix([30, 30, 40], [80, 60, 60], [70, 66, 60], d), .7); ctx.lineWidth = Math.max(.6, b.L * .004);
        ctx.beginPath(); ctx.moveTo(bx, byy); ctx.quadraticCurveTo((bx + ux) / 2, uy + b.L * .02, ux, uy); ctx.stroke();
        ctx.fillStyle = rgb(skyMix([60, 20, 20], [200, 90, 60], [230, 110, 50], d)); ctx.beginPath(); ctx.arc(ux, uy - b.L * .012, b.L * .02, Math.PI, TAU); ctx.fill();
        ctx.save(); ctx.translate(b.x, y); ctx.scale(b.dir, 1); ctx.rotate(ang);
        ctx.drawImage(sp.c, -sp.ox, -sp.oy, sp.w, sp.h);
        if (night > .5) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, sp.mast[0], sp.mast[1], b.L * .05, [255, 240, 210], .7 * (night - .4)); ctx.globalCompositeOperation = 'source-over'; }
        ctx.restore();
      }
      ctx.strokeStyle = rgb(skyMix([150, 155, 175], [50, 40, 50], [50, 54, 64], d), .85); ctx.lineCap = 'round';
      for (const g of gulls) {
        const a = t * g.w * (lively ? 1.6 : 1) + g.ph, x = g.cx + Math.cos(a) * g.rx, y = g.cy + Math.sin(a) * g.ry, sz = g.sz * (.8 + .2 * Math.sin(a));
        const flapping = Math.sin(t * .23 + g.ph) > .55, fl = flapping ? Math.sin(t * 4 + g.ph) * .5 : .15;
        ctx.lineWidth = Math.max(1, sz * .12); ctx.beginPath();
        ctx.moveTo(x - sz, y - sz * fl); ctx.quadraticCurveTo(x - sz * .45, y - sz * (.35 + fl * .3), x, y);
        ctx.quadraticCurveTo(x + sz * .45, y - sz * (.35 + fl * .3), x + sz, y - sz * fl); ctx.stroke();
      }
      if (wet > 0) {
        const n = Math.floor(wxP.length * wet);
        const flakes = snowing();
        if (flakes) { ctx.fillStyle = 'rgba(240,242,250,.8)'; ctx.beginPath(); }
        else { ctx.strokeStyle = 'rgba(205,214,232,.28)'; ctx.lineWidth = 1; ctx.beginPath(); }
        for (let i = 0; i < n; i++) {
          const p = wxP[i];
          if (flakes) { p.y += H * .05 * p.z * dt; p.x += Math.sin(t * .6 + i) * 9 * dt; } else { p.y += H * 1.1 * p.z * dt; p.x -= H * .12 * p.z * dt; }
          if (p.y > H) { p.y -= H + 20; p.x = rand(0, W * 1.1); } if (p.x < -20) p.x += W + 40;
          if (flakes) { const r = s * .003 * p.z; ctx.moveTo(p.x + r, p.y); ctx.arc(p.x, p.y, r, 0, TAU); } else { const len = s * .03 * p.z; ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + len * .11, p.y - len); }
        }
        if (flakes) ctx.fill(); else ctx.stroke();
      }
    }
  };
  return api;
}

/* Firefly Meadow: tall grass against a fading dusk, fireflies blinking in slow waves that drift into step */
// Fireflies are a summer thing: a full meadow of them June to August, a few in May and September, none otherwise. In
// winter the grass is frosted and snow drifts down; in spring and autumn a low mist lies over the meadow instead.
const FIREFLY_MONTHS = [0, 0, 0, 0, .3, 1, 1, 1, .3, 0, 0, 0];
export function firefliesScene() {
  let sky, warm, starL, grass, ff, spark, flakes, mist, K = 0, clock = 0;
  function grassLayer(base, hMax, col, n, seeds) {
    const pad = W * .1, [c, g] = layer(W + pad * 2, H);
    g.fillStyle = rgb(col); g.strokeStyle = rgb(col); g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = rand(0, W + pad * 2), h = hMax * rand(.35, 1), bend = rand(-.25, .25) * h, w = rand(.8, 1.8) * S() / 500 * (hMax / (H * .4));
      g.beginPath(); g.moveTo(x - w, H); g.quadraticCurveTo(x + bend * .3, H - h * .6, x + bend, H - h); g.quadraticCurveTo(x + bend * .3 + w * .3, H - h * .6, x + w, H); g.fill();
      if (seeds && Math.random() < .3) {
        g.lineWidth = Math.max(.6, w * .4);
        for (let k = 0; k < 6; k++) { const yy = H - h + k * h * .025; g.beginPath(); g.ellipse(x + bend - k * bend * .02, yy, w * 1.1, h * .014, bend * .002, 0, TAU); g.fill(); }
      }
    }
    g.fillRect(0, base, W + pad * 2, H - base);
    return { c, pad };
  }
  return {
    init() {
      const s = S(), hy = H * .64; let g;
      [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, hy);
      gr.addColorStop(0, '#0c1230'); gr.addColorStop(.55, '#1d2a52'); gr.addColorStop(1, '#3c4a6c');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      [warm, g] = layer(W, H);
      const wg = g.createLinearGradient(0, hy * .35, 0, hy);
      wg.addColorStop(0, 'rgba(200,120,110,0)'); wg.addColorStop(.6, 'rgba(214,132,104,.45)'); wg.addColorStop(1, 'rgba(250,180,110,.85)');
      g.fillStyle = wg; g.fillRect(0, 0, W, hy + 2);
      [starL, g] = layer(W, H); stars(g, Math.round(W * H / 5000), hy * .7);
      // A line of trees on the far side of the meadow.
      [grass, g] = layer(W, H);
      g.fillStyle = '#0f1424'; g.fillRect(0, hy - s * .02, W, H);
      for (let x = -20; x < W + 20; x += s * rand(.015, .035)) { const r = s * rand(.02, .045) * (.6 + .6 * Math.abs(Math.sin(x * .004))); g.beginPath(); g.arc(x, hy - s * .02 - r * .4, r, 0, TAU); g.fill(); }
      const month = monthHere(), winter = isWinter(), frost = winter ? 1 : 0;
      const gc = (c, f) => c.map(v => Math.round(v + (150 - v) * f));
      grass = [grass, grassLayer(H * .9, H * .32, gc([22, 28, 40], frost * .35), W / 2, false), grassLayer(H * .95, H * .42, gc([13, 17, 24], frost * .22), W / 3, true), grassLayer(H, H * .5, gc([5, 7, 10], frost * .1), W / 9, true)];
      const n = Math.round((lowPower ? 150 : 320) * FIREFLY_MONTHS[month]);
      flakes = winter ? Array.from({ length: lowPower ? 60 : 140 }, () => ({ x: rand(0, W), y: rand(0, H), v: rand(14, 40), r: rand(.6, 2.2) * s / 600, p: rand(0, TAU) })) : null;
      mist = !winter && !n ? blob(64, [150, 160, 190], .5) : null;
      ff = Array.from({ length: n }, () => {
        const z = Math.random();
        return { z, bx: rand(0, W), by: H * rand(.42 + .12 * (1 - z), .96), r: s * (.0022 + .0048 * z * z), th: rand(0, TAU), w: TAU / 4.2 * (1 + rand(-.1, .1)), p1: rand(0, TAU), p2: rand(0, TAU), f1: rand(.05, .15), f2: rand(.07, .2) };
      });
      spark = blob(32, [196, 255, 120]);
      clock = 0;
    },
    draw(t, dt) {
      const s = S(), fade = Math.min(1, t / 900);
      clock += dt;
      ctx.drawImage(sky, 0, 0, W, H);
      ctx.globalAlpha = 1 - .7 * fade; ctx.drawImage(warm, 0, 0, W, H);
      ctx.globalAlpha = .25 + .75 * fade; ctx.drawImage(starL, 0, 0, W, H); ctx.globalAlpha = 1;
      ctx.drawImage(grass[0], 0, 0, W, H);
      // Coupling builds over a few minutes, holds, then lets go: the blinking drifts into step and out again.
      const cyc = clock % 420, Kt = cyc < 200 ? cyc / 200 : cyc < 340 ? 1 : 1 - (cyc - 340) / 80;
      K = 1.1 * Kt * Kt * (3 - 2 * Kt);
      let sx = 0, sy = 0; for (const f of ff) { sx += Math.cos(f.th); sy += Math.sin(f.th); }
      const R = Math.hypot(sx, sy) / ff.length, psi = Math.atan2(sy, sx), lift = 1 + .7 * Math.min(1, bands.treble * (lively ? 1.8 : 1));
      for (const f of ff) f.th += (f.w + K * R * Math.sin(psi - f.th)) * dt;
      const flies = (lo, hi) => {
        ctx.globalCompositeOperation = 'lighter';
        for (const f of ff) {
          if (f.z < lo || f.z >= hi) continue;
          const x = f.bx + Math.sin(t * f.f1 + f.p1) * s * .05 + Math.sin(t * f.f2 * 1.7 + f.p2) * s * .02, y = f.by + Math.cos(t * f.f2 + f.p1) * s * .03;
          const ph = f.th - x / W * Math.PI * 1.2, b = Math.pow(Math.max(0, Math.sin(ph)), 14), a = Math.min(1, b * lift);
          if (a < .02) { ctx.globalAlpha = .12; ctx.fillStyle = '#2e3a18'; ctx.fillRect(x, y, 1.2, 1.2); continue; }
          const r = f.r * (4 + 1.5 * a);
          ctx.globalAlpha = a * .7; ctx.drawImage(spark, x - r, y - r, r * 2, r * 2);
          ctx.globalAlpha = a; ctx.fillStyle = '#f2ffd0'; ctx.beginPath(); ctx.arc(x, y, f.r * .6, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      };
      const sway = (gl, k, ph) => {
        const sk = (Math.sin(t * .35 + ph) * .012 + Math.sin(t * .13 + ph * 2) * .008) * k * (1 + weather);
        ctx.save(); ctx.transform(1, 0, sk, 1, -sk * H, 0); ctx.drawImage(gl.c, -gl.pad, 0, W + gl.pad * 2, H); ctx.restore();
      };
      flies(0, .35); sway(grass[1], .7, 0);
      if (mist) {   // low mist drifting over the meadow out of season
        for (let i = 0; i < 7; i++) {
          const x = ((i * .21 + t * .004 * (1 + i * .2)) % 1.3 - .15) * W, y = H * (.66 + .05 * Math.sin(i * 1.7)), w = W * .6, h = H * .12;
          ctx.globalAlpha = .22; ctx.drawImage(mist, x - w / 2, y - h / 2, w, h);
        }
        ctx.globalAlpha = 1;
      }
      flies(.35, .75); sway(grass[2], 1, 1.3);
      flies(.75, 1.01); sway(grass[3], 1.3, 2.4);
      if (flakes) {
        ctx.fillStyle = 'rgba(235, 240, 255, .8)'; ctx.beginPath();
        for (const f of flakes) {
          f.y += f.v * dt; f.x += Math.sin(t * .6 + f.p) * 8 * dt; if (f.y > H + 4) { f.y = -4; f.x = rand(0, W); }
          ctx.moveTo(f.x + f.r, f.y); ctx.arc(f.x, f.y, f.r, 0, TAU);
        }
        ctx.fill();
      }
    }
  };
}
