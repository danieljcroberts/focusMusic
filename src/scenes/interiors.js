// Windows seen from inside: a night tram, a reading room in the rain, a lighthouse lamp room, a ship's porthole,
// a glasshouse after dark and a snowed-in cabin. Everything is drawn in code; the still parts are built in init().
import { W, H, DPR, ctx, lowPower, lively } from '../view.js';
import { rand, hash, mix, rgb, layer, plain, glow, stars } from '../util.js';
import { weather } from '../weather.js';
import { daylight, skyMix } from '../daylight.js';
import { bands } from '../music.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
// Smooth value noise along a line, 0..1.
function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u; }
const stale = built => Math.abs(daylight() - built) > .04;
// A soft offscreen canvas at a fraction of CSS resolution: cheap, and the blur reads as distance.
function soft(w, h, k = .5) { const [c, g] = plain(w * k, h * k); g.scale(c.width / w, c.height / h); return [c, g]; }

// Varnished wood: grain running along the board and a soft sheen across it.
function wood(g, x, y, w, h, base, { vertical = false, sheen = .2, grain = 1 } = {}) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = rgb(base); g.fillRect(x, y, w, h);
  const across = vertical ? w : h, len = vertical ? h : w, n = Math.max(3, Math.round(across / 3 * grain));
  for (let i = 0; i < n; i++) {
    const p = Math.random(), dark = Math.random() < .65, ph = rand(0, TAU), amp = rand(.4, 2.5), fr = rand(.004, .02);
    g.strokeStyle = dark ? rgb(base.map(v => v * .5), rand(.1, .32)) : rgb(base.map(v => Math.min(255, v * 1.4 + 8)), rand(.05, .16));
    g.lineWidth = rand(.4, 1.6); g.beginPath();
    for (let s = 0; s <= len + 8; s += 8) {
      const o = Math.sin(s * fr + ph) * amp + Math.sin(s * fr * 3.1 + ph * 2) * amp * .3;
      if (vertical) g.lineTo(x + p * w + o, y + s); else g.lineTo(x + s, y + p * h + o);
    }
    g.stroke();
  }
  const gr = vertical ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, `rgba(0,0,0,${sheen})`); gr.addColorStop(.3, `rgba(255,214,160,${sheen * .55})`);
  gr.addColorStop(.55, `rgba(255,214,160,${sheen * .12})`); gr.addColorStop(1, `rgba(0,0,0,${sheen * 1.5})`);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.restore();
}
// A raised moulding: light along the top and left, shadow along the bottom and right.
function bevel(g, x, y, w, h, lw, light = .22, dark = .45) {
  g.lineWidth = lw;
  g.strokeStyle = `rgba(255,220,170,${light})`; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y); g.lineTo(x + w, y); g.stroke();
  g.strokeStyle = `rgba(0,0,0,${dark})`; g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.stroke();
}
// One water bead, drawn once and stamped: a dim body, a bright lower rim where the sky refracts, a glint above.
let beadSprite = null;
function bead() {
  if (beadSprite) return beadSprite;
  const [c, g] = plain(48, 48);
  let gr = g.createRadialGradient(24, 27, 2, 24, 24, 22);
  gr.addColorStop(0, 'rgba(190,205,225,.10)'); gr.addColorStop(.75, 'rgba(160,175,200,.22)'); gr.addColorStop(.92, 'rgba(10,14,22,.45)'); gr.addColorStop(1, 'rgba(10,14,22,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(24, 24, 22, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(225,235,250,.55)'; g.lineWidth = 3; g.beginPath(); g.arc(24, 24, 17, .35, Math.PI - .35); g.stroke();
  gr = g.createRadialGradient(18, 16, 0, 18, 16, 6); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(18, 16, 6, 0, TAU); g.fill();
  beadSprite = c; return c;
}
const stamp = (g, x, y, r, a = 1) => { g.globalAlpha = a; g.drawImage(bead(), x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; };

// Rain on a pane: beads gather on a buffer and runners slide down through them, clearing a wet track.
function rainPane(w, h, scale) {
  const [buf, bg] = layer(w, h), runners = [];
  let fade = 0;
  return {
    buf, runners,
    tick(dt, amount) {
      const add = amount * w * h / 3500 * dt * (lowPower ? .5 : 1);
      for (let i = 0; i < add + (Math.random() < add % 1 ? 1 : 0); i++) stamp(bg, rand(0, w), rand(0, h), rand(.8, 2.6) * scale, rand(.4, .9));
      fade += dt; if (fade > .5) { fade = 0; bg.globalCompositeOperation = 'destination-out'; bg.fillStyle = 'rgba(0,0,0,.035)'; bg.fillRect(0, 0, w, h); bg.globalCompositeOperation = 'source-over'; }
      const maxRun = (lowPower ? 6 : 14) * amount * Math.max(1, w * h / 250000);
      if (runners.length < maxRun && Math.random() < dt * 2.5 * amount) runners.push({ x: rand(0, w), y: rand(-10, h * .6), r: rand(2.4, 4.2) * scale, v: 0, hold: rand(0, 1.5), seed: rand(0, 99) });
      for (let i = runners.length - 1; i >= 0; i--) {
        const r = runners[i], x0 = r.x, y0 = r.y;
        r.hold -= dt;
        if (r.hold > 0) continue;
        r.v = Math.min(r.v + dt * 260 * scale, (60 + 50 * noise1(r.y * .05, r.seed)) * scale);
        if (Math.random() < dt * .5) { r.hold = rand(.2, 1.4); r.v = 0; }
        r.y += r.v * dt; r.x += (noise1(r.y * .03, r.seed + 7) - .5) * r.v * dt * .5;
        bg.globalCompositeOperation = 'destination-out'; bg.strokeStyle = 'rgba(0,0,0,.9)'; bg.lineWidth = r.r * 2.4; bg.lineCap = 'round';
        bg.beginPath(); bg.moveTo(x0, y0); bg.lineTo(r.x, r.y); bg.stroke(); bg.globalCompositeOperation = 'source-over';
        bg.strokeStyle = 'rgba(200,215,235,.10)'; bg.lineWidth = r.r * .8; bg.beginPath(); bg.moveTo(x0, y0); bg.lineTo(r.x, r.y); bg.stroke();
        if (Math.random() < dt * 3) stamp(bg, r.x + rand(-1, 1), r.y - r.r * 2, r.r * .45, .8);
        if (r.y > h + 10) runners.splice(i, 1);
      }
    },
    draw(x, y) {
      ctx.drawImage(buf, x, y, w, h);
      for (const r of runners) { ctx.save(); ctx.translate(x + r.x, y + r.y); ctx.scale(1, 1.25); stamp(ctx, 0, 0, r.r, .95); ctx.restore(); }
    }
  };
}

/* Tram at Night: a varnished wooden tram on the hills, straps swaying, the lit city sliding past the windows */
export function tramScene() {
  let inside, sky, far, mid, wins = [], straps = [], lamps = [], band = [0, 0], strip = 0;
  let pos = 0, lean = 0, bend = null, nextBend = 9, jolt = 0, k = 1;
  const SPEED = 46;
  // A facade's tiles: blue and white azulejos on a small repeating motif.
  function tiles(g) {
    const [c, t] = plain(14, 14);
    t.fillStyle = '#c8d4e4'; t.fillRect(0, 0, 14, 14);
    t.fillStyle = '#2c5294'; t.beginPath(); t.moveTo(7, 1); t.lineTo(13, 7); t.lineTo(7, 13); t.lineTo(1, 7); t.fill();
    t.fillStyle = '#c8d4e4'; t.beginPath(); t.arc(7, 7, 2.6, 0, TAU); t.fill();
    t.fillStyle = '#2c5294'; t.fillRect(0, 0, 2, 2); t.fillRect(12, 0, 2, 2); t.fillRect(0, 12, 2, 2); t.fillRect(12, 12, 2, 2);
    t.strokeStyle = 'rgba(40,50,70,.5)'; t.lineWidth = .6; t.strokeRect(0, 0, 14, 14);
    return g.createPattern(c, 'repeat');
  }
  const api = {
    init() {
      const s = Math.min(W, H); k = s / 800;
      const top = H * (W > H ? .2 : .22), bot = H * (W > H ? .66 : .6);
      const n = Math.max(1, Math.round(W / Math.max(300, H * .5)));
      const post = Math.max(16, s * .05), margin = W > H ? post * 1.2 : post * .7;
      const ww = (W - margin * 2 - post * (n - 1)) / n;
      wins = Array.from({ length: n }, (_, i) => ({ x: margin + i * (ww + post), y: top, w: ww, h: bot - top }));
      band = [top - H * .08, bot + H * .06];
      const bh = band[1] - band[0];
      strip = Math.max(1400, W * 1.6);
      // The night sky, warm over the city.
      let g; [sky, g] = soft(W, bh, .5);
      const gr = g.createLinearGradient(0, 0, 0, bh);
      gr.addColorStop(0, '#060a1c'); gr.addColorStop(.45, '#12193a'); gr.addColorStop(.8, '#3a2c44'); gr.addColorStop(1, '#4a3440');
      g.fillStyle = gr; g.fillRect(0, 0, W, bh);
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(230,235,255,${rand(.1, .6)})`; g.fillRect(rand(0, W), rand(0, bh * .4), 1, 1); }
      // Far: a hillside packed with houses, a few lit windows each.
      [far, g] = soft(strip, bh, .5);
      const hill = x => bh * (.42 + .1 * Math.sin(x / strip * TAU * 2 + 1) + .06 * Math.sin(x / strip * TAU * 5));
      g.fillStyle = '#0e1226'; g.beginPath(); g.moveTo(0, bh);
      for (let x = 0; x <= strip; x += 10) g.lineTo(x, hill(x)); g.lineTo(strip, bh); g.fill();
      for (let i = 0; i < strip / 7; i++) {
        const x = rand(0, strip), y = hill(x) + rand(0, bh * .35), w = rand(10, 26) * k, h = rand(8, 18) * k;
        g.fillStyle = rgb(mix([16, 20, 40], [34, 30, 48], Math.random())); g.fillRect(x, y - h, w, h);
        g.fillStyle = 'rgba(20,16,30,.8)'; g.beginPath(); g.moveTo(x - 2, y - h); g.lineTo(x + w / 2, y - h - h * .35); g.lineTo(x + w + 2, y - h); g.fill();
        if (Math.random() < .55) { g.fillStyle = rgb(Math.random() < .8 ? [255, 196, 120] : [190, 210, 255], rand(.5, .95)); g.fillRect(x + rand(2, w - 4), y - h * rand(.3, .8), 2.2 * k + 1, 2.4 * k + 1); }
      }
      // Middle: the street's facades, pastel by day and dim by night, some tiled, some windows lit.
      [mid, g] = soft(strip, bh, .75);
      const pat = tiles(g), street = bh * .9;
      for (let x = 0; x < strip;) {
        let w = rand(150, 320) * Math.max(.7, k); if (strip - x - w < 120) w = strip - x;
        const h = bh * rand(.38, .78), y = street - h;
        const col = [[30, 28, 46], [34, 32, 40], [22, 30, 48], [38, 28, 38], [26, 34, 42]][Math.floor(rand(0, 5))];
        const fg = g.createLinearGradient(0, y, 0, street);
        fg.addColorStop(0, rgb(col.map(v => v * .5))); fg.addColorStop(1, rgb(col.map(v => v * 1.1)));
        g.fillStyle = fg; g.fillRect(x, y, w, h);
        if (Math.random() < .35) { g.save(); g.globalAlpha = .28; g.fillStyle = pat; g.fillRect(x, y + h * .12, w, h * .88); g.restore(); g.fillStyle = 'rgba(14,20,44,.35)'; g.fillRect(x, y, w, h); }
        g.fillStyle = 'rgba(8,8,14,.9)'; g.fillRect(x - 2, y - 6, w + 4, 7);                      // cornice
        g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, y, 3, h);
        const cols = Math.max(2, Math.round(w / 64)), rows = Math.max(2, Math.round(h / 70));
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const wx = x + (c + .5) * w / cols - 11, wy = y + h * .1 + r * (h * .78 / rows), wh = h * .78 / rows * .62;
          const lit = Math.random() < .22;
          if (lit) { const lc = Math.random() < .75 ? [255, 190, 110] : [255, 225, 170]; glow(g, wx + 11, wy + wh / 2, 34, lc, .18); g.fillStyle = rgb(lc, .85); }
          else g.fillStyle = 'rgba(10,12,22,.85)';
          g.fillRect(wx, wy, 22, wh);
          if (lit && Math.random() < .5) { g.fillStyle = 'rgba(120,60,40,.45)'; g.fillRect(wx, wy, 8, wh); }   // a half-drawn curtain
          if (r > 0 && Math.random() < .45) { g.fillStyle = 'rgba(6,6,10,.9)'; g.fillRect(wx - 5, wy + wh, 32, 3); for (let b = 0; b < 6; b++) g.fillRect(wx - 4 + b * 6, wy + wh - 9, 1.4, 9); }
        }
        x += w;
      }
      const pv = g.createLinearGradient(0, street, 0, bh);
      pv.addColorStop(0, '#2a2226'); pv.addColorStop(1, '#141018');
      g.fillStyle = pv; g.fillRect(0, street, strip, bh - street);
      lamps = Array.from({ length: Math.ceil(strip / 340) }, (_, i) => ({ x: i * 340 + rand(-40, 40) }));
      // The car: varnished panels, posts between the windows, a ribbed ceiling, the brass rail, the sill.
      [inside, g] = layer(W, H);
      const teak = [84, 42, 20], dark = [50, 24, 12];
      wood(g, 0, 0, W, H, dark, { sheen: .1 });
      const ceil = g.createLinearGradient(0, 0, 0, top);
      ceil.addColorStop(0, '#1c0d07'); ceil.addColorStop(1, '#4a2412');
      g.fillStyle = ceil; g.fillRect(0, 0, W, top);
      for (let x = -W; x < 2 * W; x += 36 * Math.max(.6, k)) { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2 + (x - W / 2) * .3, 0); g.lineTo(x, top - H * .04); g.stroke(); }
      wood(g, 0, top - H * .045, W, H * .045, teak, { sheen: .3 });
      wood(g, 0, bot, W, H - bot, teak, { sheen: .25 });
      const panelW = Math.max(110, W / Math.max(2, n * 2));
      for (let x = margin * .5; x < W - 40; x += panelW) { const py = bot + H * .07; wood(g, x + 8, py, panelW - 16, H - py - H * .06, dark, { sheen: .25 }); bevel(g, x + 8, py, panelW - 16, H - py - H * .06, 2); }
      for (const w of wins) {
        g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.roundRect(w.x - 4, w.y - 4, w.w + 8, w.h + 8, 14 * k + 4); g.fill();
      }
      for (let i = 0; i <= n; i++) {
        const x = i === 0 ? 0 : i === n ? wins[n - 1].x + wins[n - 1].w : wins[i - 1].x + wins[i - 1].w;
        const w = i === 0 ? wins[0].x : i === n ? W - x : wins[i].x - x;
        if (w > 1) { wood(g, x, top - H * .01, w, bot - top + H * .02, teak, { vertical: true, sheen: .35 }); bevel(g, x + 3, top, w - 6, bot - top, 1.5, .25, .3); }
      }
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
      for (const w of wins) { g.beginPath(); g.roundRect(w.x, w.y, w.w, w.h, 14 * k + 4); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      for (const w of wins) {
        g.strokeStyle = '#3a1b0c'; g.lineWidth = 9 * Math.max(.7, k); g.beginPath(); g.roundRect(w.x, w.y, w.w, w.h, 14 * k + 4); g.stroke();
        g.strokeStyle = 'rgba(255,200,140,.28)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(w.x - 4, w.y - 4, w.w + 8, w.h + 8, 14 * k + 8); g.stroke();
        const ty = w.y + w.h * .24;                                        // the sash bar under the top light
        wood(g, w.x, ty - 5 * k - 2, w.w, 10 * k + 4, teak, { sheen: .4 });
      }
      wood(g, 0, bot - 2, W, H * .025, [120, 64, 30], { sheen: .45 });
      g.fillStyle = 'rgba(255,214,160,.35)'; g.fillRect(0, bot - 2, W, 1.5);
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, bot + H * .025 - 2, W, 4);
      const ry = H * .1, rr = Math.max(3, 5 * k);                          // the brass rail
      const rg = g.createLinearGradient(0, ry - rr, 0, ry + rr);
      rg.addColorStop(0, '#5a4120'); rg.addColorStop(.35, '#f2d48a'); rg.addColorStop(.6, '#b08a40'); rg.addColorStop(1, '#3a2810');
      g.fillStyle = rg; g.fillRect(0, ry - rr, W, rr * 2);
      for (let x = W * .08; x < W; x += W * .42) { g.fillStyle = '#7a5a28'; g.fillRect(x - 3, 0, 6, ry); }
      // Ceiling lamps and the warm light they throw on the varnish.
      g.globalCompositeOperation = 'lighter';
      for (let x = W / (n * 2); x < W; x += W / n) { glow(g, x, H * .04, s * .5, [255, 170, 90], .14); glow(g, x, H * .04, s * .06, [255, 230, 180], .7); }
      glow(g, W / 2, H, W * .8, [255, 150, 70], .1);
      g.globalCompositeOperation = 'source-over';
      const vg = g.createRadialGradient(W / 2, H * .45, s * .3, W / 2, H * .5, Math.max(W, H) * .8);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.7)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      const ns = Math.max(3, Math.round(W / (150 * Math.max(.7, k))));
      straps = Array.from({ length: ns }, (_, i) => ({ x: (i + .5) * W / ns + rand(-10, 10), a: 0, v: 0, f: rand(1.6, 2.2), len: H * rand(.075, .095) }));
    },
    draw(t, dt) {
      const sp = SPEED * k * (lively ? 1.6 : 1);
      // Bends come every half minute or so: the car leans, the straps swing out, the bell's little jolt sets them going.
      nextBend -= dt;
      if (!bend && nextBend <= 0) { bend = { p: 0, dur: rand(6, 9), dir: Math.random() < .5 ? -1 : 1 }; jolt = bend.dir * rand(.6, 1); }
      let target = 0;
      if (bend) { bend.p += dt / bend.dur; target = bend.dir * .02 * Math.sin(Math.PI * clamp(bend.p)) ** 2; if (bend.p >= 1) { bend = null; nextBend = rand(20, 45); } }
      const prev = lean; lean += (target - lean) * Math.min(1, dt * 1.5);
      const acc = (lean - prev) / Math.max(dt, .001);
      pos += sp * (1 - Math.abs(lean) * 12) * dt;
      const rattle = Math.sin(t * 9.1) * .25 + Math.sin(t * 13.7) * .15 + (noise1(t * 2, 3) - .5) * .8;
      // Outside, clipped to the windows, tilted against the car's lean.
      ctx.save(); ctx.beginPath(); for (const w of wins) ctx.roundRect(w.x, w.y, w.w, w.h, 14 * k + 4); ctx.clip();
      ctx.translate(W / 2, H * .9); ctx.rotate(-lean); ctx.translate(-W / 2, -H * .9 + rattle * .5);
      const bh = band[1] - band[0], ex = 40;
      ctx.drawImage(sky, -ex, band[0], W + ex * 2, bh);
      const tile = (c, off) => { for (let x = -(off % strip) - ex; x < W + ex; x += strip) ctx.drawImage(c, x, band[0], strip, bh); };
      tile(far, pos * .12); tile(mid, pos * .55);
      // Street lamps passing close, their light pooling on the pavement.
      ctx.globalCompositeOperation = 'lighter';
      const lx0 = pos % strip;
      for (const l of lamps) for (const rep of [0, strip]) {
        const x = l.x + rep - lx0 * 1.0; if (x < -200 || x > W + 200) continue;
        const ly = band[0] + bh * .42;
        glow(ctx, x, ly, 90 * Math.max(.6, k), [255, 190, 110], .22);
        glow(ctx, x, band[1] - bh * .06, 160 * Math.max(.6, k), [255, 170, 90], .1);
        glow(ctx, x, ly, 14 * Math.max(.6, k), [255, 236, 200], .9);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const l of lamps) for (const rep of [0, strip]) {
        const x = l.x + rep - lx0; if (x < -200 || x > W + 200) continue;
        const ly = band[0] + bh * .42, pw = 5 * Math.max(.7, k);
        ctx.fillStyle = '#07060a'; ctx.fillRect(x - pw / 2, ly + 8, pw, band[1] - ly);
        ctx.fillRect(x - pw * 1.6, ly - 10 * k, pw * 3.2, 4);
      }
      ctx.restore();
      // The glass: a cool cast and the car's own lamps reflected faintly.
      ctx.save(); ctx.beginPath(); for (const w of wins) ctx.roundRect(w.x, w.y, w.w, w.h, 14 * k + 4); ctx.clip();
      ctx.fillStyle = 'rgba(30,60,120,.12)'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const w of wins) { glow(ctx, w.x + w.w * .7, w.y + w.h * .18, w.w * .35, [255, 190, 130], .06); ctx.fillStyle = 'rgba(255,200,150,.03)'; ctx.fillRect(w.x, w.y + w.h * .55, w.w, w.h * .45); }
      ctx.restore();
      ctx.drawImage(inside, 0, 0, W, H);
      // Straps: pendulums hung from the rail, pushed by the lean and the rattle.
      const ry = H * .1, sw = Math.max(5, 9 * k);
      for (const s of straps) {
        const want = -lean * 9 + rattle * .012;
        s.v += ((want - s.a) * s.f * s.f - s.v * .55 - acc * 5 + jolt * .8) * dt; s.a += s.v * dt;
        ctx.save(); ctx.translate(s.x, ry); ctx.rotate(s.a);
        const lg = ctx.createLinearGradient(-sw / 2, 0, sw / 2, 0);
        lg.addColorStop(0, '#1c0c06'); lg.addColorStop(.4, '#5a2a14'); lg.addColorStop(1, '#170804');
        ctx.fillStyle = lg; ctx.fillRect(-sw / 2, -3, sw, s.len);
        ctx.fillStyle = 'rgba(255,200,150,.12)'; ctx.fillRect(-sw / 2 + 1, -3, 1.2, s.len);
        ctx.fillStyle = '#8a6a30'; ctx.fillRect(-sw / 2 - 1, -4, sw + 2, 6);
        const hr = sw * 1.9;                                                  // the leather loop and its grip
        ctx.strokeStyle = '#3a180a'; ctx.lineWidth = sw * .75; ctx.beginPath(); ctx.ellipse(0, s.len + hr, hr * .9, hr, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,190,130,.22)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, s.len + hr, hr * .9 - sw * .3, hr - sw * .3, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
        ctx.fillStyle = '#d8c8a8'; ctx.beginPath(); ctx.roundRect(-hr * .8, s.len + hr * 1.75, hr * 1.6, sw * .9, sw * .45); ctx.fill();
        ctx.restore();
      }
      jolt *= Math.exp(-dt * 6);
    }
  };
  return api;
}

/* Library Window: a tall arched window in an old reading room, rain on the glass, a green lamp on the desk */
export function libraryScene() {
  let room, outside, win, rain, built = 0, lampAt, pool = 0, drift = [];
  const api = {
    init() {
      const d = daylight(); built = d;
      const s = Math.min(W, H), k = s / 800;
      const ww = Math.min(W * .74, H * .47), wx = (W - ww) / 2, wy = H * .06, wb = H * .69, ar = ww / 2;
      win = { x: wx, y: wy, w: ww, h: wb - wy, spring: wy + ar, ar, k };
      const path = (g, inset = 0) => { g.beginPath(); g.moveTo(wx + inset, wb); g.lineTo(wx + inset, wy + ar); g.arc(wx + ww / 2, wy + ar, ar - inset, Math.PI, 0); g.lineTo(wx + ww - inset, wb); g.closePath(); };
      win.path = path;
      // Beyond the glass: a wet evening of roofs, spires and bare trees, softened by rain.
      let g; [outside, g] = soft(ww, wb - wy, .5);
      const oh = wb - wy;
      const sk = g.createLinearGradient(0, 0, 0, oh);
      sk.addColorStop(0, rgb(skyMix([14, 20, 34], [64, 66, 88], [118, 128, 140], d))); sk.addColorStop(.7, rgb(skyMix([30, 36, 52], [120, 100, 110], [160, 166, 170], d)));
      sk.addColorStop(1, rgb(skyMix([20, 24, 34], [60, 56, 66], [110, 116, 120], d)));
      g.fillStyle = sk; g.fillRect(0, 0, ww, oh);
      const fogc = skyMix([40, 48, 66], [120, 110, 120], [170, 176, 180], d);
      for (let L = 0; L < 3; L++) {
        const base = oh * (.55 + L * .1), col = mix(skyMix([22, 28, 42], [74, 70, 86], [120, 126, 132], d), skyMix([8, 10, 16], [30, 28, 36], [60, 64, 66], d), L / 2);
        g.fillStyle = rgb(col);
        for (let x = -10; x < ww + 10;) {
          const bw = rand(14, 40) * (1 + L * .4), bh = rand(.04, .14) * oh * (1 + L * .3);
          g.fillRect(x, base - bh, bw + 1, oh);
          if (Math.random() < .15) { g.beginPath(); g.moveTo(x + bw * .3, base - bh); g.lineTo(x + bw * .5, base - bh - oh * rand(.08, .18)); g.lineTo(x + bw * .7, base - bh); g.fill(); }
          if (Math.random() < .4) { for (let j = 0; j < 3; j++) { g.fillStyle = rgb([255, 200, 130], rand(.3, .8) * (1 - d * .7)); g.fillRect(x + rand(2, bw - 4), base - bh + rand(3, bh * .8), 2.5, 3); } g.fillStyle = rgb(col); }
          x += bw;
        }
        g.fillStyle = rgb(fogc, .14 + .1 * d); g.fillRect(0, 0, ww, oh);
      }
      g.strokeStyle = rgb(skyMix([6, 8, 12], [24, 22, 28], [50, 52, 52], d), .9);   // bare trees close by
      for (const tx of [ww * .12, ww * .8]) {
        const branch = (x, y, a, len, w) => { if (len < 4) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); branch(x2, y2, a + rand(-.5, -.15), len * .72, w * .7); branch(x2, y2, a + rand(.15, .5), len * .7, w * .7); };
        branch(tx, oh, -Math.PI / 2 + rand(-.1, .1), oh * .22, 7);
      }
      for (let i = 0; i < 5; i++) glow(g, rand(0, ww), oh * rand(.55, .85), rand(20, 50), [255, 190, 120], .25 * (1 - d * .6));
      g.fillStyle = `rgba(4,8,18,${.4 * (1 - d)})`; g.fillRect(0, 0, ww, oh);
      for (let i = 0; i < 4; i++) glow(g, rand(0, ww), oh * rand(.6, .8), rand(10, 24), [255, 200, 130], .5 * (1 - d * .8));
      rain = rainPane(ww, oh, Math.max(.7, k));
      drift = Array.from({ length: 40 }, () => ({ x: rand(0, ww), y: rand(0, oh), l: rand(10, 24) }));
      // The room: dark panelling, the deep reveal round the window, shelves, the desk, the books and the lamp.
      [room, g] = layer(W, H);
      wood(g, 0, 0, W, H, [42, 28, 20], { vertical: true, sheen: .1, grain: .5 });
      const pl = g.createLinearGradient(0, 0, 0, H); pl.addColorStop(0, 'rgba(10,14,12,.6)'); pl.addColorStop(1, 'rgba(10,8,6,.2)');
      g.fillStyle = pl; g.fillRect(0, 0, W, H);
      const side = wx - s * .07;
      if (side > 80) for (const sx of [s * .03, W - side + s * .04]) {
        const shw = side - s * .07;
        g.fillStyle = '#140c08'; g.fillRect(sx, 0, shw, H * .8);
        const shelfH = Math.max(70, H * .13);
        for (let y = H * .02; y + shelfH < H * .8; y += shelfH) {
          for (let x = sx + 4; x < sx + shw - 6;) {
            const bw = rand(9, 20) * Math.max(.8, k), bh = shelfH * rand(.6, .88);
            if (x + bw > sx + shw - 4) break;
            const c = [[90, 26, 22], [28, 52, 38], [30, 36, 64], [120, 86, 40], [70, 46, 30], [60, 22, 40], [40, 40, 36]][Math.floor(rand(0, 7))];
            const bg = g.createLinearGradient(x, 0, x + bw, 0); bg.addColorStop(0, rgb(c.map(v => v * .6))); bg.addColorStop(.4, rgb(c)); bg.addColorStop(1, rgb(c.map(v => v * .5)));
            g.fillStyle = bg; g.fillRect(x, y + shelfH - bh - 6, bw, bh);
            g.fillStyle = 'rgba(210,170,90,.45)'; g.fillRect(x + 1, y + shelfH - bh + 4, bw - 2, 1.5); g.fillRect(x + 1, y + shelfH - 16, bw - 2, 1.5);
            x += bw + (Math.random() < .1 ? rand(4, 14) : .5);
          }
          wood(g, sx - 4, y + shelfH - 6, shw + 8, 8, [70, 44, 26], { sheen: .3 });
        }
        const sv = g.createLinearGradient(sx, 0, sx + shw, 0);
        const toWin = sx < W / 2;
        sv.addColorStop(0, `rgba(0,0,0,${toWin ? .65 : .2})`); sv.addColorStop(1, `rgba(0,0,0,${toWin ? .2 : .65})`);
        g.fillStyle = sv; g.fillRect(sx, 0, shw, H * .8);
      }
      // The reveal: the wall's thickness, catching the grey light from the window.
      const rv = s * .05;
      g.save(); path(g, -rv); g.fillStyle = rgb(skyMix([34, 34, 40], [70, 66, 62], [92, 86, 78], d)); g.fill();
      const rvg = g.createLinearGradient(wx - rv, 0, wx + ww + rv, 0);
      rvg.addColorStop(0, 'rgba(20,18,16,.6)'); rvg.addColorStop(.5, `rgba(160,170,180,${.1 * d})`); rvg.addColorStop(1, 'rgba(20,18,16,.75)');
      g.fillStyle = rvg; g.fill(); g.restore();
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; path(g, 0); g.fill(); g.globalCompositeOperation = 'source-over';
      // Glazing bars and the fanlight.
      const bar = Math.max(3, 6 * k), frame = Math.max(6, 12 * k);
      g.strokeStyle = '#1c140e'; g.lineWidth = frame; path(g, frame / 2); g.stroke();
      g.lineWidth = bar;
      const cols = 3, rows = Math.max(3, Math.round((wb - win.spring) / (ww / cols) * .9));
      g.beginPath();
      for (let c = 1; c < cols; c++) { const x = wx + ww * c / cols; g.moveTo(x, wy + ar - Math.sqrt(Math.max(0, ar * ar - (x - wx - ar) ** 2))); g.lineTo(x, wb); }
      for (let r = 0; r <= rows; r++) { const y = win.spring + (wb - win.spring) * r / rows; g.moveTo(wx, y); g.lineTo(wx + ww, y); }
      for (let i = 1; i < 6; i++) { const a = Math.PI + Math.PI * i / 6; g.moveTo(wx + ar + Math.cos(a) * ar * .25, win.spring + Math.sin(a) * ar * .25); g.lineTo(wx + ar + Math.cos(a) * ar, win.spring + Math.sin(a) * ar); }
      g.moveTo(wx + ar + ar * .25, win.spring); g.arc(wx + ar, win.spring, ar * .25, 0, Math.PI, true);
      g.stroke();
      g.strokeStyle = 'rgba(200,210,220,.12)'; g.lineWidth = 1; g.stroke();
      // The sill and the desk in front of it.
      const sillY = wb, deskY = H * .76, front = H * .86;
      wood(g, wx - rv - s * .03, sillY, ww + rv * 2 + s * .06, s * .025, [80, 72, 64], { sheen: .3 });
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(wx - rv - s * .03, sillY + s * .025, ww + rv * 2 + s * .06, s * .01);
      g.fillStyle = '#1a100a';
      g.beginPath(); g.moveTo(0, deskY); g.lineTo(W, deskY); g.lineTo(W, front); g.lineTo(0, front); g.fill();
      wood(g, 0, deskY, W, front - deskY, [74, 38, 18], { sheen: .35 });
      const dg = g.createLinearGradient(0, deskY, 0, front); dg.addColorStop(0, 'rgba(0,0,0,.45)'); dg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = dg; g.fillRect(0, deskY, W, front - deskY);
      wood(g, 0, front, W, H - front, [40, 20, 10], { sheen: .3 });
      g.fillStyle = 'rgba(255,210,150,.25)'; g.fillRect(0, front, W, 1.5);
      // The window's light on the desk.
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = rgb(skyMix([40, 50, 70], [80, 80, 100], [120, 130, 140], d), .12);
      g.beginPath(); g.moveTo(wx, deskY); g.lineTo(wx + ww, deskY); g.lineTo(wx + ww * 1.2, front); g.lineTo(wx - ww * .2, front); g.fill();
      g.globalCompositeOperation = 'source-over';
      const lx = W > H ? W / 2 + ww * .32 : W * .7, ly = deskY + (front - deskY) * .55, L = Math.max(.75, k);
      lampAt = { x: lx, y: ly, L, deskY, front };
      // Books: a stack lying flat, two leaning upright.
      const bx = W > H ? W / 2 - ww * .45 : W * .14;
      let y = ly + 6 * L;
      for (let i = 0; i < 4; i++) {
        const bw = rand(110, 150) * L, bh = rand(14, 22) * L, c = [[96, 30, 26], [30, 56, 42], [44, 46, 70], [110, 80, 40]][i];
        const ox = rand(-10, 10) * L;
        g.fillStyle = rgb(c); g.fillRect(bx + ox, y - bh, bw, bh);
        g.fillStyle = 'rgba(232,220,196,.85)'; g.fillRect(bx + ox + bw - 4 * L, y - bh + 2, 4 * L, bh - 4);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(bx + ox, y - 2, bw, 2);
        g.fillStyle = 'rgba(220,180,90,.6)'; g.fillRect(bx + ox + 8 * L, y - bh + bh * .3, 2, bh * .4);
        y -= bh;
      }
      for (let i = 0; i < 2; i++) {
        g.save(); g.translate(bx + 150 * L + i * 22 * L, ly + 6 * L); g.rotate(i ? .12 : 0);
        const bh = rand(120, 150) * L, bw = 20 * L;
        g.fillStyle = i ? '#3a2a48' : '#5a2418'; g.fillRect(0, -bh, bw, bh);
        g.fillStyle = 'rgba(220,180,90,.6)'; g.fillRect(2, -bh + 12, bw - 4, 2); g.fillRect(2, -24, bw - 4, 2);
        g.restore();
      }
      // The banker's lamp: brass foot and stem, the long green shade.
      const sx0 = lx - 70 * L, sx1 = lx + 70 * L, shy = ly - 105 * L;
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(lx, ly + 4 * L, 56 * L, 9 * L, 0, 0, TAU); g.fill();
      const brass = (x0, x1) => { const b = g.createLinearGradient(x0, 0, x1, 0); b.addColorStop(0, '#4a3410'); b.addColorStop(.35, '#e8c674'); b.addColorStop(.6, '#a07a30'); b.addColorStop(1, '#3a2808'); return b; };
      g.fillStyle = brass(lx - 50 * L, lx + 50 * L); g.beginPath(); g.ellipse(lx, ly, 48 * L, 11 * L, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(lx, ly - 7 * L, 30 * L, 7 * L, 0, 0, TAU); g.fill();
      g.fillStyle = brass(lx - 4 * L, lx + 4 * L); g.fillRect(lx - 3.5 * L, shy + 10 * L, 7 * L, ly - shy - 14 * L);
      g.fillRect(lx - 30 * L, shy + 8 * L, 60 * L, 4 * L);
      const sg = g.createLinearGradient(0, shy - 26 * L, 0, shy + 12 * L);
      sg.addColorStop(0, '#0a3a20'); sg.addColorStop(.3, '#2f8a56'); sg.addColorStop(.5, '#14603a'); sg.addColorStop(1, '#06200f');
      g.fillStyle = sg; g.beginPath(); g.moveTo(sx0, shy + 10 * L); g.bezierCurveTo(sx0 + 6 * L, shy - 30 * L, sx1 - 6 * L, shy - 30 * L, sx1, shy + 10 * L); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(190,255,210,.35)'; g.lineWidth = 2 * L; g.beginPath(); g.moveTo(sx0 + 18 * L, shy - 8 * L); g.bezierCurveTo(lx - 30 * L, shy - 20 * L, lx + 20 * L, shy - 20 * L, sx1 - 24 * L, shy - 10 * L); g.stroke();
      g.fillStyle = brass(sx0, sx1); g.fillRect(sx0 - 2 * L, shy + 8 * L, sx1 - sx0 + 4 * L, 4 * L);
      g.fillStyle = '#c9a050'; g.beginPath(); g.arc(lx, shy - 18 * L, 4 * L, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(200,160,80,.8)'; g.lineWidth = 1; g.setLineDash([1.5, 1.5]);   // the pull chain
      g.beginPath(); g.moveTo(lx + 22 * L, shy + 12 * L); g.lineTo(lx + 22 * L, shy + 44 * L); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#d8b060'; g.beginPath(); g.arc(lx + 22 * L, shy + 46 * L, 2.5 * L, 0, TAU); g.fill();
      lampAt.shy = shy + 12 * L; lampAt.sw = (sx1 - sx0) / 2;
    },
    draw(t, dt) {
      if (stale(built)) api.init();
      const d = daylight(), { x: wx, y: wy, w: ww, h: oh } = win;
      ctx.save(); win.path(ctx, 0); ctx.clip();
      ctx.drawImage(outside, wx, wy, ww, oh);
      // Rain falling past outside, a faint slant.
      ctx.strokeStyle = rgb(skyMix([150, 165, 190], [190, 190, 200], [220, 225, 230], d), .08 + .1 * weather); ctx.lineWidth = 1; ctx.beginPath();
      for (const r of drift) { r.y += dt * 260; r.x -= dt * 40; if (r.y > oh) { r.y -= oh + 30; r.x = rand(0, ww + 60); } ctx.moveTo(wx + r.x, wy + r.y); ctx.lineTo(wx + r.x - r.l * .15, wy + r.y + r.l); }
      ctx.stroke();
      rain.tick(dt, .25 + .75 * weather);
      rain.draw(wx, wy);
      // The lamp reflected faintly in the lower panes.
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, lampAt.x - (lampAt.x - W / 2) * .2, wy + oh * .82, win.ar * .5, [255, 200, 130], .05 * (1 - d * .5));
      ctx.restore();
      ctx.drawImage(room, 0, 0, W, H);
      // The lamp: a warm pool on the desk that swells a little with the bass.
      pool += ((bands.bass || 0) - pool) * Math.min(1, dt * 2);
      const L = lampAt.L, amt = (.85 + .25 * pool) * (1 - d * .35);
      ctx.globalCompositeOperation = 'lighter';
      ctx.save(); ctx.translate(lampAt.x, lampAt.y - 2 * L); ctx.scale(1, .32);
      glow(ctx, 0, 0, 280 * L, [255, 170, 80], .3 * amt);
      glow(ctx, 0, 0, 120 * L, [255, 210, 140], .35 * amt);
      ctx.restore();
      glow(ctx, lampAt.x, lampAt.shy, 360 * L, [255, 160, 70], .12 * amt);
      ctx.fillStyle = `rgba(255,236,190,${.85 * amt})`; ctx.beginPath(); ctx.ellipse(lampAt.x, lampAt.shy, lampAt.sw * .92, 4 * L, 0, 0, TAU); ctx.fill();
      glow(ctx, lampAt.x, lampAt.shy - 6 * L, lampAt.sw * 1.1, [140, 255, 170], .06 * amt);
      ctx.globalCompositeOperation = 'source-over';
    }
  };
  return api;
}

/* Lighthouse Keeper's Room: inside the lantern, the great lens turning, its beam going out through the fog */
export function lamproomScene() {
  let back, front, fogs = [], geo;
  const PERIOD = 20;   // two flash panels, so a beam sweeps past every ten seconds
  const api = {
    init() {
      const s = Math.min(W, H), k = s / 800, cx = W / 2;
      const yT = H * .13, yB = H * .58, hz = H * .44, floor = H * .7;
      const lh = Math.min(H * .5, W * .92), lw = lh * .62, cy = H * .42;
      geo = { s, k, cx, yT, yB, hz, floor, lh, R: lw / 2, cy };
      // Behind the glass: fog over a dark sea.
      let g; [back, g] = layer(W, H);
      const sk = g.createLinearGradient(0, yT, 0, yB);
      sk.addColorStop(0, '#070c18'); sk.addColorStop(.6, '#1c2434'); sk.addColorStop(.68, '#141a28'); sk.addColorStop(1, '#05080e');
      g.fillStyle = sk; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(140,160,190,.08)'; g.lineWidth = 1;
      for (let i = 0; i < 40; i++) { const y = hz + (yB - hz) * (i / 40) ** 1.6; g.beginPath(); for (let x = 0; x <= W; x += 30) g.lineTo(x, y + Math.sin(x * .02 + i) * 1.2); g.stroke(); }
      // The lantern's far wall: iron mullions spaced round the curve, diagonal astragals, the dome above.
      [front, g] = layer(W, H);
      const iron = '#0d0f14', Rw = W * .62 + s * .2;
      g.fillStyle = '#0a0b10'; g.fillRect(0, 0, W, yT); g.fillRect(0, yB, W, H - yB);
      for (let i = -12; i <= 12; i++) { g.strokeStyle = 'rgba(120,90,50,.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, -H * .2); g.lineTo(cx + Rw * Math.sin(i * Math.PI / 12) * 1.3, yT); g.stroke(); }
      const dome = g.createLinearGradient(0, 0, 0, yT); dome.addColorStop(0, 'rgba(0,0,0,.6)'); dome.addColorStop(1, 'rgba(60,40,24,.4)');
      g.fillStyle = dome; g.fillRect(0, 0, W, yT);
      const xs = [];
      for (let i = -10; i <= 10; i++) { const a = i * Math.PI / 10; if (Math.abs(a) < Math.PI / 2 + .01) xs.push(cx + Rw * Math.sin(a)); }
      g.strokeStyle = iron; g.lineWidth = Math.max(1.5, 2.5 * k);
      g.lineWidth = Math.max(1, 1.4 * k); for (let i = 0; i + 1 < xs.length; i++) { g.beginPath(); g.moveTo(xs[i], yT); g.lineTo(xs[i + 1], (yT + yB) / 2); g.moveTo(xs[i], (yT + yB) / 2); g.lineTo(xs[i + 1], yB); g.stroke(); }
      for (const x of xs) {
        const mw = Math.max(5, 12 * k) * (.5 + .5 * Math.cos(Math.asin(clamp((x - cx) / Rw, -1, 1))));
        g.fillStyle = iron; g.fillRect(x - mw / 2, yT, mw, yB - yT);
        g.fillStyle = 'rgba(220,170,90,.18)'; g.fillRect(x - mw / 2, yT, 1.2, yB - yT);
      }
      for (const y of [yT, (yT + yB) / 2, yB]) { g.fillStyle = iron; g.fillRect(0, y - 5 * k - 2, W, 10 * k + 4); g.fillStyle = 'rgba(220,170,90,.2)'; g.fillRect(0, y - 5 * k - 2, W, 1.2); }
      // The parapet and the floor.
      const pg = g.createLinearGradient(0, yB, 0, floor);
      pg.addColorStop(0, '#2a1a16'); pg.addColorStop(1, '#120c0c');
      g.fillStyle = pg; g.fillRect(0, yB + 5 * k, W, floor - yB);
      const fl = g.createLinearGradient(0, floor, 0, H);
      fl.addColorStop(0, '#16161a'); fl.addColorStop(1, '#060608');
      g.fillStyle = fl; g.fillRect(0, floor, W, H - floor);
      g.strokeStyle = 'rgba(255,255,255,.03)';
      for (let i = -30; i <= 30; i++) { g.beginPath(); g.moveTo(cx + i * 10, floor); g.lineTo(cx + i * 60, H); g.stroke(); }
      // The lamp's warm light on the lower walls and floor.
      g.globalCompositeOperation = 'lighter';
      glow(g, cx, cy + lh * .1, Math.max(W, H) * .7, [255, 170, 90], .1);
      g.globalCompositeOperation = 'source-over';
      fogs = Array.from({ length: lowPower ? 5 : 9 }, () => ({ x: rand(-.2, 1.2), y: rand(.35, .55), r: rand(.25, .5), v: rand(.004, .012), a: rand(.05, .12) }));
    },
    draw(t) {
      const { s, k, cx, yT, yB, hz, floor, lh, R, cy } = geo;
      const fog = .35 + .65 * weather, rot = t / PERIOD * TAU * (lively ? 1.5 : 1);
      ctx.drawImage(back, 0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.rect(0, yT, W, yB - yT); ctx.clip();
      for (const f of fogs) { f.x += f.v / 60; if (f.x > 1.4) f.x = -.4; glow(ctx, f.x * W, f.y * H, f.r * W, [130, 145, 170], f.a * fog); }
      // The beams. a = 0 faces us; sideways they lie long across the fog, away they make a halo behind the lens.
      ctx.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 2; b++) {
        const a = rot + b * Math.PI, sx = Math.sin(a), cz = Math.cos(a);
        if (cz < .1) {
          // Soft-edged: a wide faint fan, a narrower brighter one inside it, then a core.
          const len = W * .9 * Math.abs(sx) + R, ex = cx + Math.sign(sx) * len, ey = cy + (hz - cy) * .3;
          const al = (.07 + .16 * fog) * smooth((.1 - cz) * 3);
          const spread = .1 + .3 * Math.max(0, -cz);
          for (const wk of [1, .8, .63, .48, .35, .24, .15, .08]) {
            const ak = .4;
            const gr = ctx.createLinearGradient(cx, cy, ex, ey);
            gr.addColorStop(0, `rgba(255,236,190,${al * ak})`); gr.addColorStop(.5, `rgba(255,236,190,${al * ak * .5})`); gr.addColorStop(1, 'rgba(255,236,190,0)');
            const w0 = R * .3 * wk, w1 = (R * .4 + len * spread) * wk;
            ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(cx, cy - w0); ctx.lineTo(ex, ey - w1); ctx.lineTo(ex, ey + w1); ctx.lineTo(cx, cy + w0); ctx.fill();
          }
          glow(ctx, cx + sx * len * .45, hz + (yB - hz) * .15, len * .45, [255, 230, 180], .06 * fog * Math.abs(sx));
        }
        if (cz < 0) glow(ctx, cx, cy, s * .8, [255, 232, 190], .25 * fog * (-cz) ** 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      ctx.drawImage(front, 0, 0, W, H);
      // Pedestal.
      const top = cy - lh / 2, bot = cy + lh / 2, rad = y => R * (1 - .22 * ((y - cy) / (lh / 2)) ** 2);
      const pw = R * .8, pg = ctx.createLinearGradient(cx - pw, 0, cx + pw, 0);
      pg.addColorStop(0, '#120e0a'); pg.addColorStop(.4, '#3a2c1c'); pg.addColorStop(1, '#0c0806');
      ctx.fillStyle = pg; ctx.fillRect(cx - pw, bot, pw * 2, floor + H * .04 - bot);
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(cx, floor + H * .04, pw * 1.3, pw * .2, 0, 0, TAU); ctx.fill();
      // The lens: a glowing core, the glass barrel, prism rings, two bullseye panels turning.
      const lit = Math.max(0, Math.cos(rot)) ** 6 + Math.max(0, Math.cos(rot + Math.PI)) ** 6;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, cx, cy, R * 1.6, [255, 200, 120], .25 + .3 * lit);
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath(); for (let y = top; y <= bot; y += 6) ctx.lineTo(cx - rad(y), y); for (let y = bot; y >= top; y -= 6) ctx.lineTo(cx + rad(y), y); ctx.closePath();
      const gl = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
      gl.addColorStop(0, 'rgba(120,150,180,.35)'); gl.addColorStop(.2, 'rgba(255,220,160,.18)'); gl.addColorStop(.5, 'rgba(255,214,150,.28)'); gl.addColorStop(.8, 'rgba(255,220,160,.14)'); gl.addColorStop(1, 'rgba(120,150,180,.38)');
      ctx.fillStyle = gl; ctx.fill();
      ctx.save(); ctx.clip();
      // Prism rings above and below the belt: glass bands whose glints travel round as the lens turns.
      const ringN = 13, bandH = lh * .3 / ringN;
      for (const half of [-1, 1]) for (let j = 0; j < ringN; j++) {
        const y = cy + half * (lh * .2 + bandH * (j + .5)), r = rad(y), ry = R * .08 * (j + 1) / ringN;
        const rg = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
        for (let i = 0; i <= 12; i++) {
          const u = i / 12, ph = Math.asin(u * 2 - 1) + rot, gl2 = Math.max(0, Math.sin(ph * 3 + j * .9)) ** 4;
          const edge = Math.abs(u * 2 - 1) ** 3;
          rg.addColorStop(u, `rgba(255,${210 + 40 * gl2},${150 + 80 * gl2},${.1 + .55 * gl2 + .2 * edge})`);
        }
        ctx.strokeStyle = rg; ctx.lineWidth = bandH * .62;
        ctx.beginPath(); ctx.ellipse(cx, y, r, ry, 0, half < 0 ? 0 : Math.PI, half < 0 ? Math.PI : TAU, half > 0); ctx.stroke();
        ctx.strokeStyle = 'rgba(40,26,10,.5)'; ctx.lineWidth = Math.max(.8, bandH * .12);
        ctx.beginPath(); ctx.ellipse(cx, y + half * bandH * .42, r, ry, 0, half < 0 ? 0 : Math.PI, half < 0 ? Math.PI : TAU, half > 0); ctx.stroke();
      }
      // The central belt: two bullseye panels, rings foreshortened as they turn.
      for (let b = 0; b < 2; b++) {
        const a = rot + b * Math.PI, cz = Math.cos(a);
        if (cz <= 0) continue;
        const px = cx + R * Math.sin(a), rb = lh * .19;
        for (let r = 1; r <= 7; r++) {
          const rr = rb * r / 7, hl = .5 + .5 * Math.sin(r * 1.7 - a * 5);
          ctx.strokeStyle = `rgba(255,240,205,${(.12 + .45 * hl ** 2) * (.3 + .7 * cz)})`; ctx.lineWidth = Math.max(1, 2 * k);
          ctx.beginPath(); ctx.ellipse(px, cy, rr * cz, rr, 0, 0, TAU); ctx.stroke();
          ctx.strokeStyle = `rgba(40,30,20,${.35 * cz})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(px, cy, rr * cz * .96, rr * .96, 0, 0, TAU); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, px, cy, rb * (.5 + cz), [255, 236, 190], .25 + .55 * cz ** 8);
        ctx.globalCompositeOperation = 'source-over';
      }
      // Brass frames between the panels, curving with the barrel.
      for (let p = 0; p < 4; p++) {
        const a = rot + Math.PI / 4 + p * Math.PI / 2, cz = Math.cos(a);
        if (cz <= 0) continue;
        ctx.strokeStyle = `rgba(${150 + 80 * cz},${110 + 60 * cz},50,.9)`; ctx.lineWidth = Math.max(2, 4 * k) * (.4 + .6 * cz);
        ctx.beginPath(); for (let y = top; y <= bot; y += 8) ctx.lineTo(cx + rad(y) * Math.sin(a), y); ctx.stroke();
      }
      ctx.restore();
      const brassBand = (y, h, rw) => {
        const bg = ctx.createLinearGradient(cx - rw, 0, cx + rw, 0);
        bg.addColorStop(0, '#3a2808'); bg.addColorStop(.3, '#e2c070'); bg.addColorStop(.55, '#8a6424'); bg.addColorStop(.8, '#c9a050'); bg.addColorStop(1, '#2a1a06');
        ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(cx, y, rw, h, 0, 0, TAU); ctx.fill();
      };
      brassBand(top, R * .12, rad(top) * 1.04); brassBand(cy - lh * .2, R * .05, rad(cy - lh * .2)); brassBand(cy + lh * .2, R * .05, rad(cy + lh * .2)); brassBand(bot, R * .12, rad(bot) * 1.04);
      ctx.fillStyle = '#2a1e10'; ctx.beginPath(); ctx.moveTo(cx - R * .5, top - R * .05); ctx.lineTo(cx, top - R * .45); ctx.lineTo(cx + R * .5, top - R * .05); ctx.fill();
      // The brass railing round the lens, in the foreground.
      const ry = H * .8, rx = W * .7, rh = H * .1, tube = Math.max(4, 9 * k);
      for (let i = -4; i <= 4; i++) {
        const a = Math.PI / 2 + i * .3, x = cx + rx * Math.cos(a), y = ry + rh * Math.sin(a);
        ctx.fillStyle = '#5a4018'; ctx.fillRect(x - tube * .35, y, tube * .7, H - y);
        ctx.fillStyle = 'rgba(255,220,150,.35)'; ctx.fillRect(x - tube * .2, y, 1.5, H - y);
      }
      for (const [dy, w] of [[0, tube], [H * .07, tube * .7]]) {
        ctx.lineWidth = w;
        ctx.strokeStyle = '#6a4a1a'; ctx.beginPath(); ctx.ellipse(cx, ry + dy, rx, rh, 0, .05, Math.PI - .05); ctx.stroke();
        ctx.lineWidth = w * .35; ctx.strokeStyle = 'rgba(255,224,150,.65)'; ctx.beginPath(); ctx.ellipse(cx, ry + dy - w * .25, rx, rh, 0, .05, Math.PI - .05); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, cx, ry + rh, s * .5, [255, 200, 120], .08 + .1 * lit);
      ctx.globalCompositeOperation = 'source-over';
    }
  };
  return api;
}

