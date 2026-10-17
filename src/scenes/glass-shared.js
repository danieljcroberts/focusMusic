// Shared by every glass scene: extra stages, the city backdrop and photo backgrounds, the drop simulation and WebGL helpers.
import { W, H, fadeCv, gctxFallback } from '../view.js';
import { rand, rgb, layer, plain, glow } from '../util.js';
import { img, ok } from '../assets.js';
import { daylight, skyMix } from '../daylight.js';

export const STAGES = [];
export function addStage(el) { el.classList.add('stage'); el.setAttribute('aria-hidden', 'true'); el.hidden = true; fadeCv.before(el); STAGES.push(el); return el; }
export function blurCanvas(src, f) {
  const w = Math.max(1, Math.round(W / f)), h = Math.max(1, Math.round(H / f));
  const [a, ag] = layer(w, h); ag.imageSmoothingQuality = 'high'; ag.drawImage(src, 0, 0, w, h);
  const [b, bg2] = layer(w * 3, h * 3); bg2.imageSmoothingQuality = 'high'; bg2.drawImage(a, 0, 0, w * 3, h * 3);
  const [c, cg] = layer(W, H); cg.imageSmoothingQuality = 'high'; cg.drawImage(b, 0, 0, W, H);
  return [c, cg];
}
export function paintNightCity(g) {
  const WARM = [255, 196, 120], COOL = [150, 200, 255], WHITE = [255, 244, 228];
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#05070f'); sky.addColorStop(.5, '#121834'); sky.addColorStop(.78, '#33203f'); sky.addColorStop(1, '#4a2a2a');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const base = H * .93;
  const block = (minH, maxH, col, win, step) => {
    let x = -20;
    while (x < W + 20) {
      const bw = rand(36, 110), bh = rand(minH, maxH);
      g.fillStyle = col; g.fillRect(x, base - bh, bw, bh);
      for (let wy = base - bh + step; wy < base - step; wy += step)
        for (let wx = x + step * .6; wx < x + bw - step * .6; wx += step)
          if (Math.random() < win) {
            const c = Math.random() < .62 ? WARM : Math.random() < .55 ? COOL : WHITE;
            g.fillStyle = rgb(c, rand(.45, .95)); g.fillRect(wx, wy, step * .45, step * .55);
          }
      x += bw + rand(2, 14);
    }
  };
  block(H * .28, H * .62, '#0a0e1b', .3, 9);
  block(H * .12, H * .34, '#05070d', .22, 13);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const c = [[255, 60, 160], [60, 230, 255], [255, 170, 60], [170, 90, 255]][i % 4];
    const x = rand(.05, .95) * W, y = rand(.45, .8) * H, w = rand(30, 90), h = rand(8, 18);
    g.fillStyle = rgb(c, .9); g.fillRect(x, y, w, h); glow(g, x + w / 2, y + h / 2, w * 1.4, c, .35);
  }
  for (let x = rand(20, 80); x < W; x += rand(110, 190)) {
    glow(g, x, base - H * .07, 46, [255, 168, 80], .55);
    g.fillStyle = '#ffe2b0'; g.beginPath(); g.arc(x, base - H * .07, 3, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 14; i++) {
    const x = rand(0, W), y = base + rand(-4, 10), c = Math.random() < .55 ? [255, 40, 50] : [255, 240, 210];
    glow(g, x, y, 22, c, .6); glow(g, x + 16, y, 22, c, .6);
  }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#040508'; g.fillRect(0, base + 14, W, H - base);
}
export function photoInto(g, im) {
  const s = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
  g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  g.fillStyle = 'rgba(4,6,16,.28)'; g.fillRect(0, 0, W, H);
}
// Backgrounds the rain can sit over. Each rain scene keeps its own choice.
export const BGS = {
  drawn: { label: 'Drawn city', art: { who: 'Original, drawn in code', lic: '', url: '' } },
  waterfront: { label: 'Blue-hour waterfront', file: 'city-photo.jpg', art: { who: 'City lighting by Maria Eklind (blurred)', lic: 'CC BY-SA 2.0', url: 'https://commons.wikimedia.org/wiki/File:City_lighting_(explore)_-_Flickr_-_Maria_Eklind.jpg' } },
  tokyo: { label: 'Tokyo at night', file: 'city-tokyo.jpg', art: { who: 'Roppongi at night by Syced', lic: 'CC0', url: 'https://commons.wikimedia.org/wiki/File:Roppongi_at_night_seen_from_Shibuya_Stream.jpg' } },
  toronto: { label: 'Toronto skyline', file: 'city-toronto.jpg', art: { who: 'Night skyline of Toronto by Andrew Gosine', lic: 'CC0', url: 'https://commons.wikimedia.org/wiki/File:Night_skyline_of_Toronto,_Canada_374759.jpg' } },
  street: { label: 'Rainy street', paint: g => paintStreet(g), art: { who: 'Original, drawn in code', lic: '', url: '' } },
  traffic: { label: 'The road ahead', paint: g => paintTraffic(g), art: { who: 'Original, drawn in code', lic: '', url: '' } },
  foliage: { label: 'Greenhouse plants', paint: g => paintFoliage(g), art: { who: 'Original, drawn in code', lic: '', url: '' } },
};
export const bgPending = k => !!BGS[k].file && !ok(img(BGS[k].file));
export function paintBg(g, k) {
  const b = BGS[k];
  if (b.paint) b.paint(g); else if (b.file) photoInto(g, img(b.file)); else paintNightCity(g);
}

