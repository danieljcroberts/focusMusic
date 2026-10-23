// Layered scenes drawn in code, made for looking around (tilt.js): each layer is a seamless strip at its own depth,
// drifting sideways at its own pace and shifting with the phone's tilt, the near ones more. The strips are drawn once
// and again only when the light, the weather or the season moves on, from a fixed seed so the land stays the same.
import { W, H, ctx, lowPower } from '../view.js';
import { layer, mix, rgb, glow } from '../util.js';
import { weather } from '../weather.js';
import { daylight, skyMix, twilight } from '../daylight.js';
import { season, snowing } from '../season.js';
import { drawMoon } from '../moon.js';
import { tilt } from '../tilt.js';

const TAU = Math.PI * 2, OV = .08;   // each strip is this much taller than the screen, half above and half below
const prng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
// A skyline across a strip that joins up with itself: sines whose periods divide its width. u runs 0 to 1.
function ridge(r, peaky) {
  const parts = [1, 2, 3, 5, 8, 13, 21, 34].map((k, i) => ({ k, a: Math.pow(.55, i), p: r() * TAU }));
  return u => parts.reduce((s, q) => s + q.a * (peaky ? 1 - 2 * Math.abs(Math.sin(u * q.k * Math.PI + q.p)) : Math.sin(u * q.k * TAU + q.p)), 0) / 2;
}
function skyCanvas(top, mid, low) {
  const [c, g] = layer(W, H), gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, rgb(top)); gr.addColorStop(.55, rgb(mid)); gr.addColorStop(1, rgb(low));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  return [c, g];
}
function starField(g, r, n, maxY, a) {
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(235,240,255,${(.2 + .7 * r()) * a})`; g.beginPath(); g.arc(r() * W, r() * maxY, r() < .08 ? 1.3 : .4 + .5 * r(), 0, TAU); g.fill(); }
}

// The engine: o.sky(env) draws the backdrop, o.layers(env) returns strips { c, depth, v (CSS px a second at depth 1) },
// each with optional before/after hooks drawn at that layer's depth, and o.front draws over everything.
function layeredScene(o) {
  let strips = [], sky = null, key = '', clock = 0, TW = 0, SH = 0;
  function build() {
    TW = Math.ceil(Math.max(W, H) * 1.6); SH = Math.ceil(H * (1 + OV));
    const env = { d: daylight(), tw: twilight(), wx: weather, season: season(), snow: snowing(), TW, SH, u: Math.max(W, H) / 1000, top: H * OV / 2 };
    sky = o.sky(env); strips = o.layers(env);
    if (o.setup) o.setup(env);
  }
  return {
    strip: () => layer(TW, SH),   // a blank strip for o.layers to draw on
    init() { key = ''; },
    draw(t, dt) {
      const k = [W, H, Math.round(daylight() * 40), Math.round(weather * 4), season(), snowing()].join();
      if (k !== key) { key = k; build(); }
      clock += dt;
      const look = tilt(dt);
      ctx.drawImage(sky, 0, 0, W, H);
      if (o.back) o.back(t, dt, look);
      for (const l of strips) {
        const x = -(((clock * l.v * l.depth + look.x * l.depth * W * .045) % TW) + TW) % TW, y = -H * OV / 2 - look.y * l.depth * H * .03;
        if (l.before) l.before(t, dt, look, x, y);
        ctx.drawImage(l.c, x, y, TW, SH); if (x + TW < W) ctx.drawImage(l.c, x + TW, y, TW, SH);
        if (l.after) l.after(t, dt, look, x, y);
      }
      if (o.front) o.front(t, dt, look);
    },
  };
}

/* Mountain Layers: range behind range into the haze, mist pooling in the valleys between, the sun or the moon over
   the far peaks, birds crossing by day. Snow on the high ranges in winter. */
export function rangesScene() {
  let sun = null, birds = [];
  const sc = layeredScene({
    sky(e) {
      const top = skyMix([8, 12, 32], [58, 64, 120], [92, 150, 214], e.d), low = skyMix([28, 34, 66], [244, 168, 120], [206, 226, 240], e.d);
      const [c, g] = skyCanvas(top, mix(top, low, .55), low);
      if (e.d < .45) starField(g, prng(7), Math.round(W * H / 4000), H * .6, 1 - e.d / .45);
      sun = { x: W * .68, y: H * (.22 + .3 * (1 - e.d)), day: e.d > .3, low };
      return c;
    },
    layers(e) {
      const r = prng(11), n = 6, out = [];
      const haze = skyMix([28, 34, 66], [226, 160, 132], [190, 214, 232], e.d), near = skyMix([6, 8, 16], [40, 28, 46], [36, 62, 58], e.d);
      for (let i = 0; i < n; i++) {
        const depth = (i + 1) / n, base = H * (.5 + .44 * Math.pow(i / (n - 1), 1.1)) + H * OV / 2, amp = H * (.34 - .045 * i), f = ridge(r, i < 4);
        const col = mix(near, haze, Math.pow(1 - depth, 1.3) * .9), [c, g] = sc.strip();
        g.beginPath(); g.moveTo(0, e.SH);
        for (let x = 0; x <= e.TW; x += 3) g.lineTo(x, base - amp * (.15 + .85 / (1 + Math.exp(-2.4 * f(x / e.TW)))));   // a soft floor: valleys round off instead of going flat
        g.lineTo(e.TW, e.SH); g.closePath();
        const fill = g.createLinearGradient(0, base - amp, 0, base + H * .12);
        const capped = e.snow ? i < 3 : i < 1;   // the farthest range keeps its snow all year
        fill.addColorStop(0, rgb(capped ? mix(col, [236, 240, 248], .55 * (e.d * .7 + .3)) : col));
        fill.addColorStop(capped ? .18 : 0, rgb(col)); fill.addColorStop(1, rgb(mix(col, haze, .35)));
        g.fillStyle = fill; g.fill();
        // Mist in the valley below the ridge, thicker in wet weather.
        const mist = g.createLinearGradient(0, base - amp * .2, 0, base + H * .1);
        mist.addColorStop(0, rgb(haze, 0)); mist.addColorStop(1, rgb(haze, (.25 + .4 * e.wx) * (1 - depth * .6)));
        g.fillStyle = mist; g.fillRect(0, base - amp * .2, e.TW, e.SH);
        out.push({ c, depth: .15 + .85 * depth, v: 14 * e.u });
        if (i === 2) out[i].after = drawBirds;
      }
      return out;
    },
    setup(e) { const r = prng(5); birds = e.d > .3 ? Array.from({ length: 7 }, () => ({ x: r() * W, y: H * (.18 + .25 * r()), v: 10 + 14 * r(), p: r() * TAU, s: .6 + .6 * r() })) : []; },
    back(t) {
      if (!sun) return;
      if (sun.day) { glow(ctx, sun.x, sun.y, H * .3, [255, 236, 200], .35); glow(ctx, sun.x, sun.y, H * .05, [255, 250, 236], .95); }
      else drawMoon(ctx, sun.x, sun.y - H * .08, Math.min(W, H) * .035, 'rgba(240,236,220,.95)');
    },
  });
  function drawBirds(t, dt, look) {
    ctx.strokeStyle = 'rgba(30,30,40,.6)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (const b of birds) {
      b.x += b.v * dt; if (b.x > W + 20) b.x = -20;
      const x = b.x - look.x * W * .02, y = b.y + Math.sin(t * .4 + b.p) * 6, w = 6 * b.s * (Math.max(W, H) / 1000) * 1.5, fl = Math.sin(t * 7 + b.p) * w * .5;
      ctx.beginPath(); ctx.moveTo(x - w, y - fl); ctx.quadraticCurveTo(x - w * .4, y - fl * .2, x, y); ctx.quadraticCurveTo(x + w * .4, y - fl * .2, x + w, y - fl); ctx.stroke();
    }
  }
  return sc;
}

/* City Layers: rows of buildings at dusk and night, windows coming on as it gets dark, a train crossing a viaduct
   between the rows, red lights blinking on the tall roofs, rain when the weather turns. */
export function skylineScene() {
  let train = null, rain = [];
  const sc = layeredScene({
    sky(e) {
      const top = skyMix([6, 8, 22], [40, 36, 92], [120, 160, 210], e.d), low = skyMix([34, 30, 60], [236, 132, 108], [214, 222, 232], e.d);
      const [c, g] = skyCanvas(top, mix(top, low, .5), low);
      if (e.d < .4) starField(g, prng(3), Math.round(W * H / 9000), H * .4, (1 - e.d / .4) * (1 - e.wx * .7));
      return c;
    },
    layers(e) {
      const r = prng(21), out = [], dark = 1 - e.d;
      const haze = skyMix([40, 36, 66], [196, 120, 120], [180, 196, 214], e.d), near = skyMix([5, 6, 12], [22, 18, 34], [52, 58, 70], e.d);
      for (let i = 0; i < 4; i++) {
        const depth = (i + 1) / 4, col = mix(near, haze, Math.pow(1 - depth, 1.2) * .85), [c, g] = sc.strip();
        const ground = H * (.6 + .1 * i + (i === 3 ? .04 : 0)) + H * OV / 2, unit = H * (.03 + .012 * i);
        let x = 0; const blinks = [];
        while (x < e.TW) {
          const w = unit * (2 + 4 * r()), h = i === 3 ? H * (.04 + .1 * r()) : H * (.12 + .3 * r() * (1.2 - i * .15)), top = ground - h;   // the front row is low rooftops, so the viaduct shows over them
          g.fillStyle = rgb(col); g.fillRect(x, top, w + 1, e.SH);
          if (r() < .3) g.fillRect(x + w * .3, top - unit * .8, w * .25, unit * .8);   // a water tank or a lift house
          if (r() < .25) { g.fillRect(x + w * .5, top - unit * 2.2, 1.5, unit * 2.2); blinks.push({ x: x + w * .5, y: top - unit * 2.2, p: r() * 3 }); }
          // Windows: a grid, more of them lit as it gets dark, warm or cool.
          const ww = unit * .22, wh = unit * .3, lit = .05 + .55 * dark;
          for (let wy = top + unit * .5; wy < ground - wh; wy += wh * 2.2) for (let wx = x + unit * .35; wx < x + w - ww - unit * .2; wx += ww * 2.3) {
            if (r() > lit) continue;
            g.fillStyle = rgb(r() < .8 ? [255, 214, 150] : [190, 220, 255], (.35 + .6 * r()) * (.3 + .7 * dark) * (1 - depth * .15 + .15));
            g.fillRect(wx, wy, ww, wh);
          }
          x += w + unit * r() * .6;
        }
        g.fillStyle = rgb(col); g.fillRect(0, ground, e.TW, e.SH);
        const via = i === 2 ? viaduct(e) : null;
        out.push({ c, depth: .2 + .8 * depth, v: 10 * e.u, after: (t, dt, look, x, y) => { drawBlinks(t, blinks, x, y, e.TW); if (via) via(t, dt, look, x, y); } });
      }
      return out;
    },
    setup(e) {
      train = { x: -W * .05, v: W * .12, wait: 2 };
      rain = e.wx > .62 ? Array.from({ length: lowPower ? 90 : 220 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: H * (1.1 + .5 * Math.random()), l: H * (.02 + .02 * Math.random()) })) : [];
    },
    front(t, dt, look) {
      if (!rain.length) return;
      ctx.strokeStyle = 'rgba(200,210,235,.28)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of rain) { d.y += d.v * dt; d.x -= d.v * dt * .12; if (d.y > H) { d.y = -d.l; d.x = Math.random() * W * 1.1; } ctx.moveTo(d.x - look.x * 8, d.y); ctx.lineTo(d.x - look.x * 8 - d.l * .12, d.y + d.l); }
      ctx.stroke();
    },
  });
  // Aircraft warning lights on the tall roofs, each blinking in its own time.
  function drawBlinks(t, blinks, x, y, tw) {
    for (const b of blinks) {
      if ((t * .7 + b.p) % 2 > .25) continue;
      for (const xx of [x + b.x, x + b.x + tw]) if (xx > -10 && xx < W + 10) glow(ctx, xx, y + b.y, 7, [255, 60, 50], .9);
    }
  }
  // A viaduct of arches between the second and third rows, and every so often a lit train crossing it.
  function viaduct(e) {
    const [c, g] = sc.strip(), deck = H * .8 + H * OV / 2, col = mix(skyMix([5, 6, 12], [22, 18, 34], [52, 58, 70], e.d), skyMix([40, 36, 66], [196, 120, 120], [180, 196, 214], e.d), .45);
    g.fillStyle = rgb(col); g.fillRect(0, deck, e.TW, H * .025);
    const span = H * .09;
    for (let x = 0; x < e.TW; x += span) { g.fillRect(x, deck, span * .16, e.SH); g.beginPath(); g.moveTo(x, deck + H * .02); g.quadraticCurveTo(x + span / 2, deck + H * .07, x + span, deck + H * .02); g.lineTo(x + span, deck); g.lineTo(x, deck); g.fill(); }
    return (t, dt, look, x, y) => {
      ctx.drawImage(c, x, y, e.TW, e.SH); if (x + e.TW < W) ctx.drawImage(c, x + e.TW, y, e.TW, e.SH);
      if (train.wait > 0) { train.wait -= dt; return; }
      train.x += train.v * dt;
      const len = W * .5, ty = deck + y - H * .028, carH = H * .026, cars = 6, cw = len / cars;
      for (let k = 0; k < cars; k++) {
        const cx = train.x - k * cw; if (cx < -cw || cx > W) continue;
        ctx.fillStyle = rgb(col); ctx.fillRect(cx, ty, cw - 3, carH);
        ctx.fillStyle = `rgba(255,226,160,${.4 + .5 * (1 - e.d)})`;
        for (let wx = cx + cw * .08; wx < cx + cw - cw * .12; wx += cw * .14) ctx.fillRect(wx, ty + carH * .25, cw * .08, carH * .35);
      }
      if (train.x - len > W) { train.x = -W * .05; train.wait = 20 + 30 * Math.random(); }
    };
  }
  return sc;
}

/* Forest Layers: ranks of pines fading back into fog, light slanting through by day, fireflies at night in summer,
   leaves falling in autumn, snow on the boughs and falling in winter. */
export function fogForestScene() {
  let motes = [], shafts = 0;
  const sc = layeredScene({
    sky(e) {
      const top = skyMix([8, 12, 24], [74, 70, 110], [150, 186, 206], e.d), low = skyMix([26, 34, 48], [214, 168, 150], [214, 226, 222], e.d);
      const [c] = skyCanvas(top, mix(top, low, .6), low);
      shafts = e.d > .55 ? (e.d - .55) / .45 * (1 - e.wx * .6) : 0;
      return c;
    },
    layers(e) {
      const r = prng(31), out = [], n = 5;
      const fog = skyMix([30, 38, 52], [196, 160, 150], [200, 214, 210], e.d);
      const leaf = [[38, 70, 50], [30, 64, 40], [70, 62, 36], [40, 52, 50]][e.season], near = skyMix([4, 6, 8], [20, 18, 22], leaf, e.d * .7);
      for (let i = 0; i < n; i++) {
        const depth = (i + 1) / n, col = mix(near, fog, Math.pow(1 - depth, 1.15) * .88), [c, g] = sc.strip();
        const ground = H * (.58 + .09 * i) + H * OV / 2, size = H * (.12 + .07 * i);
        g.fillStyle = rgb(col);
        for (let x = -size; x < e.TW + size; x += size * (.28 + .3 * r())) {
          const h = size * (.8 + .7 * r()), w = h * .32, base = ground + size * .05 * r();
          g.beginPath();
          for (let k = 0; k < 5; k++) {   // tiers of boughs
            const ty = base - h * (k / 5), tw = w * (1 - k / 6);
            g.moveTo(x - tw, ty); g.lineTo(x, ty - h * .34); g.lineTo(x + tw, ty);
          }
          g.fill();
          g.fillRect(x - w * .05, base - h * .1, w * .1, h * .12);
          if (e.snow) { g.fillStyle = rgb(mix(col, [236, 240, 246], .5 + .3 * e.d)); for (let k = 1; k < 5; k++) { const ty = base - h * (k / 5) - h * .3, tw = w * (1 - k / 6) * .35; g.beginPath(); g.moveTo(x - tw, ty + h * .1); g.lineTo(x, ty); g.lineTo(x + tw, ty + h * .1); g.fill(); } g.fillStyle = rgb(col); }
        }
        g.fillRect(0, ground, e.TW, e.SH);
        const mist = g.createLinearGradient(0, ground - size * .9, 0, ground + H * .05);
        mist.addColorStop(0, rgb(fog, 0)); mist.addColorStop(1, rgb(fog, (.35 + .35 * e.wx) * (1 - depth * .7)));
        g.fillStyle = mist; g.fillRect(0, ground - size * .9, e.TW, e.SH);
        out.push({ c, depth: .15 + .85 * depth, v: 9 * e.u });
        if (i === 1) out[i].after = rays;
      }
      return out;
    },
    setup(e) {
      const kind = e.snow ? 'snow' : e.season === 2 ? 'leaf' : e.d < .3 && e.season < 2 ? 'fly' : null;   // fireflies on spring and summer nights
      const n = kind === 'fly' ? (lowPower ? 40 : 90) : kind === 'snow' ? (lowPower ? 50 : 120) : kind ? (lowPower ? 20 : 45) : 0;
      motes = Array.from({ length: n }, () => ({ kind, x: Math.random() * W, y: Math.random() * H, z: .3 + .7 * Math.random(), p: Math.random() * TAU, c: kind === 'leaf' ? [[214, 120, 40], [190, 70, 30], [226, 170, 60]][Math.floor(Math.random() * 3)] : null }));
    },
    front(t, dt, look) {
      for (const m of motes) {
        const sx = -look.x * m.z * W * .05, sy = -look.y * m.z * H * .03;
        if (m.kind === 'fly') {
          m.x += Math.sin(t * .3 + m.p) * 12 * dt; m.y += Math.cos(t * .23 + m.p * 1.3) * 8 * dt;
          const a = Math.max(0, Math.sin(t * 1.4 + m.p * 3)); if (a < .05) continue;
          glow(ctx, m.x + sx, m.y * .5 + H * .5 + sy, 6 * m.z + 2, [200, 255, 120], a * .8);
        } else {
          m.y += (m.kind === 'snow' ? 22 : 34) * m.z * dt; m.x += Math.sin(t * .8 + m.p) * 18 * m.z * dt - 6 * dt;
          if (m.y > H + 10) { m.y = -10; m.x = Math.random() * W; }
          if (m.x < -10) m.x = W + 10;
          if (m.kind === 'snow') { ctx.fillStyle = `rgba(240,244,250,${.5 + .4 * m.z})`; ctx.beginPath(); ctx.arc(m.x + sx, m.y + sy, 1 + 2 * m.z, 0, TAU); ctx.fill(); }
          else { ctx.save(); ctx.translate(m.x + sx, m.y + sy); ctx.rotate(t * 1.5 + m.p); ctx.fillStyle = rgb(m.c, .85); ctx.beginPath(); ctx.ellipse(0, 0, 3 * m.z + 1.2, 1.5 * m.z + .6, 0, 0, TAU); ctx.fill(); ctx.restore(); }
        }
      }
    },
  });
  // Light slanting down through the far trees on bright days, slowly coming and going.
  function rays(t, dt, look) {
    if (shafts <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) {
      const a = shafts * .07 * (.5 + .5 * Math.sin(t * .05 + k * 1.7)), x0 = W * (.1 + k * .2) - look.x * W * .03;
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(255,240,200,${a})`); g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + W * .06, 0); ctx.lineTo(x0 + W * .22, H); ctx.lineTo(x0 + W * .1, H); ctx.fill();
    }
    ctx.restore();
  }
  return sc;
}

