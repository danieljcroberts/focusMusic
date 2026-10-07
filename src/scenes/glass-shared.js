// Shared by every glass scene: extra stages, the city backdrop and photo backgrounds, the drop simulation and WebGL helpers.
import { W, H, fadeCv, gctxFallback } from '../view.js';
import { rand, rgb, layer, plain, glow } from '../util.js';
import { img, ok } from '../assets.js';

export const STAGES = [];
export function addStage(el) { el.classList.add('stage'); el.hidden = true; fadeCv.before(el); STAGES.push(el); return el; }
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
};
export const bgPending = k => !!BGS[k].file && !ok(img(BGS[k].file));
export function paintBg(g, k) { if (BGS[k].file) photoInto(g, img(BGS[k].file)); else paintNightCity(g); }

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