// The road ahead through a windscreen at night: wet asphalt, tail lights, a traffic light, lamps receding, the bonnet below.
export function paintTraffic(g) {
  const hy = H * .46, cx = W * .5, d = daylight(), night = 1 - d;
  const sky = g.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, rgb(skyMix([4, 5, 12], [40, 30, 60], [120, 140, 165], d))); sky.addColorStop(1, rgb(skyMix([26, 20, 38], [160, 100, 90], [185, 190, 200], d)));
  g.fillStyle = sky; g.fillRect(0, 0, W, hy + 1);
  const road = g.createLinearGradient(0, hy, 0, H);
  road.addColorStop(0, rgb(skyMix([21, 19, 28], [50, 45, 55], [95, 95, 100], d))); road.addColorStop(1, rgb(skyMix([10, 9, 14], [28, 26, 32], [60, 60, 66], d)));
  g.fillStyle = rgb(skyMix([11, 10, 16], [30, 28, 34], [70, 72, 76], d)); g.fillRect(0, hy, W, H - hy);
  g.fillStyle = road; g.beginPath(); g.moveTo(cx - 14, hy); g.lineTo(cx + 14, hy); g.lineTo(W * 1.15, H); g.lineTo(-W * .15, H); g.fill();
  g.fillStyle = rgb(skyMix([8, 8, 14], [40, 32, 44], [90, 92, 100], d), .9); // buildings either side
  for (let x = 0; x < W; x += rand(50, 120)) { if (Math.abs(x - cx) < W * .12) continue; const bh = rand(H * .08, H * .3) * (Math.abs(x - cx) / W + .3); g.fillRect(x, hy - bh, rand(40, 110), bh); }
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = .4 + .6 * night;   // the lights count for less by day
  for (let i = 0; i < 6; i++) { // neon
    const c = [[255, 60, 160], [60, 230, 255], [255, 170, 60], [170, 90, 255]][i % 4], x = i % 2 ? rand(cx + W * .18, W) : rand(0, cx - W * .18), y = rand(hy - H * .2, hy - 10);
    g.fillStyle = rgb(c, .9); g.fillRect(x, y, rand(30, 80), rand(6, 14)); glow(g, x + 30, y + 6, 70, c, .3);
  }
  for (let k = 1; k <= 7; k++) { // street lamps receding on both sides
    const z = k / 7, y = hy + (H - hy) * z * z * .9, spread = W * .14 + (W * .5) * z, r = 18 + 60 * z;
    for (const sd of [-1, 1]) { glow(g, cx + sd * spread, y - H * .22 * z - 8, r, [255, 180, 100], .5); g.fillStyle = '#ffe2b0'; g.beginPath(); g.arc(cx + sd * spread, y - H * .22 * z - 8, 2 + 3 * z, 0, Math.PI * 2); g.fill(); }
  }
  for (const [zx, z] of [[-.02, .35], [.05, .62], [-.01, .92]]) { // cars ahead, their tail lights doubled in the wet road
    const y = hy + (H - hy) * z * z * .85, sc = .2 + z, gap = 48 * sc, x = cx + zx * W + (z - .5) * W * .1;
    g.fillStyle = 'rgba(0,0,0,.9)'; g.fillRect(x - gap - 22 * sc, y - 46 * sc, gap * 2 + 44 * sc, 50 * sc);
    for (const sd of [-1, 1]) { glow(g, x + sd * gap, y - 20 * sc, 60 * sc, [255, 40, 50], .8); g.fillStyle = 'rgba(255,120,120,.95)'; g.beginPath(); g.arc(x + sd * gap, y - 20 * sc, 7 * sc, 0, Math.PI * 2); g.fill(); glow(g, x + sd * gap, y + 50 * sc, 50 * sc, [255, 40, 50], .3); }
  }
  const lx = cx + W * .2, ly = hy - H * .2; // a traffic light on red
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#0a0a10'; g.fillRect(lx - 10, ly, 20, 56); g.fillRect(lx - 2, ly + 56, 4, H * .12);
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = '#ff3a3a'; g.beginPath(); g.arc(lx, ly + 10, 6, 0, Math.PI * 2); g.fill(); glow(g, lx, ly + 10, 50, [255, 60, 60], .7);
  g.fillStyle = '#3a2a10'; g.beginPath(); g.arc(lx, ly + 28, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#103a1c'; g.beginPath(); g.arc(lx, ly + 46, 6, 0, Math.PI * 2); g.fill();
  glow(g, lx, H * .8, 70, [255, 60, 60], .25);
  g.fillStyle = 'rgba(255,220,180,.35)'; for (let k = 0; k < 8; k++) { const z = (k + .3) / 8, y = hy + (H - hy) * z * z, w = 3 + 14 * z, h = 6 + 30 * z; g.fillRect(cx - w / 2 + (z - .5) * 6, y, w, h); }
  g.globalCompositeOperation = 'source-over';
  const bonnet = g.createLinearGradient(0, H * .84, 0, H); // the car's own bonnet, catching the lights
  bonnet.addColorStop(0, '#07070b'); bonnet.addColorStop(1, '#101018');
  g.fillStyle = bonnet; g.beginPath(); g.moveTo(0, H); g.lineTo(0, H * .9); g.quadraticCurveTo(cx, H * .8, W, H * .9); g.lineTo(W, H); g.fill();
  g.globalCompositeOperation = 'lighter'; glow(g, cx, H * .93, W * .3, [255, 50, 60], .12); g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  // By day: a pale haze of spray over everything, and the far road vanishing into it.
  if (d > .1) { g.fillStyle = rgb([200, 205, 212], .35 * d); g.fillRect(0, 0, W, H); const hz = g.createLinearGradient(0, hy - 30, 0, hy + 60); hz.addColorStop(0, rgb([200, 205, 212], 0)); hz.addColorStop(.5, rgb([200, 205, 212], .5 * d)); hz.addColorStop(1, rgb([200, 205, 212], 0)); g.fillStyle = hz; g.fillRect(0, hy - 30, W, 90); }
}

