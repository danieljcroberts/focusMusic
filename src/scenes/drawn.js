// Scenes drawn entirely in code on the 2D canvas.
import { W, H, ctx } from '../view.js';
import { rand, hash, mix, rgb, layer, glow, stars } from '../util.js';
import { daylight, skyMix } from '../daylight.js';
import { bands } from '../music.js';

// Low Tide and Aurora follow the viewer's clock and rebuild their sky when the light has moved.
const stale = built => Math.abs(daylight() - built) > .04;

/* 2. Canopy */
export function canopyScene() {
  let sky, layers, shafts, motes;
  return {
    init() {
      let g; [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#f6e7b4'); gr.addColorStop(.45, '#b9cf92'); gr.addColorStop(1, '#4b6a42');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      glow(g, W * .78, H * .05, Math.max(W, H) * .5, [255, 246, 214], .85);
      const s = Math.min(W, H) / 800;
      const far = [204, 220, 166], near = [22, 36, 24];
      layers = [0, 1, 2, 3].map(i => {
        const p = i / 3, col = mix(far, near, Math.pow(p, .8));
        const [c, lg] = layer(W + 60, H);
        const groundY = H * (.72 + i * .06);
        lg.fillStyle = rgb(col); lg.fillRect(0, groundY, W + 60, H - groundY);
        const trunks = 5 + i * 2;
        for (let k = 0; k < trunks; k++) {
          const x = rand(0, W + 60), w = (5 + i * 9) * s * rand(.7, 1.3);
          lg.fillStyle = rgb(mix(col, [0, 0, 0], .08 * i));
          lg.beginPath(); lg.moveTo(x - w * .5, -10); lg.lineTo(x + w * .5, -10);
          lg.lineTo(x + w * .8, groundY + 4); lg.lineTo(x - w * .8, groundY + 4); lg.fill();
        }
        const blobs = 22 + i * 9;
        for (let k = 0; k < blobs; k++) {
          const r = (34 + i * 30) * s * rand(.6, 1.3);
          lg.fillStyle = rgb(mix(col, Math.random() < .5 ? [255, 255, 220] : [0, 0, 0], rand(0, .12)));
          lg.beginPath(); lg.arc(rand(-20, W + 80), rand(-r * .6, H * (.18 + i * .06)), r, 0, Math.PI * 2); lg.fill();
        }
        return { c, i };
      });
      shafts = Array.from({ length: 6 }, (_, k) => ({ x: W * (.35 + k * .13) + rand(-30, 30), w: rand(30, 110) * s, ph: rand(0, 6.28), sp: rand(.15, .35) }));
      motes = Array.from({ length: 90 }, () => ({ x: rand(0, W), y: rand(0, H), vx: rand(-7, 7), vy: rand(-5, 3), r: rand(.6, 2), ph: rand(0, 6.28) }));
    },
    draw(t, dt) {
      ctx.drawImage(sky, 0, 0, W, H);
      const drawLayer = L => {
        const off = Math.sin(t * .22 + L.i * 1.3) * (1.5 + L.i * 2.5) - 30;
        ctx.drawImage(L.c, off, 0, W + 60, H);
      };
      drawLayer(layers[0]); drawLayer(layers[1]);
      ctx.globalCompositeOperation = 'lighter';
      const lean = H * .38;
      for (const sh of shafts) {
        const a = .07 + .06 * Math.sin(t * sh.sp + sh.ph);
        const gr = ctx.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, `rgba(255,240,190,${a})`); gr.addColorStop(.85, 'rgba(255,240,190,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(sh.x, -10); ctx.lineTo(sh.x + sh.w, -10);
        ctx.lineTo(sh.x + sh.w * 2.4 - lean, H); ctx.lineTo(sh.x - lean, H); ctx.fill();
      }
      for (let k = 0; k < 9; k++) {
        const x = W * (.1 + .09 * k) + Math.sin(t * .4 + k) * 8, y = H * (.86 + .03 * Math.sin(k * 3.1));
        ctx.fillStyle = `rgba(255,236,170,${.05 + .04 * Math.sin(t * .9 + k * 2)})`;
        ctx.beginPath(); ctx.ellipse(x, y, 50 + 30 * hash(k, 1), 8 + 4 * hash(k, 2), 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      drawLayer(layers[2]);
      ctx.globalCompositeOperation = 'lighter';
      for (const m of motes) {
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.x < -5) m.x = W + 5; if (m.x > W + 5) m.x = -5; if (m.y < -5) m.y = H + 5; if (m.y > H + 5) m.y = -5;
        const tw = Math.pow(Math.sin(t * 1.3 + m.ph), 2);
        ctx.fillStyle = `rgba(255,246,204,${.15 + .6 * tw})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      drawLayer(layers[3]);
    }
  };
}

/* 3. Night Drive */
export function driveScene() {
  let sky, skyline;
  const speed = 13, ch = 1.4;
  return {
    init() {
      const hy = H * .56;
      let g; [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, hy);
      gr.addColorStop(0, '#06051a'); gr.addColorStop(.6, '#1c0f3c'); gr.addColorStop(1, '#6a2458');
      g.fillStyle = gr; g.fillRect(0, 0, W, hy);
      g.fillStyle = '#07050e'; g.fillRect(0, hy, W, H - hy);
      stars(g, Math.round(W * hy / 2500), hy * .8);
      glow(g, W / 2, hy, Math.max(W, H) * .55, [255, 84, 140], .32);
      [skyline, g] = layer(W, H);
      let x = 0;
      while (x < W) {
        const bw = rand(14, 46), bh = rand(H * .015, H * .11) * (1 - .5 * Math.abs(x - W / 2) / W * 0);
        g.fillStyle = '#120a22'; g.fillRect(x, hy - bh, bw, bh);
        for (let wy = hy - bh + 4; wy < hy - 3; wy += 5) for (let wx = x + 3; wx < x + bw - 3; wx += 5)
          if (Math.random() < .22) { g.fillStyle = Math.random() < .7 ? 'rgba(255,196,120,.7)' : 'rgba(120,230,255,.7)'; g.fillRect(wx, wy, 1.6, 1.6); }
        x += bw + rand(0, 6);
      }
    },
    draw(t) {
      const f = H * .9, hy = H * .56, cx = W / 2;
      const P = (X, Y, z) => [cx + X * f / z, hy + (ch - Y) * f / z];
      ctx.drawImage(sky, 0, 0, W, H);
      ctx.drawImage(skyline, 0, 0, W, H);
      const a = P(-3, 0, 80), b = P(3, 0, 80), c = P(3, 0, .6), d = P(-3, 0, .6);
      const rg = ctx.createLinearGradient(0, hy, 0, H);
      rg.addColorStop(0, '#1a1030'); rg.addColorStop(1, '#0c0916');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.fill();
      ctx.strokeStyle = 'rgba(200,170,255,.35)'; ctx.lineWidth = 1.5;
      for (const X of [-2.85, 2.85]) { ctx.beginPath(); ctx.moveTo(...P(X, 0, 80)); ctx.lineTo(...P(X, 0, .6)); ctx.stroke(); }
      const travel = t * speed;
      ctx.fillStyle = 'rgba(255,236,200,.55)';
      for (let k = 0; k < 16; k++) {
        const z0 = k * 6 - (travel % 6) + .8, z1 = z0 + 2.2;
        if (z0 < .6) continue;
        const p1 = P(-.07, 0, z0), p2 = P(.07, 0, z0), p3 = P(.07, 0, z1), p4 = P(-.07, 0, z1);
        ctx.beginPath(); ctx.moveTo(...p1); ctx.lineTo(...p2); ctx.lineTo(...p3); ctx.lineTo(...p4); ctx.fill();
      }
      const carZ = 11 + Math.sin(t * .21) * 2.5, carX = .9 + Math.sin(t * .13) * .5;
      const lamps = [];
      for (let k = 0; k < 9; k++) { const z = k * 11 - (travel % 11) + 1.2; if (z > .7) lamps.push(z); }
      lamps.sort((p, q) => q - p);
      const drawLamp = z => {
        for (const side of [-1, 1]) {
          const top = P(side * 4.2, 5.2, z), base = P(side * 4.2, 0, z), arm = P(side * 3.4, 5.2, z);
          ctx.strokeStyle = 'rgba(10,6,20,.9)'; ctx.lineWidth = Math.max(1, .12 * f / z);
          ctx.beginPath(); ctx.moveTo(...base); ctx.lineTo(...top); ctx.lineTo(...arm); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          const fade = Math.min(1, (60 - z) / 30);
          glow(ctx, arm[0], arm[1], Math.min(160, .9 * f / z), [255, 186, 104], .55 * fade);
          const pool = P(side * 2.4, 0, z);
          ctx.save(); ctx.translate(pool[0], pool[1]); ctx.scale(1, .28);
          glow(ctx, 0, 0, Math.min(420, 2.2 * f / z), [255, 160, 90], .16 * fade);
          ctx.restore();
          ctx.globalCompositeOperation = 'source-over';
        }
      };
      lamps.filter(z => z > carZ).forEach(drawLamp);
      const body1 = P(carX - .85, 1.1, carZ), body2 = P(carX + .85, 0, carZ);
      ctx.fillStyle = '#0b0714'; ctx.fillRect(body1[0], body1[1], body2[0] - body1[0], body2[1] - body1[1]);
      ctx.globalCompositeOperation = 'lighter';
      for (const s of [-.62, .62]) {
        const l = P(carX + s, .72, carZ);
        glow(ctx, l[0], l[1], .5 * f / carZ, [255, 40, 70], .7);
        glow(ctx, l[0], l[1], .12 * f / carZ, [255, 190, 190], .9);
      }
      ctx.globalCompositeOperation = 'source-over';
      lamps.filter(z => z <= carZ).forEach(drawLamp);
    }
  };
}

/* 4. Hearth */
export function hearthScene() {
  let room, streaks, embers, geo;
  return {
    init() {
      let g; [room, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#0e0605'); gr.addColorStop(.7, '#22100a'); gr.addColorStop(1, '#170a06');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const ww = Math.min(W * .3, 280), wh = ww * 1.35, wx = W * .07, wy = H * .1;
      const fw = Math.min(W * .62, 460), fh = fw * .62, fx = W * .58 - fw / 2, base = H * .88;
      geo = { ww, wh, wx, wy, fw, fh, fx, base };
      if (W < 600) { geo.fx = W / 2 - fw / 2; }
      g.fillStyle = '#3a2016'; g.fillRect(geo.fx - fw * .14, base - fh * 1.32, fw * 1.28, fh * 1.32 + 6);
      g.fillStyle = '#4a2a1c'; g.fillRect(geo.fx - fw * .2, base - fh * 1.38, fw * 1.4, fh * .1);
      g.fillStyle = '#050202';
      g.beginPath(); g.moveTo(geo.fx, base); g.lineTo(geo.fx, base - fh * .7);
      g.quadraticCurveTo(geo.fx + fw / 2, base - fh * 1.15, geo.fx + fw, base - fh * .7); g.lineTo(geo.fx + fw, base); g.fill();
      const fl = g.createLinearGradient(0, base, 0, H);
      fl.addColorStop(0, '#2c160e'); fl.addColorStop(1, '#120805');
      g.fillStyle = fl; g.fillRect(0, base, W, H - base);
      streaks = Array.from({ length: 70 }, () => ({ x: rand(0, 1), y: rand(0, 1), l: rand(8, 26), v: rand(.6, 1.1) }));
      embers = Array.from({ length: 40 }, () => ({ life: rand(0, 1) }));
    },
    draw(t, dt) {
      const { ww, wh, wx, wy, fw, fh, fx, base } = geo;
      ctx.drawImage(room, 0, 0, W, H);
      const wg = ctx.createLinearGradient(0, wy, 0, wy + wh);
      wg.addColorStop(0, '#1a2532'); wg.addColorStop(1, '#2c3846');
      ctx.fillStyle = wg; ctx.fillRect(wx, wy, ww, wh);
      ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
      ctx.strokeStyle = 'rgba(190,210,230,.35)'; ctx.lineWidth = 1;
      for (const s of streaks) {
        s.y += s.v * dt * 1.4; if (s.y > 1.1) { s.y = -.1; s.x = rand(0, 1); }
        const x = wx + s.x * ww, y = wy + s.y * wh;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + s.l); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = '#1a0c07'; ctx.lineWidth = 8; ctx.strokeRect(wx, wy, ww, wh);
      ctx.lineWidth = 5; ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh * .48); ctx.lineTo(wx + ww, wy + wh * .48); ctx.stroke();
      const flick = .5 + .25 * Math.sin(t * 7.3) + .15 * Math.sin(t * 13.1 + 1) + .1 * Math.sin(t * 2.1);
      const cx = fx + fw / 2, fyc = base - fh * .2;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, cx, fyc, Math.max(W, H) * .75, [255, 110, 40], .13 + .05 * flick);
      ctx.fillStyle = `rgba(255,140,60,${.05 + .03 * flick})`; ctx.fillRect(wx, wy, ww, wh);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#1a0d08';
      ctx.beginPath(); ctx.roundRect(cx - fw * .3, base - fh * .1, fw * .6, fh * .09, 8); ctx.fill();
      ctx.beginPath(); ctx.roundRect(cx - fw * .22, base - fh * .17, fw * .44, fh * .08, 8); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const ph = i * 1.7, x = cx + (i - 4) * fw * .055 + Math.sin(t * .8 + ph) * 3;
        const w = fw * (.09 + .04 * hash(i, 3)), h = fh * (.38 + .22 * hash(i, 5)) * (.78 + .16 * Math.sin(t * 3.7 + ph) + .08 * Math.sin(t * 9.3 + ph * 2)) * (1 + bands.bass * .3);
        const b = base - fh * .12, sway = Math.sin(t * 2.3 + ph) * w * .4 + Math.sin(t * 5.3 + ph * 2) * w * .14;
        const fg = ctx.createLinearGradient(0, b, 0, b - h);
        fg.addColorStop(0, 'rgba(255,240,190,.85)'); fg.addColorStop(.3, 'rgba(255,165,60,.6)');
        fg.addColorStop(.7, 'rgba(215,70,20,.28)'); fg.addColorStop(1, 'rgba(150,30,10,0)');
        ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(x - w / 2, b);
        ctx.quadraticCurveTo(x - w * .6, b - h * .45, x + sway, b - h);
        ctx.quadraticCurveTo(x + w * .6, b - h * .45, x + w / 2, b); ctx.fill();
      }
      for (const e of embers) {
        e.life += dt * (.35 + .3 * bands.treble);
        if (e.life >= 1 || e.x === undefined) { e.life = e.x === undefined ? e.life % 1 : 0; e.x = cx + rand(-fw * .25, fw * .25); e.y0 = base - fh * .2; e.dx = rand(-20, 20); e.ph = rand(0, 6); }
        const y = e.y0 - e.life * fh * 1.1, x = e.x + e.dx * e.life + Math.sin(t * 2 + e.ph) * 6;
        ctx.fillStyle = `rgba(255,${150 + 60 * (1 - e.life)},70,${(1 - e.life) * .9})`;
        ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  };
}

/* 5. Low Tide */
export function tideScene() {
  let sky, clouds, built = 0;
  return {
    init() {
      const hy = H * .6, d = daylight(); built = d;
      let g; [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, hy);
      gr.addColorStop(0, rgb(skyMix([6, 8, 26], [42, 44, 82], [88, 148, 220], d)));
      gr.addColorStop(.55, rgb(skyMix([16, 20, 44], [122, 90, 140], [150, 198, 235], d)));
      gr.addColorStop(1, rgb(skyMix([34, 30, 56], [239, 166, 124], [222, 232, 240], d)));
      g.fillStyle = gr; g.fillRect(0, 0, W, hy + 1);
      if (d < .5) { g.globalAlpha = 1 - d * 2; stars(g, Math.round(W * hy / 3000), hy * .85); g.globalAlpha = 1; }
      const sg = g.createLinearGradient(0, hy, 0, H);
      sg.addColorStop(0, rgb(skyMix([24, 26, 52], [108, 82, 119], [70, 130, 170], d)));
      sg.addColorStop(.25, rgb(skyMix([14, 16, 36], [67, 58, 98], [44, 96, 136], d)));
      sg.addColorStop(1, rgb(skyMix([5, 6, 16], [23, 23, 45], [18, 40, 68], d)));
      g.fillStyle = sg; g.fillRect(0, hy, W, H - hy);
      // The sun sits on the horizon at dusk and dawn, climbs by day, and gives way to a moon at night.
      const sx = W * .62, sr = Math.min(W, H) * .045, lift = Math.max(0, d - .5) * 2 * H * .3;
      if (d > .05) {
        g.globalAlpha = Math.min(1, d * 3);
        glow(g, sx, hy - sr * .6 - lift, Math.max(W, H) * .45, [255, 190, 140], .45 * (1 - lift / (H * .3)) + .15);
        g.fillStyle = '#ffd9a8'; g.beginPath(); g.arc(sx, hy - sr * .6 - lift, sr, Math.PI, 0); g.lineTo(sx + sr, hy); g.lineTo(sx - sr, hy); g.fill();
        g.globalAlpha = 1;
      } else {
        glow(g, W * .3, hy - H * .3, Math.min(W, H) * .25, [200, 210, 255], .35);
        g.fillStyle = '#e6e9ff'; g.beginPath(); g.arc(W * .3, hy - H * .3, sr * .6, 0, Math.PI * 2); g.fill();
      }
      clouds = Array.from({ length: 8 }, (_, i) => {
        const cw = rand(240, 480) * Math.max(.6, W / 1400), chh = cw * .32;
        const [c, cg] = layer(cw, chh);
        const tint = Math.random() < .5 ? [255, 206, 214] : [214, 190, 236];
        for (let k = 0; k < 18; k++) {
          const px = rand(cw * .15, cw * .85), py = rand(chh * .35, chh * .7), pr = rand(chh * .2, chh * .45);
          const pg = cg.createRadialGradient(px, py, 0, px, py, pr);
          pg.addColorStop(0, rgb(tint, .32)); pg.addColorStop(1, rgb(tint, 0));
          cg.fillStyle = pg; cg.beginPath(); cg.arc(px, py, pr, 0, Math.PI * 2); cg.fill();
        }
        const y = rand(H * .05, hy * .75);
        return { c, w: cw, h: chh, x: rand(-cw, W), y, v: 3 + 9 * (y / hy) };
      });
    },
    draw(t, dt) {
    if (stale(built)) this.init();
    const hy = H * .6, sx = daylight() > .05 ? W * .62 : W * .3;
    ctx.drawImage(sky, 0, 0, W, H);
      for (const c of clouds) { c.x += c.v * dt; if (c.x > W + 10) c.x = -c.w; ctx.drawImage(c.c, c.x, c.y, c.w, c.h); }
      const rows = 46;
      ctx.lineCap = 'round';
      for (let k = 1; k <= rows; k++) {
        const p = k / rows, y = hy + (H - hy) * p * p;
        ctx.strokeStyle = `rgba(255,205,190,${.03 + .09 * p})`; ctx.lineWidth = .6 + p;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 24) {
          const yy = y + Math.sin(x * .012 / (p + .15) + t * (.4 + p * .6) + k) * 1.6 * p;
          x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
        }
        ctx.stroke();
        const m = 2 + Math.floor(k / 4);
        for (let i = 0; i < m; i++) {
          const a = .55 * Math.pow(.5 + .5 * Math.sin(t * 2.2 + k * 1.7 + i * 3.1), 2) * (1 - p * .4);
          const xx = sx + (hash(k, i) - .5) * (14 + 260 * p), len = 5 + 34 * p;
          ctx.strokeStyle = `rgba(255,214,164,${a})`; ctx.lineWidth = 1 + p * 1.6;
          ctx.beginPath(); ctx.moveTo(xx - len / 2, y); ctx.lineTo(xx + len / 2, y); ctx.stroke();
        }
      }
    }
  };
}

/* 6. Aurora */
export function auroraScene() {
  let sky, hills, strips, built = 0;
  const cols = [[110, 255, 170], [90, 215, 255], [190, 120, 255]];
  return {
    init() {
      const d = daylight(); built = d;
      let g; [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, rgb(skyMix([2, 5, 14], [30, 30, 70], [80, 140, 215], d)));
      gr.addColorStop(.6, rgb(skyMix([8, 26, 38], [120, 80, 110], [160, 200, 230], d)));
      gr.addColorStop(1, rgb(skyMix([15, 42, 51], [200, 130, 110], [200, 220, 225], d)));
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      if (d < .5) { g.globalAlpha = 1 - d * 2; stars(g, Math.round(W * H / 2200), H * .75); g.globalAlpha = 1; }
      strips = cols.map(c => {
        const s = document.createElement('canvas'); s.width = 1; s.height = 256;
        const sg = s.getContext('2d'), lg = sg.createLinearGradient(0, 0, 0, 256);
        lg.addColorStop(0, rgb(c, 0)); lg.addColorStop(.7, rgb(c, .35)); lg.addColorStop(.94, rgb(c, .9)); lg.addColorStop(1, rgb(c, 0));
        sg.fillStyle = lg; sg.fillRect(0, 0, 1, 256); return s;
      });
      [hills, g] = layer(W, H);
      const ridge = (baseY, amp, col, seed, trees) => {
        const pts = [];
        for (let x = 0; x <= W + 20; x += 20) pts.push([x, baseY - amp * (Math.sin(x * .004 + seed) * .6 + Math.sin(x * .011 + seed * 2) * .3 + hash(x, seed) * .1)]);
        g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
        for (const p of pts) g.lineTo(p[0], p[1]);
        g.lineTo(W, H); g.fill();
        g.strokeStyle = 'rgba(170,220,230,.14)'; g.lineWidth = 1.5; g.beginPath();
        pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
        if (trees) {
          g.fillStyle = col;
          for (let x = 0; x < W; x += rand(6, 22)) {
            const i = Math.min(pts.length - 1, Math.round(x / 20)), y = pts[i][1] + 4, h = rand(14, 34) * Math.max(.7, H / 900);
            g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + h * .22, y); g.lineTo(x - h * .22, y); g.fill();
          }
        }
      };
      ridge(H * .8, H * .08, '#0b1a22', 1.3, false);
      ridge(H * .9, H * .07, '#03090d', 4.1, true);
    },
    draw(t) {
    if (stale(built)) this.init();
    const night = 1 - daylight();   // the lights are there by day too, just washed out
    ctx.drawImage(sky, 0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const step = 3;
      for (let i = 0; i < 3; i++) {
        for (let x = 0; x < W; x += step) {
          const y = H * (.32 + i * .07) + Math.sin(x * .0035 + t * .12 + i * 1.9) * H * .07 + Math.sin(x * .011 - t * .2 + i) * H * .022;
          const h = H * (.2 + .1 * Math.sin(x * .006 + t * .27 + i * 2.3)) * (1 + bands.mid * .3);
          const a = (i === 2 ? .35 : .75) * Math.pow(.5 + .5 * Math.sin(x * .017 + t * .45 + i * 2), 1.6) * (.08 + .92 * night) * (1 + bands.bass * .5);
          if (a < .02) continue;
          ctx.globalAlpha = a;
          ctx.drawImage(strips[i], x, y - h, step + .5, h);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(hills, 0, 0, W, H);
    }
  };
}
