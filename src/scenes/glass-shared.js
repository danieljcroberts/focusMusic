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
  traffic: { label: 'Night traffic', paint: g => paintTraffic(g), art: { who: 'Original, drawn in code', lic: '', url: '' } },
  foliage: { label: 'Greenhouse plants', paint: g => paintFoliage(g), art: { who: 'Original, drawn in code', lic: '', url: '' } },
};
export const bgPending = k => !!BGS[k].file && !ok(img(BGS[k].file));
export function paintBg(g, k) {
  const b = BGS[k];
  if (b.paint) b.paint(g); else if (b.file) photoInto(g, img(b.file)); else paintNightCity(g);
}

// The road ahead through a windscreen at night: wet asphalt, tail lights, a traffic light, lamps receding, the bonnet below.
export function paintTraffic(g) {
  const hy = H * .46, cx = W * .5;
  const sky = g.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, '#04050c'); sky.addColorStop(1, '#1a1426');
  g.fillStyle = sky; g.fillRect(0, 0, W, hy + 1);
  const road = g.createLinearGradient(0, hy, 0, H);
  road.addColorStop(0, '#15131c'); road.addColorStop(1, '#0a090e');
  g.fillStyle = '#0b0a10'; g.fillRect(0, hy, W, H - hy);
  g.fillStyle = road; g.beginPath(); g.moveTo(cx - 14, hy); g.lineTo(cx + 14, hy); g.lineTo(W * 1.15, H); g.lineTo(-W * .15, H); g.fill();
  g.fillStyle = 'rgba(0,0,0,.6)'; // buildings either side
  for (let x = 0; x < W; x += rand(50, 120)) { if (Math.abs(x - cx) < W * .12) continue; const bh = rand(H * .08, H * .3) * (Math.abs(x - cx) / W + .3); g.fillRect(x, hy - bh, rand(40, 110), bh); }
  g.globalCompositeOperation = 'lighter';
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
}

// Daylight through a greenhouse: pale glass, dense leaves lit from above, a few flowers.
export function paintFoliage(g) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#e8f0e4'); sky.addColorStop(.5, '#b9d2b0'); sky.addColorStop(1, '#5b7c52');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  glow(g, W * .25, 0, W * .5, [255, 250, 225], .7);
  const s = Math.min(W, H) / 800;
  for (let i = 0; i < 220; i++) {
    const y = rand(H * .1, H * 1.05), depth = y / H, x = rand(-40, W + 40), r = rand(26, 70) * s * (.6 + depth * .7);
    const base = [40 + 90 * (1 - depth) * Math.random(), 90 + 110 * (1 - depth * .6), 40 + 50 * Math.random()].map(Math.round);
    g.save(); g.translate(x, y); g.rotate(rand(-1.2, 1.2));
    g.fillStyle = rgb(base, .92); g.beginPath(); g.ellipse(0, 0, r, r * .45, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = rgb(base.map(v => Math.min(255, v + 45)), .5); g.beginPath(); g.ellipse(-r * .2, -r * .12, r * .5, r * .16, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = rgb(base.map(v => v * .6), .6); g.lineWidth = 1; g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke();
    g.restore();
    if (Math.random() < .07) { g.fillStyle = Math.random() < .5 ? 'rgba(240,90,120,.95)' : 'rgba(250,200,80,.95)'; g.beginPath(); g.arc(x + r * .3, y - r * .4, 5 * s, 0, Math.PI * 2); g.fill(); }
  }
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 6; // roof glazing bars
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
