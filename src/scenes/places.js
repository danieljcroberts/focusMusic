// More scenes drawn in code: a lighthouse, a night train, a distant storm, a plane window, a pond and an aquarium.
// The outdoor ones follow the viewer's clock through daylight() and rebuild their sky as the light changes.
import { W, H, ctx } from '../view.js';
import { rand, hash, rgb, layer, glow, stars } from '../util.js';
import { weather } from '../weather.js';
import { daylight, skyMix } from '../daylight.js';

// A vertical gradient whose stops are [position, night, dusk, day] colours, blended by the daylight d.
function paintSky(g, stops, d, h = H) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  for (const [p, n, k, y] of stops) gr.addColorStop(p, rgb(skyMix(n, k, y, d)));
  g.fillStyle = gr; g.fillRect(0, 0, W, h + 1);
}
// Scenes rebuild when the light has moved noticeably since they were drawn.
const stale = built => Math.abs(daylight() - built) > .04;
// Low Tide's water: rows of faint horizontal strokes, denser toward the viewer.
function waterRows(hy, t, col, alpha) {
  const rows = 40; ctx.lineCap = 'round';
  for (let k = 1; k <= rows; k++) {
    const p = k / rows, y = hy + (H - hy) * p * p;
    ctx.strokeStyle = rgb(col, alpha * (.3 + .9 * p)); ctx.lineWidth = .6 + p;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 24) {
      const yy = y + Math.sin(x * .012 / (p + .15) + t * (.4 + p * .6) + k) * 1.6 * p;
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

/* Lighthouse: a headland at night, the beam sweeping through fog, a buoy blinking out on the water */
export function lighthouseScene() {
  let sky, land, fogBand, built = 0, lamp, buoy, blink = 0;
  const hy = () => H * .6;
  const api = {
    init() {
      const d = daylight(); built = d; let g;
      [sky, g] = layer(W, H);
      paintSky(g, [[0, [3, 6, 18], [38, 34, 78], [96, 150, 220]], [.6, [9, 16, 36], [190, 110, 100], [190, 215, 235]], [1, [6, 10, 22], [60, 50, 70], [120, 150, 170]]], d);
      if (d < .5) { g.globalAlpha = 1 - d * 2; stars(g, Math.round(W * H / 2600), hy() * .9); g.globalAlpha = 1; }
      const sea = g.createLinearGradient(0, hy(), 0, H);
      sea.addColorStop(0, rgb(skyMix([10, 18, 40], [70, 55, 90], [50, 110, 160], d))); sea.addColorStop(1, rgb(skyMix([3, 6, 14], [16, 16, 34], [20, 50, 80], d)));
      g.fillStyle = sea; g.fillRect(0, hy(), W, H - hy());
      [land, g] = layer(W, H);
      const s = Math.min(W, H) / 800, ridgeY = x => hy() - H * .18 * Math.pow(Math.max(0, (x - W * .55) / (W * .45)), .6) + Math.sin(x * .02) * 3 * s;
      const rock = skyMix([8, 9, 14], [26, 20, 30], [58, 60, 56], d), grass = skyMix([10, 16, 12], [40, 48, 30], [86, 120, 62], d);
      const rg = g.createLinearGradient(0, hy() - H * .2, 0, H);
      rg.addColorStop(0, rgb(grass)); rg.addColorStop(.3, rgb(rock)); rg.addColorStop(1, rgb(rock.map(v => v * .45)));
      g.fillStyle = rg; g.beginPath(); g.moveTo(W * .55, H);
      for (let x = W * .55; x <= W + 2; x += 6) g.lineTo(x, ridgeY(x));
      g.lineTo(W + 2, H); g.fill();
      g.save(); g.beginPath(); g.moveTo(W * .55, H); for (let x = W * .55; x <= W + 2; x += 6) g.lineTo(x, ridgeY(x)); g.lineTo(W + 2, H); g.clip();
      g.strokeStyle = rgb(rock.map(v => v * .7), .7); g.lineWidth = 2;   // strata in the cliff face
      for (let k = 0; k < 14; k++) {
        g.beginPath();
        for (let x = W * .55; x <= W + 2; x += 20) g.lineTo(x, hy() - H * .02 + k * H * .04 + Math.sin(x * .03 + k) * 4 + (x - W * .55) * .02);
        g.stroke();
      }
      g.restore();
      const tx = W * .82, ty = ridgeY(tx), th = H * .22, tw = 15 * s;
      lamp = { x: tx, y: ty - th - 6 * s };
      const body = g.createLinearGradient(tx - tw, 0, tx + tw, 0);
      const wall = skyMix([30, 32, 44], [140, 120, 130], [236, 236, 230], d);
      body.addColorStop(0, rgb(wall.map(v => v * .55))); body.addColorStop(.45, rgb(wall)); body.addColorStop(1, rgb(wall.map(v => v * .5)));
      g.fillStyle = body; g.beginPath(); g.moveTo(tx - tw, ty + 4); g.lineTo(tx - tw * .7, ty - th); g.lineTo(tx + tw * .7, ty - th); g.lineTo(tx + tw, ty + 4); g.fill();
      g.fillStyle = rgb(skyMix([60, 20, 24], [160, 50, 50], [200, 60, 60], d));
      for (const f of [.25, .6]) g.fillRect(tx - tw * (1 - f * .3), ty - th * f, tw * 2 * (1 - f * .3), th * .09);
      g.fillStyle = rgb(rock); g.fillRect(tx - tw * .95, ty - th - 7 * s, tw * 1.9, 8 * s);
      g.beginPath(); g.moveTo(tx - tw * .8, ty - th - 7 * s); g.lineTo(tx, ty - th - 22 * s); g.lineTo(tx + tw * .8, ty - th - 7 * s); g.fill();
      [fogBand, g] = layer(W, H);
      const fg = g.createLinearGradient(0, hy() - H * .22, 0, hy() + H * .1);
      fg.addColorStop(0, 'rgba(150,165,190,0)'); fg.addColorStop(.6, 'rgba(150,165,190,.55)'); fg.addColorStop(1, 'rgba(150,165,190,0)');
      g.fillStyle = fg; g.fillRect(0, 0, W, H);
      buoy = { x: W * .28, y: hy() + H * .09 };
    },
    draw(t, dt) {
      if (stale(built)) api.init();
      const d = daylight(), night = 1 - d;
      ctx.drawImage(sky, 0, 0, W, H);
      waterRows(hy(), t, skyMix([170, 190, 230], [255, 200, 180], [230, 245, 255], d), .09);
      const fog = .25 + .55 * weather;
      ctx.globalAlpha = fog * (.5 + .5 * night); ctx.drawImage(fogBand, 0, 0, W, H); ctx.globalAlpha = 1;
      // The lamp turns once every eight seconds. The beam is widest and brightest when it faces us.
      const th = t * .785, toward = Math.max(0, Math.sin(th)), dir = Math.cos(th);
      const len = W * 1.3, ex = lamp.x + dir * len, ey = lamp.y - len * (.1 - .22 * toward);
      ctx.globalCompositeOperation = 'lighter';
      const a = (.05 + .22 * fog) * (.35 + .65 * toward) * (.25 + .75 * night);
      const bg = ctx.createLinearGradient(lamp.x, lamp.y, ex, ey);
      bg.addColorStop(0, `rgba(255,236,190,${a})`); bg.addColorStop(1, 'rgba(255,236,190,0)');
      const spread = .035 + .06 * toward, nx = -(ey - lamp.y), ny = ex - lamp.x, nl = Math.hypot(nx, ny) || 1;
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(lamp.x, lamp.y);
      ctx.lineTo(ex + nx / nl * len * spread, ey + ny / nl * len * spread); ctx.lineTo(ex - nx / nl * len * spread, ey - ny / nl * len * spread); ctx.fill();
      glow(ctx, lamp.x, lamp.y, 14 + 90 * toward * toward, [255, 236, 190], (.3 + .7 * toward) * (.3 + .7 * night));
      blink = (blink + dt) % 3;
      if (blink < .3) glow(ctx, buoy.x, buoy.y, 16, [255, 60, 50], .7 * night + .15);
      ctx.fillStyle = `rgba(255,230,180,${.8 * toward * toward * night})`; ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(20,14,16,.9)'; ctx.fillRect(buoy.x - 3, buoy.y - 10, 6, 10);
      ctx.drawImage(land, 0, 0, W, H);
    }
  };
  return api;
}

/* Night Train: the carriage window, lights sliding past at three depths, a lit station now and then */
export function trainScene() {
  let cabin, sky, far, poles, streaks, station = null, nextStation = 40;
  const SPEED = 260;
  return {
    init() {
      let g; [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#04050c'); gr.addColorStop(.5, '#0b0d1c'); gr.addColorStop(.62, '#1a1626'); gr.addColorStop(.7, '#070608'); gr.addColorStop(1, '#040305');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      stars(g, Math.round(W * H / 5000), H * .4);
      glow(g, W * .5, H * .58, W * .7, [120, 90, 140], .18);
      [cabin, g] = layer(W, H);
      g.fillStyle = '#0a0809'; g.fillRect(0, 0, W, H * .09); g.fillRect(0, H * .86, W, H * .14); g.fillRect(W * .94, 0, W * .06, H);
      g.fillStyle = '#1a1416'; g.fillRect(0, H * .085, W * .94, 6); g.fillRect(0, H * .855, W * .94, 8);
      g.fillStyle = '#2a2224'; g.fillRect(0, H * .858, W * .94, 2);
      // Reflections of the carriage lights and a seat back, faint on the glass.
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) glow(g, W * (.2 + .3 * i), H * .17, 90, [255, 225, 190], .07);
      g.fillStyle = 'rgba(255,225,190,.035)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.roundRect(W * (.1 + .3 * i), H * .13, W * .2, 10, 5); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(40,30,34,.35)'; g.beginPath(); g.roundRect(W * .66, H * .5, W * .22, H * .36, 18); g.fill();
      far = Array.from({ length: 70 }, () => ({ x: rand(0, 2 * W), y: H * rand(.5, .6), c: Math.random() < .7 ? [255, 200, 130] : [150, 200, 255], r: rand(.6, 1.5) }));
      poles = Array.from({ length: Math.ceil(2 * W / 220) + 1 }, (_, i) => ({ x: i * 220 }));
      streaks = Array.from({ length: 5 }, () => ({ x: rand(0, 2 * W), y: H * rand(.3, .8), l: rand(80, 220), a: rand(.1, .3) }));
    },
    draw(t, dt) {
      const sway = Math.sin(t * 1.7) * 1.2 + Math.sin(t * .4) * 2;
      ctx.drawImage(sky, 0, sway * .3, W, H);
      ctx.save(); ctx.translate(0, sway);
      ctx.globalCompositeOperation = 'lighter';
      for (const l of far) { l.x -= 22 * dt; if (l.x < -10) l.x += 2 * W; glow(ctx, l.x, l.y, l.r * 6, l.c, .35); ctx.fillStyle = rgb(l.c, .9); ctx.fillRect(l.x, l.y, l.r, l.r); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#05040a'; ctx.fillRect(0, H * .615, W, H * .25);
      // The station: a long lit platform that takes a few seconds to pass.
      nextStation -= dt;
      if (!station && nextStation <= 0) station = { x: W + 40, len: W * 2.6 };
      if (station) {
        station.x -= SPEED * dt;
        const s = station, x0 = Math.max(-10, s.x), x1 = Math.min(W + 10, s.x + s.len);
        if (x1 > x0) {
          ctx.fillStyle = '#2a2622'; ctx.fillRect(x0, H * .58, x1 - x0, H * .05);
          ctx.fillStyle = '#4a4238'; ctx.fillRect(x0, H * .58, x1 - x0, 3);
          ctx.globalCompositeOperation = 'lighter';
          for (let x = s.x + 80; x < s.x + s.len - 40; x += 170) if (x > -40 && x < W + 40) {
            glow(ctx, x, H * .44, 70, [255, 240, 200], .35);
            ctx.fillStyle = 'rgba(255,245,215,.9)'; ctx.fillRect(x - 22, H * .43, 44, 5);
            ctx.fillStyle = 'rgba(255,240,200,.08)'; ctx.fillRect(x - 40, H * .44, 80, H * .14);
          }
          const sx = s.x + s.len * .5; if (sx > -120 && sx < W + 120) { ctx.fillStyle = 'rgba(90,160,255,.9)'; ctx.fillRect(sx - 60, H * .49, 120, 16); }
          ctx.globalCompositeOperation = 'source-over';
        }
        if (s.x + s.len < -60) { station = null; nextStation = rand(60, 130); }
      }
      for (const p of poles) {
        p.x -= SPEED * dt; if (p.x < -30) p.x += poles.length * 220;
        ctx.strokeStyle = '#06050a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, H * .64); ctx.lineTo(p.x, H * .34); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x - 1, H * .36); ctx.lineTo(p.x + 24, H * .36); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x + 24, H * .37); ctx.quadraticCurveTo(p.x + 134, H * .41, p.x + 244, H * .37); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const s of streaks) { s.x -= 900 * dt; if (s.x + s.l < 0) { s.x = W + rand(0, W); s.y = H * rand(.3, .8); } ctx.fillStyle = `rgba(255,230,200,${s.a})`; ctx.fillRect(s.x, s.y, s.l, 1.5); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      ctx.drawImage(cabin, 0, 0, W, H);
    }
  };
}

/* Storm on the Plain: a cloud bank lit from inside, a rain curtain, lightning kept at the horizon */
export function stormScene() {
  let sky, clouds, ground, flash = null, next = 8, curtain;
  const hy = () => H * .68;
  return {
    init() {
      let g; [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, hy());
      gr.addColorStop(0, '#07080f'); gr.addColorStop(.6, '#141a2a'); gr.addColorStop(1, '#2a2f44');
      g.fillStyle = gr; g.fillRect(0, 0, W, hy() + 1);
      [clouds, g] = layer(W, H);
      for (let i = 0; i < 160; i++) {
        const y = H * (.12 + .5 * Math.pow(Math.random(), .7)), r = rand(40, 130) * Math.max(.6, W / 1400);
        const dark = (y - H * .12) / (H * .5);
        const cg = g.createRadialGradient(0, 0, 0, 0, 0, r); const c = [26 - 14 * dark, 30 - 14 * dark, 44 - 16 * dark].map(Math.round);
        cg.addColorStop(0, rgb(c, .9)); cg.addColorStop(1, rgb(c, 0));
        g.save(); g.translate(rand(-r, W + r), y); g.fillStyle = cg; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.restore();
      }
      [ground, g] = layer(W, H);
      const gg = g.createLinearGradient(0, hy(), 0, H);
      gg.addColorStop(0, '#171c16'); gg.addColorStop(1, '#070906');
      g.fillStyle = gg; g.fillRect(0, hy(), W, H - hy());
      g.fillStyle = '#05060a';
      const tx = W * .18, ty = hy() + 2; // a lone tree
      g.fillRect(tx - 3, ty - H * .06, 6, H * .06);
      for (const [dx, dy, r] of [[0, -H * .085, H * .035], [-H * .025, -H * .07, H * .028], [H * .025, -H * .072, H * .026]]) { g.beginPath(); g.arc(tx + dx, ty + dy, r, 0, Math.PI * 2); g.fill(); }
      for (let x = W * .4; x < W; x += rand(70, 110)) { g.fillRect(x, hy() - 10, 2, 14); } // fence posts
      g.strokeStyle = 'rgba(5,6,10,.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(W * .4, hy() - 6); g.lineTo(W, hy() - 6); g.stroke();
      curtain = { x: W * rand(.45, .7), w: W * .3, drift: 0 };
    },
    draw(t, dt) {
      ctx.drawImage(sky, 0, 0, W, H);
      ctx.drawImage(clouds, 0, 0, W, H);
      // Rain falling from the cloud base, drifting slowly across the plain.
      curtain.drift += dt * 6; curtain.x += Math.sin(t * .05) * dt * 4;
      ctx.strokeStyle = `rgba(150,165,190,${.04 + .05 * weather})`; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const x = curtain.x + (i / 40) * curtain.w + Math.sin(i * 1.7) * 6, off = (curtain.drift * 9 + i * 37) % (H * .2);
        ctx.moveTo(x, H * .5 + off); ctx.lineTo(x - 3, Math.min(hy(), H * .5 + off + H * .06));
      }
      ctx.stroke();
      next -= dt;
      if (!flash && next <= 0) { flash = { x: rand(.08, .92) * W, y: H * rand(.25, .5), life: 0, dur: rand(.3, .7), bolt: Math.random() < .35, seed: rand(0, 100) }; next = rand(7, 26) / (.4 + weather); }
      if (flash) {
        flash.life += dt;
        const p = flash.life / flash.dur;
        if (p >= 1) flash = null;
        else {
          const inten = Math.sin(p * Math.PI) * (.6 + .4 * Math.abs(Math.sin(p * 31 + flash.seed))) * (.65 + .35 * Math.sin(flash.life * 90));
          ctx.globalCompositeOperation = 'lighter';
          ctx.save(); ctx.beginPath(); ctx.rect(0, H * .1, W, H * .54); ctx.clip();
          glow(ctx, flash.x, flash.y, W * .45, [190, 200, 255], .5 * inten);
          glow(ctx, flash.x, flash.y, W * .12, [230, 235, 255], .6 * inten);
          ctx.restore();
          if (flash.bolt && p > .15 && p < .55) {
            ctx.strokeStyle = `rgba(235,240,255,${.9 * inten})`; ctx.lineWidth = 1.5; ctx.beginPath();
            let x = flash.x, y = H * .6; ctx.moveTo(x, y);
            for (let k = 1; k <= 7; k++) { x += (hash(k, flash.seed) - .5) * 40; y = H * .6 + (hy() - H * .6) * k / 7; ctx.lineTo(x, y); }
            ctx.stroke(); glow(ctx, flash.x, H * .64, 60, [200, 210, 255], .4 * inten);
          }
          ctx.fillStyle = `rgba(170,180,230,${.1 * inten})`; ctx.fillRect(0, hy(), W, H - hy());
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.drawImage(ground, 0, 0, W, H);
    }
  };
}

/* Above the Clouds: a plane window at the hour the clock says, cloud decks sliding by, the wingtip light blinking */
export function cloudsScene() {
  let sky, decks, wing, built = 0, tip;
  const api = {
    init() {
      const d = daylight(); built = d; let g;
      [sky, g] = layer(W, H);
      paintSky(g, [[0, [4, 6, 20], [22, 30, 90], [70, 130, 225]], [.5, [12, 16, 40], [130, 70, 120], [150, 195, 240]], [.62, [20, 20, 50], [250, 150, 90], [220, 230, 245]], [1, [10, 12, 30], [60, 40, 70], [170, 190, 210]]], d);
      if (d < .5) { g.globalAlpha = 1 - d * 2; stars(g, Math.round(W * H / 3000), H * .5); g.globalAlpha = 1; }
      if (d > .1) glow(g, W * .72, H * .6, W * .35, [255, 200, 130], .5 * Math.min(1, d * 2));
      const top = skyMix([40, 44, 70], [255, 190, 150], [255, 255, 255], d), under = skyMix([14, 16, 30], [90, 60, 100], [170, 185, 205], d);
      decks = [[.52, 6, .35, 60], [.64, 14, .8, 110], [.84, 32, .9, 150]].map(([y, v, alpha, size]) => {
        const w = Math.ceil(W * 2), [c, cg] = layer(w, H * .5);
        for (let i = 0; i < 110; i++) {
          const r = rand(size * .4, size) * Math.max(.6, W / 1400), x = rand(0, w), yy = rand(H * .02, H * .2);
          const k = yy / (H * .2), col = top.map((v, j) => Math.round(v + (under[j] - v) * k));
          const cg2 = cg.createRadialGradient(x, yy, 0, x, yy, r);
          cg2.addColorStop(0, rgb(col, .55)); cg2.addColorStop(1, rgb(col, 0));
          cg.fillStyle = cg2; cg.beginPath(); cg.arc(x, yy, r, 0, Math.PI * 2); cg.fill();
        }
        return { c, y: H * y, v, alpha, w, x: 0 };
      });
      [wing, g] = layer(W, H);
      const wy = H * .76, tx = W * .6, ty = H * .83;
      tip = { x: tx, y: ty };
      const wg = g.createLinearGradient(0, wy, 0, H);
      wg.addColorStop(0, rgb(skyMix([38, 40, 50], [120, 90, 100], [200, 205, 215], d))); wg.addColorStop(.3, rgb(skyMix([20, 22, 30], [60, 50, 65], [140, 145, 158], d))); wg.addColorStop(1, '#0a0b10');
      g.fillStyle = wg; g.beginPath(); g.moveTo(-2, wy); g.lineTo(tx, ty); g.lineTo(tx + 10, ty + H * .03); g.lineTo(-2, H * .97); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-2, wy); g.lineTo(tx, ty); g.stroke();
    },
    draw(t, dt) {
      if (stale(built)) api.init();
      ctx.drawImage(sky, 0, 0, W, H);
      for (const dk of decks) {
        dk.x = (dk.x + dk.v * dt) % dk.w;
        ctx.globalAlpha = dk.alpha;
        for (let x = -dk.x; x < W; x += dk.w) ctx.drawImage(dk.c, x, dk.y + Math.sin(t * .1 + dk.y) * 2, dk.w, H * .5);
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(wing, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, tip.x - 6, tip.y, 10, [255, 40, 40], .8);
      const c = t % 1.5; if (c < .07 || (c > .2 && c < .27)) glow(ctx, tip.x - 2, tip.y - 2, 60, [255, 255, 255], .9);
      ctx.globalCompositeOperation = 'source-over';
    }
  };
  return api;
}

/* Pond: rain rings on dark water, lily pads, a fish shadow now and then */
export function pondScene() {
  let base, pads, rings, fish = null, nextFish = 12, built = 0;
  const api = {
    init() {
      const d = daylight(); built = d; let g;
      [base, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, rgb(skyMix([8, 12, 20], [50, 40, 70], [60, 100, 120], d))); gr.addColorStop(.5, rgb(skyMix([5, 9, 14], [22, 28, 44], [30, 60, 70], d))); gr.addColorStop(1, rgb(skyMix([3, 6, 8], [10, 16, 20], [14, 30, 32], d)));
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      glow(g, W * .3, H * .1, W * .5, skyMix([40, 50, 90], [255, 170, 120], [230, 240, 255], d), .18);
      [pads, g] = layer(W, H);
      const padCol = skyMix([10, 24, 16], [30, 60, 34], [50, 110, 50], d), edge = skyMix([18, 40, 26], [50, 90, 50], [90, 160, 80], d);
      for (let i = 0; i < 9; i++) {
        const y = H * rand(.3, .95), s = .5 + y / H, r = rand(26, 44) * s, x = rand(0, W), rot = rand(0, 6.28);
        g.fillStyle = rgb(padCol); g.beginPath(); g.ellipse(x, y, r, r * .42, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = rgb(edge, .5); g.beginPath(); g.ellipse(x, y - 1.5, r, r * .42, 0, Math.PI, Math.PI * 2); g.fill();
        g.fillStyle = rgb(padCol); g.beginPath(); g.ellipse(x, y, r, r * .42, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = rgb(edge, .8); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(rot) * r, y + Math.sin(rot) * r * .42); g.stroke();
      }
      g.strokeStyle = rgb(skyMix([14, 22, 12], [40, 50, 30], [70, 100, 50], d)); g.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const x = rand(0, W * .12), y0 = H * rand(.7, 1), h = H * rand(.3, .55); g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + 10, y0 - h * .6, x + rand(-10, 20), y0 - h); g.stroke(); }
      rings = [];
    },
    draw(t, dt) {
      if (stale(built)) api.init();
      ctx.drawImage(base, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const y = H * (.2 + .12 * i), x = W * .3 + Math.sin(t * .3 + i) * 30; ctx.fillStyle = `rgba(200,210,240,${.025 + .02 * Math.sin(t * .7 + i * 2)})`; ctx.beginPath(); ctx.ellipse(x, y, 90 + 20 * i, 3, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
      // Rings spread for a couple of seconds; the perspective squashes them.
      const rate = 1 + 9 * weather;
      if (Math.random() < dt * rate) rings.push({ x: rand(0, W), y: H * rand(.08, 1), life: 0 });
      ctx.lineWidth = 1;
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]; r.life += dt / 2.4;
        if (r.life >= 1) { rings.splice(i, 1); continue; }
        const s = .4 + r.y / H, rad = r.life * 46 * s, a = (1 - r.life) * .45;
        ctx.strokeStyle = `rgba(215,228,255,${a})`;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, rad, rad * .34, 0, 0, Math.PI * 2); ctx.stroke();
        if (r.life > .25) { ctx.strokeStyle = `rgba(215,228,255,${a * .6})`; ctx.beginPath(); ctx.ellipse(r.x, r.y, rad * .55, rad * .19, 0, 0, Math.PI * 2); ctx.stroke(); }
        if (r.life < .08) { ctx.fillStyle = `rgba(230,240,255,${.6 - r.life * 6})`; ctx.beginPath(); ctx.arc(r.x, r.y - 3 + r.life * 30, 1.2, 0, Math.PI * 2); ctx.fill(); }
      }
      nextFish -= dt;
      if (!fish && nextFish <= 0) { const ltr = Math.random() < .5; fish = { x0: ltr ? -80 : W + 80, x1: ltr ? W + 80 : -80, y: H * rand(.45, .85), p: 0, dur: rand(10, 16) }; }
      if (fish) {
        fish.p += dt / fish.dur;
        if (fish.p >= 1) { fish = null; nextFish = rand(18, 40); }
        else {
          const x = fish.x0 + (fish.x1 - fish.x0) * fish.p, y = fish.y + Math.sin(fish.p * 9) * 14, dir = Math.sign(fish.x1 - fish.x0), s = .5 + fish.y / H;
          ctx.fillStyle = 'rgba(2,4,6,.4)';
          ctx.beginPath(); ctx.ellipse(x, y, 34 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
          const wag = Math.sin(t * 7) * 6 * s;
          ctx.beginPath(); ctx.moveTo(x - dir * 30 * s, y); ctx.lineTo(x - dir * 52 * s, y - 10 * s + wag); ctx.lineTo(x - dir * 52 * s, y + 10 * s + wag); ctx.fill();
        }
      }
      ctx.drawImage(pads, 0, 0, W, H);
    }
  };
  return api;
}

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