/* Grand Canyon: from the South Rim, looking north. The flat North Rim far off, ranks of terraced buttes between,
   striped with the canyon's rock (cream limestone over red sandstone, the dark schist at the bottom), the river in the
   inner gorge, and the rim's ledge with a juniper in front. Shadows fall on the faces turned from the sun (the right
   ones in the morning, the left in the evening); sunset turns the rock red, night turns it blue. Condors soar, clouds
   drift with their shadows crossing the canyon, summer storms trail rain in the distance, and in winter snow lies on
   the flat tops. */
const STRATA = [   // [fraction of the depth, colour]: from the rim down
  [0, [226, 210, 176]], [.07, [204, 176, 136]], [.13, [234, 216, 174]], [.22, [178, 92, 62]], [.28, [194, 116, 76]], [.33, [170, 82, 56]],
  [.38, [196, 122, 82]], [.44, [182, 94, 66]], [.58, [160, 112, 92]], [.68, [134, 106, 92]], [.78, [84, 70, 72]], [1, [62, 54, 58]]];
export function canyonScene() {
  let birds = [], clouds = [], rainOn = 0, sun = null;
  const sc = layeredScene({
    sky(e) {
      const top = skyMix([8, 12, 30], [70, 66, 120], [86, 146, 214], e.d), low = skyMix([30, 34, 62], [250, 150, 96], [214, 222, 226], e.d);
      const storm = Math.max(0, e.wx - .6) / .4;
      const [c, g] = skyCanvas(mix(top, [90, 96, 110], storm * .5), mix(mix(top, low, .5), [120, 124, 132], storm * .4), mix(low, [150, 150, 156], storm * .3));
      if (e.d < .45) starField(g, prng(17), Math.round(W * H / 3500), H * .5, (1 - e.d / .45) * (1 - storm));
      const hour = new Date().getHours();
      sun = { x: W * (hour < 12 ? .82 : .18), y: H * (.1 + .2 * (1 - e.d)), day: e.d > .3, east: hour < 12 };
      rainOn = storm;
      return c;
    },
    layers(e) {
      const r = prng(41), out = [];
      const tint = e.d > .5 ? mix([255, 236, 220], [255, 248, 238], (e.d - .5) * 2) : mix([60, 70, 110], [255, 150, 110], e.d * 2);
      const light = c => c.map((v, k) => Math.min(255, Math.round(v * tint[k] / 255)));
      const haze = skyMix([30, 34, 62], [236, 160, 120], [196, 206, 216], e.d);
      const sunX = sun && sun.east ? 1 : -1, low = 1 - Math.abs(e.d - .5) * 1.2;   // shadows strongest with a low sun
      // [top y, floor y, depth, buttes, height range, kind]
      const L = [[.30, .40, .12, 0, [.9, 1], 'rim'], [.33, .54, .3, 16, [.45, .95], 'temples'], [.39, .66, .5, 12, [.4, .9], 'temples'],
        [.5, .8, .68, 9, [.2, .6], 'gorge'], [.55, .97, .84, 3, [.5, 1], 'temples'], [.85, 1.12, 1, 0, [0, 0], 'ledge']];
      for (const [ty, fy, depth, n, [h0, h1], kind] of L) {
        const [c, g] = sc.strip(), top = ty * H + H * OV / 2, floor = fy * H + H * OV / 2, span = floor - top;
        // The profile: the height (0 floor, 1 rim) across the strip, joining up with itself.
        const feats = Array.from({ length: n }, () => ({ c: r(), w: .025 + .06 * r(), h: h0 + (h1 - h0) * r(), steps: 3 + Math.floor(r() * 3) }));
        const wob = ridge(r, false);
        let side = 0, owner = -1;   // set by height(): the butte a column belongs to, and which side of it (-1 left, 1 right)
        const jag = ridge(r, true);
        const height = u => {
          side = 0; owner = -1;
          if (kind === 'rim') return .96 + .03 * wob(u);
          if (kind === 'ledge') return .5 + .22 * wob(u) + .12 * jag(u * 3 % 1) + .15 * Math.max(0, Math.sin(u * TAU * 3));
          let h = kind === 'gorge' ? .06 + .05 * Math.max(0, wob(u)) : .12 + .05 * wob(u);
          feats.forEach((f, fi) => {
            let du = u - f.c; du -= Math.round(du);
            const t = Math.max(0, 1 - Math.abs(du) / f.w), tt = Math.min(1, t * 1.25);   // a narrow top, widening down
            const q = tt * f.steps, k = Math.floor(q), fr = q - k;
            // Cliffs and sloping ledges of scree between them, as the hard and soft rocks wear back.
            const v = f.h * (k + .25 * fr + .75 * Math.min(1, Math.max(0, (fr - .62) / .38))) / f.steps;
            if (v > h) { h = v; owner = fi; side = Math.sign(du); }
          });
          return h;
        };
        const N = Math.ceil(e.TW / 2), hs = new Float32Array(N + 1), sides = new Int8Array(N + 1);
        for (let i = 0; i <= N; i++) { hs[i] = height(i / N); sides[i] = owner >= 0 ? side : 0; }
        const yAt = i => floor - hs[i] * span;
        g.beginPath(); g.moveTo(0, e.SH);
        for (let i = 0; i <= N; i++) g.lineTo(i * 2, yAt(i));
        g.lineTo(e.TW, e.SH); g.closePath();
        // The strata, lit and hazed by distance.
        const fill = g.createLinearGradient(0, top, 0, floor);
        const fog = Math.pow(1 - depth, 1.3) * .55;
        STRATA.forEach(([f, col], k) => {
          const cc = rgb(mix(light(kind === 'ledge' ? mix(col, [150, 130, 108], .7) : col), haze, fog));
          if (k) fill.addColorStop(Math.max(0, f - .004), rgb(mix(light(kind === 'ledge' ? mix(STRATA[k - 1][1], [150, 130, 108], .7) : STRATA[k - 1][1]), haze, fog)));
          fill.addColorStop(f, cc);
        });
        g.fillStyle = fill; g.fill();
        g.save(); g.clip();
        // Faces turned from the sun in shadow, deeper with a low sun; then fine vertical streaks of erosion.
        // Each butte's side turned from the sun in shade (the sun is east, on the right, in the morning).
        const shade = (.22 + .4 * low) * (1 - fog);
        for (let i = 0; i <= N; i++) if (sides[i] && sides[i] !== sunX) { g.fillStyle = `rgba(40,18,36,${shade})`; g.fillRect(i * 2 - 1, yAt(i), 2.5, e.SH); }
        g.globalAlpha = .03 * (1 - fog);
        for (let x = 0; x < e.TW; x += 3 + r() * 6) { g.fillStyle = r() < .5 ? '#000' : '#fff'; g.fillRect(x, top, 1, e.SH); }
        g.globalAlpha = 1;
        g.restore();
        // Snow on the flat tops in winter.
        if (e.snow && kind !== 'gorge') {
          g.fillStyle = rgb(mix([240, 244, 250], haze, fog), .85);
          for (let i = 1; i <= N; i++) if (Math.abs(hs[i] - hs[i - 1]) < .002 && hs[i] > .3) g.fillRect(i * 2 - 2, yAt(i) - 1, 2.5, 2 + 3 * depth);
        }
        // The river along the floor of the inner gorge, catching the sky.
        if (kind === 'gorge') {
          const river = mix(light([86, 120, 96]), haze, fog * .5), glint = mix(skyMix([40, 50, 90], [255, 190, 130], [230, 236, 230], e.d), river, .3);
          g.lineCap = 'round';
          for (const [w, col] of [[H * .011, river], [H * .0028, glint]]) {
            g.strokeStyle = rgb(col); g.lineWidth = w; g.beginPath();
            let on = false;
            for (let i = 0; i <= N; i += 2) {
              const x = i * 2, y = floor - span * .04 + Math.sin(x / e.TW * TAU * 4) * H * .008;
              if (hs[i] < .13) { if (on) g.lineTo(x, y); else g.moveTo(x, y); on = true; } else on = false;   // only where the gorge floor shows
            }
            g.stroke();
          }
        }
        // The ledge: cracked limestone, and a juniper twisted by the wind.
        if (kind === 'ledge') {
          g.strokeStyle = 'rgba(30,20,20,.35)'; g.lineWidth = 1.2;
          for (let k = 0; k < 40; k++) { const x = r() * e.TW, y0 = yAt(Math.round(x / 2)) + 4; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (r() - .5) * 20, y0 + H * (.03 + .06 * r())); g.stroke(); }
          const jx = e.TW * .3, jy = yAt(Math.round(N * .3)) + 6, s = H * .22, dark = light([40, 52, 36]);
          g.strokeStyle = rgb(mix(dark, [60, 44, 34], .5)); g.lineWidth = s * .05; g.lineCap = 'round';
          g.beginPath(); g.moveTo(jx, jy + 4); g.quadraticCurveTo(jx - s * .15, jy - s * .4, jx + s * .2, jy - s * .7); g.stroke();
          g.beginPath(); g.moveTo(jx - s * .05, jy - s * .3); g.quadraticCurveTo(jx - s * .4, jy - s * .45, jx - s * .5, jy - s * .62); g.stroke();
          g.fillStyle = rgb(dark);
          for (const [dx, dy, rr] of [[.2, -.72, .2], [.05, -.8, .16], [.35, -.62, .15], [-.5, -.66, .16], [-.35, -.55, .12], [-.1, -.6, .12]]) {
            g.beginPath(); g.ellipse(jx + dx * s, jy + dy * s, rr * s * 1.3, rr * s * .7, 0, 0, TAU); g.fill();
          }
        }
        out.push({ c, depth, v: 4 * e.u });
        if (kind === 'temples' && depth === .5) out[out.length - 1].after = soar;
        if (kind === 'gorge') out[out.length - 1].after = shadows;
      }
      return out;
    },
    setup(e) {
      const r = prng(9);
      birds = e.d > .25 && rainOn < .5 ? [0, 1].map(k => ({ cx: W * (.3 + .4 * r()), cy: H * (.35 + .08 * k), rx: W * (.12 + .08 * r()), ry: H * .03, p: r() * TAU, v: .05 + .03 * r() })) : [];
      const n = 3 + Math.round(e.wx * 5);
      clouds = Array.from({ length: n }, () => ({ x: r() * W * 1.4, y: H * (.04 + .16 * r()), w: W * (.12 + .18 * r()), v: 4 + 6 * r(), a: .5 + .4 * r() }));
    },
    back(t, dt) {
      if (!sun) return;
      if (sun.day) { glow(ctx, sun.x, sun.y, H * .35, [255, 230, 190], .3); glow(ctx, sun.x, sun.y, H * .045, [255, 250, 236], .9); }
      else drawMoon(ctx, W * .7, H * .14, Math.min(W, H) * .03, 'rgba(240,236,220,.95)');
      const d = daylight(), col = skyMix([50, 56, 80], [250, 200, 180], [255, 255, 255], d);
      for (const c of clouds) {
        c.x -= c.v * dt; if (c.x < -c.w) c.x = W + c.w;
        for (let k = 0; k < 4; k++) glow(ctx, c.x + (k - 1.5) * c.w * .28, c.y + (k % 2) * c.w * .04, c.w * .3, mix(col, [140, 140, 150], rainOn * .6), c.a * (.35 + .25 * rainOn));
      }
      // Summer storms: grey curtains of rain falling over the far rim.
      if (rainOn > 0) {
        for (let k = 0; k < 4; k++) {
          const x = W * (.15 + .22 * k) + Math.sin(t * .02 + k) * W * .03, g = ctx.createLinearGradient(0, H * .12, 0, H * .45);
          g.addColorStop(0, `rgba(110,114,126,${.35 * rainOn})`); g.addColorStop(1, 'rgba(110,114,126,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, H * .14); ctx.lineTo(x + W * .1, H * .14); ctx.lineTo(x + W * .07, H * .45); ctx.lineTo(x - W * .03, H * .45); ctx.fill();
        }
      }
    },
  });
  // Condors circling slowly on the air over the canyon, tilting as they turn.
  function soar(t, dt, look) {
    for (const b of birds) {
      b.p += b.v * dt;
      const x = b.cx + Math.cos(b.p) * b.rx - look.x * W * .03, y = b.cy + Math.sin(b.p) * b.ry, s = Math.max(W, H) * .012 * (1 + .25 * Math.sin(b.p)), tilt = Math.cos(b.p) * .25;
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.fillStyle = 'rgba(28,24,26,.85)';
      ctx.beginPath(); ctx.moveTo(-s * 1.6, -s * .1); ctx.quadraticCurveTo(-s * .6, -s * .35, 0, 0); ctx.quadraticCurveTo(s * .6, -s * .35, s * 1.6, -s * .1); ctx.quadraticCurveTo(s * .6, -s * .05, 0, s * .18); ctx.quadraticCurveTo(-s * .6, -s * .05, -s * 1.6, -s * .1); ctx.fill();
      ctx.restore();
    }
  }
  // The shadows of the clouds sliding across the canyon.
  function shadows() {
    if (!sun || !sun.day) return;
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    for (const c of clouds) glow(ctx, c.x, H * (.5 + c.y / H * .9), c.w * .55, [150, 130, 140], .35 * c.a);
    ctx.restore();
  }
  return sc;
}
