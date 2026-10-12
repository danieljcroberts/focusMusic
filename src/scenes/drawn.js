// Scenes drawn entirely in code on the 2D canvas: a night road and a fireside.
import { W, H, ctx } from '../view.js';
import { rand, hash, layer, glow, stars } from '../util.js';
import { bands } from '../music.js';


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

