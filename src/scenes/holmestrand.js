// Holmestrand: the view from the path on the hill above the town, east over the fjord, painted from photographs.
// An overcast deck of cloud, painted with noise and lit gold from below at dawn and dusk; the low Hurum hills across the
// water in aerial perspective; the wooded island to the right with the sun behind it; the fjord reflecting the sky and
// the shore through a moving ripple, with the sun laid along it; the waterfront block and the marina masts; the harbour
// mole with its row of trees; rows of white and ochre wooden houses with eaves, dormers and framed windows on the slope,
// among gardens, hedges and streets; and autumn maple and birch over the guardrail. Follows the clock and the weather.
import { W, H, ctx } from '../view.js';
import { hash, rgb, layer, glow } from '../util.js';
import { daylight, skyMix } from '../daylight.js';
import { weather } from '../weather.js';
import { bands, musicLevel } from '../music.js';
import { seasonName } from '../season.js';

function seeded(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = x => x * x * (3 - 2 * x);
// Value noise on a grid, summed over octaves: a small buffer of fbm in 0..1, for clouds, hills and leaves.
// With wrap, the buffer joins up with itself left to right (each point is blended with its twin one width along), so
// copies laid side by side show no seam.
function fbmBuffer(w, h, seed, octaves = 5, scale = 1, wrap = false) {
  const r = seeded(seed), G = 64, grid = new Float32Array(G * G);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
    const g = (a, b) => grid[((b % G + G) % G) * G + ((a % G + G) % G)];
    return lerp(lerp(g(xi, yi), g(xi + 1, yi), fx), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), fx), fy);
  };
  const out = new Float32Array(w * h);
  const at = (x, y) => { let v = 0, a = .5, f = scale * 4 / w; for (let o = 0; o < octaves; o++) { v += a * noise(x * f + o * 7.3, y * f + o * 3.1); f *= 2.03; a *= .5; } return v; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!wrap) { out[y * w + x] = at(x, y); continue; }
    const k = x / w, v = at(x, y) * (1 - k) + at(x - w, y) * k;   // the same value at both edges
    out[y * w + x] = .5 + (v - .5) / Math.sqrt(k * k + (1 - k) * (1 - k));   // keep the contrast the blend would lose
  }
  return out;
}
// A maple leaf: five lobes, pointing up, radius r, turned by a.
function leafPath(g, x, y, r, a) {
  g.save(); g.translate(x, y); g.rotate(a); g.beginPath();
  for (let i = 0; i <= 20; i++) {
    const t = i / 20 * Math.PI * 2, lobe = Math.abs(Math.cos(t * 2.5)), rr = r * (.62 + .38 * Math.pow(lobe, .35)) * (t > Math.PI * .8 && t < Math.PI * 1.2 ? .75 : 1);
    const px = Math.sin(t) * rr, py = -Math.cos(t) * rr;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath(); g.fill(); g.restore();
}

export function holmestrandScene() {
  let sky, clouds, far, shore, town, fol, rail, refl, rg, built = -1, G, windows, ferry, gulls, cw;
  const stale = () => Math.abs(daylight() - built) > .04;
  const mix = (n, k, d, t) => rgb(skyMix(n, k, d, t));

  function build() {
    const d = daylight(); built = d;
    const port = H > W, s = Math.min(W, H) / 800, tw = 1 - Math.abs(d * 2 - 1), gold = tw * (1 - weather * .5);
    const hy = H * (port ? .4 : .45), sunX = W * (port ? .64 : .7), wy1 = H * (port ? .55 : .6);
    const lit = .35 + .65 * d;
    // The season (the hemisphere's): winter is bare and snowy, spring fresh and light, summer deep green, autumn gold.
    const season = seasonName();
    G = { hy, sunX, s, gold, port, wy1, lit, season };
    let g;

    /* Sky: the deck. A base gradient, then noise-shaded cloud: dark bellies, lighter tops, and a warm underlight that
       grows toward the horizon and the sun, so the gold reads as light getting under the cloud. */
    [sky, g] = layer(W, H);
    const top = skyMix([12, 16, 30], [84, 90, 106], [150, 158, 172], d), low = skyMix([30, 34, 54], [236, 196, 128], [214, 212, 204], d);
    const gr = g.createLinearGradient(0, 0, 0, hy); gr.addColorStop(0, rgb(top)); gr.addColorStop(.75, rgb(skyMix([14, 18, 32], [150, 142, 136], [190, 194, 202], d))); gr.addColorStop(1, rgb(low));
    g.fillStyle = gr; g.fillRect(0, 0, W, hy + 2);
    cw = Math.ceil(W * 2);
    const nw = 320, nh = Math.max(64, Math.min(320, Math.round(nw * hy / W))), nb = fbmBuffer(nw, nh, 11, 5, 3, true), nb2 = fbmBuffer(nw, nh, 23, 3, 9, true);   // the buffer keeps the sky's shape, so lumps stay lumps
    const cim = new ImageData(nw, nh);
    const belly = skyMix([8, 10, 20], [66, 68, 80], [140, 146, 160], d), edge = skyMix([34, 38, 58], [176, 150, 128], [208, 208, 214], d), under = [255, 200, 120];
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const i = y * nw + x, k = y / nh;
      const n = nb[i] * .8 + nb2[i] * .2 + (k - .5) * .25;                      // thicker up top, breaking up toward the horizon
      const cover = Math.max(0, Math.min(1, (n - .36) * 3.2)) * (1 - Math.pow(Math.max(0, k - .7) / .3, 2));
      const litK = Math.max(0, Math.min(1, (nb2[i] - nb[i]) * 2 + .5));         // which side of each lump faces the light
      const warm = Math.pow(k, 2.5) * gold * (.5 + .5 * Math.exp(-Math.pow((x / nw * 2 - sunX / W * 2 + .5) / .5, 2)));
      const col = belly.map((v, j) => v + (edge[j] - v) * litK * .7 + (under[j] - v) * warm * .6);
      cim.data[i * 4] = col[0]; cim.data[i * 4 + 1] = col[1]; cim.data[i * 4 + 2] = col[2]; cim.data[i * 4 + 3] = 255 * cover * (.75 + .25 * weather);
    }
    const [cbuf, cg] = layer(nw, nh); cg.putImageData(cim, 0, 0);
    [clouds, g] = layer(cw, hy); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(cbuf, 0, 0, cw / 2, hy); g.drawImage(cbuf, cw / 2, 0, cw / 2, hy);   // tiles at the join by its own wrap
    // The sun: a bright core at the horizon and a wide glow, strongest at dawn and dusk.
    g = sky.getContext('2d'); g.save(); g.beginPath(); g.rect(0, 0, W, hy); g.clip();
    glow(g, sunX, hy, W * .6, [255, 196, 110], .5 * gold + .08 * d);
    glow(g, sunX, hy, W * .18, [255, 240, 200], .9 * gold + .2 * d);
    glow(g, sunX, hy, W * .05, [255, 255, 240], gold);
    g.restore();

    /* Far shore: the Hurum hills in two ridges with haze between, islets, and the wooded island to the right. */
    [far, g] = layer(W, H);
    const hz = fbmBuffer(512, 8, 5, 4, 2);
    const ridge = (y0, amp, col, haze, seed, x0 = -10, x1 = W + 10, shapeFn = null) => {
      g.fillStyle = rgb(col); g.beginPath(); g.moveTo(x0, hy + 3);
      for (let x = x0; x <= x1; x += 4) { const u = (x + 10) / (W + 20), n = hz[Math.floor(u * 511) + (seed % 8) * 512]; const f = shapeFn ? shapeFn((x - x0) / (x1 - x0)) : 1; g.lineTo(x, y0 - amp * (.4 + .6 * n) * f); }
      g.lineTo(x1, hy + 3); g.fill();
      if (haze) { const hg2 = g.createLinearGradient(0, y0 - amp, 0, hy); hg2.addColorStop(0, rgb(low, 0)); hg2.addColorStop(1, rgb(low, haze)); g.fillStyle = hg2; g.fillRect(x0, y0 - amp, x1 - x0, hy - y0 + amp + 3); }
    };
    ridge(hy - H * .006, H * .05, skyMix([16, 20, 34], [86, 92, 110], [128, 140, 158], d), .45, 1);
    ridge(hy + 1, H * .028, skyMix([12, 16, 28], [70, 76, 92], [108, 120, 140], d), .25, 3, -10, W * .62);
    const isle = season === 'winter' ? skyMix([14, 16, 22], [80, 84, 92], [120, 126, 136], d) : skyMix([8, 12, 16], [52, 54, 40], [66, 82, 54], d);
    ridge(hy + H * .01, H * .012, isle, 0, 5, W * .05, W * .18, u => Math.sin(u * Math.PI));
    ridge(hy + H * .01, H * .008, isle, 0, 6, W * .2, W * .28, u => Math.sin(u * Math.PI));
    const ix0 = W * (port ? .5 : .55), isleTop = x => { const u = (x - ix0) / (W + 20 - ix0), n = hz[Math.floor((x + 10) / (W + 20) * 511) + 7 * 512]; return hy + H * .014 - H * .042 * (.4 + .6 * n) * Math.sin(Math.min(1, u * 1.5) * Math.PI * .5); };
    ridge(hy + H * .014, H * .042, isle, 0, 7, ix0, W + 20, u => Math.sin(Math.min(1, u * 1.5) * Math.PI * .5));
    g.save(); g.globalCompositeOperation = 'lighter';                                  // the sun's rim along the island's crown
    g.strokeStyle = rgb([255, 190, 100], .5 * gold); g.lineWidth = 3 * s; g.beginPath();
    for (let x = ix0; x <= W + 20; x += 4) g.lineTo(x, isleTop(x));
    g.stroke(); g.restore();
    const rr = seeded(77);
    for (let i = 0; i < 700; i++) { const x = ix0 + rr() * (W + 20 - ix0), topY = isleTop(x); const y = topY + rr() * Math.max(1, hy + H * .014 - topY); g.fillStyle = rgb(rr() < .5 ? isle.map(v => v * .7) : isle.map(v => v * 1.3 + 20 * gold), .6); g.fillRect(x, y, 2 * s, 2 * s); }

    /* The shore: the waterfront block, halls, marina masts, the mole with its trees and boats. Its own layer, so the
       water can mirror it. */
    [shore, g] = layer(W, H);
    const r = seeded(31), sy = wy1 - H * .035;
    const wallC = (base, face) => rgb(base.map((v, j) => Math.round(v * (.3 + .7 * lit) * (face ? 1 : .78) + [48, 26, 0][j] * gold * face)));
    g.strokeStyle = rgb(skyMix([44, 48, 60], [150, 150, 150], [205, 208, 214], d)); g.lineWidth = Math.max(1, .9 * s);
    for (let i = 0; i < 34; i++) { const x = W * (.02 + .15 * r()), h = H * (.02 + .024 * r()); g.beginPath(); g.moveTo(x, sy + H * .012); g.lineTo(x, sy + H * .012 - h); g.stroke(); }
    g.fillStyle = wallC([150, 152, 150], 0); g.fillRect(W * .02, sy - H * .01, W * .19, H * .028);
    g.fillStyle = wallC([176, 176, 170], 1); g.fillRect(W * .25, sy - H * .022, W * .17, H * .04);
    g.fillStyle = wallC([200, 200, 196], 0); g.fillRect(W * .25, sy - H * .022, W * .17, H * .004);
    g.fillStyle = wallC([54, 54, 58], 0); g.fillRect(W * .19, sy - H * .058, W * .075, H * .078);
    g.fillStyle = wallC([70, 70, 74], 1); g.fillRect(W * .19 + W * .05, sy - H * .058, W * .025, H * .078);
    for (let f = 0; f < 5; f++) for (let k = 0; k < 7; k++) { g.fillStyle = rgb(hash(f, k) < .5 ? [255, 214, 150] : [90, 100, 120], .25 + .6 * (1 - d)); g.fillRect(W * .19 + W * .075 * (.08 + k * .13), sy - H * .058 + H * .078 * (.1 + f * .17), W * .006, H * .009); }
    const mx = W * (port ? .58 : .54), my = sy + H * .004;
    g.strokeStyle = rgb(skyMix([34, 36, 42], [128, 118, 104], [168, 162, 152], d)); g.lineWidth = 3.5 * s; g.beginPath(); g.moveTo(mx, my + H * .022); g.quadraticCurveTo(mx + W * .09, my - H * .014, mx + W * .18, my + H * .004); g.stroke();
    for (let i = 0; i < 8; i++) { const u = i / 7, x = mx + W * .18 * u, y = my + H * .022 * (1 - u) * (1 - u) - H * .014 * 2 * u * (1 - u) + H * .004 * u * u; g.fillStyle = rgb(skyMix([10, 18, 12], [44, 70, 36], [64, 100, 48], d)); g.beginPath(); g.ellipse(x, y - 6 * s, 4 * s, 8 * s, 0, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 12; i++) { g.fillStyle = rgb(skyMix([66, 68, 76], [228, 228, 228], [248, 248, 248], d)); g.fillRect(mx + W * .02 + W * .14 * r(), my + H * .008 + H * .01 * r(), (4 + 3 * r()) * s, 2 * s); }

    /* Water: its reflection is composed live into this buffer. */
    { const [c, cg2] = layer(W, H); refl = c; rg = cg2; }

    /* The town. The slope first: a hillside of lawns, hedges and streets, warm where the low sun reaches it. Then houses,
       nearer rows larger, each a proper wooden house with eaves, a gable or hip, dormers, framed windows and a shadow. */
    [town, g] = layer(W, H);
    windows = [];
    const hg = g.createLinearGradient(0, wy1 - H * .05, 0, H);
    hg.addColorStop(0, mix([12, 18, 16], [78, 86, 56], [108, 122, 76], d)); hg.addColorStop(.5, mix([8, 12, 10], [54, 64, 40], [80, 96, 56], d)); hg.addColorStop(1, mix([4, 6, 6], [30, 38, 24], [48, 60, 34], d));
    g.fillStyle = hg; g.fillRect(0, wy1 - H * .05, W, H);
    if (season === 'winter') { g.fillStyle = mix([150, 160, 180], [226, 222, 220], [244, 246, 250], d); g.fillRect(0, wy1 - H * .05, W, H); }
    g.fillStyle = rgb([255, 190, 110], .12 * gold); g.fillRect(0, wy1 - H * .05, W, H * .25);
    // The waterfront: a stone quay along the water, then a row of low warehouses, shops and old wharf houses.
    { const qy = wy1 - H * .05, qc = skyMix([20, 22, 28], [120, 112, 100], [156, 152, 144], d);
      g.fillStyle = rgb(qc); g.fillRect(0, qy, W, H * .018);
      g.fillStyle = rgb(qc.map(v => v * .75)); g.fillRect(0, qy + H * .018, W, H * .004);
      const rq = seeded(57), wcols = [[200, 80, 56], [232, 220, 196], [214, 170, 96], [150, 154, 150], [236, 232, 222], [120, 60, 50]];
      for (let x = -10; x < W; ) {
        const bw = (30 + 60 * rq()) * s, bh = (14 + 16 * rq()) * s, by = qy + H * .022 + bh * .2;
        const c = wcols[Math.floor(rq() * wcols.length)];
        g.fillStyle = wallC(c, 1); g.fillRect(x, by - bh, bw, bh);
        g.fillStyle = wallC(c, 0); g.fillRect(x + bw * .75, by - bh, bw * .25, bh);
        g.fillStyle = rgb([40, 40, 46].map(v => v * (.4 + .6 * lit))); g.beginPath(); g.moveTo(x - 2 * s, by - bh); g.lineTo(x + bw / 2, by - bh - bh * (.25 + .3 * rq())); g.lineTo(x + bw + 2 * s, by - bh); g.fill();
        for (let k = 0; k < Math.max(1, Math.round(bw / (10 * s))); k++) { const wx = x + (k + .5) * bw / Math.max(1, Math.round(bw / (10 * s))) - 2 * s; g.fillStyle = rgb(skyMix([30, 36, 50], [86, 96, 112], [120, 138, 160], d)); g.fillRect(wx, by - bh * .7, 4 * s, 5 * s); windows.push({ x: wx, y: by - bh * .7, w: 4 * s, h: 5 * s, on: rq() < .6, ph: rq() * 9, owner: -1 }); }
        x += bw + (2 + 10 * rq()) * s;
      } }
    { const gw2 = 160, gh2 = 64, gb = fbmBuffer(gw2, gh2, 41, 4, 4), gim = new ImageData(gw2, gh2);
      const dk = skyMix([6, 10, 8], [34, 46, 26], [52, 72, 38], d), lt = skyMix([14, 22, 16], [96, 112, 60], [128, 150, 84], d);
      for (let i = 0; i < gw2 * gh2; i++) { const n = gb[i], c = n < .5 ? dk : lt; gim.data[i * 4] = c[0]; gim.data[i * 4 + 1] = c[1]; gim.data[i * 4 + 2] = c[2]; gim.data[i * 4 + 3] = 255 * Math.abs(n - .5) * 2.2; }
      const [gbuf, gg] = layer(gw2, gh2); gg.putImageData(gim, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(gbuf, 0, wy1 - H * .05, W, H * .5); }
    const treeC = season === 'winter' ? skyMix([24, 26, 30], [70, 66, 64], [96, 92, 90], d) : season === 'spring' ? skyMix([14, 26, 14], [70, 120, 50], [110, 170, 70], d) : skyMix([10, 18, 12], [38, 66, 32], [58, 100, 46], d);
    for (let i = 0; i < 140; i++) { const x = r() * W, y = wy1 + H * .02 + Math.pow(r(), .8) * H * .32, k = (y - wy1) / (H * .34), rr3 = (5 + 14 * k + 8 * r()) * s; g.fillStyle = rgb(treeC.map(v => v * (.8 + .4 * r())), .9); g.beginPath(); g.ellipse(x, y, rr3 * 1.2, rr3, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = rgb(treeC.map(v => v * 1.5 + 36 * gold), .5); g.beginPath(); g.ellipse(x + rr3 * .3, y - rr3 * .35, rr3 * .7, rr3 * .5, 0, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = rgb(skyMix([20, 22, 26], [92, 90, 86], [130, 128, 124], d), .8); g.lineWidth = 3 * s;
    for (const [x0, y0, x1, y1] of [[W * .05, wy1, W * .32, H * .9], [W * .45, wy1 - H * .02, W * .3, H * .88], [W * .95, wy1, W * .6, H * .9], [0, wy1 + H * .12, W, wy1 + H * .16]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    const palette = [[240, 236, 226], [240, 236, 226], [238, 232, 216], [236, 226, 198], [226, 214, 184], [206, 160, 90], [214, 206, 194], [176, 58, 42], [96, 118, 140]];
    const houses = [];
    const rows = port ? 9 : 6, rk = port ? .62 : 1;
    for (let row = 0; row < rows; row++) {
      const yb0 = wy1 + H * (.012 + (row * row * .012 + row * .03) * rk), sc = 1 + (row * row * .22 + row * .25) * rk, n = Math.round((W / 26) / sc);
      for (let i = 0; i < n; i++) {
        const yb = yb0 + (r() - .5) * H * .022, w = (24 + 30 * r()) * s * sc, h = (13 + 11 * r()) * s * sc, x = (i + .5) * (W / n) + (r() - .5) * W / n * .9 - w / 2;
        if (row < 2 && x > mx - w * .5 && x < mx + W * .2) continue;
        if (r() < .08) continue;
        houses.push({ x, yb, w, h, base: palette[Math.floor(r() * palette.length)], red: r() < .14, hip: r() < .3, dormer: r() < .4, chimney: r() < .6, tree: r(), treeK: r(), two: r() < .5 });
      }
    }
    // The white church with its spire, among the second row.
    { const cy = wy1 + H * (.012 + .042 * rk), sc = 1.5 + .5 * rk, cx = W * (port ? .3 : .36);
      for (let i = houses.length - 1; i >= 0; i--) if (Math.abs(houses[i].x + houses[i].w / 2 - cx) < 60 * s * sc && Math.abs(houses[i].yb - cy) < H * .03) houses.splice(i, 1);
      houses.push({ church: true, x: cx - 24 * s * sc, yb: cy, w: 48 * s * sc, h: 20 * s * sc }); }
    houses.sort((a, b) => a.yb - b.yb);
    houses.forEach((hs, i) => { hs.n = i; });
    for (const hs of houses) {
      const owner = hs.n;
      if (hs.church) {
        const { x, yb, w, h } = hs, white = [244, 242, 236], roofC2 = (season === 'winter' ? [228, 230, 236] : [56, 58, 66]).map(v => v * (.35 + .65 * lit));
        g.fillStyle = wallC(white, 0); g.fillRect(x, yb - h, w * .7, h); g.fillStyle = wallC(white, 1); g.fillRect(x + w * .7, yb - h, w * .3, h);
        g.fillStyle = rgb(roofC2); g.beginPath(); g.moveTo(x - w * .04, yb - h); g.lineTo(x + w * .5, yb - h * 1.55); g.lineTo(x + w * 1.04, yb - h); g.fill();
        const tx = x + w * .06, tw = w * .24;   // the tower and spire at the west end
        g.fillStyle = wallC(white, 1); g.fillRect(tx, yb - h * 2.1, tw, h * 2.1);
        g.fillStyle = rgb(roofC2); g.beginPath(); g.moveTo(tx - tw * .1, yb - h * 2.1); g.lineTo(tx + tw / 2, yb - h * 3.3); g.lineTo(tx + tw * 1.1, yb - h * 2.1); g.fill();
        g.fillStyle = rgb([60, 70, 90]); for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x + w * (.42 + k * .16), yb - h * .55, 2.2 * s, 4.5 * s, 0, 0, Math.PI * 2); g.fill(); }
        g.beginPath(); g.ellipse(tx + tw / 2, yb - h * 1.7, 2.5 * s, 2.5 * s, 0, 0, Math.PI * 2); g.fill();
        continue;
      }
      const { x, yb, w, h, base, red, hip, dormer, chimney, tree, treeK, two } = hs, sc = h / (14 * s);
      const roofC = (season === 'winter' ? [228, 230, 236] : red ? [148, 64, 48] : [44, 46, 50]).map(v => v * (.35 + .65 * lit)), roofLit = roofC.map(v => Math.min(255, v * 1.25 + 24 * gold));
      g.fillStyle = rgb([0, 0, 0], .22 * lit); g.beginPath(); g.ellipse(x + w * .35, yb + 2 * s, w * .7, 4 * s * sc, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = wallC(base, 0); g.fillRect(x, yb - h, w * .6, h);
      g.fillStyle = wallC(base, 1); g.fillRect(x + w * .6, yb - h, w * .4, h);
      g.strokeStyle = rgb([0, 0, 0], .07); g.lineWidth = 1; for (let yy = yb - h + 3 * sc; yy < yb; yy += 3 * sc) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
      g.fillStyle = rgb(roofC);
      if (hip) { g.beginPath(); g.moveTo(x - w * .07, yb - h); g.lineTo(x + w * .22, yb - h * 1.5); g.lineTo(x + w * .78, yb - h * 1.5); g.lineTo(x + w * 1.07, yb - h); g.fill(); g.fillStyle = rgb(roofLit); g.beginPath(); g.moveTo(x + w * .6, yb - h); g.lineTo(x + w * .78, yb - h * 1.5); g.lineTo(x + w * 1.07, yb - h); g.fill(); }
      else { g.beginPath(); g.moveTo(x - w * .07, yb - h); g.lineTo(x + w * .5, yb - h * 1.65); g.lineTo(x + w * 1.07, yb - h); g.fill(); g.fillStyle = rgb(roofLit); g.beginPath(); g.moveTo(x + w * .5, yb - h * 1.65); g.lineTo(x + w * 1.07, yb - h); g.lineTo(x + w * .62, yb - h); g.fill();
        g.fillStyle = wallC(base, 1); g.beginPath(); g.moveTo(x + w * .62, yb - h); g.lineTo(x + w * .5, yb - h * 1.6); g.lineTo(x + w * .38, yb - h); g.fill(); }
      g.strokeStyle = rgb(roofC.map(v => v * .6)); g.lineWidth = Math.max(1, s * sc * .5); g.beginPath(); g.moveTo(x - w * .07, yb - h); g.lineTo(x + w * 1.07, yb - h); g.stroke();
      if (dormer && !hip) { g.fillStyle = wallC(base, 1); g.fillRect(x + w * .2, yb - h * 1.3, w * .14, h * .3); g.fillStyle = rgb(roofC); g.beginPath(); g.moveTo(x + w * .17, yb - h * 1.3); g.lineTo(x + w * .27, yb - h * 1.42); g.lineTo(x + w * .37, yb - h * 1.3); g.fill(); windows.push({ x: x + w * .24, y: yb - h * 1.26, w: w * .06, h: h * .18, on: r() < .5, ph: r() * 9, owner }); }
      if (chimney) { g.fillStyle = rgb([80, 66, 60].map(v => v * (.35 + .65 * lit))); g.fillRect(x + w * (.3 + .4 * treeK), yb - h * 1.62, 3 * s * sc, h * .35); }
      const floors = two ? 2 : 1, wn = Math.max(1, Math.round(w / (11 * s * sc)));
      for (let f = 0; f < floors; f++) for (let k = 0; k < wn; k++) {
        const ww = 4.5 * s * sc, wh = 5.5 * s * sc, wx = x + w * (k + .5) / wn - ww / 2, wy = yb - h * (floors === 2 ? (f ? .82 : .4) : .62);
        g.fillStyle = rgb([236, 234, 226].map(v => v * (.4 + .6 * lit))); g.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
        g.fillStyle = rgb(skyMix([30, 36, 50], [86, 96, 112], [120, 138, 160], d)); g.fillRect(wx, wy, ww, wh);
        windows.push({ x: wx, y: wy, w: ww, h: wh, on: r() < .5, ph: r() * 9, owner });
      }
      g.fillStyle = rgb([70, 50, 40].map(v => v * (.4 + .6 * lit))); g.fillRect(x + w * .08, yb - h * .3, 3.5 * s * sc, h * .3);
      g.fillStyle = rgb(season === 'winter' ? skyMix([30, 32, 36], [120, 118, 116], [150, 148, 146], d) : skyMix([10, 18, 12], [40, 64, 32], [60, 96, 44], d)); g.fillRect(x - w * .05, yb + 1, w * 1.1, 3 * s * sc);
      if (tree < .45) { const tc = season === 'winter' ? skyMix([14, 16, 22], [52, 54, 60], [76, 78, 84], d) : skyMix([12, 22, 14], [40, 68, 34], [62, 104, 48], d); g.fillStyle = rgb(tc); g.beginPath(); if (tree < .2) g.ellipse(x + w * 1.1, yb - h * .4, 5 * s * sc, 13 * s * sc, 0, 0, Math.PI * 2); else g.ellipse(x - w * .14, yb - h * .5, 10 * s * sc, 9 * s * sc, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = rgb(tc.map(v => v * 1.4 + 30 * gold), .6); g.beginPath(); if (tree < .2) g.ellipse(x + w * 1.1 + 2 * s * sc, yb - h * .5, 2.5 * s * sc, 9 * s * sc, 0, 0, Math.PI * 2); else g.ellipse(x - w * .12, yb - h * .6, 6 * s * sc, 5 * s * sc, 0, 0, Math.PI * 2); g.fill(); }
    }
    // Lit windows are drawn over the finished town, so drop those a nearer house stands in front of.
    const covers = (hs, cx, cy) => {
      if (cx > hs.x && cx < hs.x + hs.w && cy > hs.yb - hs.h && cy < hs.yb) return true;                         // its walls
      const peak = hs.yb - hs.h * (hs.church ? 1.55 : 1.65);
      return cy > peak && cy < hs.yb - hs.h && Math.abs(cx - (hs.x + hs.w / 2)) < hs.w * .57 * (cy - peak) / (hs.yb - hs.h - peak);   // its roof
    };
    windows = windows.filter(w => { const cx = w.x + w.w / 2, cy = w.y + w.h / 2; return !houses.some(hs => hs.n > w.owner && covers(hs, cx, cy)); });
    const lampX = W * (port ? .72 : .74), lampY = wy1 + H * .22;
    g.strokeStyle = rgb([40, 42, 46]); g.lineWidth = 2.5 * s; g.beginPath(); g.moveTo(lampX, lampY + H * .12); g.lineTo(lampX, lampY); g.lineTo(lampX - 8 * s, lampY - 3 * s); g.stroke();
    g.fillStyle = rgb(skyMix([120, 120, 120], [210, 210, 210], [240, 240, 240], d)); g.beginPath(); g.ellipse(lampX - 9 * s, lampY - 4 * s, 7 * s, 4 * s, 0, 0, Math.PI * 2); g.fill();
    G.lamp = { x: lampX - 9 * s, y: lampY - 4 * s };

    /* Foliage: three depths of autumn scrub, maple leaves drawn as leaves on thin stems, rimmed by the low sun, with
       the tall birch on the middle depth. Each on a wider layer so it can stir. */
    const leafCols = season === 'autumn' ? [[228, 194, 56], [236, 168, 44], [206, 140, 38], [120, 140, 50], [92, 118, 46], [64, 86, 42], [240, 212, 92], [186, 96, 40]]
      : season === 'summer' ? [[70, 120, 46], [52, 100, 40], [96, 140, 56], [40, 84, 36], [110, 150, 60]]
      : season === 'spring' ? [[150, 196, 80], [170, 210, 96], [120, 176, 70], [190, 214, 110]]
      : [[120, 100, 70], [100, 84, 60]];   // winter: the few leaves left are brown
    const leafK = season === 'winter' ? .12 : season === 'spring' ? .7 : 1;
    fol = [0, 1, 2].map(k => {
      const [c, lg] = layer(W + 80, H);
      const rr2 = seeded(100 + k), top = H * (port ? .7 : .74) + H * .07 * k, dark = .45 + .55 * lit, shade = 1 - k * .15;
      const stems = Math.round(W / (14 - 2.5 * k));
      // A frame, not a wall: the scrub crowds the two sides and thins to a few stems in the middle, so the town shows.
      const edgeX = () => { const u = rr2(); const side = rr2() < .5 ? u * u * .32 : 1 - u * u * .32; return side * (W + 80); };
      for (let i = 0; i < stems; i++) {
        const sx = rr2() < .93 ? edgeX() : rr2() * (W + 80), sy2 = top + (H - top) * (.3 + .7 * rr2()), sh = (40 + 90 * rr2()) * s * (1 + k * .4), lean = (rr2() - .5) * .5;
        lg.strokeStyle = rgb([80, 60, 44].map(v => v * dark * shade)); lg.lineWidth = Math.max(.8, (.8 + k * .5) * s); lg.beginPath(); lg.moveTo(sx, sy2 + sh * .3); lg.quadraticCurveTo(sx + lean * sh * .4, sy2 - sh * .4, sx + lean * sh, sy2 - sh); lg.stroke();
        const base = leafCols[Math.floor(rr2() * leafCols.length)], nl = Math.round((14 + Math.floor(rr2() * 16)) * leafK);
        for (let j = 0; j < nl; j++) {
          const u = rr2(), px = sx + lean * sh * u + (rr2() - .5) * sh * .35, py = sy2 + sh * .3 - sh * 1.3 * u + (rr2() - .5) * sh * .2, lr = (2.2 + 3.5 * rr2()) * s * (1 + k * .6);
          const upper = u > .6, tone = base.map(v => Math.round(v * dark * shade * (.8 + .4 * rr2()) + (upper ? 40 * gold : 0)));
          lg.fillStyle = rgb(tone, .95); leafPath(lg, px, py, lr, (rr2() - .5) * 2.4);
        }
      }
      if (k === 1 && !port) {
        const bx = W * .8;
        lg.strokeStyle = rgb([200, 196, 188].map(v => v * dark)); lg.lineWidth = 5 * s; lg.lineCap = 'round'; lg.beginPath(); lg.moveTo(bx, H); lg.quadraticCurveTo(bx + 8 * s, H * .6, bx + 5 * s, hy - H * .14); lg.stroke();
        lg.strokeStyle = rgb([40, 36, 34]); lg.lineWidth = 2 * s; for (let j = 0; j < 14; j++) { const yy = H * .98 - j * H * .035; lg.beginPath(); lg.moveTo(bx - 2 * s + j * .3, yy); lg.lineTo(bx + 2 * s + j * .3, yy - 2 * s); lg.stroke(); }
        lg.strokeStyle = rgb([170, 166, 158].map(v => v * dark)); lg.lineWidth = 1.5 * s;
        for (let j = 0; j < 12; j++) { const yy = hy - H * .14 + j * H * .045, dir = j % 2 ? 1 : -1, len = W * (.025 + .045 * (j / 12)); lg.beginPath(); lg.moveTo(bx + 5 * s, yy); lg.quadraticCurveTo(bx + dir * len * .6, yy - H * .03, bx + dir * len, yy + H * .01); lg.stroke(); }
        for (let j = 0; j < Math.round(2200 * leafK); j++) { const a = rr2() * 6.28, rad = Math.pow(rr2(), .7), px = bx + 5 * s + Math.cos(a) * rad * W * .075 * (1 + .3 * Math.sin(a * 3)), py = hy + H * .07 + Math.sin(a) * rad * H * .26; const c2 = (season === 'autumn' ? [[128, 140, 58], [180, 168, 60], [96, 112, 54], [214, 190, 70]] : season === 'summer' ? [[70, 120, 50], [90, 136, 58], [56, 104, 44], [100, 146, 64]] : season === 'spring' ? [[150, 196, 84], [170, 206, 96], [130, 180, 72], [180, 214, 108]] : [[120, 100, 70], [110, 92, 64], [130, 106, 74], [100, 84, 60]])[j % 4]; lg.fillStyle = rgb(c2.map(v => v * dark + 20 * gold), .85); lg.beginPath(); lg.ellipse(px, py, (1.2 + 1.6 * rr2()) * s, (1 + 1.2 * rr2()) * s, a, 0, Math.PI * 2); lg.fill(); }
      }
      return c;
    });
    /* The guardrail: a W-beam in galvanised grey with a bright top edge and posts, across the bottom left. */
    [rail, g] = layer(W, H);
    const ry = H * .9, rc2 = skyMix([44, 48, 54], [148, 150, 154], [184, 188, 192], d);
    const path = (dy) => { g.beginPath(); g.moveTo(-10, ry + H * .035 + dy); g.quadraticCurveTo(W * .35, ry - H * .005 + dy, W * .72, ry + H * .01 + dy); };
    g.lineCap = 'round'; g.strokeStyle = rgb(rc2); g.lineWidth = 11 * s; path(0); g.stroke();
    g.strokeStyle = rgb(rc2.map(v => v * .72)); g.lineWidth = 3 * s; path(1 * s); g.stroke();
    g.strokeStyle = rgb(rc2.map(v => Math.min(255, v * 1.3 + 30 * gold))); g.lineWidth = 1.5 * s; path(-4.5 * s); g.stroke();
    g.fillStyle = rgb(rc2.map(v => v * .7)); for (const u of [.08, .3, .52]) g.fillRect(W * u, ry - H * .004 + H * .03 * (1 - u / .72) * .5, 6 * s, H * .06);

    ferry = ferry || { x: W * 1.1, y: hy + H * .03, v: W * .005 };
    gulls = gulls || Array.from({ length: 3 }, (_, i) => ({ x: W * (.3 + .2 * i), y: hy * (.6 + .1 * i), ph: i * 2.1 }));
  }

  return {
    init() { built = -1; },
    draw(t, dt) {
      if (built < 0 || stale()) build();
      const d = daylight(), { hy, sunX, s, gold, port, wy1, lit } = G, night = 1 - d;
      ctx.drawImage(sky, 0, 0, W, H);
      const cx = (t * W * .003) % cw;
      ctx.drawImage(clouds, -cx, 0); ctx.drawImage(clouds, cw - cx, 0);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, sunX, hy, W * (.1 + .02 * musicLevel), [255, 230, 170], (.4 * gold + .05 * d) * (1 - weather * .4));
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(far, 0, 0, W, H);
      // The water: the sky, clouds and shore mirrored in strips that slide with a slow ripple, darkened and tinted;
      // then the sun's column and a fine shimmer.
      rg.clearRect(0, 0, W, H);
      rg.drawImage(sky, 0, 0, W, H); rg.drawImage(clouds, -cx, 0); rg.drawImage(clouds, cw - cx, 0); rg.drawImage(far, 0, 0, W, H); rg.drawImage(shore, 0, 0, W, H);
      const wh = wy1 - hy, strips = 36;
      ctx.save(); ctx.beginPath(); ctx.rect(0, hy, W, wh); ctx.clip();
      ctx.fillStyle = mix([10, 13, 22], [120, 118, 112], [112, 124, 138], d); ctx.fillRect(0, hy, W, wh);
      ctx.globalAlpha = .55 + .15 * night;
      for (let i = 0; i < strips; i++) {
        const y0 = hy + wh * i / strips, hh = wh / strips + 1, depth = (i + .5) / strips;
        const src = hy - wh * depth * (port ? .45 : .35) - hh;             // the mirror compresses toward the near edge
        const dx = Math.sin(t * .8 + i * .9) * (1 + depth * 6) * s * (1 + weather);
        ctx.drawImage(refl, 0, Math.max(0, src), W, hh, dx, y0, W, hh);
      }
      ctx.globalAlpha = 1;
      const deepC = skyMix([6, 8, 14], [70, 72, 78], [80, 94, 108], d);
      const wg = ctx.createLinearGradient(0, hy, 0, wy1); wg.addColorStop(0, rgb(deepC, 0)); wg.addColorStop(1, rgb(deepC, .6));
      ctx.fillStyle = wg; ctx.fillRect(0, hy, W, wh);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(sunX, hy); ctx.scale(1, wh / (W * .12)); glow(ctx, 0, 0, W * (.04 + .05 * i), [255, 210, 130], (.45 - .1 * i) * (gold + .1 * d)); ctx.restore(); }
      ctx.lineCap = 'round';
      for (let k = 0; k < 40; k++) {
        const p = k / 40, y = hy + wh * p * p + 2, m = 3 + Math.floor(p * 14);
        for (let i = 0; i < m; i++) {
          const nearSun = Math.exp(-Math.pow((hash(k, i) - sunX / W) / (.05 + .1 * p), 2));
          const a = (.06 + .4 * nearSun * (gold + .15 * d)) * Math.pow(.5 + .5 * Math.sin(t * (1.2 + .6 * hash(i, k)) + k * 1.7 + i * 3.1), 2) * lit;
          const xx = W * ((hash(k, i) + t * .004 * (.5 + p)) % 1), len = (4 + 40 * p) * s;
          ctx.strokeStyle = rgb(nearSun > .3 ? [255, 224, 160] : [226, 230, 238], a); ctx.lineWidth = .7 + p * 1.6;
          ctx.beginPath(); ctx.moveTo(xx - len / 2, y); ctx.lineTo(xx + len / 2, y); ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      // The ferry, white over a dark hull, crossing slowly, with its lights at night.
      ferry.x -= ferry.v * dt; if (ferry.x < -W * .1) ferry.x = W * 1.1;
      const fw = W * .045, fh = H * .012;
      ctx.fillStyle = mix([30, 32, 40], [60, 62, 70], [70, 74, 84], d); ctx.fillRect(ferry.x, ferry.y, fw, fh * .5);
      ctx.fillStyle = mix([90, 92, 100], [236, 232, 224], [248, 248, 248], d); ctx.fillRect(ferry.x + fw * .1, ferry.y - fh, fw * .8, fh); ctx.fillRect(ferry.x + fw * .3, ferry.y - fh * 1.7, fw * .35, fh * .7);
      ctx.fillStyle = rgb([255, 220, 160], .5 * night + .2); for (let i = 0; i < 6; i++) ctx.fillRect(ferry.x + fw * (.15 + i * .12), ferry.y - fh * .7, fw * .05, fh * .3);
      ctx.drawImage(shore, 0, 0, W, H);
      ctx.drawImage(town, 0, 0, W, H);
      if (night > .15) {
        ctx.globalCompositeOperation = 'lighter';
        for (const w of windows) if (w.on && Math.sin(t * .05 + w.ph) > -.4) { ctx.fillStyle = rgb([255, 178, 96], .78 * night); ctx.fillRect(w.x, w.y, w.w, w.h); }   // warm lamplight, not every room
        glow(ctx, G.lamp.x, G.lamp.y, 50 * s, [255, 200, 120], .55 * night); ctx.fillStyle = rgb([255, 240, 200], night); ctx.beginPath(); ctx.ellipse(G.lamp.x, G.lamp.y, 5 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
        glow(ctx, W * .3, wy1 - H * .005, 70 * s, [255, 200, 130], .22 * night);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (d > .2) {
        ctx.strokeStyle = rgb([40, 40, 48], .7 * d); ctx.lineWidth = Math.max(1, 1.2 * s);
        for (const gl of gulls) {
          gl.x += Math.cos(t * .11 + gl.ph) * 12 * s * dt; gl.y += Math.sin(t * .17 + gl.ph) * 6 * s * dt;
          const flap = Math.sin(t * 5 + gl.ph) * 3 * s;
          ctx.beginPath(); ctx.moveTo(gl.x - 7 * s, gl.y + flap); ctx.quadraticCurveTo(gl.x - 3 * s, gl.y - 2 * s, gl.x, gl.y); ctx.quadraticCurveTo(gl.x + 3 * s, gl.y - 2 * s, gl.x + 7 * s, gl.y + flap); ctx.stroke();
        }
      }
      // A breath of haze over the far town toward the sun, then the foliage stirring at three depths, then the rail.
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, sunX, wy1 + H * .05, W * .3, [255, 200, 120], .08 * gold);
      ctx.globalCompositeOperation = 'source-over';
      const gust = .5 + weather + bands.mid * .4;
      fol.forEach((c, k) => { const off = -40 + Math.sin(t * (.5 + k * .25) + k) * (1.5 + k * 2) * gust; ctx.drawImage(c, off, 0); });
      ctx.drawImage(rail, 0, 0, W, H);
    }
  };
}
