// Places drawn in code: a koi pond, a raked garden, desert dunes, bamboo, lanterns over a lake, Paris roofs in the rain,
// a harbour, a firefly meadow and a volcano across the water.
import { W, H, ctx, lowPower, lively } from '../view.js';
import { rand, hash, mix, rgb, layer, plain, glow, stars } from '../util.js';
import { weather } from '../weather.js';
import { daylight, skyMix } from '../daylight.js';
import { bands, musicLevel } from '../music.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const S = () => Math.min(W, H);
// A soft round sprite, drawn once and stamped with drawImage.
function blob(r, c, a = 1) { const [cv, g] = layer(r * 2, r * 2); glow(g, r, r, r, c, a); return cv; }
// A closed outline through [x, y] points, rounded with curves through the midpoints.
function smoothClosed(g, pts) {
  const n = pts.length, a = pts[n - 1], b = pts[0];
  g.beginPath(); g.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  g.closePath();
}
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

/* Koi Pond: koi turning slowly under lily pads, cherry petals on the surface, rain rings when it rains */
const KOI = [
  { body: [240, 122, 40] },
  { body: [238, 234, 224], spots: [214, 54, 34] },
  { body: [232, 186, 74], sheen: 1 },
  { body: [238, 234, 224], spots: [214, 54, 34], ink: 1 },
  { body: [244, 150, 60], spots: [250, 236, 220] },
  { body: [240, 236, 228] },
  { body: [238, 234, 224], spots: [214, 54, 34] },
  { body: [226, 96, 34] },
];
const KOI_W = [.55, .84, .97, 1, .95, .84, .7, .55, .4, .27, .17];
export function koiScene() {
  let water, top, fish, petals, rings, glint;
  const N = KOI_W.length - 1;
  function makeFish(i) {
    const L = S() * rand(.15, .21), a = rand(0, TAU), x = rand(W * .25, W * .75), y = rand(H * .25, H * .75), kind = KOI[i % KOI.length];
    const spine = []; for (let k = 0; k <= N; k++) spine.push([x - Math.cos(a) * k * L / N, y - Math.sin(a) * k * L / N]);
    const patches = kind.spots ? Array.from({ length: 2 + i % 2 }, (_, k) => ({ u: .1 + k * .25 + rand(-.04, .04), o: rand(-.45, .45), r: rand(.07, .11) })) : [];
    const ink = kind.ink ? Array.from({ length: 4 }, () => ({ u: rand(.2, .75), o: rand(-.8, .8), r: rand(.025, .045) })) : [];
    return { L, a, x, y, spine, kind, patches, ink, z: rand(0, 1), f1: rand(.12, .25), f2: rand(.04, .1), p1: rand(0, TAU), p2: rand(0, TAU), ph: rand(0, TAU), wf: rand(1.6, 2.4) };
  }
  function lilyPad(g, x, y, r, rot, flower) {
    g.save(); g.translate(x, y); g.rotate(rot);
    const pad = (ox, oy) => { g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, r, .2, TAU - .2); g.closePath(); };
    g.fillStyle = 'rgba(0,0,0,.35)'; pad(r * .08, r * .12); g.fill();
    const pg = g.createRadialGradient(-r * .3, -r * .3, 0, 0, 0, r * 1.1);
    pg.addColorStop(0, '#4c8a44'); pg.addColorStop(.7, '#2c5f30'); pg.addColorStop(1, '#1d4524');
    g.fillStyle = pg; pad(0, 0); g.fill();
    g.strokeStyle = 'rgba(150,200,110,.35)'; g.lineWidth = Math.max(1, r * .035); g.stroke();
    g.strokeStyle = 'rgba(22,54,26,.55)'; g.lineWidth = Math.max(.6, r * .015);
    for (let k = 0; k < 11; k++) { const an = .45 + k * (TAU - .9) / 10; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an) * r * .9, Math.sin(an) * r * .9); g.stroke(); }
    if (flower) {
      for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 8; k++) {
        const an = k / 8 * TAU + ring * .4, pr = r * (.36 - ring * .1);
        g.save(); g.rotate(an); g.fillStyle = ring ? '#fbe6ee' : '#f2b8cc';
        g.beginPath(); g.ellipse(pr * .55, 0, pr * .6, pr * .26, 0, 0, TAU); g.fill(); g.restore();
      }
      g.fillStyle = '#f4d35e'; g.beginPath(); g.arc(0, 0, r * .07, 0, TAU); g.fill();
    }
    g.restore();
  }
  function fishPoints(f, t) {
    const L = f.L, pts = [];
    for (let k = 0; k <= N; k++) {
      const p = f.spine[k], q = f.spine[Math.min(N, k + 1)], r = f.spine[Math.max(0, k - 1)];
      let tx = r[0] - q[0], ty = r[1] - q[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const u = k / N, wag = Math.sin(t * f.wf * 1.5 - u * 3 + f.ph) * L * .05 * u * u;
      pts.push([p[0] - ty * wag, p[1] + tx * wag, tx, ty]);
    }
    const out = [], hw = L * .135, h0 = pts[0];
    out.push([h0[0] + h0[2] * hw * .6, h0[1] + h0[3] * hw * .6]);
    for (let k = 0; k <= N; k++) { const p = pts[k], w = KOI_W[k] * hw; out.push([p[0] - p[3] * w, p[1] + p[2] * w]); }
    for (let k = N; k >= 0; k--) { const p = pts[k], w = KOI_W[k] * hw; out.push([p[0] + p[3] * w, p[1] - p[2] * w]); }
    return [pts, out];
  }
  function drawFish(f, t) {
    const L = f.L, [pts, out] = fishPoints(f, t), c = f.kind.body, hw = L * .135;
    ctx.globalAlpha = .7 + .28 * (1 - f.z);
    // Pectoral fins, then the tail, under the body.
    const p2 = pts[2], fwd = Math.atan2(p2[3], p2[2]);
    ctx.fillStyle = rgb(c, .5);
    for (const side of [-1, 1]) {
      const fa = fwd + side * (2.25 + .22 * Math.sin(t * 1.4 + f.ph + side)), cx = p2[0] + Math.cos(fa) * L * .09, cy = p2[1] + Math.sin(fa) * L * .09;
      ctx.beginPath(); ctx.ellipse(cx, cy, L * .085, L * .036, fa, 0, TAU); ctx.fill();
    }
    const pn = pts[N], bx = -pn[2], by = -pn[3], nx = -pn[3], ny = pn[2];
    ctx.fillStyle = rgb(c, .45); ctx.beginPath(); ctx.moveTo(pn[0] + nx * L * .03, pn[1] + ny * L * .03);
    ctx.quadraticCurveTo(pn[0] + bx * L * .1 + nx * L * .05, pn[1] + by * L * .1 + ny * L * .05, pn[0] + bx * L * .21 + nx * L * .11, pn[1] + by * L * .21 + ny * L * .11);
    ctx.lineTo(pn[0] + bx * L * .13, pn[1] + by * L * .13);
    ctx.lineTo(pn[0] + bx * L * .21 - nx * L * .11, pn[1] + by * L * .21 - ny * L * .11);
    ctx.quadraticCurveTo(pn[0] + bx * L * .1 - nx * L * .05, pn[1] + by * L * .1 - ny * L * .05, pn[0] - nx * L * .03, pn[1] - ny * L * .03);
    ctx.fill();
    smoothClosed(ctx, out);
    ctx.fillStyle = rgb(c); ctx.fill();
    ctx.save(); ctx.clip();
    const at = (u, o) => { const k = Math.min(N, Math.round(u * N)), p = pts[k], w = KOI_W[k] * hw; return [p[0] - p[3] * w * o, p[1] + p[2] * w * o, Math.atan2(p[3], p[2])]; };
    if (f.kind.spots) { ctx.fillStyle = rgb(f.kind.spots); for (const s of f.patches) { const [x, y, an] = at(s.u, s.o); ctx.beginPath(); ctx.ellipse(x, y, s.r * L * 1.5, s.r * L, an, 0, TAU); ctx.fill(); } }
    if (f.kind.ink) { ctx.fillStyle = 'rgba(26,24,28,.9)'; for (const s of f.ink) { const [x, y, an] = at(s.u, s.o); ctx.beginPath(); ctx.ellipse(x, y, s.r * L * 1.6, s.r * L, an, 0, TAU); ctx.fill(); } }
    ctx.lineWidth = L * .06; ctx.strokeStyle = 'rgba(40,20,10,.28)'; ctx.stroke();
    ctx.lineCap = 'round'; ctx.strokeStyle = f.kind.sheen ? 'rgba(255,250,215,.4)' : 'rgba(255,255,255,.16)'; ctx.lineWidth = L * .045;
    ctx.beginPath(); for (let k = 1; k < N - 2; k++) k === 1 ? ctx.moveTo(pts[k][0], pts[k][1]) : ctx.lineTo(pts[k][0], pts[k][1]); ctx.stroke();
    ctx.restore();
    const p0 = pts[0], ew = KOI_W[0] * hw * .75;
    ctx.fillStyle = 'rgba(20,16,14,.75)';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(p0[0] + p0[2] * hw * .1 - p0[3] * ew * sd, p0[1] + p0[3] * hw * .1 + p0[2] * ew * sd, Math.max(.8, L * .008), 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  function steer(f, t, dt) {
    const k = lively ? 1.6 : 1;
    let turn = Math.sin(t * f.f1 + f.p1) * .45 + Math.sin(t * f.f2 + f.p2) * .35;
    const m = f.L * .9, edge = Math.max(0, m - f.x, f.x - (W - m), m - f.y, f.y - (H - m)) / m;
    if (edge > 0) { let d = Math.atan2(H / 2 - f.y, W / 2 - f.x) - f.a; d = Math.atan2(Math.sin(d), Math.cos(d)); turn += d * Math.min(2, edge) * 2; }
    f.a += turn * dt * k * .4;
    const v = f.L * (.2 + .09 * Math.sin(t * .13 + f.ph)) * k, h = f.a + Math.sin(t * f.wf + f.ph) * .1;
    f.x += Math.cos(h) * v * dt; f.y += Math.sin(h) * v * dt;
    const sp = f.spine, seg = f.L / N; sp[0][0] = f.x; sp[0][1] = f.y;
    for (let i = 1; i <= N; i++) { const p = sp[i], q = sp[i - 1], dx = p[0] - q[0], dy = p[1] - q[1], l = Math.hypot(dx, dy) || 1; p[0] = q[0] + dx / l * seg; p[1] = q[1] + dy / l * seg; }
  }
  return {
    init() {
      const s = S(); let g;
      [water, g] = layer(W, H);
      const rg = g.createRadialGradient(W * .45, H * .4, 0, W * .5, H * .5, Math.hypot(W, H) * .6);
      rg.addColorStop(0, '#16342c'); rg.addColorStop(.55, '#0c211c'); rg.addColorStop(1, '#040c0a');
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 240; i++) {
        g.fillStyle = Math.random() < .55 ? 'rgba(0,0,0,.09)' : 'rgba(90,120,95,.045)';
        g.beginPath(); g.ellipse(rand(0, W), rand(0, H), s * rand(.006, .05), s * rand(.006, .035), rand(0, 3), 0, TAU); g.fill();
      }
      glow(g, W * .3, H * .22, s * .7, [130, 170, 160], .07);
      [top, g] = layer(W, H);
      const clusters = [[rand(.05, .3), rand(.05, .3)], [rand(.7, .95), rand(.6, .95)], [rand(.6, .95), rand(.05, .25)]];
      let n = 0;
      for (const [cx, cy] of clusters) for (let k = 0; k < (n === 2 ? 2 : 3); k++, n++) lilyPad(g, W * cx + rand(-1, 1) * s * .1, H * cy + rand(-1, 1) * s * .1, s * rand(.045, .08), rand(0, TAU), k === 0 && n !== 3);
      const vg = g.createRadialGradient(W / 2, H / 2, s * .3, W / 2, H / 2, Math.hypot(W, H) * .6);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      fish = Array.from({ length: lowPower ? 6 : 8 }, (_, i) => makeFish(i)).sort((a, b) => b.z - a.z);
      petals = Array.from({ length: 9 }, () => ({ x: rand(0, W), y: rand(0, H), a: rand(0, TAU), va: rand(-.15, .15), vx: rand(2, 6) * s / 800, vy: rand(-2, 2) * s / 800, r: s * rand(.007, .011) }));
      rings = []; glint = blob(64, [190, 220, 210]);
    },
    draw(t, dt) {
      const s = S();
      ctx.drawImage(water, 0, 0, W, H);
      for (const f of fish) steer(f, t, dt);
      // Shadows on the bed, offset as if the light came from the upper left.
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      for (const f of fish) { const [, out] = fishPoints(f, t), o = f.L * (.05 + .05 * (1 - f.z)); ctx.save(); ctx.translate(o, o * 1.3); smoothClosed(ctx, out); ctx.fill(); ctx.restore(); }
      for (const f of fish) drawFish(f, t);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const x = W * (.25 + .25 * i) + Math.sin(t * .05 + i * 2) * W * .15, y = H * (.3 + .2 * i) + Math.cos(t * .04 + i) * H * .12, r = s * (.35 + .1 * i);
        ctx.globalAlpha = .05 + .02 * Math.sin(t * .3 + i); ctx.drawImage(glint, x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(top, 0, 0, W, H);
      for (const p of petals) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
        if (p.x > W + 20) p.x = -20; if (p.x < -20) p.x = W + 20; if (p.y > H + 20) p.y = -20; if (p.y < -20) p.y = H + 20;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(p.r * .5, p.r * .7, p.r, p.r * .7, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f6c6d2'; ctx.beginPath(); ctx.moveTo(-p.r, 0); ctx.quadraticCurveTo(0, -p.r * 1.1, p.r, -p.r * .25); ctx.lineTo(p.r * .7, 0); ctx.lineTo(p.r, p.r * .25); ctx.quadraticCurveTo(0, p.r * 1.1, -p.r, 0); ctx.fill();
        ctx.restore();
      }
      if (weather > .4 && Math.random() < dt * (weather - .4) / .6 * (lowPower ? 7 : 14)) rings.push({ x: rand(0, W), y: rand(0, H), life: 0, r: s * rand(.04, .07) });
      ctx.lineWidth = 1;
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]; r.life += dt / 2.6;
        if (r.life >= 1) { rings.splice(i, 1); continue; }
        const a = (1 - r.life) * .35, rad = r.r * Math.sqrt(r.life);
        ctx.strokeStyle = `rgba(210,235,225,${a})`; ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.stroke();
        if (r.life > .2) { ctx.strokeStyle = `rgba(210,235,225,${a * .5})`; ctx.beginPath(); ctx.arc(r.x, r.y, rad * .6, 0, TAU); ctx.stroke(); }
      }
    }
  };
}

