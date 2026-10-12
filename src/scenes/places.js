// An aquarium drawn in code on the 2D canvas.
import { W, H, ctx } from '../view.js';
import { rand, rgb, layer, glow } from '../util.js';

/* Aquarium: a tank seen through thick glass, caustic light, bubbles, fish going about their day */
export function aquariumScene() {
  let back, fish, bubbles, plants, glass;
  const floorY = () => H * .86;
  return {
    init() {
      let g; [back, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#0b2a3a'); gr.addColorStop(.6, '#07202e'); gr.addColorStop(1, '#041219');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      glow(g, W * .5, 0, W * .6, [120, 200, 220], .25);
      g.fillStyle = '#2a2a26'; g.fillRect(0, floorY(), W, H - floorY());
      for (let i = 0; i < W * .6; i++) { g.fillStyle = `rgba(${150 + rand(-40, 60)},${140 + rand(-40, 50)},${120 + rand(-40, 40)},.9)`; g.beginPath(); g.arc(rand(0, W), rand(floorY(), H), rand(1, 3), 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#0a1a20';
      for (const [x, w, h] of [[.12, .22, .11], [.7, .3, .16], [.42, .12, .06]]) { g.beginPath(); g.ellipse(W * x, floorY(), W * w * .5, H * h, 0, Math.PI, Math.PI * 2); g.fill(); }
      plants = Array.from({ length: 9 }, (_, i) => ({ x: W * (i < 5 ? rand(.02, .3) : rand(.62, .98)), h: H * rand(.25, .55), w: rand(6, 14), ph: rand(0, 6), c: Math.random() < .5 ? [30, 110, 70] : [20, 80, 60] }));
      fish = Array.from({ length: 6 }, (_, i) => ({ x: rand(0, W), y: H * rand(.2, .75), v: rand(25, 55) * (Math.random() < .5 ? 1 : -1), s: rand(.6, 1.3) * Math.max(.7, W / 1200), ph: rand(0, 6), c: [[255, 140, 50], [220, 225, 235], [80, 140, 255], [255, 200, 70]][i % 4] }));
      bubbles = [];
      [glass, g] = layer(W, H);
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .4, W / 2, H / 2, Math.max(W, H) * .75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.035)'; g.beginPath(); g.roundRect(W * .06, H * .08, W * .12, H * .5, 16); g.fill();
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, W, H * .04); g.fillRect(0, H * .96, W, H * .04);
    },
    draw(t, dt) {
      ctx.drawImage(back, 0, 0, W, H);
      // Light from above, moving as the surface moves.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const x = W * (.2 + .2 * i) + Math.sin(t * .23 + i * 1.9) * W * .08, y = H * .3 + Math.cos(t * .17 + i) * H * .1;
        glow(ctx, x, y, W * .22, [120, 210, 230], .09 + .04 * Math.sin(t * .5 + i));
      }
      for (let k = 0; k < 7; k++) {
        const y = floorY() + 3 + k * ((H - floorY()) / 7), a = .04 + .04 * Math.sin(t * 1.1 + k * 2.1);
        ctx.strokeStyle = `rgba(190,240,255,${a})`; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let x = 0; x <= W; x += 18) { const yy = y + Math.sin(x * .03 + t * .9 + k) * 2.5; x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const x0 = W * (.3 + .2 * i) + Math.sin(t * .11 + i) * 40, a = .05 + .03 * Math.sin(t * .4 + i * 2);
        const sg = ctx.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, `rgba(180,235,255,${a})`); sg.addColorStop(.8, 'rgba(180,235,255,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 70, 0); ctx.lineTo(x0 + 160, H); ctx.lineTo(x0 - 20, H); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const p of plants) {
        const sway = Math.sin(t * .6 + p.ph) * 12;
        ctx.strokeStyle = rgb(p.c); ctx.lineWidth = p.w; ctx.lineCap = 'round';
        for (let b = -1; b <= 1; b++) { ctx.beginPath(); ctx.moveTo(p.x, floorY() + 4); ctx.quadraticCurveTo(p.x + b * 20 + sway * .5, floorY() - p.h * .55, p.x + b * 34 + sway, floorY() - p.h * (1 - Math.abs(b) * .25)); ctx.stroke(); }
      }
      for (const f of fish) {
        f.x += f.v * dt; const y = f.y + Math.sin(t * .8 + f.ph) * 10;
        if (f.x > W + 60 || f.x < -60) { f.v = -f.v; f.y = H * rand(.2, .75); }
        const dir = Math.sign(f.v), s = f.s, wag = Math.sin(t * 9 + f.ph) * 5 * s;
        ctx.fillStyle = rgb(f.c, .95);
        ctx.beginPath(); ctx.ellipse(f.x, y, 24 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(f.x - dir * 20 * s, y); ctx.lineTo(f.x - dir * 38 * s, y - 10 * s + wag); ctx.lineTo(f.x - dir * 38 * s, y + 10 * s + wag); ctx.fill();
        ctx.fillStyle = rgb(f.c.map(v => v * .7), .9); ctx.beginPath(); ctx.ellipse(f.x, y + 4 * s, 20 * s, 4 * s, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#081018'; ctx.beginPath(); ctx.arc(f.x + dir * 14 * s, y - 2 * s, 1.8 * s, 0, Math.PI * 2); ctx.fill();
      }
      if (Math.random() < dt * 3) bubbles.push({ x: W * .3 + rand(-6, 6), y: floorY() - 4, r: rand(1.5, 4), ph: rand(0, 6), v: rand(40, 70) });
      ctx.strokeStyle = 'rgba(220,245,255,.7)'; ctx.lineWidth = 1;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]; b.y -= b.v * dt; b.x += Math.sin(t * 3 + b.ph) * 12 * dt;
        if (b.y < H * .06) { bubbles.splice(i, 1); continue; }
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(b.x - b.r * .4, b.y - b.r * .5, 1, 1);
      }
      ctx.drawImage(glass, 0, 0, W, H);
    }
  };
}