/* Ship's Porthole: a brass porthole on a riveted bulkhead, the sea beyond it rolling slowly with the ship */
export function portholeScene() {
  let wall, view, rim, built = 0, geo, beads = [], spray = 6, waves = [];
  const api = {
    init() {
      const d = daylight(); built = d;
      const R = Math.min(W * .47, H * .4), rg = R * .74, cx = W / 2, cy = H * .48, k = R / 360;
      geo = { R, rg, cx, cy, k };
      // The view, oversize so it can tilt: sky, sun or moon, and a sea fading to the horizon.
      const D = Math.ceil(rg * 3); let g;
      [view, g] = layer(D, D);
      const hz = D / 2;
      const sk = g.createLinearGradient(0, 0, 0, hz);
      sk.addColorStop(0, rgb(skyMix([4, 8, 22], [40, 44, 100], [70, 130, 210], d))); sk.addColorStop(.7, rgb(skyMix([12, 20, 44], [180, 110, 120], [150, 190, 230], d)));
      sk.addColorStop(1, rgb(skyMix([20, 30, 56], [250, 160, 110], [210, 225, 240], d)));
      g.fillStyle = sk; g.fillRect(0, 0, D, hz + 1);
      if (d < .5) { g.save(); g.globalAlpha = 1 - d * 2; for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(235,240,255,${rand(.2, .8)})`; g.beginPath(); g.arc(rand(0, D), rand(0, hz * .9), rand(.3, 1.1), 0, TAU); g.fill(); } g.restore(); }
      const bodyX = D * .66, bodyY = hz - D * (d > .3 ? .08 : .2);
      if (d > .3) { glow(g, bodyX, bodyY, D * .3, [255, 200, 140], .5 * (1 - Math.abs(d - .5))); glow(g, bodyX, bodyY, D * .03, [255, 240, 210], .9); }
      else { glow(g, bodyX, bodyY, D * .12, [190, 205, 240], .25); g.fillStyle = '#e8ecf4'; g.beginPath(); g.arc(bodyX, bodyY, D * .018, 0, TAU); g.fill(); }
      for (let i = 0; i < 14; i++) { const y = rand(hz * .3, hz * .9); g.fillStyle = rgb(skyMix([30, 36, 60], [255, 170, 140], [255, 255, 255], d), rand(.05, .14)); g.beginPath(); g.ellipse(rand(0, D), y, rand(60, 200) * k, rand(4, 12) * k, 0, 0, TAU); g.fill(); }
      const sea = g.createLinearGradient(0, hz, 0, D);
      sea.addColorStop(0, rgb(skyMix([14, 22, 40], [90, 70, 100], [70, 120, 160], d))); sea.addColorStop(.25, rgb(skyMix([6, 12, 26], [30, 34, 60], [26, 70, 110], d))); sea.addColorStop(1, rgb(skyMix([2, 5, 12], [12, 14, 30], [12, 40, 70], d)));
      g.fillStyle = sea; g.fillRect(0, hz, D, D - hz);
      g.globalCompositeOperation = 'lighter';
      const path = g.createLinearGradient(0, hz, 0, D * .8);
      const pc = d > .3 ? [255, 200, 140] : [170, 190, 230];
      path.addColorStop(0, rgb(pc, .1)); path.addColorStop(1, rgb(pc, 0));
      g.fillStyle = path;
      for (const wk of [1, .75, .5, .3, .15]) { g.beginPath(); g.moveTo(bodyX - 6 * wk, hz); g.lineTo(bodyX + 6 * wk, hz); g.lineTo(bodyX + D * .16 * wk, D * .8); g.lineTo(bodyX - D * .16 * wk, D * .8); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      waves = Array.from({ length: 60 }, (_, i) => ({ p: (i + .5) / 60, seed: rand(0, 99) }));
      geo.D = D; geo.sparkle = pc; geo.bodyX = bodyX - D / 2;
      // The bulkhead: painted steel plates with riveted seams, lit by a lamp out of view.
      [wall, g] = layer(W, H);
      const paint = skyMix([46, 52, 50], [70, 70, 64], [176, 172, 160], d);
      g.fillStyle = rgb(paint); g.fillRect(0, 0, W, H);
      const lg = g.createRadialGradient(W * .2, -H * .1, 0, W * .2, -H * .1, Math.max(W, H) * 1.2);
      lg.addColorStop(0, 'rgba(255,214,160,.22)'); lg.addColorStop(1, 'rgba(0,0,0,.45)');
      g.fillStyle = lg; g.fillRect(0, 0, W, H);
      const plate = Math.max(160, R * 1.1), rr = Math.max(2, 3.2 * k);
      const rivet = (x, y) => { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x + 1, y + 1.5, rr, 0, TAU); g.fill(); g.fillStyle = rgb(paint.map(v => v * 1.05)); g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,240,220,.3)'; g.beginPath(); g.arc(x - rr * .3, y - rr * .3, rr * .4, 0, TAU); g.fill(); };
      for (let y = (H / 2) % plate; y < H; y += plate) {
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, y, W, 2); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, y + 2, W, 1);
        for (let x = 10; x < W; x += 26 * Math.max(.7, k)) { rivet(x, y - 9 * k); rivet(x, y + 11 * k); }
      }
      for (let x = (W / 2 + R * 1.3) % plate; x < W; x += plate) {
        if (Math.abs(x - cx) < R * 1.15) continue;
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x, 0, 2, H);
        for (let y = 10; y < H; y += 26 * Math.max(.7, k)) rivet(x + 10 * k, y);
      }
      // The brass: a flange bolted to the plate, the hinged frame inside it, the glass's deep edge.
      [rim, g] = layer(W, H);
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(cx + R * .03, cy + R * .05, R * 1.02, 0, TAU); g.fill();
      const conic = (r0, r1, shift) => {
        if (!g.createConicGradient) { const lgr = g.createLinearGradient(cx - r1, cy - r1, cx + r1, cy + r1); lgr.addColorStop(0, '#f0cf7e'); lgr.addColorStop(1, '#5a3c12'); return lgr; }
        const c = g.createConicGradient(shift, cx, cy);
        const stops = ['#6a4a18', '#f2d488', '#b08a3c', '#5a3c12', '#c9a050', '#fff0b8', '#9a7430', '#4a3010', '#6a4a18'];
        stops.forEach((s, i) => c.addColorStop(i / (stops.length - 1), s)); return c;
      };
      g.fillStyle = conic(R * .86, R, -.6); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.arc(cx, cy, R * .84, 0, TAU, true); g.fill('evenodd');
      g.strokeStyle = 'rgba(40,24,6,.6)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R * .845, 0, TAU); g.stroke(); g.beginPath(); g.arc(cx, cy, R - 1, 0, TAU); g.stroke();
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU + .13, x = cx + Math.cos(a) * R * .925, y = cy + Math.sin(a) * R * .925, br = R * .03;
        g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(x + 1.5, y + 2, br, 0, TAU); g.fill();
        const bg = g.createRadialGradient(x - br * .4, y - br * .4, 0, x, y, br);
        bg.addColorStop(0, '#fff2c0'); bg.addColorStop(.5, '#c09440'); bg.addColorStop(1, '#4a3010');
        g.fillStyle = bg; g.beginPath(); g.arc(x, y, br, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(40,24,6,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - br * .6, y); g.lineTo(x + br * .6, y); g.stroke();
      }
      g.fillStyle = conic(rg, R * .82, 1.2); g.beginPath(); g.arc(cx, cy, R * .82, 0, TAU); g.arc(cx, cy, rg, 0, TAU, true); g.fill('evenodd');
      g.strokeStyle = 'rgba(255,240,190,.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R * .815, Math.PI * .9, Math.PI * 1.6); g.stroke();
      for (const a of [Math.PI * .25, Math.PI * .75, -Math.PI * .5]) {      // the dogs that clamp the frame shut
        const x = cx + Math.cos(a) * R * .83, y = cy + Math.sin(a) * R * .83;
        g.save(); g.translate(x, y); g.rotate(a);
        const dg = g.createLinearGradient(0, -R * .04, 0, R * .04); dg.addColorStop(0, '#f0d080'); dg.addColorStop(1, '#5a3c12');
        g.fillStyle = dg; g.beginPath(); g.roundRect(-R * .06, -R * .035, R * .16, R * .07, R * .02); g.fill();
        g.fillStyle = '#3a2808'; g.beginPath(); g.arc(R * .07, 0, R * .015, 0, TAU); g.fill();
        g.restore();
      }
      const hg = g.createLinearGradient(cx - R * 1.05, 0, cx - R * .9, 0); hg.addColorStop(0, '#5a3c12'); hg.addColorStop(.5, '#f2d488'); hg.addColorStop(1, '#6a4a18');
      g.fillStyle = hg; g.beginPath(); g.roundRect(cx - R * 1.06, cy - R * .12, R * .16, R * .24, R * .03); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, rg * .985, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over';
      // The glass: shadow round its edge and a soft reflection.
      const sh = g.createRadialGradient(cx, cy, rg * .7, cx, cy, rg);
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.5)');
      g.fillStyle = sh; g.beginPath(); g.arc(cx, cy, rg, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(cx, cy, rg, 0, TAU); g.clip();
      const rf = g.createLinearGradient(cx - rg, cy - rg, cx, cy);
      rf.addColorStop(0, 'rgba(255,255,255,.14)'); rf.addColorStop(.5, 'rgba(255,255,255,.03)'); rf.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rf; g.beginPath(); g.ellipse(cx - rg * .35, cy - rg * .35, rg * .8, rg * .4, -Math.PI / 4, 0, TAU); g.fill();
      g.restore();
      const wg = wall.getContext('2d'); wg.globalCompositeOperation = 'destination-out'; wg.fillStyle = '#000';
      wg.beginPath(); wg.arc(cx, cy, R * .98, 0, TAU); wg.fill(); wg.globalCompositeOperation = 'source-over';
    },
    draw(t, dt) {
      if (stale(built)) api.init();
      const { R, rg, cx, cy, k, D } = geo, d = daylight();
      const sea = .5 + weather;
      const roll = (Math.sin(t * TAU / 11) * .06 + Math.sin(t * TAU / 27 + 1) * .03) * sea * (lively ? 1.4 : 1);
      const heave = (Math.sin(t * TAU / 8.3) * .1 + Math.sin(t * TAU / 19) * .05) * rg * sea;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rg, 0, TAU); ctx.clip();
      ctx.translate(cx, cy + heave); ctx.rotate(roll);
      ctx.drawImage(view, -D / 2, -D / 2, D, D);
      // Heavy weather greys the sky and sea.
      if (weather > .4) { ctx.fillStyle = rgb(skyMix([10, 14, 22], [70, 66, 78], [120, 128, 136], d), .55 * (weather - .4)); ctx.fillRect(-D / 2, -D / 2, D, D); }
      // Swell: long strokes under the horizon, closer ones larger and slower to fade.
      ctx.lineCap = 'round';
      for (const w of waves) {
        const p = w.p, y = (D / 2) * p * p * .9 + 2;
        ctx.strokeStyle = rgb(skyMix([120, 140, 190], [255, 190, 160], [230, 245, 255], d), (.04 + .14 * p) * (.6 + .5 * weather));
        ctx.lineWidth = .5 + 2 * p * k;
        const span = rg * 1.4, n = 3 + Math.floor(p * 3);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = ((hash(i, w.seed) * 2 - 1) * span + t * (6 + 10 * p) * k + span * 3) % (span * 2) - span;
          const l = (20 + 60 * p) * k * (.5 + hash(i + 3, w.seed)), dy = Math.sin(t * .8 + i + w.seed) * 2 * p;
          ctx.moveTo(x, y + dy); ctx.quadraticCurveTo(x + l / 2, y + dy - 2 * p, x + l, y + dy);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) {
        const tw = Math.max(0, Math.sin(t * (1 + hash(i, 2)) + i * 3)) ** 8;
        if (tw < .02) continue;
        glow(ctx, geo.bodyX + (hash(i, 5) - .5) * rg * .6, 6 + hash(i, 9) * rg * .5, 4 + 6 * k, geo.sparkle, .5 * tw);
      }
      ctx.restore();
      // Spray and rain on the glass when the weather is up.
      spray -= dt;
      if (weather > .5 && spray <= 0) {
        const n = Math.round((lowPower ? 20 : 45) * weather), sx = cx + (Math.random() < .5 ? -1 : 1) * rg * .5;
        for (let i = 0; i < n; i++) beads.push({ x: sx + rand(-rg, rg) * .6, y: cy + rand(-rg, rg * .7), r: rand(1.5, 5) * k + 1, a: 0, life: rand(5, 14), v: 0 });
        spray = rand(5, 12) / weather;
      }
      if (Math.random() < dt * 30 * Math.max(0, weather - .35)) beads.push({ x: cx + rand(-rg, rg), y: cy + rand(-rg, rg), r: rand(1, 2.6) * k + .8, a: 0, life: rand(6, 16), v: 0 });
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rg, 0, TAU); ctx.clip();
      for (let i = beads.length - 1; i >= 0; i--) {
        const b = beads[i]; b.life -= dt; b.a = Math.min(1, b.a + dt * 4) * clamp(b.life / 2);
        if (b.r > 4 * k) { b.v = Math.min(b.v + dt * 20, 30 * k); b.y += b.v * dt; }
        stamp(ctx, b.x, b.y, b.r, b.a * .9);
        if (b.life <= 0 || b.y > cy + rg) beads.splice(i, 1);
      }
      if (beads.length > 300) beads.splice(0, beads.length - 300);
      ctx.restore();
      ctx.drawImage(wall, 0, 0, W, H);
      ctx.drawImage(rim, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, cx - R * .4, cy - R * .5, R * .5, [255, 220, 160], .06);
      ctx.globalCompositeOperation = 'source-over';
    }
  };
  return api;
}

/* Greenhouse at Night: inside a Victorian glasshouse after dark, palms against the blue, fireflies among the leaves */
export function greenhouseNightScene() {
  let sky, frame, wet, backP, leftP, rightP, flies = [], drips = [], hits = [], vp;
  // A palm frond: a curving rib with narrow leaflets drooping off both sides.
  function frond(g, x, y, ang, len, curl, col, rim) {
    const pts = [];
    for (let i = 0; i <= 30; i++) { const p = i / 30, a = ang + curl * p * p; pts.push([x, y, a, p]); x += Math.cos(a) * len / 30; y += Math.sin(a) * len / 30; }
    g.strokeStyle = col; g.lineWidth = Math.max(1.5, len * .012); g.beginPath(); for (const [px, py] of pts) g.lineTo(px, py); g.stroke();
    g.fillStyle = col;
    for (let i = 2; i < pts.length; i++) {
      const [px, py, a, p] = pts[i], l = len * .28 * Math.sin(Math.PI * Math.min(1, p * 1.15)) + 4;
      for (const side of [-1, 1]) {
        const la = a + side * (1.1 - .5 * p) + .35, ex = px + Math.cos(la) * l, ey = py + Math.sin(la) * l + l * .25;
        g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo((px + ex) / 2 - Math.sin(la) * l * .08, (py + ey) / 2 + Math.cos(la) * l * .08, ex, ey);
        g.quadraticCurveTo((px + ex) / 2 + Math.sin(la) * l * .04, (py + ey) / 2 - Math.cos(la) * l * .04, px, py); g.fill();
        if (rim && side < 0) { g.strokeStyle = rim; g.lineWidth = .8; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo((px + ex) / 2 - Math.sin(la) * l * .08, (py + ey) / 2 + Math.cos(la) * l * .08, ex, ey); g.stroke(); g.strokeStyle = col; }
      }
    }
  }
  // A broad leaf on a stalk: banana, elephant ear, philodendron.
  function broad(g, x, y, ang, len, wid, col, rim) {
    const sx = x + Math.cos(ang) * len * .5, sy = y + Math.sin(ang) * len * .5;
    g.strokeStyle = col; g.lineWidth = Math.max(2, len * .025); g.beginPath(); g.moveTo(x, y); g.lineTo(sx, sy); g.stroke();
    g.save(); g.translate(sx, sy); g.rotate(ang + .3);
    g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * .2, -wid, len * .8, -wid * .8, len, 0); g.bezierCurveTo(len * .8, wid * .8, len * .2, wid, 0, 0); g.fill();
    if (rim) { g.strokeStyle = rim; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * .2, -wid, len * .8, -wid * .8, len, 0); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(len, 0); g.stroke();
    g.restore();
  }
  const api = {
    init() {
      const s = Math.min(W, H), k = s / 800;
      vp = { x: W / 2, y: H * .44, k, Ra: Math.max(W * .55, H * .45) };
      let g; [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#060b22'); gr.addColorStop(.45, '#0e1a44'); gr.addColorStop(.75, '#1a2a5a'); gr.addColorStop(1, '#0a1230');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      stars(g, Math.round(W * H / 6000), H * .5);
      glow(g, W * .22, H * .12, s * .4, [140, 160, 220], .18); glow(g, W * .22, H * .12, s * .03, [220, 230, 255], .6);
      glow(g, W * .5, H * .6, W * .6, [60, 80, 140], .25);
      // The ironwork: arched ribs receding toward the far end, purlins running its length, the end wall's glazing.
      [frame, g] = layer(W, H);
      const P = (X, Y, z) => [vp.x + X / z, vp.y + Y / z], Ra = vp.Ra, wallH = Ra * .9;
      const zs = []; for (let z = .55; z < 5; z *= 1.32) zs.push(z);
      const zf = zs[zs.length - 1];
      g.lineCap = 'round';
      for (const z of zs) {
        g.strokeStyle = 'rgba(6,10,20,.95)'; g.lineWidth = Math.max(1.2, 13 * k / z);
        g.beginPath();
        let [x, y] = P(-Ra, wallH, z); g.moveTo(x, y);
        for (let i = 0; i <= 40; i++) { const a = Math.PI - Math.PI * i / 40; [x, y] = P(Ra * Math.cos(a), -Ra * Math.sin(a), z); g.lineTo(x, y); }
        [x, y] = P(Ra, wallH, z); g.lineTo(x, y); g.stroke();
        g.strokeStyle = 'rgba(120,150,210,.12)'; g.lineWidth = Math.max(.6, 2 * k / z); g.stroke();
      }
      for (let j = -3; j <= 17; j++) {
        let X, Y;
        if (j < 0) { X = -Ra; Y = -j * wallH / 3; } else if (j > 14) { X = Ra; Y = (j - 14) * wallH / 3; } else { const a = Math.PI - Math.PI * j / 14; X = Ra * Math.cos(a); Y = -Ra * Math.sin(a); }
        const [x0, y0] = P(X, Y, .3), [x1, y1] = P(X, Y, zf);
        g.strokeStyle = 'rgba(6,10,20,.9)'; g.lineWidth = Math.max(1, 4 * k); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
      g.strokeStyle = 'rgba(6,10,20,.8)'; g.lineWidth = Math.max(1, 3 * k / zf);
      for (let i = -6; i <= 6; i++) { const [x, y0] = P(i / 6 * Ra, -Ra * Math.sqrt(Math.max(0, 1 - (i / 6) ** 2)), zf), [, y1] = P(0, wallH, zf); g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke(); }
      for (let i = 1; i < 4; i++) { const [x0, y] = P(-Ra, -Ra * i / 4 + wallH * .2, zf), [x1] = P(Ra, 0, zf); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
      // Water on the roof glass, stamped once; its strength follows the weather.
      [wet, g] = layer(W, H);
      for (let i = 0; i < W * H / (lowPower ? 900 : 450); i++) { const x = rand(0, W), y = rand(0, H * .62) ** 1 ; stamp(g, x, y, rand(.7, 2.2) * Math.max(.7, k), rand(.25, .7)); }
      // Plants: a far bank of foliage, then palms and big leaves reaching in from both sides.
      const deep = 'rgb(5,10,14)', rim = 'rgba(90,120,190,.35)';
      [backP, g] = layer(W, H);
      g.fillStyle = 'rgb(12,20,30)';
      for (let i = 0; i < W / 14; i++) { const r = s * rand(.03, .08); g.beginPath(); g.arc(rand(-20, W + 20), H * rand(.78, .86) + r * .5, r, 0, TAU); g.fill(); }
      for (let i = 0; i < 26; i++) frond(g, rand(0, W), H * rand(.74, .84), -Math.PI / 2 + rand(-1, 1), s * rand(.14, .28), rand(-1, 1) * .8, 'rgb(14,24,34)', null);
      for (let i = 0; i < 30; i++) broad(g, rand(0, W), H * rand(.8, .9), -Math.PI / 2 + rand(-1, 1), s * rand(.1, .18), s * rand(.025, .045), 'rgb(12,20,30)', null);
      g.fillStyle = 'rgb(10,16,24)'; g.fillRect(0, H * .8, W, H * .2);
      const haze = g.createLinearGradient(0, H * .55, 0, H); haze.addColorStop(0, 'rgba(40,60,110,0)'); haze.addColorStop(.4, 'rgba(40,60,110,.25)'); haze.addColorStop(1, 'rgba(10,16,30,.3)');
      g.fillStyle = haze; g.fillRect(0, 0, W, H);
      // The bed nearest us: ferns and leaves thick enough to hide the floor.
      for (let i = 0; i < W / 18; i++) frond(g, rand(-20, W + 20), H * rand(.86, 1.05), -Math.PI / 2 + rand(-1, 1), s * rand(.12, .26), rand(-1, 1), 'rgb(8,13,19)', 'rgba(70,95,150,.18)');
      for (let i = 0; i < W / 40; i++) broad(g, rand(0, W), H * rand(.9, 1.04), -Math.PI / 2 + rand(-1.1, 1.1), s * rand(.08, .16), s * rand(.025, .045), 'rgb(7,12,17)', 'rgba(70,95,150,.2)');
      const side = (left) => {
        const [c, h] = layer(W, H), sg = left ? 1 : -1, x0 = left ? 0 : W;
        h.fillStyle = deep;
        // A palm trunk rising from the corner with its crown leaning in.
        const tx = x0 + sg * W * .08, ty = H * .3;
        h.strokeStyle = deep; h.lineWidth = s * .035; h.beginPath(); h.moveTo(x0 + sg * W * .03, H); h.quadraticCurveTo(x0 + sg * W * .02, H * .6, tx, ty); h.stroke();
        for (let i = 0; i < 8; i++) frond(h, tx, ty, (left ? -Math.PI * .1 : -Math.PI * .9) + sg * rand(-.6, 1.2) - (left ? 0 : 0), s * rand(.35, .55), sg * rand(.5, 1.3), deep, rim);
        for (let i = 0; i < 5; i++) broad(h, x0 + sg * rand(0, W * .2), H * rand(.85, 1.02), left ? rand(-1.3, -.3) : rand(-2.8, -1.8), s * rand(.2, .32), s * rand(.06, .1), deep, rim);
        for (let i = 0; i < 4; i++) frond(h, x0 + sg * rand(W * .1, W * .35), H * 1.02, -Math.PI / 2 + sg * rand(0, .8), s * rand(.25, .4), sg * rand(.4, 1), deep, rim);
        return c;
      };
      leftP = side(true); rightP = side(false);
      const nf = lowPower ? 14 : 30;
      flies = Array.from({ length: nf }, () => ({ x: rand(.05, .95), y: rand(.45, .92), s1: rand(0, 99), s2: rand(0, 99), per: rand(3, 7), ph: rand(0, 1), sp: rand(.008, .02) }));
      drips = []; hits = [];
    },
    draw(t, dt) {
      const k = vp.k;
      ctx.drawImage(sky, 0, 0, W, H);
      ctx.drawImage(frame, 0, 0, W, H);
      ctx.globalAlpha = .25 + .75 * weather; ctx.drawImage(wet, 0, 0, W, H); ctx.globalAlpha = 1;
      // Drops running down the curve of the roof, and the little lights of rain landing on it.
      if (drips.length < (lowPower ? 8 : 18) * weather && Math.random() < dt * 3) { const a = -Math.PI / 2 + rand(-1.2, 1.2); drips.push({ a, r: rand(.35, 1.1) * vp.Ra, v: 0, size: rand(1.8, 3.2) * Math.max(.7, k) }); }
      for (let i = drips.length - 1; i >= 0; i--) {
        const dr = drips[i], dir = dr.a > -Math.PI / 2 ? 1 : -1;
        dr.v = Math.min(dr.v + dt * .08, .25); dr.a += dir * dr.v * dt * 80 / dr.r * k;
        const x = vp.x + Math.cos(dr.a) * dr.r, y = vp.y + Math.sin(dr.a) * dr.r;
        ctx.strokeStyle = 'rgba(170,190,230,.12)'; ctx.lineWidth = dr.size * .8; ctx.beginPath(); ctx.arc(vp.x, vp.y, dr.r, dr.a - dir * .12, dr.a, dir < 0); ctx.stroke();
        stamp(ctx, x, y, dr.size, .9);
        if (dr.a > -.25 || dr.a < -Math.PI + .25) drips.splice(i, 1);
      }
      if (Math.random() < dt * 25 * weather) hits.push({ x: rand(0, W), y: rand(0, H * .55), life: .25 });
      ctx.globalCompositeOperation = 'lighter';
      for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; h.life -= dt; ctx.fillStyle = `rgba(170,190,240,${h.life * 1.2})`; ctx.fillRect(h.x, h.y, 1.5, 1.5); if (h.life <= 0) hits.splice(i, 1); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(backP, Math.sin(t * .2) * 2, 0, W, H);
      // Fireflies: slow wandering, each glowing up for a breath or two and fading again.
      ctx.globalCompositeOperation = 'lighter';
      const sp = lively ? 1.8 : 1;
      for (const f of flies) {
        f.x += (noise1(t * .15 * sp, f.s1) - .5) * f.sp * dt * 3 * sp; f.y += (noise1(t * .15 * sp, f.s2) - .5) * f.sp * dt * 2 * sp;
        f.x = (f.x + 1.1) % 1.1; f.y = clamp(f.y, .35, .97);
        const c = ((t / f.per + f.ph) % 1), b = Math.sin(Math.PI * clamp(c / .45)) ** 2;
        if (b < .02) continue;
        const x = (f.x - .05) * W, y = f.y * H, r = (10 + 18 * b) * Math.max(.7, k);
        glow(ctx, x, y, r * 2.2, [150, 230, 90], .12 * b);
        glow(ctx, x, y, r * .35, [230, 255, 160], .8 * b);
      }
      ctx.globalCompositeOperation = 'source-over';
      const swayL = Math.sin(t * .31) * .006 + Math.sin(t * .13 + 1) * .004, swayR = Math.sin(t * .27 + 2) * .006 + Math.sin(t * .11) * .004;
      ctx.save(); ctx.translate(0, H); ctx.rotate(swayL); ctx.drawImage(leftP, 0, -H, W, H); ctx.restore();
      ctx.save(); ctx.translate(W, H); ctx.rotate(swayR); ctx.drawImage(rightP, -W, -H, W, H); ctx.restore();
    }
  };
  return api;
}

/* Snowed-in Cabin: a log cabin window at night, firelight on the frame, snow falling on the pines and banking up the glass */
export function cabinScene() {
  let outside, room, frost, drift, driftAt = -1, panes = [], flakes = [], acc = 0, geo;
  const FILL = 600;   // seconds for the drifts to climb the panes
  const api = {
    init() {
      const s = Math.min(W, H), k = s / 800;
      const fw = Math.min(W * .8, H * .85), fh = Math.min(H * .58, fw * 1.3), fx = (W - fw) / 2, fy = H * .1;
      const cols = fw > fh * 1.1 ? 3 : 2, rows = 2, bar = Math.max(8, 14 * k), edge = Math.max(14, 26 * k);
      const pw = (fw - edge * 2 - bar * (cols - 1)) / cols, ph = (fh - edge * 2 - bar * (rows - 1)) / rows;
      panes = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = fx + edge + c * (pw + bar), y = fy + edge + r * (ph + bar);
        panes.push({ x, y, w: pw, h: ph });
      }
      geo = { k, fx, fy, fw, fh, s };
      // Outside: a moonlit clearing, snow on the ground, pine woods in three rows.
      let g; [outside, g] = layer(W, H);
      const hz = fy + fh * .55;
      const sk = g.createLinearGradient(0, fy, 0, hz);
      sk.addColorStop(0, '#060a18'); sk.addColorStop(1, '#1c2640');
      g.fillStyle = sk; g.fillRect(0, 0, W, hz + 2);
      stars(g, Math.round(fw * fh / 9000), hz * .8);
      glow(g, fx + fw * .75, fy + fh * .15, s * .3, [170, 190, 230], .2);
      const sn = g.createLinearGradient(0, hz, 0, fy + fh);
      sn.addColorStop(0, '#5a6a88'); sn.addColorStop(1, '#8090ac');
      g.fillStyle = sn; g.fillRect(0, hz, W, H - hz);
      const pine = (x, base, h, col, snow) => {
        const w = h * .36;
        g.fillStyle = col; g.fillRect(x - h * .02, base - h * .15, h * .04, h * .15);
        for (let i = 0; i < 6; i++) {
          const ty = base - h * .1 - i * h * .15, tw = w * (1 - i * .14);
          g.fillStyle = col; g.beginPath(); g.moveTo(x - tw, ty); g.lineTo(x, ty - h * .3); g.lineTo(x + tw, ty); g.quadraticCurveTo(x, ty - h * .05, x - tw, ty); g.fill();
          g.fillStyle = snow; g.beginPath(); g.moveTo(x - tw * .9, ty - h * .015); g.quadraticCurveTo(x - tw * .4, ty - h * .07, x - tw * .1, ty - h * .1); g.lineTo(x - tw * .2, ty - h * .06); g.quadraticCurveTo(x - tw * .5, ty - h * .03, x - tw * .9, ty - h * .015); g.fill();
          g.beginPath(); g.moveTo(x + tw * .85, ty - h * .02); g.quadraticCurveTo(x + tw * .4, ty - h * .07, x + tw * .1, ty - h * .1); g.lineTo(x + tw * .2, ty - h * .06); g.fill();
        }
      };
      const rowsP = [[hz, fh * .16, '#1a2236', 'rgba(120,135,165,.6)', 34], [hz + fh * .05, fh * .3, '#0e1422', 'rgba(150,165,195,.7)', 16], [hz + fh * .16, fh * .55, '#070a12', 'rgba(170,185,215,.75)', 7]];
      for (const [base, h, col, snow, n] of rowsP) {
        const step = fw / n;
        for (let x = fx - step; x < fx + fw + step; x += step * rand(.6, 1.2)) pine(x + rand(-step * .3, step * .3), base + rand(-3, 3), h * rand(.75, 1.15), col, snow);
        g.fillStyle = 'rgba(80,95,130,.12)'; g.fillRect(0, 0, W, H);
      }
      [drift] = layer(W, H); driftAt = -1;
      // Frost feathering in from the corners of each pane.
      [frost, g] = layer(W, H);
      for (const p of panes) {
        g.save(); g.beginPath(); g.rect(p.x, p.y, p.w, p.h); g.clip();
        for (const [cx, cy] of [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]]) {
          const fr = Math.min(p.w, p.h) * .4;
          glow(g, cx, cy, fr, [220, 232, 250], .28);
          g.strokeStyle = 'rgba(225,238,255,.22)'; g.lineWidth = .8;
          for (let i = 0; i < 26; i++) {
            let x = cx, y = cy, a = Math.atan2(p.y + p.h / 2 - cy, p.x + p.w / 2 - cx) + rand(-.8, .8);
            const len = fr * rand(.3, 1);
            g.beginPath(); g.moveTo(x, y);
            for (let l = 0; l < len; l += 4) {
              a += rand(-.25, .25); x += Math.cos(a) * 4; y += Math.sin(a) * 4; g.lineTo(x, y);
              if (Math.random() < .35) { const b = a + (Math.random() < .5 ? .8 : -.8), bl = rand(2, 7) * (1 - l / len); g.moveTo(x, y); g.lineTo(x + Math.cos(b) * bl, y + Math.sin(b) * bl); g.moveTo(x, y); }
            }
            g.stroke();
          }
        }
        g.restore();
      }
      // The room: log walls, the frame and sill in honey pine.
      [room, g] = layer(W, H);
      const logH = Math.max(34, s * .085);
      for (let y = -logH * .3; y < H; y += logH) {
        const lg = g.createLinearGradient(0, y, 0, y + logH);
        lg.addColorStop(0, '#120803'); lg.addColorStop(.25, '#4c2a12'); lg.addColorStop(.5, '#5a3318'); lg.addColorStop(.85, '#28150a'); lg.addColorStop(1, '#0a0502');
        g.fillStyle = lg; g.fillRect(0, y, W, logH);
        for (let i = 0; i < 6; i++) { g.strokeStyle = `rgba(30,14,4,${rand(.15, .35)})`; g.lineWidth = rand(.5, 1.5); const yy = y + logH * rand(.2, .8); g.beginPath(); g.moveTo(0, yy); for (let x = 0; x <= W; x += 40) g.lineTo(x, yy + Math.sin(x * .01 + i) * 2); g.stroke(); }
        g.fillStyle = 'rgba(190,170,140,.18)'; g.fillRect(0, y + logH - 3, W, 2);   // chinking
        for (let i = 0; i < W / 700; i++) { const kx = rand(0, W), ky = y + logH * rand(.35, .65); g.fillStyle = 'rgba(20,10,3,.35)'; g.beginPath(); g.ellipse(kx, ky, logH * .14, logH * .05, 0, 0, TAU); g.fill(); }
      }
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(fx - edge * .5, fy - edge * .5, fw + edge, fh + edge);
      const pine2 = [120, 74, 36];
      wood(g, fx, fy, fw, edge, pine2, { sheen: .3 }); wood(g, fx, fy + fh - edge, fw, edge, pine2, { sheen: .3 });
      wood(g, fx, fy, edge, fh, pine2, { vertical: true, sheen: .3 }); wood(g, fx + fw - edge, fy, edge, fh, pine2, { vertical: true, sheen: .3 });
      for (let c = 1; c < cols; c++) wood(g, fx + edge + c * (pw + bar) - bar, fy + edge, bar, fh - edge * 2, pine2, { vertical: true, sheen: .4 });
      for (let r = 1; r < rows; r++) wood(g, fx + edge, fy + edge + r * (ph + bar) - bar, fw - edge * 2, bar, pine2, { sheen: .4 });
      for (const p of panes) bevel(g, p.x - 1, p.y - 1, p.w + 2, p.h + 2, 2, .15, .5);
      bevel(g, fx, fy, fw, fh, 2, .3, .5);
      const sillY = fy + fh, sillH = Math.max(14, 24 * k), over = s * .05;
      wood(g, fx - over, sillY, fw + over * 2, sillH, [170, 110, 58], { sheen: .45 });
      g.fillStyle = 'rgba(255,220,170,.35)'; g.fillRect(fx - over, sillY, fw + over * 2, 1.5);
      wood(g, fx - over * .6, sillY + sillH, fw + over * 1.2, sillH * .8, [110, 66, 30], { sheen: .3 });
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(fx - over * .6, sillY + sillH * 1.8, fw + over * 1.2, sillH * .5);
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
      for (const p of panes) g.fillRect(p.x, p.y, p.w, p.h);
      g.globalCompositeOperation = 'source-over';
      const nf = lowPower ? 90 : 220;
      if (flakes.length !== nf) flakes = Array.from({ length: nf }, () => ({ x: rand(0, 1), y: rand(0, 1), z: rand(.25, 1), ph: rand(0, TAU) }));
    },
    draw(t, dt) {
      const { k, fx, fy, fw, fh, s } = geo;
      acc += dt;
      ctx.drawImage(outside, 0, 0, W, H);
      ctx.save(); ctx.beginPath(); for (const p of panes) ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
      // Snow falling, nearer flakes larger, quicker and drifting more; drawn in three depth batches.
      ctx.fillStyle = 'rgb(230,238,255)';
      const fall = (.6 + .6 * weather) * (lively ? 1.5 : 1);
      for (let b = 0; b < 3; b++) {
        ctx.globalAlpha = .4 + .25 * b; ctx.beginPath();
        for (let i = b; i < flakes.length; i += 3) {
          const f = flakes[i];
          f.y += dt * (.02 + .05 * f.z) * fall; f.x += dt * (Math.sin(t * .4 + f.ph) * .01 + .004) * f.z;
          if (f.y > 1) { f.y -= 1; f.x = rand(0, 1); } if (f.x > 1) f.x -= 1;
          const r = (.6 + 2.2 * f.z * f.z) * Math.max(.7, k), x = fx + f.x * fw, y = fy + f.y * fh;
          ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // The drift against the glass: one soft bank rising from the bottom of the window, higher at the sides.
      // It grows by a pixel every few seconds, so it is redrawn into its own buffer only when it has moved.
      const x0 = panes[0].x, x1 = panes[panes.length - 1].x + panes[panes.length - 1].w, yb = panes[panes.length - 1].y + panes[panes.length - 1].h;
      const span = yb - panes[0].y, base = span * (.03 + .23 * smooth(acc / FILL)), n = 48;
      const ht = u => { const edge = Math.max(0, 1 - Math.min(u, 1 - u) * 4) ** 2; return base * (.82 + .3 * noise1(u * 7, 3) + .1 * noise1(u * 23, 5) + .55 * edge); };
      if (Math.abs(base - driftAt) > .5) {
        driftAt = base;
        const g = drift.getContext('2d'); g.clearRect(0, 0, W, H);
        const top = yb - base * 1.6, sg = g.createLinearGradient(0, top, 0, yb);
        sg.addColorStop(0, 'rgba(236,242,252,.96)'); sg.addColorStop(.25, 'rgba(206,218,236,.97)'); sg.addColorStop(1, 'rgba(140,156,186,1)');
        g.fillStyle = sg; g.beginPath(); g.moveTo(x0, yb);
        for (let i = 0; i <= n; i++) { const u = i / n; g.lineTo(x0 + u * (x1 - x0), yb - ht(u)); }
        g.lineTo(x1, yb); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5; g.beginPath();
        for (let i = 0; i <= n; i++) { const u = i / n; g.lineTo(x0 + u * (x1 - x0), yb - ht(u) + 1); }
        g.stroke();
        g.strokeStyle = 'rgba(90,110,150,.16)'; g.lineWidth = 2;   // faint layers where each night's fall settled
        for (const f of [.45, .75]) { g.beginPath(); for (let i = 0; i <= n; i++) { const u = i / n; g.lineTo(x0 + u * (x1 - x0), yb - ht(u) * (1 - f) + Math.sin(u * 9 + f * 5) * 2); } g.stroke(); }
        g.globalAlpha = .5 + .4 * smooth(acc / FILL); g.drawImage(frost, 0, 0, W, H); g.globalAlpha = 1;
      }
      ctx.drawImage(drift, fx * DPR, fy * DPR, fw * DPR, fh * DPR, fx, fy, fw, fh);
      // Crystals sparkling faintly in the bank where it presses on the glass.
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < 40; i++) { const u = hash(i, 1), v = hash(i, 2); if (Math.sin(t * .7 + i * 3) < .7) continue; ctx.fillRect(x0 + u * (x1 - x0), yb - ht(u) * v * .9, 1.5, 1.5); }
      ctx.restore();
      ctx.drawImage(room, 0, 0, W, H);
      // Firelight from a hearth out of view, low on the left: a slow flicker, never a flash.
      const fl = .78 + .12 * Math.sin(t * 2.3) + .08 * Math.sin(t * 5.1 + 1) + .14 * (noise1(t * 3, 4) - .5) + .1 * (noise1(t * .7, 8) - .5);
      ctx.globalCompositeOperation = 'lighter';
      const hx = -W * .05, hy = H * 1.05, rad = Math.max(W, H) * 1.05;
      const fg = ctx.createRadialGradient(hx, hy, 0, hx, hy, rad);
      fg.addColorStop(0, `rgba(255,140,50,${.42 * fl})`); fg.addColorStop(.45, `rgba(255,110,40,${.16 * fl})`); fg.addColorStop(1, 'rgba(255,100,30,0)');
      ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
      glow(ctx, fx, fy + fh, s * .45, [255, 130, 50], .14 * fl);
      ctx.globalCompositeOperation = 'source-over';
      const vg = ctx.createRadialGradient(W * .4, H * .5, s * .35, W / 2, H / 2, Math.max(W, H) * .85);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(8,4,2,${.78 - .14 * fl})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
  };
  return api;
}