// A rainy street outside a café: the pavement and the shops across the road with their lit windows, a lamp, a bus
// shelter, parked bicycles and a passer-by under an umbrella. Follows the clock; the windows glow more as it darkens.
export function paintStreet(g) {
  const d = daylight(), night = 1 - d, s = Math.min(W, H) / 800;
  const hy = H * .62;   // the kerb across the road
  const sky = g.createLinearGradient(0, 0, 0, hy * .6);
  sky.addColorStop(0, rgb(skyMix([8, 10, 20], [60, 50, 80], [150, 165, 180], d))); sky.addColorStop(1, rgb(skyMix([24, 24, 40], [170, 120, 110], [200, 205, 210], d)));
  g.fillStyle = sky; g.fillRect(0, 0, W, hy);
  // The buildings across the road: a row of three- and four-storey fronts, each a different grey or warm stone.
  const tones = [[[40, 36, 44], [120, 95, 80], [190, 170, 150]], [[34, 36, 46], [95, 90, 100], [160, 162, 168]], [[44, 38, 38], [130, 100, 85], [205, 180, 160]]];
  let x = -rand(20, 80), k = 0;
  const windows = [];
  while (x < W + 40) {
    const w = rand(120, 240) * s, top = hy * rand(.08, .3), t = tones[k++ % 3];
    g.fillStyle = rgb(skyMix(t[0], t[1], t[2], d)); g.fillRect(x, top, w, hy - top);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + w - 3, top, 3, hy - top);   // the shadow between fronts
    const floors = Math.max(2, Math.round((hy - top) / (62 * s))), fh = (hy - top) / floors;
    for (let f = 0; f < floors; f++) {
      const y = top + f * fh, shop = f === floors - 1;
      if (shop) {   // the shopfront: a wide lit window with an awning, and a doorway
        const lit = Math.random() < .8;
        g.fillStyle = lit ? rgb(skyMix([255, 190, 110], [255, 205, 140], [245, 235, 215], d)) : rgb(skyMix([20, 22, 30], [60, 60, 70], [120, 125, 130], d));
        g.fillRect(x + 10 * s, y + fh * .25, w - 20 * s, fh * .7); if (lit) windows.push([x + w / 2, y + fh * .6, w * .6, lit]);
        g.fillStyle = rgb(skyMix([30, 28, 40], [120, 70, 60], [180, 90, 70], d)); g.fillRect(x + 4 * s, y + fh * .15, w - 8 * s, fh * .14);   // awning
        for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.1)'; g.fillRect(x + 4 * s + (w - 8 * s) * i / 5, y + fh * .15, (w - 8 * s) / 5, fh * .14); }
        g.fillStyle = 'rgba(10,10,16,.85)'; g.fillRect(x + w - 34 * s, y + fh * .3, 22 * s, fh * .66);   // the doorway
      } else {
        const n = Math.max(2, Math.round(w / (46 * s)));
        for (let i = 0; i < n; i++) {
          const lit = Math.random() < .35 * night + .05, wx = x + (i + .5) * w / n - 12 * s, wy = y + fh * .25;
          g.fillStyle = lit ? rgb([255, 205, 140]) : rgb(skyMix([14, 16, 26], [50, 52, 66], [150, 160, 170], d));
          g.fillRect(wx, wy, 24 * s, fh * .5); if (lit) windows.push([wx + 12 * s, wy + fh * .25, 24 * s, true]);
          g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(wx, wy, 24 * s, 3 * s);
        }
      }
    }
    x += w;
  }
  // The street: wet asphalt with the lights laid in it, then the near pavement.
  const road = g.createLinearGradient(0, hy, 0, H);
  road.addColorStop(0, rgb(skyMix([22, 22, 30], [60, 55, 62], [105, 105, 110], d))); road.addColorStop(1, rgb(skyMix([12, 12, 18], [34, 32, 38], [80, 80, 86], d)));
  g.fillStyle = road; g.fillRect(0, hy, W, H - hy);
  g.fillStyle = rgb(skyMix([60, 60, 70], [120, 115, 120], [170, 170, 172], d)); g.fillRect(0, hy - 4 * s, W, 6 * s);   // the far kerb
  g.globalCompositeOperation = 'lighter';
  for (const [wx, wy, ww] of windows) {   // each light smeared down the wet road
    const rg = g.createLinearGradient(0, hy, 0, H);
    rg.addColorStop(0, rgb([255, 200, 130], .18 * (.4 + .6 * night))); rg.addColorStop(1, rgb([255, 200, 130], 0));
    g.fillStyle = rg; g.fillRect(wx - ww * .3, hy, ww * .6, H - hy);
    glow(g, wx, wy, ww * .9, [255, 200, 130], .18 * night);
  }
  // A street lamp on the far pavement, and a bus shelter.
  const lx = W * .72, ly = hy - H * .28;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = rgb(skyMix([20, 20, 26], [40, 38, 44], [60, 60, 66], d)); g.fillRect(lx - 3 * s, ly, 6 * s, hy - ly); g.fillRect(lx - 14 * s, ly - 4 * s, 28 * s, 10 * s);
  g.globalCompositeOperation = 'lighter';
  glow(g, lx, ly + 2 * s, 90 * s, [255, 220, 170], .55 * night); g.fillStyle = rgb([255, 240, 210], .4 + .6 * night); g.fillRect(lx - 8 * s, ly - 2 * s, 16 * s, 6 * s);
  glow(g, lx, hy + 40 * s, 120 * s, [255, 220, 170], .25 * night);
  g.globalCompositeOperation = 'source-over';
  const bx = W * .18, bw = 150 * s, bh = 70 * s, by = hy - bh;
  g.fillStyle = rgb(skyMix([30, 34, 46], [70, 72, 90], [130, 140, 150], d), .7); g.fillRect(bx, by, bw, bh);
  g.fillStyle = rgb(skyMix([50, 52, 66], [100, 100, 115], [170, 175, 185], d)); g.fillRect(bx - 6 * s, by - 6 * s, bw + 12 * s, 6 * s); g.fillRect(bx, by, 3 * s, bh); g.fillRect(bx + bw - 3 * s, by, 3 * s, bh);
  g.fillStyle = rgb([255, 215, 160], .35 + .5 * night); g.fillRect(bx + bw * .3, by + bh * .2, bw * .3, bh * .5);   // the lit timetable
  // Bicycles against the far railing, and a passer-by under an umbrella crossing with the light behind.
  g.strokeStyle = rgb(skyMix([18, 18, 24], [40, 40, 48], [60, 60, 66], d)); g.lineWidth = 2 * s;
  for (let i = 0; i < 3; i++) { const cx = W * .45 + i * 34 * s, cy = hy - 12 * s, r = 11 * s; g.beginPath(); g.arc(cx - r, cy, r, 0, 6.283); g.arc(cx + r, cy, r, 0, 6.283); g.moveTo(cx - r, cy); g.lineTo(cx - r * .2, cy - r * 1.3); g.lineTo(cx + r, cy); g.lineTo(cx + r * .1, cy - r * 1.5); g.stroke(); }
  const px = W * .58, py = hy + 20 * s, ph = 80 * s;
  g.fillStyle = rgb(skyMix([12, 12, 18], [28, 26, 34], [40, 40, 46], d));
  g.fillRect(px - 9 * s, py - ph * .6, 18 * s, ph * .6); g.beginPath(); g.arc(px, py - ph * .66, 7 * s, 0, 6.283); g.fill();
  g.fillRect(px - 6 * s, py, 4 * s, 22 * s); g.fillRect(px + 2 * s, py, 4 * s, 22 * s);
  g.fillStyle = rgb(skyMix([120, 30, 40], [170, 50, 60], [200, 60, 70], d)); g.beginPath(); g.arc(px, py - ph * .72, 30 * s, Math.PI, 0); g.fill();   // the umbrella
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(px, py + 24 * s, 34 * s, 6 * s, 0, 0, 6.283); g.fill();   // their reflection, roughly
  // The near pavement edge at the bottom, and the café's own reflected lamps.
  g.fillStyle = rgb(skyMix([16, 16, 22], [40, 38, 44], [90, 92, 96], d)); g.fillRect(0, H * .92, W, H * .08);
  g.globalCompositeOperation = 'lighter';
  for (const fx of [.12, .5, .88]) glow(g, W * fx, H * .2, 70 * s, [255, 190, 120], .16 * (.3 + .7 * night));
  g.globalCompositeOperation = 'source-over';
}

