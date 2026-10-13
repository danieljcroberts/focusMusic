// Holmestrand: the view from the path on the hill above the town, east over the fjord. An overcast sky with a band of
// gold at the horizon at dawn and dusk, the low Hurum hills across the water, the wooded island to the right with the sun
// rising behind it, the fjord with the sun laid along it, the waterfront with the dark block and the marina masts, the
// harbour mole with its row of trees, rows of white and ochre wooden houses with dark roofs, and autumn maple and birch
// in front, over the guardrail. Follows the clock and the weather. The clouds drift, the water shimmers, a ferry crosses,
// the leaves stir, and at night the windows and the harbour lights come on.
import { W, H, ctx } from '../view.js';
import { hash, rgb, layer, glow } from '../util.js';
import { daylight, skyMix } from '../daylight.js';
import { weather } from '../weather.js';
import { bands, musicLevel } from '../music.js';

// A seeded random so the town is the same each visit.
function seeded(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

export function holmestrandScene() {
  let sky, clouds, far, water, town, fol, rail, built = -1, G, windows, lamps, ferry, gulls, cw;
  const stale = () => Math.abs(daylight() - built) > .04;
  const mix = (n, k, d, t) => rgb(skyMix(n, k, d, t));

  function build() {
    const d = daylight(); built = d;
    const port = H > W, s = Math.min(W, H) / 800;
    const hy = H * (port ? .42 : .46), sunX = W * (port ? .62 : .68);
    G = { hy, sunX, s, tw: 1 - Math.abs(d * 2 - 1), port };
    let g;

    // Sky: a grey overcast deck, lighter toward the horizon, with the gold band where the sun gets under it.
    [sky, g] = layer(W, H);
    const gr = g.createLinearGradient(0, 0, 0, hy);
    gr.addColorStop(0, mix([10, 13, 24], [96, 102, 116], [168, 176, 190], d));
    gr.addColorStop(.7, mix([16, 20, 34], [140, 138, 142], [196, 200, 208], d));
    gr.addColorStop(1, mix([26, 30, 46], [252, 214, 140], [230, 226, 212], d));
    g.fillStyle = gr; g.fillRect(0, 0, W, hy + 2);
    // The gold: a wide glow low on the sky, strongest at dawn and dusk; by day a paler brightness; at night a last trace.
    const gold = G.tw;
    g.save(); g.beginPath(); g.rect(0, 0, W, hy); g.clip();
    glow(g, sunX, hy - H * .01, W * .55, [255, 200, 110], .55 * gold + .1 * d);
    glow(g, sunX, hy - H * .005, W * .22, [255, 236, 190], .7 * gold + .15 * d);
    g.fillStyle = rgb([255, 215, 140], .18 * gold); g.fillRect(0, hy - H * .06, W, H * .06);
    g.restore();

    // Cloud deck, twice the width so it can drift: long soft bands with ragged undersides.
    cw = Math.ceil(W * 2);
    [clouds, g] = layer(cw, hy);
    const rc = seeded(7);
    const cloudCol = skyMix([8, 10, 18], [78, 82, 94], [160, 166, 178], d), cloudLit = skyMix([14, 16, 26], [130, 118, 110], [205, 206, 210], d);
    for (let i = 0; i < 90; i++) {
      const y = hy * (.02 + .62 * Math.pow(rc(), .8)), r = (60 + 160 * rc()) * Math.max(.6, W / 1400), x = rc() * cw;
      const k = y / hy, col = cloudCol.map((v, j) => v + (cloudLit[j] - v) * (.3 + .7 * k));
      const cg = g.createRadialGradient(x, y, 0, x, y, r); cg.addColorStop(0, rgb(col, .55)); cg.addColorStop(1, rgb(col, 0));
      g.fillStyle = cg; g.beginPath(); g.ellipse(x, y, r * 1.6, r * .5, 0, 0, Math.PI * 2); g.fill();
    }

    // Far shore: the low Hurum hills right across, hazy; two islets to the left; the wooded island to the right, nearer.
    [far, g] = layer(W, H);
    const hill = skyMix([14, 18, 30], [72, 78, 94], [112, 124, 142], d);
    g.fillStyle = rgb(hill); g.beginPath(); g.moveTo(-10, hy + 2);
    for (let x = -10; x <= W + 10; x += 12) g.lineTo(x, hy - H * (.018 + .022 * (.5 + .5 * Math.sin(x * .0025 + 1.2)) + .008 * Math.sin(x * .011 + 2) + .004 * hash(x, 3)));
    g.lineTo(W + 10, hy + 2); g.fill();
    g.fillStyle = rgb(skyMix([18, 22, 34], [92, 94, 104], [130, 140, 154], d), .8);   // a nearer, paler ridge behind the town
    g.beginPath(); g.moveTo(-10, hy + 2); for (let x = -10; x <= W * .55; x += 12) g.lineTo(x, hy - H * (.006 + .014 * (.5 + .5 * Math.sin(x * .004 + 4)) * (1 - x / (W * .6)))); g.lineTo(W * .55, hy + 2); g.fill();
    const isle = skyMix([10, 14, 20], [58, 60, 48], [78, 92, 64], d);
    for (const [x0, x1, h] of [[W * .06, W * .17, .012], [W * .2, W * .27, .008]]) {
      g.fillStyle = rgb(isle); g.beginPath(); g.moveTo(x0, hy + 3); g.quadraticCurveTo((x0 + x1) / 2, hy - H * h, x1, hy + 3); g.fill();
    }
    const ix0 = W * (port ? .5 : .54), ix1 = W + 20, iy = hy + H * .012;
    g.fillStyle = rgb(isle); g.beginPath(); g.moveTo(ix0, iy);
    for (let x = ix0; x <= ix1; x += 8) { const u = (x - ix0) / (ix1 - ix0); g.lineTo(x, iy - H * (.034 * Math.sin(Math.min(1, u * 1.6) * Math.PI * .5) + .006 * hash(x, 9) + .004 * Math.sin(x * .05))); }
    g.lineTo(ix1, iy); g.fill();
    g.fillStyle = rgb([255, 190, 110], .22 * gold); g.beginPath(); g.moveTo(ix0, iy);   // the sun's rim on the island's crown
    for (let x = ix0; x <= ix1; x += 8) { const u = (x - ix0) / (ix1 - ix0); const top = iy - H * (.034 * Math.sin(Math.min(1, u * 1.6) * Math.PI * .5) + .006 * hash(x, 9)); g.lineTo(x, top); }
    for (let x = ix1; x >= ix0; x -= 8) { const u = (x - ix0) / (ix1 - ix0); const top = iy - H * (.034 * Math.sin(Math.min(1, u * 1.6) * Math.PI * .5) + .006 * hash(x, 9)); g.lineTo(x, top + 4 * s); }
    g.fill();

    // The fjord: silver-grey water with the sun's column in it.
    [water, g] = layer(W, H);
    const wy1 = H * (port ? .56 : .6);
    const wg = g.createLinearGradient(0, hy, 0, wy1);
    wg.addColorStop(0, mix([18, 22, 34], [170, 168, 160], [150, 160, 172], d)); wg.addColorStop(1, mix([10, 13, 22], [96, 100, 108], [104, 116, 130], d));
    g.fillStyle = wg; g.fillRect(0, hy, W, wy1 - hy + 2);
    g.save(); g.beginPath(); g.rect(0, hy, W, wy1 - hy); g.clip();
    for (let i = 0; i < 4; i++) { g.save(); g.translate(sunX, hy); g.scale(1, (wy1 - hy) / (W * .12)); glow(g, 0, 0, W * (.05 + .05 * i), [255, 215, 140], (.5 - .1 * i) * (gold + .15 * d)); g.restore(); }
    g.restore();

    // The town: waterfront first (the block, the halls, the marina masts, the mole), then rows of houses coming nearer.
    [town, g] = layer(W, H);
    const r = seeded(31);
    const ty0 = wy1 - H * .03, lit = .5 + .5 * d, warm = gold;
    const hg = g.createLinearGradient(0, wy1 - H * .04, 0, H);
    hg.addColorStop(0, mix([12, 18, 16], [74, 82, 52], [104, 118, 72], d)); hg.addColorStop(.5, mix([8, 12, 10], [52, 62, 38], [78, 94, 54], d)); hg.addColorStop(1, mix([4, 6, 6], [30, 38, 24], [48, 60, 34], d));
    g.fillStyle = hg; g.fillRect(0, wy1 - H * .04, W, H);
    g.fillStyle = rgb([255, 190, 110], .1 * warm); g.fillRect(0, wy1 - H * .04, W, H * .2);      // the low sun on the slope
    for (let i = 0; i < 60; i++) { const x = r() * W, y = wy1 + H * .02 + r() * H * .3, rr2 = (6 + 14 * r()) * s; g.fillStyle = rgb(skyMix([10, 16, 12], [40 + 30 * r(), 60 + 30 * r(), 30], [70 + 40 * r(), 100 + 40 * r(), 50], d), .8); g.beginPath(); g.ellipse(x, y, rr2 * 1.3, rr2, 0, 0, Math.PI * 2); g.fill(); }   // gardens and trees between the houses
    const wall = (base, face) => rgb(base.map((v, j) => Math.round(v * (.35 + .65 * lit) * (face ? 1 : .82) + [40, 22, 0][j] * warm * face)));
    // Marina: a hedge of masts along the left shore.
    g.strokeStyle = rgb(skyMix([40, 44, 56], [150, 150, 150], [200, 204, 210], d)); g.lineWidth = Math.max(1, s);
    for (let i = 0; i < 26; i++) { const x = W * (.03 + .13 * r()), h = H * (.025 + .02 * r()); g.beginPath(); g.moveTo(x, ty0 + H * .01); g.lineTo(x, ty0 + H * .01 - h); g.stroke(); }
    // Industrial halls and the dark block.
    g.fillStyle = wall([150, 152, 150], 0); g.fillRect(W * .02, ty0 - H * .012, W * .2, H * .03);
    g.fillStyle = wall([170, 170, 166], 1); g.fillRect(W * .26, ty0 - H * .02, W * .16, H * .035);
    g.fillStyle = wall([60, 60, 64], 0); g.fillRect(W * .2, ty0 - H * .055, W * .07, H * .075);
    g.fillStyle = rgb([255, 220, 160], .12 + .5 * (1 - d)); for (let f = 0; f < 5; f++) for (let k = 0; k < 6; k++) if (hash(f, k) < .7) g.fillRect(W * .2 + W * .07 * (.1 + k * .15), ty0 - H * .055 + H * .075 * (.1 + f * .17), W * .006, H * .008);
    // The mole: a curved breakwater with a row of small trees, and boats inside.
    const mx = W * (port ? .6 : .55), my = ty0 - H * .005;
    g.strokeStyle = rgb(skyMix([30, 34, 40], [120, 112, 100], [160, 156, 148], d)); g.lineWidth = 3 * s; g.beginPath(); g.moveTo(mx, my + H * .02); g.quadraticCurveTo(mx + W * .08, my - H * .012, mx + W * .16, my + H * .004); g.stroke();
    for (let i = 0; i < 7; i++) { const u = i / 6, x = mx + W * .16 * u, y = my + H * .02 * (1 - u) * (1 - u) - H * .012 * 4 * u * (1 - u) + H * .004 * u; g.fillStyle = rgb(skyMix([12, 20, 14], [48, 66, 34], [70, 100, 50], d)); g.beginPath(); g.ellipse(x, y - 5 * s, 4 * s, 7 * s, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = rgb(skyMix([60, 62, 70], [220, 220, 220], [245, 245, 245], d)); for (let i = 0; i < 9; i++) g.fillRect(mx + W * .02 + W * .12 * r(), my + H * .006 + H * .01 * r(), 5 * s, 2 * s);
    // Houses: five rows, nearer and larger toward the bottom; gabled, white or cream or ochre, a few red roofs.
    windows = []; lamps = [];
    const palette = [[242, 238, 228], [242, 238, 228], [236, 226, 200], [230, 220, 190], [204, 160, 92], [214, 206, 190], [180, 60, 44]];
    for (let row = 0; row < 6; row++) {
      const yb0 = ty0 + H * (.025 + row * .046), sc = 1 + row * .3, n = Math.round((W / 34) / sc);
      for (let i = 0; i < n; i++) {
        const yb = yb0 + (r() - .5) * H * .02;
        const w = (22 + 34 * r()) * s * sc, h = (12 + 14 * r()) * s * sc, x = (i + .5) * (W / n) + (r() - .5) * W / n * .9 - w / 2;
        if (r() < .1) continue;                                                // a gap, a garden
        if (row < 2 && x > mx - w && x < mx + W * .2) continue;              // the harbour stays open
        const base = palette[Math.floor(r() * palette.length)], red = r() < .14, hip = r() < .3;
        const roofC = red ? [150, 66, 50] : [46, 48, 52];
        g.fillStyle = wall(base, 0); g.fillRect(x, yb - h, w, h);                 // the shaded face
        g.fillStyle = wall(base, 1); g.fillRect(x + w * .55, yb - h, w * .45, h);  // the sunlit face toward the fjord
        g.fillStyle = rgb(roofC.map(v => v * (.4 + .6 * lit)));
        g.beginPath(); if (hip) { g.moveTo(x - w * .05, yb - h); g.lineTo(x + w * .2, yb - h * 1.45); g.lineTo(x + w * .8, yb - h * 1.45); g.lineTo(x + w * 1.05, yb - h); }
        else { g.moveTo(x - w * .05, yb - h); g.lineTo(x + w * .5, yb - h * 1.6); g.lineTo(x + w * 1.05, yb - h); } g.fill();
        if (r() < .5) { g.fillStyle = rgb([60, 52, 50].map(v => v * (.4 + .6 * lit))); g.fillRect(x + w * (.2 + .5 * r()), yb - h * 1.5, 3 * s * sc, h * .3); }   // a chimney
        const wn = Math.max(1, Math.round(w / (12 * s * sc)));
        for (let k = 0; k < wn; k++) { const wx = x + w * (k + .5) / wn - 2.5 * s * sc, wy = yb - h * .7; windows.push({ x: wx, y: wy, w: 5 * s * sc, h: 6 * s * sc, on: r() < .55, ph: r() * 9 }); g.fillStyle = rgb([70, 80, 96].map(v => v * (.5 + .5 * lit))); g.fillRect(wx, wy, 5 * s * sc, 6 * s * sc); }
        if (r() < .4) { g.fillStyle = rgb(skyMix([14, 24, 16], [40, 66, 34], [60, 100, 46], d)); g.beginPath(); if (r() < .5) g.ellipse(x + w * 1.08, yb - h * .35, 5 * s * sc, 12 * s * sc, 0, 0, Math.PI * 2); else g.ellipse(x - w * .12, yb - h * .4, 9 * s * sc, 8 * s * sc, 0, 0, Math.PI * 2); g.fill(); }   // a cypress or a round tree by the house
      }
    }
    lamps.push({ x: W * (port ? .7 : .72), y: ty0 + H * .2 });

    // Foliage: three depths of autumn scrub, each on its own wider layer so it can stir. Maple gold, birch yellow, greens.
    const leafCols = [[230, 196, 60], [236, 170, 44], [210, 150, 40], [120, 140, 50], [90, 118, 44], [60, 84, 40], [236, 210, 90]];
    fol = [0, 1, 2].map(k => {
      const [c, lg] = layer(W + 80, H);
      const rr = seeded(100 + k), top = H * (port ? .62 : .64) + H * .08 * k, dark = .55 + .45 * lit, shade = 1 - k * .18;
      const clumps = Math.round(W / (16 - 3 * k));
      for (let i = 0; i < clumps; i++) {
        const cx = rr() * (W + 80), cy = top + (H - top) * Math.pow(rr(), .7), R = (16 + 30 * rr()) * s * (1 + k * .4);
        const base = leafCols[Math.floor(rr() * leafCols.length)];
        for (let j = 0; j < 26; j++) {
          const a = rr() * 6.28, rad = R * Math.sqrt(rr()), px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad * .8, lr = (1.6 + 3 * rr()) * s * (1 + k * .4);
          const tone = base.map(v => Math.round(v * dark * shade * (.8 + .4 * rr()) + 30 * warm * (py < cy ? 1 : 0)));
          lg.fillStyle = rgb(tone, .92); lg.beginPath(); lg.ellipse(px, py, lr * 1.2, lr * .8, a, 0, Math.PI * 2); lg.fill();
        }
        if (rr() < .3) { lg.strokeStyle = rgb([70, 50, 36].map(v => v * dark)); lg.lineWidth = Math.max(1, 1.2 * s); lg.beginPath(); lg.moveTo(cx, cy + R); lg.lineTo(cx + (rr() - .5) * 10 * s, cy - R * 1.6); lg.stroke(); }   // a bare stem reaching up
      }
      // The tall birch on the right, on the middle layer: a pale trunk and a loose crown.
      if (k === 1 && !port) {
        const bx = W * .8;
        lg.strokeStyle = rgb([190, 186, 176].map(v => v * dark)); lg.lineWidth = 4 * s; lg.beginPath(); lg.moveTo(bx, H); lg.quadraticCurveTo(bx + 8 * s, H * .6, bx + 5 * s, hy - H * .12); lg.stroke();
        lg.lineWidth = 1.5 * s; for (let j = 0; j < 7; j++) { const yy = hy - H * .1 + j * H * .05, dir = j % 2 ? 1 : -1; lg.beginPath(); lg.moveTo(bx + 5 * s, yy); lg.quadraticCurveTo(bx + dir * W * .03, yy - H * .02, bx + dir * W * .05, yy + H * .01); lg.stroke(); }
        for (let j = 0; j < 700; j++) { const a = rr() * 6.28, rad = Math.sqrt(rr()), px = bx + 5 * s + Math.cos(a) * rad * W * .065, py = hy + H * .06 + Math.sin(a) * rad * H * .22; const c2 = [[120, 136, 60], [176, 164, 62], [92, 110, 52], [150, 150, 70]][j % 4]; lg.fillStyle = rgb(c2.map(v => v * dark), .8); lg.beginPath(); lg.ellipse(px, py, (1.2 + 1.8 * rr()) * s, (1 + 1.4 * rr()) * s, a, 0, Math.PI * 2); lg.fill(); }
      }
      return c;
    });
    // The guardrail across the bottom left, grey steel with a lip, and its posts.
    [rail, g] = layer(W, H);
    const ry = H * .9, rc2 = skyMix([40, 44, 50], [150, 152, 156], [186, 190, 194], d);
    g.strokeStyle = rgb(rc2); g.lineWidth = 9 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(-10, ry + H * .035); g.quadraticCurveTo(W * .35, ry - H * .005, W * .72, ry + H * .01); g.stroke();
    g.strokeStyle = rgb(rc2.map(v => v * .7)); g.lineWidth = 2 * s; g.beginPath(); g.moveTo(-10, ry + H * .035 + 5 * s); g.quadraticCurveTo(W * .35, ry - H * .005 + 5 * s, W * .72, ry + H * .01 + 5 * s); g.stroke();
    g.fillStyle = rgb(rc2.map(v => v * .8)); for (const u of [.08, .3, .52]) g.fillRect(W * u, ry - H * .004 + H * .03 * (1 - u / .72) * .5, 6 * s, H * .05);

    ferry = ferry || { x: W * 1.1, y: hy + H * .035, v: W * .006 };
    gulls = gulls || Array.from({ length: 3 }, (_, i) => ({ x: W * (.3 + .2 * i), y: hy * (.6 + .1 * i), ph: i * 2.1 }));
  }

  return {
    init() { built = -1; },
    draw(t, dt) {
      if (built < 0 || stale()) build();
      const d = daylight(), { hy, sunX, s, tw, port } = G, night = 1 - d;
      ctx.drawImage(sky, 0, 0, W, H);
      const cx = (t * W * .004) % cw;
      ctx.globalAlpha = .85 + .15 * weather; ctx.drawImage(clouds, -cx, 0); ctx.drawImage(clouds, cw - cx, 0); ctx.globalAlpha = 1;
      // The sun's glare breathes a little with the music.
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, sunX, hy - H * .004, W * (.12 + .02 * musicLevel), [255, 230, 170], (.5 * tw + .08 * d) * (1 - weather * .4));
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(far, 0, 0, W, H);
      ctx.drawImage(water, 0, 0, W, H);
      // Water: fine horizontal shimmer, brightest in the sun's column, moving slowly.
      const wy1 = H * (port ? .56 : .6);
      ctx.lineCap = 'round';
      for (let k = 0; k < 34; k++) {
        const p = k / 34, y = hy + (wy1 - hy) * p * p + 2, m = 3 + Math.floor(p * 12);
        for (let i = 0; i < m; i++) {
          const nearSun = Math.exp(-Math.pow((hash(k, i) - sunX / W) / (.06 + .1 * p), 2));
          const a = (.08 + .35 * nearSun * (tw + .2 * d)) * Math.pow(.5 + .5 * Math.sin(t * (1.2 + .6 * hash(i, k)) + k * 1.7 + i * 3.1), 2) * (.3 + .7 * night * .3 + .7 * d);
          const xx = W * ((hash(k, i) + t * .004 * (.5 + p)) % 1), len = (4 + 40 * p) * s;
          ctx.strokeStyle = rgb(nearSun > .3 ? [255, 222, 160] : [220, 226, 236], a); ctx.lineWidth = .7 + p * 1.5;
          ctx.beginPath(); ctx.moveTo(xx - len / 2, y); ctx.lineTo(xx + len / 2, y); ctx.stroke();
        }
      }
      // The ferry, white with a dark hull, crossing slowly; a dot of light at night.
      ferry.x -= ferry.v * dt; if (ferry.x < -W * .1) ferry.x = W * 1.1;
      const fw = W * .045, fh = H * .012;
      ctx.fillStyle = rgb(skyMix([30, 32, 40], [60, 62, 70], [70, 74, 84], d)); ctx.fillRect(ferry.x, ferry.y, fw, fh * .5);
      ctx.fillStyle = rgb(skyMix([90, 92, 100], [236, 232, 224], [248, 248, 248], d)); ctx.fillRect(ferry.x + fw * .1, ferry.y - fh, fw * .8, fh); ctx.fillRect(ferry.x + fw * .3, ferry.y - fh * 1.7, fw * .35, fh * .7);
      if (night > .3) glow(ctx, ferry.x + fw * .5, ferry.y - fh * .5, 10 * s, [255, 220, 160], .6 * night);
      ctx.drawImage(town, 0, 0, W, H);
      // Windows and the street lamp after dark.
      if (night > .15) {
        ctx.globalCompositeOperation = 'lighter';
        for (const w of windows) if (w.on && Math.sin(t * .05 + w.ph) > -.6) { ctx.fillStyle = rgb([255, 214, 150], .85 * night); ctx.fillRect(w.x, w.y, w.w, w.h); }
        for (const l of lamps) glow(ctx, l.x, l.y, 40 * s, [255, 200, 120], .5 * night);
        glow(ctx, W * .3, H * (port ? .57 : .61), 60 * s, [255, 200, 130], .25 * night);   // the harbour's lights on the water
        ctx.globalCompositeOperation = 'source-over';
      }
      // Gulls over the harbour by day.
      if (d > .2) {
        ctx.strokeStyle = rgb([40, 40, 48], .7 * d); ctx.lineWidth = Math.max(1, 1.2 * s);
        for (const gl of gulls) {
          gl.x += Math.cos(t * .11 + gl.ph) * 12 * s * dt; gl.y += Math.sin(t * .17 + gl.ph) * 6 * s * dt;
          const flap = Math.sin(t * 5 + gl.ph) * 3 * s;
          ctx.beginPath(); ctx.moveTo(gl.x - 7 * s, gl.y + flap); ctx.quadraticCurveTo(gl.x - 3 * s, gl.y - 2 * s, gl.x, gl.y); ctx.quadraticCurveTo(gl.x + 3 * s, gl.y - 2 * s, gl.x + 7 * s, gl.y + flap); ctx.stroke();
        }
      }
      // Foliage, each depth stirring at its own pace, a touch more with the music and the wind.
      const gust = .5 + weather + bands.mid * .4;
      fol.forEach((c, k) => { const off = -40 + Math.sin(t * (.5 + k * .25) + k) * (1.5 + k * 2) * gust; ctx.drawImage(c, off, 0); });
      ctx.drawImage(rail, 0, 0, W, H);
      // Lamp glow over the near leaves, so it reads as in front of them.
      if (night > .15) { ctx.globalCompositeOperation = 'lighter'; for (const l of lamps) glow(ctx, l.x, l.y, 90 * s, [255, 190, 110], .12 * night); ctx.globalCompositeOperation = 'source-over'; }
    }
  };
}