/* Zen Garden: raked gravel flowing around mossy stones, re-raked one slow sweep at a time */
export function zenScene() {
  let stones, sp, sc, bw, bh, cur, next, flat, top, shadow, job, sweep, wait, variant;
  const SAND = [218, 210, 192];
  function field(x, y, vt) {
    for (const s of stones) {
      const d = Math.hypot(x - s.x, y - s.y), R = s.r + sp * (s.n + (vt === 1 ? 1 : 0) + .5);
      if (d < R) return (d - s.r) / sp;
    }
    if (vt === 1) return (y * .94 + x * .34) / sp;
    if (vt === 2) return (y + Math.sin(x / (sp * 8)) * sp * 1.4) / sp;
    return y / sp;
  }
  // Fills a job's pixels a few rows at a time so a new pattern never stalls a frame.
  function work(j, ms) {
    const t0 = performance.now(), d = j.img.data, k = 2.2 / sp;
    while (j.y < bh && performance.now() - t0 < ms) {
      const y = j.y++, cy = y / sc;
      for (let x = 0; x < bw; x++) {
        const cx = x / sc, i = (y * bw + x) * 4;
        let b;
        if (j.vt < 0) b = .96;
        else {
          const v0 = field(cx, cy, j.vt), v1 = field(cx - 1.2, cy - 1.2, j.vt), h0 = Math.cos(v0 * TAU), h1 = Math.cos(v1 * TAU);
          b = .95 + clamp((h0 - h1) / (TAU * k), -1, 1) * .13 - (1 - h0) * .035;
        }
        b += (hash(x, y) - .5) * .09;
        d[i] = SAND[0] * b; d[i + 1] = SAND[1] * b; d[i + 2] = SAND[2] * b; d[i + 3] = 255;
      }
    }
    return j.y >= bh;
  }
  function start(vt, reuse) {
    const [cv, g] = reuse ? [reuse, reuse.getContext('2d')] : plain(bw, bh);
    return { vt, cv, g, img: g.createImageData(bw, bh), y: 0 };
  }
  function finish(j) { j.g.putImageData(j.img, 0, 0); return j.cv; }
  function stone(g, s) {
    const pts = []; const n = 14, seed = rand(0, 100);
    for (let k = 0; k < n; k++) { const an = k / n * TAU, rr = s.r * (.82 + .16 * hash(k, seed)) * (1 + .12 * Math.cos(an * 2 + seed)); pts.push([s.x + Math.cos(an) * rr * s.ex, s.y + Math.sin(an) * rr]); }
    g.save(); g.shadowColor = 'rgba(40,30,20,.55)'; g.shadowBlur = s.r * .5; g.shadowOffsetX = s.r * .22; g.shadowOffsetY = s.r * .3;
    g.fillStyle = '#2c2a26'; smoothClosed(g, pts); g.fill(); g.restore();
    for (let i = 0; i < 26; i++) { const an = i / 26 * TAU; glow(g, s.x + Math.cos(an) * s.r * 1.02 * s.ex, s.y + Math.sin(an) * s.r * 1.02, s.r * rand(.14, .24), [58, 84, 36], .5); }
    for (let i = 0; i < 420; i++) {   // moss creeping out over the gravel at the stone's foot
      const an = rand(0, TAU), rr = s.r * (.9 + Math.pow(Math.random(), 2.5) * .3);
      g.fillStyle = rgb(mix([44, 70, 30], [116, 140, 60], Math.random()), rand(.3, .8));
      g.beginPath(); g.arc(s.x + Math.cos(an) * rr * s.ex, s.y + Math.sin(an) * rr, s.r * rand(.012, .035), 0, TAU); g.fill();
    }
    const sg = g.createRadialGradient(s.x - s.r * .35, s.y - s.r * .4, s.r * .05, s.x, s.y, s.r * 1.05);
    sg.addColorStop(0, rgb(s.tone.map(v => v + 40))); sg.addColorStop(.6, rgb(s.tone)); sg.addColorStop(1, rgb(s.tone.map(v => v * .45)));
    g.fillStyle = sg; smoothClosed(g, pts); g.fill();
    g.save(); g.clip();
    for (let i = 0; i < 70; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,240,.08)'; g.beginPath(); g.arc(s.x + rand(-s.r, s.r), s.y + rand(-s.r, s.r), s.r * rand(.01, .05), 0, TAU); g.fill(); }
    for (let i = 0; i < 90; i++) { const an = rand(Math.PI * .9, Math.PI * 1.7), rr = s.r * rand(.5, .95); g.fillStyle = rgb(mix([60, 90, 38], [130, 150, 70], Math.random()), .7); g.beginPath(); g.arc(s.x + Math.cos(an) * rr * s.ex, s.y + Math.sin(an) * rr, s.r * rand(.02, .05), 0, TAU); g.fill(); }
    g.restore();
  }
  return {
    init() {
      const s = S(); sp = s * .024; sc = Math.min(1, Math.max(.5, 9 / sp)); bw = Math.ceil(W * sc); bh = Math.ceil(H * sc);
      stones = [];
      const want = W * H > 600000 ? 5 : 4;
      for (let tries = 0; stones.length < want && tries < 400; tries++) {
        const r = s * rand(.055, .1), x = rand(W * .14, W * .86), y = rand(H * .14, H * .86), n = 3 + Math.floor(rand(0, 3));
        if (stones.every(o => Math.hypot(o.x - x, o.y - y) > o.r + r + sp * (o.n + n + 3))) stones.push({ x, y, r, n, ex: rand(1, 1.35), tone: [rand(84, 104), rand(82, 98), rand(78, 92)].map(Math.round) });
      }
      variant = 0;
      const j0 = start(0); work(j0, 1e9); cur = finish(j0);
      const jf = start(-1); work(jf, 1e9); flat = finish(jf);
      job = start(1); next = null; sweep = -1; wait = 25;
      let g; [top, g] = layer(W, H);
      for (const st of stones) stone(g, st);
      const lg = g.createLinearGradient(0, 0, W, H);
      lg.addColorStop(0, 'rgba(255,236,200,.14)'); lg.addColorStop(.5, 'rgba(255,236,200,0)'); lg.addColorStop(1, 'rgba(30,24,16,.22)');
      g.fillStyle = lg; g.fillRect(0, 0, W, H);
      const vg = g.createRadialGradient(W / 2, H / 2, s * .35, W / 2, H / 2, Math.hypot(W, H) * .62);
      vg.addColorStop(0, 'rgba(20,16,10,0)'); vg.addColorStop(1, 'rgba(20,16,10,.38)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      shadow = blob(64, [24, 30, 18]);
    },
    draw(t, dt) {
      const s = S();
      if (job && work(job, 4)) { next = finish(job); job = null; }
      if (!job && next && sweep < 0 && (wait -= dt) <= 0) sweep = 0;
      ctx.drawImage(cur, 0, 0, W, H);
      if (sweep >= 0) {
        sweep += dt / 120 * (lively ? 2 : 1);
        const band = sp * 3, x = -band + (W + band) * Math.min(1, sweep);
        if (x > 0) ctx.drawImage(next, 0, 0, Math.min(bw, x * sc), bh, 0, 0, Math.min(W, x), H);
        const fx = Math.max(0, x), fw = Math.min(W, x + band) - fx;
        if (fw > 0) ctx.drawImage(flat, fx * sc, 0, fw * sc, bh, fx, 0, fw, H);
        const eg = ctx.createLinearGradient(x - sp, 0, x + sp * .6, 0);
        eg.addColorStop(0, 'rgba(60,45,30,0)'); eg.addColorStop(.7, 'rgba(60,45,30,.12)'); eg.addColorStop(1, 'rgba(255,245,225,.1)');
        ctx.fillStyle = eg; ctx.fillRect(x - sp, 0, sp * 1.6, H);
        if (sweep >= 1) { const old = cur; cur = next; next = null; sweep = -1; wait = 40; variant = (variant + 1) % 3; job = start((variant + 1) % 3, old); }
      }
      ctx.drawImage(top, 0, 0, W, H);
      // The shade of a tree just out of view, moving a little in the air.
      ctx.globalAlpha = .13;
      for (let i = 0; i < 5; i++) {
        const r = s * (.22 + .06 * i), x = W - s * .05 + Math.sin(t * .11 + i * 1.7) * s * .03 - i * s * .08, y = -s * .04 + Math.cos(t * .09 + i) * s * .03 + (i % 2) * s * .1;
        ctx.drawImage(shadow, x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }
  };
}

/* Desert Night: dunes under a huge moon, sand smoking off the crests, a caravan's lanterns crossing a far ridge */
export function desertScene() {
  let sky, far, near, prof, crests, grains, cx, tw, lamp;
  const NL = 5;
  function ridge(p) { const f = p - Math.floor(p), c = .74; if (f < c) { const u = f / c; return u * u * (3 - 2 * u) * .85 + u * .15; } return Math.pow((1 - f) / (1 - c), 1.5); }
  function dune(l) {
    const s = S(), base = H * [.6, .645, .7, .78, .88][l], amp = s * [.05, .075, .11, .16, .22][l], lam = s * [.38, .5, .66, .85, 1.1][l] * (W > H ? 1.25 : 1);
    const p1 = rand(0, 1), p2 = rand(0, TAU), p3 = rand(0, TAU), y = new Float32Array(Math.ceil(W) + 2);
    for (let x = 0; x < y.length; x++) {
      const u = x / lam, A = .62 + .38 * Math.sin(u * 1.3 + p3);
      y[x] = base - amp * (A * ridge(u + p1) * .8 + .2 * (.5 + .5 * Math.sin(u * 2.1 + p2)));
    }
    return y;
  }
  // Dunes painted pixel by pixel at init. Each crest's shadow edge leans as it comes toward us, as real crest lines do.
  function paintDunes(l0, l1) {
    const sc = W * H > 500000 ? .75 : 1, bw = Math.ceil(W * sc), bh = Math.ceil(H * sc), [c, g] = plain(bw, bh), im = g.createImageData(bw, bh), d = im.data;
    const L = prof.map((_, l) => { const p = l / (NL - 1); return { lit: mix([96, 100, 140], [184, 164, 160], p), shade: mix([44, 46, 80], [36, 30, 50], p), amp: S() * [.05, .075, .11, .16, .22][l], lam: S() * [.38, .5, .66, .85, 1.1][l], haze: .4 * (1 - p) }; });
    const sl = (y, x) => (y[clamp(x + 3, 0, y.length - 1)] - y[clamp(x - 3, 0, y.length - 1)]) / 6, sm = (a, b, v) => { const u = clamp((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
    const col = (l, X, Y, px, py) => {
      const y = prof[l], o = L[l], dy = Y - y[X], xs = clamp(Math.round(X - dy * 1.3 * Math.sin(X / o.lam * 1.9 + l * 1.7)), 0, W), s0 = sl(y, xs);
      const k = clamp(.66 - s0 * 1.6, 0, 1) * (1 - .7 * sm(.015, .1, s0)), f = clamp(dy / (o.amp * 1.8), 0, 1) * .55, n = 1 + (hash(px, py) - .5) * .05;
      return [0, 1, 2].map(ch => { let v = o.shade[ch] + (o.lit[ch] - o.shade[ch]) * k; v += (o.shade[ch] - v) * f; v += ([60, 62, 100][ch] - v) * o.haze; return v * n; });
    };
    for (let py = 0; py < bh; py++) {
      const Y = py / sc;
      for (let px = 0; px < bw; px++) {
        const X = Math.min(W, Math.round(px / sc));
        let l = l1; while (l >= l0 && Y < prof[l][X]) l--;
        if (l < l0) continue;
        const cc = col(l, X, Y, px, py), i = (py * bw + px) * 4, cov = clamp((Y - prof[l][X]) * sc + .5, 0, 1);
        let back = null, m = l - 1; if (cov < 1) { while (m >= l0 && Y < prof[m][X]) m--; if (m >= l0) back = col(m, X, Y, px, py); }
        for (let ch = 0; ch < 3; ch++) d[i + ch] = back ? back[ch] + (cc[ch] - back[ch]) * cov : cc[ch];
        d[i + 3] = back ? 255 : 255 * cov;
      }
    }
    g.putImageData(im, 0, 0);
    return c;
  }
  return {
    init() {
      const s = S(); let g;
      [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, H * .75);
      gr.addColorStop(0, '#04050f'); gr.addColorStop(.55, '#0d1030'); gr.addColorStop(.85, '#252548'); gr.addColorStop(1, '#3a3456');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      stars(g, Math.round(W * H / 2400), H * .7);
      // The Milky Way, a faint diagonal band.
      g.save(); g.translate(W * .6, H * .3); g.rotate(-.55);
      for (let i = 0; i < 26; i++) glow(g, rand(-W, W), rand(-1, 1) * s * .06, s * rand(.08, .18), [150, 150, 200], .05);
      for (let i = 0; i < (lowPower ? 300 : 900); i++) { g.fillStyle = `rgba(230,232,255,${rand(.1, .6)})`; g.fillRect(rand(-W, W), (Math.random() + Math.random() - 1) * s * .09, rand(.4, 1.1), rand(.4, 1.1)); }
      g.restore();
      const mx = W * (W > H ? .27 : .32), my = H * (W > H ? .2 : .17), mr = s * .1;
      glow(g, mx, my, mr * 8, [120, 130, 190], .22); glow(g, mx, my, mr * 2.4, [220, 225, 240], .22);
      const mg = g.createRadialGradient(mx - mr * .3, my - mr * .3, 0, mx, my, mr);
      mg.addColorStop(0, '#fbf8ec'); mg.addColorStop(.85, '#e6e2d2'); mg.addColorStop(1, '#cfcbbd');
      g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.clip();
      for (const [dx, dy, r, a] of [[-.3, -.2, .32, .16], [.25, .15, .25, .14], [-.05, .4, .2, .12], [.4, -.35, .15, .1], [-.45, .3, .12, .1], [.1, -.05, .1, .1]]) glow(g, mx + dx * mr, my + dy * mr, r * mr * 1.4, [150, 148, 140], a * 2.2);
      g.restore();
      prof = Array.from({ length: NL }, (_, l) => dune(l));
      far = paintDunes(0, 1); near = paintDunes(2, NL - 1);
      crests = [];
      for (let l = 2; l < NL; l++) {
        const y = prof[l];
        for (let x = 4; x < W - 4; x++) if (y[x] <= y[x - 4] && y[x] < y[x + 4] && y[x] <= y[x - 1] && y[x] <= y[x + 1]) {
          let seen = true; for (let m = l + 1; m < NL; m++) if (prof[m][x] < y[x] + 2) seen = false;
          if (seen) crests.push({ x, l });
        }
      }
      grains = [];
      cx = rand(0, W);
      tw = Array.from({ length: 40 }, () => ({ x: rand(0, W), y: rand(0, H * .55), r: rand(.8, 1.5), ph: rand(0, TAU), f: rand(.3, .9) }));
      lamp = blob(32, [255, 176, 90]);
    },
    draw(t, dt) {
      const s = S();
      ctx.drawImage(sky, 0, 0, W, H);
      for (const st of tw) { ctx.fillStyle = `rgba(240,240,255,${.35 + .35 * Math.sin(t * st.f + st.ph)})`; ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, TAU); ctx.fill(); }
      ctx.drawImage(far, 0, 0, W, H);
      // The caravan: a line of camels on the far ridge, every other one carrying a lantern.
      const gap = s * .036, h = s * .022, y1 = prof[1];
      cx += dt * W / 420 * (lively ? 2 : 1); if (cx - gap * 7 > W + 20) cx = -20;
      for (let k = 0; k < 7; k++) {
        const x = cx - k * gap; if (x < -10 || x > W + 10) continue;
        const gy = y1[clamp(Math.round(x), 0, y1.length - 1)] + h * .05, step = Math.sin(t * 1.6 + k * 1.3) * h * .12;
        ctx.fillStyle = '#0b0b1a'; ctx.strokeStyle = '#0b0b1a'; ctx.lineWidth = Math.max(.8, h * .09);
        ctx.beginPath(); ctx.ellipse(x, gy - h * .6, h * .42, h * .2, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x - h * .04, gy - h * .76, h * .2, h * .16, 0, 0, TAU); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + h * .35, gy - h * .65); ctx.quadraticCurveTo(x + h * .55, gy - h * .7, x + h * .58, gy - h * .98); ctx.lineTo(x + h * .74, gy - h * .96);
        for (const [lx, sg] of [[-.3, 1], [-.2, -1], [.24, -1], [.33, 1]]) { ctx.moveTo(x + h * lx, gy - h * .55); ctx.lineTo(x + h * lx + step * sg, gy); }
        ctx.stroke();
        if (k % 2 === 0) {
          const lx = x + h * .1, ly = gy - h * 1.05, a = .55 + .1 * Math.sin(t * 2.3 + k * 2);
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.drawImage(lamp, lx - h * 1.5, ly - h * 1.5, h * 3, h * 3); ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(255,225,160,.95)'; ctx.fillRect(lx - .8, ly - .8, 1.6, 1.6); ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.drawImage(near, 0, 0, W, H);
      // Sand lifted off the crests and carried down the slip faces.
      const rate = (lowPower ? 25 : 60) * (.25 + weather);
      if (crests.length) for (let n = Math.floor(rate * dt + Math.random()); n > 0; n--) {
        const c = crests[Math.floor(Math.random() * crests.length)], x = c.x + rand(-s * .012, s * .004), sc = .6 + .25 * (c.l - 2);
        grains.push({ x, y: prof[c.l][clamp(Math.round(x), 0, W)] - 1, vx: s * rand(.03, .06) * (.6 + weather) * sc, vy: -s * rand(.002, .012) * sc, life: 0, max: rand(1.4, 3.2), sc });
      }
      ctx.lineWidth = 1; ctx.lineCap = 'round';
      for (let i = grains.length - 1; i >= 0; i--) {
        const p = grains[i]; p.life += dt;
        if (p.life >= p.max || p.x > W + 20) { grains.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += s * .006 * dt;
        const a = Math.sin(Math.PI * p.life / p.max) * (.2 + .2 * weather);
        ctx.strokeStyle = `rgba(205,200,220,${a})`; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .12, p.y - p.vy * .12); ctx.stroke();
      }
    }
  };
}

/* Bamboo Forest: stalks in four depths swaying as gusts roll through, light flickering down through the leaves */
const BAMBOO = [
  { gap: .07, w: .011, col: [154, 176, 142], hi: [190, 208, 172], lo: [130, 150, 120], leaf: [[140, 166, 124], [160, 184, 140]], size: .07, amp: .5 },
  { gap: .1, w: .019, col: [108, 140, 92], hi: [160, 190, 120], lo: [78, 104, 66], leaf: [[90, 126, 70], [120, 156, 90]], size: .1, amp: .7 },
  { gap: .15, w: .032, col: [64, 104, 52], hi: [140, 180, 90], lo: [36, 62, 30], leaf: [[52, 92, 40], [86, 130, 60]], size: .15, amp: .95 },
  { gap: .27, w: .058, col: [36, 66, 30], hi: [110, 150, 64], lo: [16, 32, 14], leaf: [[30, 58, 24], [56, 92, 40]], size: .24, amp: 1.25 },
];
export function bambooScene() {
  let back, mist, shafts, ground, stalks, sprites, flat;
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
  let sky, mid, near, wins, figure, nextFig, smoke, puff, drops, flue;
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
    g.save(); g.clip(roof); g.strokeStyle = 'rgba(160,175,200,.12)'; g.lineWidth = 1;
    for (let x = x0; x < x0 + w; x += u * .14) { g.beginPath(); g.moveTo(x, eave); g.lineTo(x + (x - x0 - w / 2) * -.12, top); g.stroke(); }
    g.restore();
    const nd = Math.max(1, Math.floor(w / (u * 1.2)));
    for (let k = 0; k < nd; k++) {   // dormers
      const dx = x0 + w * (k + .5) / nd, dw = u * .42, dy = top + u * .35, dh = u * .62;
      g.fillStyle = rgb(face.map(v => v * 1.15)); g.fillRect(dx - dw / 2, dy, dw, dh);
      g.fillStyle = rgb(zinc.map(v => v * 1.1)); g.beginPath(); g.moveTo(dx - dw * .62, dy + 1); g.quadraticCurveTo(dx, dy - dw * .55, dx + dw * .62, dy + 1); g.fill();
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
      fig(true);
      if (flue.near) puffs();
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
  let sky, boats, gulls, built = 0, hy, lh;
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
      [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, hy);
      for (const [p, n, k, y] of [[0, [4, 6, 18], [40, 46, 96], [90, 150, 220]], [.6, [12, 16, 36], [170, 120, 140], [170, 205, 235]], [1, [24, 26, 46], [252, 176, 120], [222, 232, 238]]]) gr.addColorStop(p, rgb(skyMix(n, k, y, d)));
      g.fillStyle = gr; g.fillRect(0, 0, W, hy + 1);
      if (d < .5) { g.globalAlpha = 1 - d * 2; stars(g, Math.round(W * H / 3000), hy * .8); g.globalAlpha = 1; }
      const sunX = W * .62, sunA = 1 - Math.abs(d - .5) * 2;
      if (d > .15) { glow(g, sunX, hy, W * .6, skyMix([0, 0, 0], [255, 170, 110], [255, 240, 210], d), .45 * Math.max(sunA, .3)); glow(g, sunX, hy - H * .02, s * .05, skyMix([0, 0, 0], [255, 220, 170], [255, 250, 235], d), .9 * sunA); }
      else { glow(g, W * .25, H * .18, s * .25, [180, 190, 230], .2); g.fillStyle = '#e8e6d8'; g.beginPath(); g.arc(W * .25, H * .18, s * .025, 0, TAU); g.fill(); }
      // Far hills behind the harbour.
      g.fillStyle = rgb(skyMix([10, 12, 24], [90, 70, 96], [120, 140, 160], d));
      g.beginPath(); g.moveTo(0, hy); for (let x = 0; x <= W * .55; x += 6) g.lineTo(x, hy - H * .06 * Math.pow(1 - x / (W * .55), .7) * (.8 + .2 * Math.sin(x * .02))); g.lineTo(W * .55, hy); g.fill();
      const sea = g.createLinearGradient(0, hy, 0, H);
      sea.addColorStop(0, rgb(skyMix([20, 22, 42], [200, 140, 120], [170, 200, 220], d))); sea.addColorStop(.3, rgb(skyMix([10, 14, 30], [70, 60, 90], [70, 120, 150], d))); sea.addColorStop(1, rgb(skyMix([3, 5, 12], [20, 22, 40], [30, 66, 90], d)));
      g.fillStyle = sea; g.fillRect(0, hy, W, H - hy);
      if (d > .15) { g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 60; i++) { const y = hy + Math.pow(Math.random(), 1.6) * (H - hy) * .7, sp = (y - hy) / (H - hy); g.fillStyle = rgb(skyMix([0, 0, 0], [255, 180, 120], [255, 245, 220], d), .25 * sunA + .05); g.fillRect(sunX + rand(-1, 1) * s * (.03 + .2 * sp), y, s * rand(.01, .05) * (.4 + sp), 1.2); } g.globalCompositeOperation = 'source-over'; }
      // The breakwater and its lighthouse.
      const bx0 = W * .46, by = hy + H * .018, stone = skyMix([14, 14, 22], [70, 56, 70], [120, 118, 112], d);
      g.fillStyle = rgb(stone); g.beginPath(); g.moveTo(bx0, by + H * .01); g.lineTo(bx0 + s * .02, by - H * .008); g.lineTo(W * .92, by - H * .008); g.lineTo(W * .93, by + H * .01); g.fill();
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(bx0, by + H * .004, W * .93 - bx0, H * .006);
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
    }
  };
  return api;
}

/* Firefly Meadow: tall grass against a fading dusk, fireflies blinking in slow waves that drift into step */
export function firefliesScene() {
  let sky, warm, starL, grass, ff, spark, K = 0, clock = 0;
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
      grass = [grass, grassLayer(H * .9, H * .32, [22, 28, 40], W / 2, false), grassLayer(H * .95, H * .42, [13, 17, 24], W / 3, true), grassLayer(H, H * .5, [5, 7, 10], W / 9, true)];
      const n = lowPower ? 150 : 320;
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
      flies(.35, .75); sway(grass[2], 1, 1.3);
      flies(.75, 1.01); sway(grass[3], 1.3, 2.4);
    }
  };
}

/* Volcano Island: an island across dark water glowing at the summit, lava ribbons down one flank, steam where it meets the sea */
export function volcanoScene() {
  let sky, island, refl, flows, plume, steam, ash, hot, steamS, hy, top;
  return {
    init() {
      const s = S(); hy = H * .62; let g;
      const cx = W * (W > H ? .48 : .5), half = W > H ? Math.min(W * .42, s * .95) : W * .62, peak = W > H ? Math.min(H * .25, s * .36) : s * .5;
      const prof = x => { const u = Math.abs(x - cx) / half; if (u >= 1) return hy; const crater = u < .07 ? (1 - u / .07) * peak * .05 : 0; return hy - peak * Math.pow(1 - u, 1.7) * (1 + .03 * Math.sin(x * .05)) + crater + peak * .1 * Math.max(0, 1 - Math.abs((x - cx + half * .55) / (half * .2))) * -1; };
      top = { x: cx, y: prof(cx) };
      [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, hy);
      gr.addColorStop(0, '#03040b'); gr.addColorStop(.7, '#0e0d1c'); gr.addColorStop(1, '#2a1620');
      g.fillStyle = gr; g.fillRect(0, 0, W, hy + 1);
      stars(g, Math.round(W * H / 2600), hy * .9);
      glow(g, top.x, top.y, s * .7, [190, 70, 30], .22);
      const sea = g.createLinearGradient(0, hy, 0, H); sea.addColorStop(0, '#120a10'); sea.addColorStop(1, '#020206');
      g.fillStyle = sea; g.fillRect(0, hy, W, H - hy);
      [island, g] = layer(W, H);
      const shape = new Path2D(); shape.moveTo(cx - half - 2, hy + 1);
      for (let x = cx - half; x <= cx + half; x += 3) shape.lineTo(x, prof(x));
      shape.lineTo(cx + half + 2, hy + 1); shape.closePath();
      g.fillStyle = '#0b080b'; g.fill(shape);
      g.save(); g.clip(shape); g.globalCompositeOperation = 'lighter';
      glow(g, top.x, top.y, peak * .9, [170, 50, 20], .35);
      g.globalCompositeOperation = 'source-over'; g.lineCap = 'round';
      for (let i = 0; i < 26; i++) {   // ridges and gullies running down from the summit
        const side = i % 2 ? 1 : -1, u = rand(.05, .95), x1 = cx + side * half * u, x0 = top.x + side * half * .04 * rand(0, 1);
        g.strokeStyle = Math.random() < .5 ? 'rgba(90,40,30,.18)' : 'rgba(0,0,0,.35)'; g.lineWidth = rand(.6, 1.6);
        g.beginPath(); g.moveTo(x0, top.y + 2); g.quadraticCurveTo((x0 + x1) / 2 + rand(-1, 1) * s * .02, (top.y + hy) / 2, x1, hy); g.stroke();
      }
      g.restore();
      [refl, g] = layer(W, H);   // the island upside down in the water, faint
      g.save(); g.translate(0, hy * 2); g.scale(1, -1); g.globalAlpha = .7; g.fillStyle = '#050307'; g.fill(shape); g.restore();
      // Lava ribbons: from the crater down the right flank to the sea.
      flows = [];
      for (let i = 0; i < 3; i++) {
        const end = cx + half * (.12 + .26 * i + rand(-.04, .04)), x0 = top.x + half * .025 * (i - .6), p = new Path2D(), ph = rand(0, TAU), pts = [];
        for (let k = 0; k <= 30; k++) {
          const u = k / 30, x = x0 + (end - x0) * Math.pow(u, .9) + Math.sin(u * 8 + ph) * s * .018 * u, w = .08 * Math.min(1, u * 6) + .92 * Math.pow(u, 2.2);
          pts.push([x, Math.min(hy - 1, prof(x) + s * .006 + (hy - prof(x)) * w)]);
        }
        pts.forEach(([x, y], k) => k ? p.lineTo(x, y) : p.moveTo(x, y));
        flows.push({ p, end: pts[pts.length - 1], ph: rand(0, TAU) });
      }
      hot = blob(48, [255, 120, 40]); steamS = blob(48, [205, 196, 196]); ash = blob(48, [70, 60, 66]);
      plume = []; steam = [];
    },
    draw(t, dt) {
      const s = S(), pulse = .85 + .15 * Math.sin(t * .23) * Math.sin(t * .37 + 1);
      ctx.drawImage(sky, 0, 0, W, H);
      // The plume rises from the crater and leans away on the wind, lit orange from below.
      if (Math.random() < dt * (lowPower ? 2 : 4)) plume.push({ x: top.x + rand(-1, 1) * s * .01, y: top.y, life: 0, max: rand(12, 18) });
      for (let i = plume.length - 1; i >= 0; i--) {
        const p = plume[i]; p.life += dt; if (p.life >= p.max) { plume.splice(i, 1); continue; }
        const k = p.life / p.max; p.y -= s * .03 * dt * (1 - k * .6); p.x += s * (.008 + .03 * k) * dt * (.6 + weather);
        const r = s * (.03 + .18 * k), a = Math.min(1, p.life) * (1 - k);
        ctx.globalAlpha = .35 * a; ctx.drawImage(ash, p.x - r, p.y - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .2 * a * Math.max(0, 1 - k * 3) * pulse; ctx.drawImage(hot, p.x - r, p.y - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
      ripples(hy, t, [120, 70, 70], .06, 28);
      ctx.drawImage(refl, 0, 0, W, H);
      ctx.drawImage(island, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, top.x, top.y, s * .07 * pulse, [255, 120, 40], .55 * pulse);
      glow(ctx, top.x, top.y + s * .004, s * .02, [255, 210, 140], .7 * pulse);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const f of flows) {
        const fp = .8 + .2 * Math.sin(t * .3 + f.ph);
        ctx.strokeStyle = `rgba(255,70,20,${.14 * fp})`; ctx.lineWidth = s * .03; ctx.stroke(f.p);
        ctx.strokeStyle = `rgba(255,110,40,${.5 * fp})`; ctx.lineWidth = s * .009; ctx.stroke(f.p);
        ctx.setLineDash([s * .006, s * .022]); ctx.lineDashOffset = -t * s * .01 * (lively ? 2 : 1);
        ctx.strokeStyle = `rgba(255,220,150,${.45 * fp})`; ctx.lineWidth = s * .003; ctx.stroke(f.p);
        ctx.setLineDash([]);
        // Its glow and the summit's, drawn down into the water as broken streaks.
        const [ex] = f.end;
        for (let j = 0; j < 22; j++) {
          const yy = hy + 2 + j * s * .008, w = s * (.03 - j * .0015) * (1 + .3 * Math.sin(t * 1.1 + j * 1.7 + f.ph));
          ctx.fillStyle = `rgba(255,120,50,${(.2 - j * .008) * fp})`; ctx.fillRect(ex - w / 2 + Math.sin(t * .9 + j) * s * .006, yy, w, 2.5);
        }
      }
      for (let j = 0; j < 34; j++) {
        const yy = hy + 2 + (hy - top.y) * j / 34 * 1.1, w = s * (.05 - j * .0017) * (1 + .35 * Math.sin(t * .8 + j * 2.3));
        ctx.fillStyle = `rgba(255,110,40,${(.16 - j * .0045) * pulse})`; ctx.fillRect(top.x - w / 2 + Math.sin(t * .7 + j * .9) * s * .008, yy, w, 2.5);
      }
      ctx.globalCompositeOperation = 'source-over';
      // Steam where each flow reaches the sea.
      if (Math.random() < dt * (lowPower ? 3 : 6)) { const f = flows[Math.floor(rand(0, flows.length))]; steam.push({ x: f.end[0] + rand(-1, 1) * s * .01, y: hy - s * .004, life: 0, max: rand(5, 8) }); }
      for (let i = steam.length - 1; i >= 0; i--) {
        const p = steam[i]; p.life += dt; if (p.life >= p.max) { steam.splice(i, 1); continue; }
        const k = p.life / p.max; p.y -= s * .02 * dt; p.x += s * .01 * dt * (.5 + weather);
        const r = s * (.012 + .05 * k), a = Math.min(1, p.life * 1.5) * (1 - k);
        ctx.globalAlpha = .3 * a; ctx.drawImage(steamS, p.x - r, p.y - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .25 * a * (1 - k); ctx.drawImage(hot, p.x - r * .8, p.y - r * .5, r * 1.6, r * 1.6); ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    }
  };
}