// Daylight through a greenhouse: pale glass, dense leaves lit from above, a few flowers.
export function paintFoliage(g) {
  const d = daylight(), s = Math.min(W, H) / 800;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, rgb(skyMix([14, 18, 30], [150, 120, 120], [226, 235, 220], d))); sky.addColorStop(.5, rgb(skyMix([16, 26, 24], [110, 120, 100], [157, 187, 147], d))); sky.addColorStop(1, rgb(skyMix([8, 14, 10], [40, 60, 36], [52, 80, 46], d)));
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  glow(g, W * .25, 0, W * .5, [255, 250, 225], .7 * d);
  if (d < .5) glow(g, W * .5, H * .55, W * .35, [255, 200, 130], .3 * (1 - d * 2));   // a lamp among the plants at night
  const leafC = (depth, k) => {
    const base = [30 + 60 * (1 - depth) * k, 75 + 95 * (1 - depth * .6), 30 + 35 * k];
    return skyMix(base.map(v => v * .25), base.map(v => v * .6), base, d).map(Math.round);
  };
  // A leaf: a pointed ellipse on a stem, with a lighter half and a midrib.
  const leaf = (x, y, r, ang, c) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = rgb(c, .95); g.beginPath(); g.moveTo(-r, 0); g.quadraticCurveTo(-r * .3, -r * .55, r, 0); g.quadraticCurveTo(-r * .3, r * .55, -r, 0); g.fill();
    g.fillStyle = rgb(c.map(v => Math.min(255, v + 40)), .55); g.beginPath(); g.moveTo(-r, 0); g.quadraticCurveTo(-r * .3, -r * .55, r, 0); g.quadraticCurveTo(-r * .2, -r * .1, -r, 0); g.fill();
    g.strokeStyle = rgb(c.map(v => v * .55), .7); g.lineWidth = Math.max(1, r * .04); g.beginPath(); g.moveTo(-r, 0); g.lineTo(r * .9, 0); g.stroke();
    g.restore();
  };
  // Hanging baskets at the top, trailing.
  for (let i = 0; i < 3; i++) {
    const bx = W * (.2 + i * .3) + rand(-30, 30) * s, by = H * .06;
    g.strokeStyle = 'rgba(60,40,30,.6)'; g.lineWidth = 1.5 * s; g.beginPath(); g.moveTo(bx, 0); g.lineTo(bx, by); g.stroke();
    g.fillStyle = rgb(skyMix([40, 28, 20], [90, 60, 40], [140, 95, 60], d)); g.beginPath(); g.ellipse(bx, by + 14 * s, 42 * s, 16 * s, 0, 0, Math.PI); g.fill();
    for (let j = 0; j < 26; j++) { const a = rand(.3, 2.8), len = rand(20, 120) * s; leaf(bx + Math.cos(a) * 40 * s * Math.random(), by + 14 * s + len, rand(9, 16) * s, rand(.8, 2.3), leafC(.2, Math.random())); }
  }
  // Big plants from the floor up: stems with leaves along them, far ones first.
  for (let i = 0; i < 26; i++) {
    const depth = i / 26, x0 = rand(-20, W + 20), h = H * rand(.3, .7) * (.6 + depth * .5), lean = rand(-.25, .25);
    g.strokeStyle = rgb(leafC(depth, .3).map(v => v * .7)); g.lineWidth = (2 + 3 * depth) * s;
    g.beginPath(); g.moveTo(x0, H); g.quadraticCurveTo(x0 + lean * h * .5, H - h * .6, x0 + lean * h, H - h); g.stroke();
    const n = 5 + Math.round(h / (40 * s));
    for (let j = 1; j <= n; j++) {
      const k = j / n, x = x0 + lean * h * k * k, y = H - h * k, side = j % 2 ? 1 : -1, r = (26 + 44 * depth) * s * (1 - k * .5);
      leaf(x + side * r * .7, y, r, side > 0 ? rand(-.5, .1) : Math.PI + rand(-.1, .5), leafC(depth, Math.random()));
      if (Math.random() < .06) { g.fillStyle = Math.random() < .5 ? 'rgba(240,90,120,.95)' : 'rgba(250,200,80,.95)'; g.beginPath(); g.arc(x, y, 6 * s, 0, 6.283); g.fill(); }
    }
  }
  // A potting bench low on the right with terracotta pots.
  const by = H * .78, bx = W * .55;
  g.fillStyle = rgb(skyMix([30, 24, 18], [90, 70, 50], [150, 120, 85], d)); g.fillRect(bx, by, W - bx + 10, 10 * s); g.fillRect(bx + 20 * s, by, 8 * s, H - by); g.fillRect(W - 40 * s, by, 8 * s, H - by);
  for (let i = 0; i < 4; i++) { const px = bx + 30 * s + i * 70 * s, pw = 36 * s, ph = 30 * s; g.fillStyle = rgb(skyMix([60, 30, 20], [150, 80, 50], [200, 115, 75], d)); g.beginPath(); g.moveTo(px, by - ph); g.lineTo(px + pw, by - ph); g.lineTo(px + pw - 5 * s, by); g.lineTo(px + 5 * s, by); g.fill(); g.fillRect(px - 2 * s, by - ph - 5 * s, pw + 4 * s, 6 * s); for (let j = 0; j < 6; j++) leaf(px + pw / 2 + rand(-10, 10) * s, by - ph - rand(4, 24) * s, rand(10, 18) * s, rand(-2.6, -.5), leafC(.6, Math.random())); }
  g.strokeStyle = rgb([255, 255, 255], .25 + .15 * d); g.lineWidth = 6 * s; // roof glazing bars
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(W * k / 4, 0); g.lineTo(W * k / 4 + (k - 2) * 40, H * .25); g.stroke(); }
  g.beginPath(); g.moveTo(0, H * .25); g.lineTo(W, H * .25); g.stroke();
}

