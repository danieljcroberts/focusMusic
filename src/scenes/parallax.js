// Image-based scenes built from CC0 art: tiled parallax layers and slow pans over a single still.
import { W, H, ctx } from '../view.js';
import { rand } from '../util.js';
import { img, ok } from '../assets.js';

// Tiled parallax layers. Speeds are in source-art pixels per second; pixel art steps whole art pixels.
export function parallaxScene(o) {
  return {
    init() { o.layers.forEach(l => img(l.src)); (o.preload || []).forEach(img); },
    draw(t, dt) {
      ctx.fillStyle = o.bg || '#000'; ctx.fillRect(0, 0, W, H);
      const s = Math.max(W / o.bw, H / o.bh), lw = o.bw * s, lh = o.bh * s;
      const y = o.anchor === 'center' ? (H - lh) / 2 : H - lh;
      ctx.imageSmoothingEnabled = !!o.smooth;
      for (const l of o.layers) {
        const im = img(l.src); if (!ok(im)) continue;
        ctx.globalAlpha = l.alpha ? l.alpha(t) : 1;
        const yy = y + (l.bob ? l.bob(t) * s : 0);
        let off = (t * (l.v || 0) * s) % lw;
        if (!o.smooth) off = Math.round(off / s) * s;
        for (let x = -off; x < W; x += lw) ctx.drawImage(im, Math.round(x), Math.round(yy), Math.ceil(lw) + 1, Math.ceil(lh));
      }
      ctx.globalAlpha = 1;
      if (o.extra) o.extra(t, dt, { s, y, lw, lh });
      ctx.imageSmoothingEnabled = true;
    }
  };
}

// A single still image with a slow pan and zoom.
export function driftScene(o) {
  return {
    init() { img(o.src); if (o.setup) o.setup(); },
    draw(t, dt) {
      ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H);
      const im = img(o.src);
      if (ok(im)) {
        const z = 1.08 + .04 * Math.sin(t * .021);
        const s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * z;
        const w = im.naturalWidth * s, h = im.naturalHeight * s;
        const px = (W - w) / 2 + Math.sin(t * .013) * (w - W) * .4, py = (H - h) / 2 + Math.cos(t * .011) * (h - H) * .4;
        ctx.drawImage(im, px, py, w, h);
      }
      if (o.extra) o.extra(t, dt);
    }
  };
}

// Night sky additions: our own twinkling stars and the odd shooting star.
export function skyExtras() {
  let tw = [], meteor = null, next = 6;
  return {
    setup() { tw = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * .7, ph: rand(0, 6.28), sp: rand(.6, 1.8), r: rand(.6, 1.4) })); },
    extra(t, dt) {
      ctx.globalCompositeOperation = 'lighter';
      for (const s of tw) {
        ctx.fillStyle = `rgba(230,236,255,${.5 * Math.pow(Math.max(0, Math.sin(t * s.sp + s.ph)), 3)})`;
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx.fill();
      }
      next -= dt;
      if (!meteor && next <= 0) { meteor = { x: rand(.2, .9) * W, y: rand(.05, .35) * H, life: 0 }; next = rand(9, 20); }
      if (meteor) {
        meteor.life += dt / 1.1;
        const p = meteor.life, len = 120, x = meteor.x - p * 260, y = meteor.y + p * 110;
        const g = ctx.createLinearGradient(x, y, x + len, y - len * .42);
        g.addColorStop(0, `rgba(255,255,255,${.8 * (1 - p)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y - len * .42); ctx.stroke();
        if (p >= 1) meteor = null;
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  };
}
