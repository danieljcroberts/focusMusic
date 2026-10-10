// Clean Power: a Norwegian valley running on renewables, in a navy, energy-blue and pale-sky palette.
// A concrete arch dam holds a reservoir and spills into the river, wind turbines turn on the ridge and out in the fjord,
// a field of solar panels catches a slow glint, and light pulses run along the power lines. Follows the clock and the weather.
import { W, H, ctx, lowPower } from '../view.js';
import { rand, rgb, layer, glow, stars } from '../util.js';
import { weather } from '../weather.js';
import { daylight, skyMix } from '../daylight.js';
import { musicLevel, bands } from '../music.js';

const NAVY = [11, 31, 58], BLUE = [0, 160, 222], SKY = [168, 216, 240], PALE = [232, 244, 250], GREEN = [122, 193, 67];

export function cleanPowerScene() {
  let base, built = -1, turbines, panels, lines, spill, s;
  const stale = () => Math.abs(daylight() - built) > .04;

  // Ground heights as fractions of H, so the composition holds in portrait and landscape.
  const horizon = () => H * (W > H ? .5 : .46);

  function build() {
    const d = daylight(); built = d;
    s = Math.min(W, H) / 800;
    const hy = horizon();
    let g; [base, g] = layer(W, H);

    // Sky
    const sky = g.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, rgb(skyMix([4, 12, 30], NAVY, [118, 190, 228], d)));
    sky.addColorStop(1, rgb(skyMix([12, 30, 56], [70, 120, 170], PALE, d)));
    g.fillStyle = sky; g.fillRect(0, 0, W, hy + 2);
    if (d < .5) { g.globalAlpha = 1 - d * 2; stars(g, Math.round(W * hy / 2600), hy * .8); g.globalAlpha = 1; }
    if (d > .1) glow(g, W * .78, hy * .3, Math.max(W, H) * .35, [255, 250, 230], .35 * d);

    // Mountains: three flat layers, snow on the farthest
    const ridge = (y0, amp, col, seed, snow) => {
      const pts = [];
      for (let x = -20; x <= W + 20; x += 18) pts.push([x, y0 - amp * (.55 + .45 * Math.sin(x * .006 + seed) * Math.sin(x * .0023 + seed * 2.1))]);
      g.fillStyle = rgb(col); g.beginPath(); g.moveTo(-20, H);
      for (const p of pts) g.lineTo(p[0], p[1]);
      g.lineTo(W + 20, H); g.fill();
      if (snow) {
        // Snow above a ragged line, clipped to the mountain's outline
        g.save(); g.beginPath(); g.moveTo(-20, H); for (const p of pts) g.lineTo(p[0], p[1]); g.lineTo(W + 20, H); g.clip();
        g.fillStyle = rgb(skyMix([60, 80, 110], [190, 210, 230], [250, 252, 255], d), .92);
        g.beginPath(); g.moveTo(-20, 0);
        for (let x = -20; x <= W + 20; x += 14) g.lineTo(x, y0 - amp * (.72 + .06 * Math.sin(x * .05 + seed) + .04 * Math.sin(x * .13)));
        g.lineTo(W + 20, 0); g.fill(); g.restore();
      }
      return pts;
    };
    ridge(hy - H * .02, H * .2, skyMix([20, 40, 70], [60, 100, 150], [130, 175, 210], d), 1.7, true);
    const mid = ridge(hy + H * .01, H * .12, skyMix([12, 28, 52], [30, 64, 104], [70, 120, 165], d), 4.2, false);

    // Reservoir behind the dam (left) and the fjord (right)
    const water = skyMix([8, 22, 44], [20, 70, 120], [60, 150, 205], d);
    g.fillStyle = rgb(water); g.fillRect(0, hy + H * .015, W, H * .05);
    g.fillStyle = rgb(skyMix([10, 26, 50], [24, 80, 130], [80, 170, 220], d), .6);
    for (let i = 0; i < 18; i++) g.fillRect(rand(0, W), hy + H * rand(.02, .06), rand(20, 70) * s, 1.5);

    // The dam: a pale concrete arch across a notch in the near hills
    const dx = W * (W > H ? .22 : .26), dw = Math.min(W * .34, 340 * s * 1.6), dTop = hy + H * .055, dBot = hy + H * .2;
    const near = skyMix([10, 22, 40], NAVY, [40, 90, 70], d);
    g.fillStyle = rgb(near);
    g.beginPath(); g.moveTo(-10, H); g.lineTo(-10, dTop - H * .03); g.quadraticCurveTo(dx - dw * .6, dTop - H * .05, dx - dw * .5, dTop);
    g.lineTo(dx - dw * .5, H); g.fill();
    g.beginPath(); g.moveTo(dx + dw * .5, H); g.lineTo(dx + dw * .5, dTop); g.quadraticCurveTo(dx + dw * .75, dTop - H * .06, dx + dw * 1.3, dTop - H * .02);
    g.lineTo(W + 10, dTop + H * .02); g.lineTo(W + 10, H); g.fill();
    const concrete = g.createLinearGradient(dx - dw / 2, 0, dx + dw / 2, 0);
    const cc = skyMix([60, 70, 86], [150, 165, 185], [226, 232, 238], d);
    concrete.addColorStop(0, rgb(cc.map(v => v * .7))); concrete.addColorStop(.5, rgb(cc)); concrete.addColorStop(1, rgb(cc.map(v => v * .78)));
    g.fillStyle = concrete;
    g.beginPath(); g.moveTo(dx - dw / 2, dTop); g.quadraticCurveTo(dx, dTop + H * .015, dx + dw / 2, dTop);
    g.lineTo(dx + dw * .44, dBot); g.quadraticCurveTo(dx, dBot + H * .03, dx - dw * .44, dBot); g.fill();
    g.strokeStyle = rgb(cc.map(v => v * .6), .5); g.lineWidth = 1;
    for (let k = 1; k < 6; k++) { const y = dTop + (dBot - dTop) * k / 6; g.beginPath(); g.moveTo(dx - dw * (.5 - .06 * k / 6), y); g.quadraticCurveTo(dx, y + H * .015, dx + dw * (.5 - .06 * k / 6), y); g.stroke(); }
    // Powerhouse at the foot, with lit windows at night
    const phw = dw * .32, phx = dx - phw / 2, phy = dBot + H * .012, phh = H * .035;
    g.fillStyle = rgb(skyMix([30, 40, 56], [90, 110, 140], [200, 210, 220], d)); g.fillRect(phx, phy, phw, phh);
    g.fillStyle = rgb(skyMix(NAVY, NAVY, [11, 31, 58], d)); g.fillRect(phx - 4 * s, phy - 4 * s, phw + 8 * s, 5 * s);
    for (let k = 0; k < 6; k++) { g.fillStyle = d < .5 ? 'rgba(255,214,140,.9)' : 'rgba(11,31,58,.55)'; g.fillRect(phx + phw * (.08 + k * .15), phy + phh * .35, phw * .08, phh * .35); }
    spill = { x: dx, w: dw * .16, top: dTop + H * .012, bot: dBot + H * .008 };

    // River from the dam to the fjord
    g.strokeStyle = rgb(water); g.lineWidth = 10 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(dx, dBot + H * .05); g.bezierCurveTo(dx + W * .1, dBot + H * .09, W * .6, dBot + H * .02, W + 10, hy + H * .06); g.stroke();

    // Solar field on the near slope: rows of navy panels with an energy-blue frame
    const fy = H * (W > H ? .72 : .7);
    const slope = g.createLinearGradient(0, fy - H * .06, 0, H);
    slope.addColorStop(0, rgb(skyMix([10, 24, 22], [40, 70, 50], GREEN, d)));
    slope.addColorStop(1, rgb(skyMix([6, 14, 14], [20, 40, 30], [70, 130, 50], d)));
    g.fillStyle = slope; g.beginPath(); g.moveTo(-10, H); g.lineTo(-10, fy - H * .02);
    g.quadraticCurveTo(W * .5, fy - H * .09, W + 10, fy - H * .03); g.lineTo(W + 10, H); g.fill();
    panels = [];
    const rows = W > H ? 5 : 6, pw = 46 * s * (W > H ? 1.1 : 1), ph = 18 * s;
    for (let r = 0; r < rows; r++) {
      const y = fy + r * (ph * 1.9) + ph, scale = 1 + r * .18;
      for (let x = W * .08 - (r % 2) * pw * .5; x < W * .96; x += pw * scale * 1.12) {
        const w = pw * scale, h = ph * scale;
        panels.push({ x, y, w, h });
        g.fillStyle = rgb(skyMix([8, 16, 34], NAVY, [20, 50, 95], d));
        g.beginPath(); g.moveTo(x + w * .12, y); g.lineTo(x + w, y); g.lineTo(x + w * .88, y + h); g.lineTo(x, y + h); g.fill();
        g.strokeStyle = rgb(BLUE, .55 + .25 * d); g.lineWidth = Math.max(1, 1.2 * s);
        g.stroke();
        g.strokeStyle = rgb(BLUE, .25); g.lineWidth = 1;
        for (let c = 1; c < 4; c++) { g.beginPath(); g.moveTo(x + w * (.12 + .88 * c / 4) - w * .12 * 0, y); g.lineTo(x + w * .88 * c / 4, y + h); g.stroke(); }
        g.fillStyle = rgb(skyMix([20, 30, 40], [60, 70, 80], [120, 130, 140], d)); g.fillRect(x + w * .45, y + h, 2 * s, h * .45);
      }
    }

    // Wind turbines on the far ridge and out in the fjord
    turbines = [];
    const pick = mid.filter(p => p[0] > W * .45 && p[0] < W * .98);
    const n = W > H ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const p = pick[Math.floor((i + .5) / n * pick.length)] || [W * (.5 + i * .08), hy];
      turbines.push({ x: p[0], y: p[1] + 2, h: (70 + 20 * Math.sin(i * 2.3)) * s, ph: rand(0, 6.28), sp: rand(.85, 1.15) });
    }
    for (let i = 0; i < (W > H ? 3 : 2); i++) turbines.push({ x: W * (.62 + i * .13), y: hy + H * .045, h: 46 * s, ph: rand(0, 6.28), sp: rand(.9, 1.1), sea: true });

    // Power lines from the powerhouse across the valley, with lattice pylons
    lines = [];
    const pylons = [[dx + dw * .32, dBot - H * .02], [W * .52, fy - H * .085], [W * .82, fy - H * .07], [W + 40, fy - H * .1]];
    g.strokeStyle = rgb(skyMix([20, 30, 50], [40, 60, 90], [70, 90, 110], d)); g.lineWidth = Math.max(1, 1.4 * s);
    for (const [x, y] of pylons) {
      const ph2 = 70 * s;
      g.beginPath(); g.moveTo(x - 9 * s, y + ph2 * .9); g.lineTo(x, y); g.lineTo(x + 9 * s, y + ph2 * .9); g.moveTo(x - 14 * s, y + 6 * s); g.lineTo(x + 14 * s, y + 6 * s);
      g.moveTo(x - 6 * s, y + ph2 * .3); g.lineTo(x + 6 * s, y + ph2 * .55); g.moveTo(x + 6 * s, y + ph2 * .3); g.lineTo(x - 6 * s, y + ph2 * .55); g.stroke();
    }
    for (const off of [-12, 12]) {
      const path = [];
      for (let k = 0; k < pylons.length - 1; k++) {
        const [x0, y0] = pylons[k], [x1, y1] = pylons[k + 1];
        for (let i = 0; i <= 24; i++) { const u = i / 24; path.push([x0 + off * s + (x1 - x0) * u, y0 + 6 * s + (y1 - y0) * u + Math.sin(u * Math.PI) * 14 * s]); }
      }
      g.strokeStyle = rgb(skyMix([30, 40, 60], [50, 70, 100], [60, 80, 100], d), .8); g.lineWidth = 1;
      g.beginPath(); path.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
      lines.push(path);
    }
  }

  function turbine(tb, t, d, speed) {
    const { x, y, h } = tb, hub = [x, y - h], blade = h * .62, rot = t * speed * tb.sp + tb.ph;
    const white = skyMix([150, 165, 185], [215, 225, 235], [250, 252, 255], d);
    ctx.fillStyle = rgb(white);
    ctx.beginPath(); ctx.moveTo(x - h * .035, y); ctx.lineTo(x - h * .015, y - h); ctx.lineTo(x + h * .015, y - h); ctx.lineTo(x + h * .035, y); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hub[0] + h * .03, hub[1], h * .06, h * .025, 0, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 3; k++) {
      const a = rot + k * Math.PI * 2 / 3, ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
      ctx.beginPath();
      ctx.moveTo(hub[0] + nx * h * .02, hub[1] + ny * h * .02);
      ctx.lineTo(hub[0] + ca * blade, hub[1] + sa * blade);
      ctx.lineTo(hub[0] - nx * h * .035 + ca * blade * .25, hub[1] - ny * h * .035 + sa * blade * .25);
      ctx.fill();
    }
    ctx.fillStyle = rgb(BLUE); ctx.beginPath(); ctx.arc(hub[0], hub[1], h * .022, 0, Math.PI * 2); ctx.fill();
    if (d < .5 && Math.sin(t * 1.6 + tb.ph) > .4) glow(ctx, hub[0], hub[1] - h * .03, 10 * s, [255, 40, 40], .8 * (1 - d * 2));   // aviation light
    if (tb.sea) { ctx.fillStyle = rgb(white, .25); ctx.fillRect(x - h * .04, y + 2, h * .08, h * .12); }   // reflection
  }

  return {
    init() { built = -1; },
    draw(t, dt) {
      if (built < 0 || stale()) build();
      const d = daylight();
      ctx.drawImage(base, 0, 0, W, H);

      // Spillway: a narrow curtain of white water down the dam face, foam at the foot, heavier in wet weather
      const sp = spill, flow = .4 + .6 * weather, cw = sp.w * (.45 + .4 * flow), ht = sp.bot - sp.top;
      const curtain = ctx.createLinearGradient(0, sp.top, 0, sp.bot);
      curtain.addColorStop(0, rgb([255, 255, 255], .9)); curtain.addColorStop(.25, rgb(PALE, .65)); curtain.addColorStop(1, rgb(SKY, .8));
      ctx.fillStyle = curtain;
      ctx.beginPath(); ctx.moveTo(sp.x - cw / 2, sp.top); ctx.lineTo(sp.x + cw / 2, sp.top); ctx.lineTo(sp.x + cw * .62, sp.bot); ctx.lineTo(sp.x - cw * .62, sp.bot); ctx.fill();
      ctx.strokeStyle = rgb([255, 255, 255], .75); ctx.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const u = (i + .5) / 9 - .5, off = (t * (70 + 25 * (i % 3)) * s + i * 41) % (ht * 1.3);
        const y1 = sp.top + Math.min(ht, off), y0 = Math.max(sp.top, y1 - 26 * s), sx = k => sp.x + u * cw * (1 + .24 * (k - sp.top) / ht);
        ctx.beginPath(); ctx.moveTo(sx(y0), y0); ctx.lineTo(sx(y1), y1); ctx.stroke();
      }
      for (let i = 0; i < 6; i++) glow(ctx, sp.x + (i - 2.5) * sp.w * .25 + Math.sin(t * 2 + i) * 3, sp.bot + 6 * s, (14 + 6 * Math.sin(t * 3 + i)) * s * (1 + flow), [255, 255, 255], .35 * flow);

      // Turbines: faster in wind, a little faster when the music swells
      const speed = .5 + 1.6 * weather + .4 * bands.bass;
      for (const tb of turbines) turbine(tb, t, d, speed);

      // Solar glint: a soft band of light sweeping slowly across the field by day
      if (d > .15) {
        const gx = ((t * .03) % 1.4 - .2) * W;
        ctx.globalCompositeOperation = 'lighter';
        for (const p of panels) {
          const k = Math.max(0, 1 - Math.abs(p.x + p.w / 2 - gx) / (W * .18));
          if (k <= 0) continue;
          ctx.fillStyle = rgb(SKY, .35 * k * d);
          ctx.beginPath(); ctx.moveTo(p.x + p.w * .12, p.y); ctx.lineTo(p.x + p.w, p.y); ctx.lineTo(p.x + p.w * .88, p.y + p.h); ctx.lineTo(p.x, p.y + p.h); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      // Energy: pulses of light running along the lines, more and brighter with the music
      const pulses = lowPower ? 3 : 6, bright = .45 + .55 * musicLevel;
      ctx.globalCompositeOperation = 'lighter';
      lines.forEach((path, li) => {
        for (let k = 0; k < pulses; k++) {
          const u = ((t * .05 + k / pulses + li * .37) % 1), idx = Math.floor(u * (path.length - 1)), p = path[idx];
          glow(ctx, p[0], p[1], 9 * s, BLUE, bright * (.6 + .4 * Math.sin(t * 3 + k)));
          ctx.fillStyle = rgb(PALE, bright); ctx.beginPath(); ctx.arc(p[0], p[1], 1.6 * s, 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.globalCompositeOperation = 'source-over';
    }
  };
}