// Shared drop simulation: mostly-downward runs with gentle wander, stop-start, merging and shed beads.
export function makeSim(o = {}) {
  const drops = [], maxR = o.maxR || 11, beadChance = o.beadChance || .7, gap = o.beadGap || [10, 26], moveR = o.moveR || 4.6, speed = o.speed || 1, pauseRate = o.pauseRate || .7, gather = o.gather || 0, beadCost = o.beadCost ?? .07, stillGrow = o.stillGrow ?? .008;
  function spawn(x = rand(0, W), y = rand(-10, H * .85), r = 2 + Math.pow(Math.random(), 2.6) * 7) {
    drops.push({ x, y, r, ang: rand(-.15, .15), turn: 0, v: 0, pause: 0, moving: false, travelled: 0, lastBead: 0, seed: rand(0, 100) });
  }
  function step(dt, wipe, bead) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i], px = d.x, py = d.y;
      if (d.r > moveR && d.pause <= 0) {
        d.moving = true;
        d.v = Math.min(d.v + (30 + d.r * 16) * speed * dt, d.r * 17 * speed);
        const channel = .25 * Math.sin(d.x * .011 + d.y * .004) * Math.cos(d.y * .009 - d.x * .003);
        d.turn += rand(-1, 1) * 1.4 * dt; d.turn *= 1 - 1.5 * dt;
        d.ang += d.turn * 1.6 * dt + (channel - d.ang) * 1.4 * dt;
        if (Math.random() < dt * .2) d.ang += rand(-.3, .3);
        d.ang = Math.max(-.4, Math.min(.4, d.ang));
        const s = d.v * dt;
        d.x += Math.sin(d.ang) * s; d.y += Math.cos(d.ang) * s; d.travelled += s;
        if (Math.random() < dt * pauseRate) { d.pause = rand(.3, 2); d.v = 0; }
        wipe(px, py, d.x, d.y, d.r);
        d.r = Math.min(maxR, d.r + dt * .05 + s * gather); // picks up water as it runs
        if (d.travelled - d.lastBead > rand(gap[0], gap[1])) {
          d.lastBead = d.travelled;
          if (Math.random() < beadChance) {
            const back = d.r * rand(1.6, 2.6);
            bead(d.x - Math.sin(d.ang) * back + rand(-d.r * .3, d.r * .3), d.y - Math.cos(d.ang) * back, rand(.7, Math.min(2.2, d.r * .32)));
            d.r -= beadCost;
          }
        }
      } else {
        d.moving = false;
        if (d.pause > 0) d.pause -= dt; else d.r += dt * stillGrow;
      }
      if (d.y - d.r > H + 10) drops.splice(i, 1);
    }
    for (let i = 0; i < drops.length; i++) {
      const a = drops[i]; if (!a.moving) continue;
      for (let j = drops.length - 1; j >= 0; j--) {
        if (j === i) continue;
        const b = drops[j], dx = a.x - b.x, dy = a.y - b.y, rr = (a.r + b.r) * .8;
        if (dx * dx + dy * dy < rr * rr) {
          a.r = Math.min(maxR, Math.sqrt(a.r * a.r + b.r * b.r)); a.v *= .7; a.ang += rand(-.15, .15);
          drops.splice(j, 1); if (j < i) i--;
        }
      }
    }
  }
  return { drops, spawn, step, maxR };
}
export const stretchOf = d => d.moving ? Math.min(.38, d.v / (d.r * 17) * .38) : 0;

/* WebGL helpers */
const VS = 'attribute vec2 aP; varying vec2 vUv; void main(){ vUv = aP * .5 + .5; gl_Position = vec4(aP, 0., 1.); }';
export function glKit(canvas, fs) {
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'aP'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const texs = {};
  function tex(name, unit, src) {
    let t = texs[name];
    gl.activeTexture(gl.TEXTURE0 + unit);
    if (!t) {
      t = texs[name] = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
      gl.uniform1i(gl.getUniformLocation(pr, name), unit);
    } else gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }
  return { gl, tex, u: n => gl.getUniformLocation(pr, n), draw() { gl.viewport(0, 0, canvas.width, canvas.height); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); } };
}
export function glFailed(stage, err) { if (err) console.warn(err); stage.hidden = true; gctxFallback('This scene needs WebGL, which this browser has turned off.'); }

// Normal-map sprite for one drop: R,G = surface slope, B = thickness, A = coverage with a soft rim so close drops bridge.
let SPRITE = null;
export function dropSprite() {
  if (SPRITE) return SPRITE;
  const s = 64, [c, g] = plain(s, s), im = g.createImageData(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = (x + .5) / s * 2 - 1, dy = (y + .5) / s * 2 - 1, d = Math.hypot(dx, dy), i = (y * s + x) * 4;
    if (d >= 1) continue;
    im.data[i] = 128 + dx * 127; im.data[i + 1] = 128 + dy * 127; im.data[i + 2] = Math.sqrt(1 - d * d) * 255;
    im.data[i + 3] = 255 * Math.min(1, (1 - d) / .3);
  }
  g.putImageData(im, 0, 0);
  return SPRITE = c;
}
