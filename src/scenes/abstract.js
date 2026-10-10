// Abstract: small simulations and shaders that drift with the music. Calm by default; Lively speeds them up.
import { W, H, ctx, lowPower, lively } from '../view.js';
import { rand, rgb, layer, plain, glow } from '../util.js';
import { bands, spectrum, musicPlaying } from '../music.js';
import { shaderScene } from './trip.js';

// A simulation grid whose long side is `long` cells, shaped like the screen.
function gridSize(long) {
  const a = W / Math.max(1, H);
  return a >= 1 ? [long, Math.max(8, Math.round(long / a))] : [Math.max(8, Math.round(long * a)), long];
}
// A low-resolution buffer drawn over the whole screen with smoothing.
function blit(c) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(c, 0, 0, W, H); }
// True on a clear rise in the bass, at most once every few seconds.
function bassHits(gap = 3) {
  let avg = 0, cool = 0;
  return dt => {
    const b = bands.bass, hit = b > .4 && b - avg > .22 && cool <= 0;
    avg += (b - avg) * Math.min(1, dt * 1.2); cool -= dt;
    if (hit) cool = gap;
    return hit;
  };
}
const smooth01 = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

/* Ink in Water: drops of ink falling into a clear tank and curling into clouds (a small stable-fluids solver) */
export function inkScene() {
  const INKS = [[38, 56, 148], [176, 36, 72], [18, 122, 134], [206, 142, 36], [104, 40, 122], [222, 88, 66], [24, 84, 160]];
  let gw, gh, dw, dh, u, v, u2, v2, p, dv, cu, dye, dye2, bg, buf, bg2, im, glass, drops, nextDrop, ink = 0;
  const hit = bassHits(4);
  const at = (a, x, y) => a[Math.min(gh - 1, Math.max(0, y)) * gw + Math.min(gw - 1, Math.max(0, x))];
  function sample(a, x, y) {
    if (x < 0) x = 0; else if (x > gw - 1.001) x = gw - 1.001;
    if (y < 0) y = 0; else if (y > gh - 1.001) y = gh - 1.001;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * gw + x0;
    return (a[i] * (1 - fx) + a[i + 1] * fx) * (1 - fy) + (a[i + gw] * (1 - fx) + a[i + gw + 1] * fx) * fy;
  }
  function splat(x, y, r, fx, fy, col, amt) {
    const r2 = r * r, x0 = Math.max(0, Math.floor(x - r * 2)), x1 = Math.min(gw - 1, Math.ceil(x + r * 2)), y0 = Math.max(0, Math.floor(y - r * 2)), y1 = Math.min(gh - 1, Math.ceil(y + r * 2));
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const w = Math.exp(-((i - x) ** 2 + (j - y) ** 2) / r2), k = j * gw + i;
      u[k] += fx * w; v[k] += fy * w;
    }
    if (!col) return;
    const dr = r * 2 * .7, dr2 = dr * dr, cx = x * 2 + .5, cy = y * 2 + .5;
    for (let j = Math.max(0, Math.floor(cy - dr * 2)); j <= Math.min(dh - 1, Math.ceil(cy + dr * 2)); j++)
      for (let i = Math.max(0, Math.floor(cx - dr * 2)); i <= Math.min(dw - 1, Math.ceil(cx + dr * 2)); i++) {
        const w = Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / dr2) * amt, k = (j * dw + i) * 3;
        dye[k] += col[0] * w; dye[k + 1] += col[1] * w; dye[k + 2] += col[2] * w;
      }
  }
  function drop() {
    const c = INKS[ink % INKS.length].map(v => -Math.log(Math.max(.04, v / 255)));
    drops.push({ x: gw * (.2 + .6 * ((ink * .618 + .3) % 1)), y: gh * rand(.06, .22), vy: gh * rand(.22, .32), wob: rand(0, 6), life: 0, c, r: Math.max(1.6, Math.min(gw, gh) / 30) });
    ink++;
  }
  function project() {
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++)
      dv[y * gw + x] = -.5 * (at(u, x + 1, y) - at(u, x - 1, y) + at(v, x, y + 1) - at(v, x, y - 1));
    const iters = lowPower ? 10 : 18;
    for (let n = 0; n < iters; n++)
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++)
        p[y * gw + x] = (dv[y * gw + x] + at(p, x - 1, y) + at(p, x + 1, y) + at(p, x, y - 1) + at(p, x, y + 1)) * .25;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const k = y * gw + x;
      u[k] -= .5 * (at(p, x + 1, y) - at(p, x - 1, y)); v[k] -= .5 * (at(p, x, y + 1) - at(p, x, y - 1));
      if (x === 0 || x === gw - 1) u[k] = 0;
      if (y === 0 || y === gh - 1) v[k] = 0;
    }
  }
  function confine(dt, eps) {
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++)
      cu[y * gw + x] = .5 * (at(v, x + 1, y) - at(v, x - 1, y) - at(u, x, y + 1) + at(u, x, y - 1));
    for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
      const k = y * gw + x, nx = .5 * (Math.abs(cu[k + 1]) - Math.abs(cu[k - 1])), ny = .5 * (Math.abs(cu[k + gw]) - Math.abs(cu[k - gw])), l = Math.hypot(nx, ny) + 1e-5;
      u[k] += eps * dt * (ny / l) * cu[k]; v[k] -= eps * dt * (nx / l) * cu[k];
    }
  }
  return {
    init() {
      [gw, gh] = gridSize(lowPower ? 88 : 120); dw = gw * 2; dh = gh * 2;
      const n = gw * gh;
      [u, v, u2, v2, p, dv, cu] = Array.from({ length: 7 }, () => new Float32Array(n));
      dye = new Float32Array(dw * dh * 3); dye2 = new Float32Array(dw * dh * 3); bg = new Float32Array(dw * dh * 3);
      for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) {   // clear water lit from behind, brightest a little above centre
        const x = i / dw - .5, y = j / dh - .42, l = .82 + .2 * Math.exp(-(x * x * 3 + y * y * 2.4)) - .1 * (j / dh) ** 2, k = (j * dw + i) * 3;
        bg[k] = 236 * l; bg[k + 1] = 244 * l; bg[k + 2] = 246 * l;
      }
      [buf, bg2] = plain(dw, dh); im = bg2.createImageData(dw, dh);
      let g; [glass, g] = layer(W, H);
      const sh = g.createLinearGradient(0, 0, W, 0);   // the tank's glass: soft vertical sheen and darker sides
      sh.addColorStop(0, 'rgba(40,70,80,.22)'); sh.addColorStop(.08, 'rgba(255,255,255,.0)'); sh.addColorStop(.16, 'rgba(255,255,255,.06)');
      sh.addColorStop(.22, 'rgba(255,255,255,0)'); sh.addColorStop(.9, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(40,70,80,.22)');
      g.fillStyle = sh; g.fillRect(0, 0, W, H);
      const top = g.createLinearGradient(0, 0, 0, H * .06);
      top.addColorStop(0, 'rgba(120,160,170,.25)'); top.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = top; g.fillRect(0, 0, W, H * .06);
      drops = []; nextDrop = 1; ink = Math.floor(rand(0, INKS.length)); drop();
    },
    draw(t, dt) {
      const sp = lively ? 1.6 : 1, h = dt * sp;
      nextDrop -= h;
      if (nextDrop <= 0 || hit(dt)) { drop(); nextDrop = rand(6, 10); }
      for (let i = drops.length - 1; i >= 0; i--) {   // each drop sinks, slowing, and keeps feeding ink into its plume
        const d = drops[i]; d.life += h;
        const fade = Math.max(0, 1 - d.life / 2.6);
        splat(d.x + Math.sin(d.life * 3 + d.wob) * .3, d.y, d.r, 0, d.vy * h * 3 * fade, fade > 0 ? d.c : null, h * 4.5 * fade);
        d.y += d.vy * h; d.vy *= Math.exp(-h * .9);
        if (fade <= 0) drops.splice(i, 1);
      }
      const ph = t * .07, amb = gw * .004 * (1 + bands.mid * 1.5);   // a faint convection keeps the water from going still
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const k = y * gw + x, X = x / gw * 6.28, Y = y / gh * 6.28;
        u[k] += Math.sin(Y * 1.3 + ph) * amb * h; v[k] += Math.sin(X * 1.1 - ph * .8) * amb * h * .6;
      }
      confine(h, 3);
      project();
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const k = y * gw + x;
        u2[k] = sample(u, x - h * u[k], y - h * v[k]) * (1 - h * .08); v2[k] = sample(v, x - h * u[k], y - h * v[k]) * (1 - h * .08);
      }
      [u, u2] = [u2, u]; [v, v2] = [v2, v];
      const keep = 1 - h * .009;
      for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) {
        const gx = (i - .5) * .5, gy = (j - .5) * .5;
        let sx = i - 2 * h * sample(u, gx, gy), sy = j - 2 * h * sample(v, gx, gy);
        if (sx < 0) sx = 0; else if (sx > dw - 1.001) sx = dw - 1.001;
        if (sy < 0) sy = 0; else if (sy > dh - 1.001) sy = dh - 1.001;
        const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, a = (y0 * dw + x0) * 3, b = a + 3, c = a + dw * 3, e = c + 3, k = (j * dw + i) * 3;
        const w0 = (1 - fx) * (1 - fy), w1 = fx * (1 - fy), w2 = (1 - fx) * fy, w3 = fx * fy;
        for (let q = 0; q < 3; q++) dye2[k + q] = (dye[a + q] * w0 + dye[b + q] * w1 + dye[c + q] * w2 + dye[e + q] * w3) * keep;
      }
      [dye, dye2] = [dye2, dye];
      const px = im.data;
      for (let i = 0, o = 0; i < dye.length; i += 3, o += 4) {
        px[o] = bg[i] * Math.exp(-dye[i]); px[o + 1] = bg[i + 1] * Math.exp(-dye[i + 1]); px[o + 2] = bg[i + 2] * Math.exp(-dye[i + 2]); px[o + 3] = 255;
      }
      bg2.putImageData(im, 0, 0);
      blit(buf);
      ctx.drawImage(glass, 0, 0, W, H);
    }
  };
}

/* Reaction-Diffusion: Gray-Scott coral and spots growing, splitting and slowly changing their minds */
export function reactionScene() {
  let w, h, A, B, A2, B2, buf, bg2, im, tint, f = .0545, k = .062, seedIn = 8;
  const hit = bassHits(5);
  function seed(n, r) {
    for (let s = 0; s < n; s++) {
      const cx = rand(0, w) | 0, cy = rand(0, h) | 0;
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) {
        const i = ((cy + y + h) % h) * w + (cx + x + w) % w; B[i] = .5 + rand(0, .2); A[i] = .4;
      }
    }
  }
  function step() {
    for (let y = 0; y < h; y++) {
      const r = y * w, ru = ((y - 1 + h) % h) * w, rd = ((y + 1) % h) * w;
      for (let x = 0; x < w; x++) {
        const xl = x === 0 ? w - 1 : x - 1, xr = x === w - 1 ? 0 : x + 1, i = r + x;
        const a = A[i], b = B[i];
        const la = .2 * (A[r + xl] + A[r + xr] + A[ru + x] + A[rd + x]) + .05 * (A[ru + xl] + A[ru + xr] + A[rd + xl] + A[rd + xr]) - a;
        const lb = .2 * (B[r + xl] + B[r + xr] + B[ru + x] + B[rd + x]) + .05 * (B[ru + xl] + B[ru + xr] + B[rd + xl] + B[rd + xr]) - b;
        const abb = a * b * b;
        A2[i] = a + la - abb + f * (1 - a);
        B2[i] = b + .5 * lb + abb - (k + f) * b;
      }
    }
    [A, A2] = [A2, A]; [B, B2] = [B2, B];
  }
  return {
    init() {
      [w, h] = gridSize(lowPower ? 160 : 240);
      A = new Float32Array(w * h).fill(1); B = new Float32Array(w * h); A2 = new Float32Array(w * h); B2 = new Float32Array(w * h);
      seed(Math.round(w * h / 500) + 4, 2);
      for (let i = 0; i < (lowPower ? 250 : 500); i++) step();   // start part-grown
      [buf, bg2] = plain(w, h); im = bg2.createImageData(w, h);
      tint = new Float32Array(w * h * 3);   // the colonies take their colour from where they grow: coral, sea glass, pale gold
      const C = [[236, 118, 96], [118, 200, 188], [242, 204, 128]], ph = rand(0, 6.28);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const X = x / w * 6.28, Y = y / h * 6.28, i = (y * w + x) * 3;
        const a = .5 + .5 * Math.sin(X * .7 + Y * .4 + ph), b = .5 + .5 * Math.sin(Y * .8 - X * .3 + ph * 2);
        for (let c = 0; c < 3; c++) tint[i + c] = C[0][c] * (1 - a) * (1 - b * .6) + C[1][c] * a * (1 - b * .6) + C[2][c] * b * .6;
      }
    },
    draw(t, dt) {
      const s = .5 + .5 * Math.sin(t * 6.28 / 300);   // drifts between coral and dividing spots over five minutes
      f = .0367 + (.0545 - .0367) * s; k = .0649 + (.062 - .0649) * s;
      seedIn -= dt;
      if (seedIn <= 0 || hit(dt)) { seed(1, 3); seedIn = rand(10, 16); }
      const n = Math.round((lowPower ? 3 : 5) * (lively ? 2 : 1) * (1 + bands.mid * .6));
      for (let i = 0; i < n; i++) step();
      const px = im.data, glowUp = 1 + bands.bass * .12;
      for (let y = 0; y < h; y++) {
        const r = y * w, ru = ((y - 1 + h) % h) * w;
        for (let x = 0; x < w; x++) {
          const i = r + x, b = B[i], gx = b - B[r + (x === 0 ? w - 1 : x - 1)], gy = b - B[ru + x];
          const sh = (gx + gy) * 3.2, s = smooth01((b - .05) * 3.4), core = s * s * s * .3, o = i * 4, c = i * 3;
          const lit = (1 + Math.min(0, sh)) * glowUp, hi = Math.max(0, sh) * 255;
          px[o] = (12 + (tint[c] * .8 - 12) * s + 255 * core) * lit + hi;
          px[o + 1] = (22 + (tint[c + 1] * .8 - 22) * s + 240 * core) * lit + hi;
          px[o + 2] = (40 + (tint[c + 2] * .8 - 40) * s + 225 * core) * lit + hi; px[o + 3] = 255;
        }
      }
      bg2.putImageData(im, 0, 0);
      blit(buf);
    }
  };
}

/* Flow Field: thousands of motes riding a slowly turning curl-noise current, leaving silk behind them */
export function flowScene() {
  const BG = [8, 10, 22], GROUPS = 6;
  let trail, tg, vign, n, px, py, life, clock = 0, frame = 0, waves;
  const respawn = i => { px[i] = rand(-10, W + 10); py[i] = rand(-10, H + 10); life[i] = rand(3, 12); };
  return {
    init() {
      [trail, tg] = layer(W, H); tg.fillStyle = rgb(BG); tg.fillRect(0, 0, W, H);
      let g; [vign, g] = layer(W, H);
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.hypot(W, H) * .6);
      gr.addColorStop(0, 'rgba(4,5,12,0)'); gr.addColorStop(1, 'rgba(4,5,12,.6)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      n = Math.round((lowPower ? 1400 : 4200) * Math.min(1.3, Math.max(.5, W * H / 1.3e6)));
      px = new Float32Array(n); py = new Float32Array(n); life = new Float32Array(n);
      for (let i = 0; i < n; i++) respawn(i);
      const S = Math.min(W, H);   // a stream function made of a few slow waves; its curl has no sources or sinks, so motes never pile up
      waves = Array.from({ length: 5 }, (_, j) => {
        const a = rand(0, 6.28), kk = (1.6 + j * 1.1) / S * 6.28;
        return { kx: Math.cos(a) * kk, ky: Math.sin(a) * kk, w: rand(-.35, .35), ph: rand(0, 6.28), amp: 1 / (1 + j * .7) / kk };
      });
    },
    draw(t, dt) {
      clock += dt * (lively ? 2 : 1) * (1 + bands.mid * 2.5);
      const S = Math.min(W, H), speed = S * .07 * (lively ? 1.8 : 1) * (1 + bands.bass * .35);
      tg.globalCompositeOperation = 'source-over';
      tg.fillStyle = rgb(BG, ++frame % 24 ? .014 : .08); tg.fillRect(0, 0, W, H);   // the rare stronger pass clears what 8-bit fading leaves behind
      tg.lineWidth = Math.max(1, Math.min(W, H) / 700); tg.lineCap = 'round';
      const hue = 190 + (t / 4) % 360;   // the palette turns all the way round every 24 minutes
      for (let gI = 0; gI < GROUPS; gI++) {
        tg.strokeStyle = `hsla(${(hue + gI * 22) % 360},66%,${64 + gI * 3}%,.75)`;
        tg.beginPath();
        for (let i = gI; i < n; i += GROUPS) {
          const x = px[i], y = py[i];
          let vx = 0, vy = 0;
          for (const q of waves) {
            const c = q.amp * Math.cos(q.kx * x + q.ky * y + q.w * clock + q.ph);
            vx += c * q.ky; vy -= c * q.kx;
          }
          const nx = x + vx * speed * dt * 1.6, ny = y + vy * speed * dt * 1.6;
          life[i] -= dt;
          if (life[i] <= 0 || nx < -20 || nx > W + 20 || ny < -20 || ny > H + 20) { respawn(i); continue; }
          tg.moveTo(x, y); tg.lineTo(nx, ny); px[i] = nx; py[i] = ny;
        }
        tg.stroke();
      }
      ctx.drawImage(trail, 0, 0, W, H);
      ctx.drawImage(vign, 0, 0, W, H);
    }
  };
}

/* Voronoi Glass: a stained-glass window whose cells slowly drift, swell, split and merge, lit from behind */
export const voronoiScene = () => shaderScene(`
vec2 h22(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
vec2 site(vec2 c, float t){ vec2 o = h22(c); return .5 + .38 * sin(t * (.5 + .5 * o.yx) + 6.2831 * o); }
float wgt(vec2 c, float t){ float o = h22(c + 7.3).x; return .2 * sin(t * (.3 + .25 * o) + o * 40.); }
// A power diagram: each site carries a weight that swells and shrinks, so cells grow, vanish into their neighbours and return.
vec3 cells(vec2 x, float t){
  vec2 n = floor(x), f = fract(x), mg = vec2(0.), mr = vec2(0.); float md = 1e9, mw = 0.;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = vec2(float(i), float(j)), r = g + site(n + g, t) - f; float w = wgt(n + g, t), d = dot(r, r) - w;
    if (d < md) { md = d; mr = r; mg = g; mw = w; }
  }
  float bd = 1e9;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j)), r = g + site(n + g, t) - f; float w = wgt(n + g, t);
    vec2 e = r - mr; float l = length(e);
    if (l > .0001) bd = min(bd, (dot(r, r) - dot(mr, mr) - w + mw) / (2. * l));
  }
  return vec3(bd, n + mg);
}
vec3 jewel(float h){
  if (h < .16) return vec3(.62, .05, .1);
  if (h < .32) return vec3(.06, .17, .62);
  if (h < .46) return vec3(.04, .45, .26);
  if (h < .6) return vec3(.92, .55, .08);
  if (h < .72) return vec3(.42, .12, .55);
  if (h < .86) return vec3(.04, .42, .52);
  return vec3(.82, .8, .62);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / min(uRes.x, uRes.y);
  float t = uT * .12;
  vec2 p = uv * 4.2 + vec2(t * .25, t * .1);
  vec3 c = cells(p, t);
  float bd = c.x;
  float hId = h21(c.yz * 1.37 + 3.1);
  vec3 glass = jewel(hId);
  float mott = .78 + .35 * fbm(p * 2.6 + c.yz * 4.1);
  float streak = .92 + .08 * sin((p.x + p.y * .3) * 30. + fbm(p * 4.) * 6.);
  vec2 lp = vec2(.25 * sin(uT * .013), .45);
  float light = .35 + 1.05 * exp(-dot(uv - lp, uv - lp) * 1.6) + .15 * uLevel;
  light *= 1. + .3 * uMid;
  float thick = smoothstep(.0, .2, bd);
  vec3 col = glass * light * mott * streak * (.55 + .45 * thick);
  col += glass * glass * .5 * smoothstep(.75, 1.2, light) * thick;
  float lw = .055;
  float lead = smoothstep(lw, lw * .75, bd);
  float prof = clamp(bd / lw, 0., 1.);
  vec3 leadc = vec3(.05, .05, .055) + vec3(.16, .15, .14) * pow(sin(prof * PI) * .5 + .5 * (1. - prof), 3.) * (.6 + .4 * light);
  col = mix(col, leadc, lead);
  col *= smoothstep(1.35, .25, length(uv * vec2(.85, 1.)));
  gl_FragColor = vec4(pow(col, vec3(.85)), 1.);
}`, { speed: 1 });

/* Oscilloscope: a green phosphor CRT tracing the music as a slow Lissajous figure */
export function scopeScene() {
  let base, over, phos, pg, steps, sx, sy, sw, sh, cr, amp = new Float32Array(8), m = 0;
  const EDGES = [1, 3, 6, 10, 16, 26, 40, 64, 104], NX = [1, 2, 3, 4, 5, 3, 7, 5], NY = [1, 3, 2, 5, 4, 7, 6, 8];
  const ph = Array.from({ length: 16 }, () => rand(0, 6.28));
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const screenPath = g => rrect(g, sx, sy, sw, sh, cr);
  // The screen bulges: points push outward a little more towards the corners.
  function bend(x, y) {
    const cx = sx + sw / 2, cy = sy + sh / 2, nx = (x - cx) / (sw / 2), ny = (y - cy) / (sh / 2), k = 1 - .05 * (nx * nx + ny * ny);
    return [cx + (x - cx) * k, cy + (y - cy) * k];
  }
  return {
    init() {
      const S = Math.min(W, H), mg = S * .055;
      sx = mg; sy = mg; sw = W - mg * 2; sh = H - mg * 2; cr = S * .09;
      let g; [base, g] = layer(W, H);
      const bz = g.createLinearGradient(0, 0, 0, H);   // the bezel
      bz.addColorStop(0, '#2a2b27'); bz.addColorStop(1, '#141512');
      g.fillStyle = bz; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,240,.06)'; g.lineWidth = 2; rrect(g, sx - mg * .45, sy - mg * .45, sw + mg * .9, sh + mg * .9, cr * 1.3); g.stroke();
      const sc = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(sw, sh) / 2);
      sc.addColorStop(0, '#0d1a12'); sc.addColorStop(.7, '#07100a'); sc.addColorStop(1, '#020503');
      g.fillStyle = sc; screenPath(g); g.fill();
      const div = S * .1, cx = W / 2, cy = H / 2, nxD = Math.floor(sw / 2 / div), nyD = Math.floor(sh / 2 / div);
      g.strokeStyle = 'rgba(120,220,150,.10)'; g.lineWidth = 1;   // the graticule, bent with the glass
      const line = (x0, y0, x1, y1) => { g.beginPath(); for (let s = 0; s <= 24; s++) { const [x, y] = bend(x0 + (x1 - x0) * s / 24, y0 + (y1 - y0) * s / 24); s ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
      for (let i = -nxD; i <= nxD; i++) line(cx + i * div, cy - nyD * div, cx + i * div, cy + nyD * div);
      for (let j = -nyD; j <= nyD; j++) line(cx - nxD * div, cy + j * div, cx + nxD * div, cy + j * div);
      g.strokeStyle = 'rgba(120,220,150,.16)';
      for (let i = -nxD * 5; i <= nxD * 5; i++) { const [x, y] = bend(cx + i * div / 5, cy); g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x, y + 3); g.stroke(); }
      for (let j = -nyD * 5; j <= nyD * 5; j++) { const [x, y] = bend(cx, cy + j * div / 5); g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y); g.stroke(); }
      [over, g] = layer(W, H);
      g.save(); screenPath(g); g.clip();
      g.fillStyle = 'rgba(0,0,0,.22)'; for (let y = sy; y < sy + sh; y += 3) g.fillRect(sx, y, sw, 1);   // scan lines
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(sw, sh) * .3, W / 2, H / 2, Math.hypot(sw, sh) * .55);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.75)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      const rf = g.createRadialGradient(sx + sw * .3, sy + sh * .18, 0, sx + sw * .3, sy + sh * .18, Math.max(sw, sh) * .45);   // a window reflected in the glass
      rf.addColorStop(0, 'rgba(220,240,230,.07)'); rf.addColorStop(1, 'rgba(220,240,230,0)');
      g.fillStyle = rf; g.fillRect(0, 0, W, H);
      g.restore();
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = S * .012; screenPath(g); g.stroke();
      [phos, pg] = layer(W, H);
      steps = [2, 4, 8].map(f => plain(W / f, H / f));   // a tiny copy of the trace, drawn back up soft, is the bloom
    },
    draw(t, dt) {
      const d = spectrum(), S = Math.min(W, H);
      let tot = 0;
      for (let b = 0; b < 8; b++) {
        let s = 0; for (let i = EDGES[b]; i < EDGES[b + 1]; i++) s += d[i];
        const want = s / (EDGES[b + 1] - EDGES[b]) / 255;
        amp[b] += (want - amp[b]) * Math.min(1, dt * 5); tot += amp[b];
      }
      m += ((musicPlaying && tot > .15 ? 1 : 0) - m) * Math.min(1, dt * .6);
      const sp = lively ? 2 : 1;
      for (let i = 0; i < 16; i++) ph[i] += dt * sp * (.04 + .03 * Math.sin(i * 1.7)) * (1 + (i < 8 ? amp[i] : amp[i - 8]) * .8);
      pg.globalCompositeOperation = 'destination-out';
      pg.fillStyle = `rgba(0,0,0,${Math.min(1, dt * 3.2)})`; pg.fillRect(0, 0, W, H);   // phosphor persistence
      pg.globalCompositeOperation = 'lighter';
      const N = lowPower ? 360 : 640, R = Math.min(sw, sh) * .36 * (1 + m * tot * .02), cx = W / 2, cy = H / 2, pts = new Float32Array(N * 2 + 2);
      for (let s = 0; s <= N; s++) {
        const th = s / N * 6.2832;
        let x = Math.sin(3 * th + ph[0]), y = Math.sin(2 * th + ph[1] * .5);
        if (m > .001) {
          let mx = 0, my = 0;
          for (let b = 0; b < 8; b++) { mx += amp[b] * Math.sin(NX[b] * th + ph[b]); my += amp[b] * Math.sin(NY[b] * th + ph[b + 8]); }
          const nrm = 1.1 / Math.max(.3, tot);
          x += (mx * nrm - x) * m; y += (my * nrm - y) * m;
        }
        [pts[s * 2], pts[s * 2 + 1]] = bend(cx + x * R, cy - y * R);
      }
      const stroke = (w, c) => { pg.lineWidth = w; pg.strokeStyle = c; pg.beginPath(); pg.moveTo(pts[0], pts[1]); for (let s = 1; s <= N; s++) pg.lineTo(pts[s * 2], pts[s * 2 + 1]); pg.stroke(); };
      pg.lineJoin = 'round';
      stroke(S * .008, 'rgba(60,255,120,.016)');
      stroke(Math.max(1, S * .0025), 'rgba(170,255,190,.06)');
      pg.globalCompositeOperation = 'source-over';
      ctx.drawImage(base, 0, 0, W, H);
      ctx.save(); screenPath(ctx); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(phos, 0, 0, W, H);
      let src = phos;
      for (const [c, g] of steps) { g.clearRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height); src = c; }
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.globalAlpha = .8; ctx.drawImage(src, 0, 0, W, H); ctx.drawImage(steps[1][0], 0, 0, W, H);
      ctx.globalAlpha = .5; glow(ctx, W / 2, H / 2, R * 1.6, [40, 160, 80], .05 + .05 * m * tot / 3);
      ctx.restore();
      ctx.drawImage(over, 0, 0, W, H);
    }
  };
}

/* Murmuration: a starling flock wheeling over the reedbed at dusk */
export function murmurationScene() {
  let sky, reeds, n, px, py, vx, vy, dz, head, next, cols, rows, cell, hawk, hawkIn = 14;
  const hit = bassHits(8);
  return {
    init() {
      const S = Math.min(W, H), hz = H * .8;
      let g; [sky, g] = layer(W, H);
      const gr = g.createLinearGradient(0, 0, 0, hz);
      gr.addColorStop(0, '#1c2342'); gr.addColorStop(.4, '#4b4a72'); gr.addColorStop(.72, '#b07686'); gr.addColorStop(.9, '#e69a72'); gr.addColorStop(1, '#f2bf80');
      g.fillStyle = gr; g.fillRect(0, 0, W, hz + 2);
      glow(g, W * .68, hz, Math.max(W, H) * .45, [255, 196, 130], .5);
      glow(g, W * .68, hz, S * .12, [255, 230, 180], .7);
      for (let i = 0; i < 9; i++) {   // long thin clouds catching the last light
        const y = hz * rand(.35, .85), w = W * rand(.25, .6), x = rand(-.1, 1) * W;
        g.fillStyle = `rgba(${i % 2 ? '240,170,150' : '120,90,130'},${rand(.06, .14)})`;
        g.beginPath(); g.ellipse(x, y, w / 2, S * rand(.006, .016), 0, 0, Math.PI * 2); g.fill();
      }
      const wy = hz + H * .012;
      const wt = g.createLinearGradient(0, hz, 0, H);   // still water below the trees, holding the glow
      wt.addColorStop(0, '#d89070'); wt.addColorStop(1, '#5a4060');
      g.fillStyle = wt; g.fillRect(0, hz, W, H - hz);
      [reeds, g] = layer(W, H);
      g.fillStyle = '#1a1520';   // a far bank with copses of rounded trees
      g.fillRect(0, hz - S * .008, W, wy - hz + S * .008);
      for (let x = rand(-40, 0); x < W + 40; x += rand(S * .01, S * .03)) {
        const copse = Math.max(0, Math.sin(x * .006 + 1.7) * Math.sin(x * .0023 + .4)), r = S * (.008 + .03 * copse) * rand(.7, 1.2);
        if (copse < .05 && Math.random() < .7) continue;
        g.beginPath(); g.arc(x, hz - r * .6, r, 0, Math.PI * 2); g.fill();
        if (copse > .3) { g.beginPath(); g.arc(x + r * .5, hz - r * 1.3, r * .7, 0, Math.PI * 2); g.fill(); }
      }
      g.strokeStyle = '#0d0a10'; g.fillStyle = '#0d0a10';
      const nR = Math.round(W / 2.2);
      for (let i = 0; i < nR; i++) {   // reeds in the foreground, some with seed heads
        const x = rand(-10, W + 10), base = H + 4, top = H - (H - wy) * rand(.2, 1.1) - S * rand(0, .05), lean = rand(-.25, .25) * (base - top);
        g.lineWidth = rand(.6, 1.6); g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x, (base + top) / 2, x + lean, top); g.stroke();
        if (Math.random() < .12) { g.beginPath(); g.ellipse(x + lean, top - S * .01, S * .0045, S * .014, Math.atan2(lean, base - top) * .5, 0, Math.PI * 2); g.fill(); }
      }
      const bot = g.createLinearGradient(0, H * .9, 0, H);
      bot.addColorStop(0, 'rgba(13,10,16,0)'); bot.addColorStop(1, 'rgba(13,10,16,.9)');
      g.fillStyle = bot; g.fillRect(0, H * .9, W, H * .1);
      n = Math.round((lowPower ? 550 : 1300) * Math.min(1, Math.max(.6, W * H / 1e6)));
      px = new Float32Array(n); py = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n); dz = new Float32Array(n);
      const sp = S * .12;
      for (let i = 0; i < n; i++) {
        const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * S * .14;
        px[i] = W * .45 + Math.cos(a) * r * 1.6; py[i] = H * .4 + Math.sin(a) * r * .7;
        vx[i] = sp + rand(-10, 10); vy[i] = rand(-10, 10); dz[i] = rand(.6, 1.25);
      }
      cell = S * .035; cols = Math.ceil(W / cell) + 2; rows = Math.ceil(H / cell) + 2;
      head = new Int32Array(cols * rows); next = new Int32Array(n);
      hawk = null;
    },
    draw(t, dt) {
      const S = Math.min(W, H), sp = lively ? 1.5 : 1, h = dt * sp;
      const vmin = S * .09, vmax = S * (.17 + bands.mid * .03), R = cell, R2 = R * R, rs2 = (R * .38) ** 2;
      const tx = W * (.5 + .3 * Math.sin(t * .071) * Math.cos(t * .023)), ty = H * (.36 + .14 * Math.sin(t * .097 + 1.3));
      const coh = .9 + .5 * Math.sin(t * .13) + bands.bass * .4, kf = 4.2 / S, fp = t * .09;   // the flock breathes: tighter, then looser
      hawkIn -= h;
      if (!hawk && (hawkIn <= 0 || hit(dt))) {   // now and then a hawk cuts through and the flock ripples away from it
        const fromL = Math.random() < .5;
        hawk = { x: fromL ? -S * .2 : W + S * .2, y: ty + rand(-.1, .1) * H, vx: (fromL ? 1 : -1) * S * .35, vy: rand(-.05, .05) * S };
        hawkIn = rand(20, 35);
      }
      if (hawk) { hawk.x += hawk.vx * h; hawk.y += hawk.vy * h; if (hawk.x < -S * .3 || hawk.x > W + S * .3) hawk = null; }
      head.fill(-1);
      for (let i = 0; i < n; i++) {
        const c = Math.min(cols - 1, Math.max(0, (px[i] / cell | 0) + 1)) + Math.min(rows - 1, Math.max(0, (py[i] / cell | 0) + 1)) * cols;
        next[i] = head[c]; head[c] = i;
      }
      for (let i = 0; i < n; i++) {
        const x = px[i], y = py[i], ci = Math.min(cols - 1, Math.max(0, (x / cell | 0) + 1)), cj = Math.min(rows - 1, Math.max(0, (y / cell | 0) + 1));
        let cnt = 0, ax = 0, ay = 0, mx = 0, my = 0, sx = 0, sy = 0;
        for (let b = cj - 1; b <= cj + 1 && cnt < 14; b++) {
          if (b < 0 || b >= rows) continue;
          for (let a = ci - 1; a <= ci + 1 && cnt < 14; a++) {
            if (a < 0 || a >= cols) continue;
            for (let j = head[a + b * cols]; j >= 0 && cnt < 14; j = next[j]) {
              if (j === i) continue;
              const ex = px[j] - x, ey = py[j] - y, d2 = ex * ex + ey * ey;
              if (d2 > R2) continue;
              cnt++; ax += vx[j]; ay += vy[j]; mx += ex; my += ey;
              if (d2 < rs2) { const k = 1 / (d2 + 1); sx -= ex * k; sy -= ey * k; }
            }
          }
        }
        let fx = 0, fy = 0;
        if (cnt) { fx += (ax / cnt - vx[i]) * 1.6 + mx / cnt * coh + sx * vmin * 2.2; fy += (ay / cnt - vy[i]) * 1.6 + my / cnt * coh + sy * vmin * 2.2; }
        const X = x * kf, Y = y * kf, c1 = Math.cos(X + fp), c2 = Math.cos(Y * 1.3 - fp * .8), s1 = Math.sin(X + fp), s2 = Math.sin(Y * 1.3 - fp * .8), c3 = Math.cos(X * .7 + Y * .9 + fp * .6);
        const wx = -s1 * s2 * 1.3 + c3 * .9, wy = -c1 * c2 - c3 * .7;   // a slow, swirling current the flock follows, so it stretches and folds
        fx += (wx * vmax * .6 - vx[i]) * .35; fy += (wy * vmax * .6 - vy[i]) * .35;
        const gx = tx - x, gy = ty - y, gd = Math.hypot(gx, gy) + 1, pull = Math.max(0, gd - S * .2) * .9;
        fx += gx / gd * pull; fy += gy / gd * pull;
        if (y > H * .68) fy -= (y - H * .68) * 2;   // keep above the reeds and inside the frame
        if (y < H * .08) fy += (H * .08 - y) * 2;
        if (x < W * .08) fx += (W * .08 - x) * 2; else if (x > W * .92) fx -= (x - W * .92) * 2;
        if (hawk) {
          const ex = x - hawk.x, ey = y - hawk.y, d2 = ex * ex + ey * ey, hr = S * .16;
          if (d2 < hr * hr) { const d = Math.sqrt(d2) + 1, k = (1 - d / hr) * vmax * 4; fx += ex / d * k; fy += ey / d * k; }
        }
        let nvx = vx[i] + fx * h, nvy = vy[i] + fy * h;
        const v = Math.hypot(nvx, nvy) + 1e-6, cl = v > vmax ? vmax / v : v < vmin ? vmin / v : 1;
        vx[i] = nvx * cl; vy[i] = nvy * cl;
      }
      for (let i = 0; i < n; i++) { px[i] += vx[i] * h; py[i] += vy[i] * h; }
      ctx.drawImage(sky, 0, 0, W, H);
      const L = Math.max(1.6, S * .0045), flap = t * 9;
      for (const [lo, hi, a, lw] of [[0, .9, .55, .9], [.9, 2, .85, 1.3]]) {   // far birds paler and finer, near ones darker
        ctx.strokeStyle = `rgba(20,16,26,${a})`; ctx.lineWidth = lw * Math.max(1, S / 900); ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          if (dz[i] < lo || dz[i] >= hi) continue;
          const v = Math.hypot(vx[i], vy[i]) + 1e-6, ux = vx[i] / v, uy = vy[i] / v, l = L * dz[i], w = l * (.6 + .5 * Math.sin(flap + i));
          ctx.moveTo(px[i] - ux * l * .5 - uy * w * .5, py[i] - uy * l * .5 + ux * w * .5);
          ctx.lineTo(px[i] + ux * l * .5, py[i] + uy * l * .5);
          ctx.lineTo(px[i] - ux * l * .5 + uy * w * .5, py[i] - uy * l * .5 - ux * w * .5);
        }
        ctx.stroke();
      }
      ctx.drawImage(reeds, 0, 0, W, H);
    }
  };
}

/* Ferrofluid: a glossy black pool that rises into spikes with the bass and settles back in the quiet */
export const ferrofluidScene = () => {
  let spike = .2, clock = 0;
  return shaderScene(`
float spikes(vec2 p){
  float a = uT * .02; p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p / .15;
  vec2 s = vec2(1., 1.7320508), q1 = mod(p, s) - .5 * s, q2 = mod(p - .5 * s, s) - .5 * s;
  float d = sqrt(min(dot(q1, q1), dot(q2, q2)));
  return pow(max(0., 1. - d / .52), 2.4);
}
float rim(vec2 p){
  float an = atan(p.y, p.x);
  return 1. + .035 * sin(an * 3. + uT * .23) + .025 * sin(an * 5. - uT * .17) + .02 * uA;
}
float hgt(vec2 p){
  float r = length(p) / rim(p);
  if (r >= 1.) return 0.;
  float dome = .26 * sqrt(1. - r * r) * (1. - .3 * uA);
  return dome + uA * .5 * smoothstep(1., .2, r) * spikes(p);
}
vec3 env(vec3 d){
  vec3 c = mix(vec3(.02, .02, .025), vec3(.22, .22, .25), smoothstep(-.2, .9, d.y));
  c += vec3(1.6) * smoothstep(.94, .99, dot(d, normalize(vec3(-.35, .9, .25))));
  c += vec3(1.3, 1.05, .8) * smoothstep(.86, .97, dot(d, normalize(vec3(.75, .45, -.5))));
  c += vec3(.6, .7, .9) * .5 * smoothstep(.9, .99, dot(d, normalize(vec3(-.8, .35, -.45))));
  return c;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / min(uRes.x, uRes.y);
  float ca = .4 + uT * .01;
  vec3 ro = vec3(sin(ca) * 2.3, 2.45, cos(ca) * 2.3), ta = vec3(0., .08, 0.);
  vec3 fw = normalize(ta - ro), rt = normalize(cross(fw, vec3(0., 1., 0.))), up = cross(rt, fw);
  vec3 rd = normalize(fw * 1.25 + rt * uv.x + up * uv.y);
  float top = .8, t0 = (ro.y - top) / -rd.y, t1 = ro.y / -rd.y, t = t0, lt = t0;
  bool hit = false;
  for (int i = 0; i < 160; i++) {
    vec3 p = ro + rd * t; float h = hgt(p.xz), f = p.y - h;
    if (f < .0005 && h > 0.) { hit = true; break; }
    lt = t; t += max(.003, f * .32);
    if (t > t1) break;
  }
  vec3 col;
  vec3 fp = ro + rd * t1;
  float fr = length(fp.xz) / rim(fp.xz);
  vec3 floorc = vec3(.78, .76, .72) * (1. - .45 * smoothstep(1., 3.2, length(fp.xz)));
  floorc *= .45 + .55 * smoothstep(.95, 1.6, fr + .25 * dot(normalize(fp.xz + 1e-4), vec2(.6, -.5)));
  floorc += vec3(1., .95, .85) * .12 * exp(-length(fp.xz - vec2(-.8, 1.)) * 1.5);
  if (hit && t < t1) {
    float a = lt, b = t;
    for (int i = 0; i < 6; i++) { float m = .5 * (a + b); vec3 q = ro + rd * m; if (q.y - hgt(q.xz) < 0.) b = m; else a = m; }
    vec3 p = ro + rd * b; float e = .0025;
    vec3 n = normalize(vec3(hgt(p.xz - vec2(e, 0.)) - hgt(p.xz + vec2(e, 0.)), 2. * e, hgt(p.xz - vec2(0., e)) - hgt(p.xz + vec2(0., e))));
    vec3 rf = reflect(rd, n);
    float fres = .05 + .95 * pow(1. - max(0., dot(n, -rd)), 5.);
    vec3 refl = rf.y < 0. ? vec3(.5, .48, .45) * .3 : env(rf);
    col = vec3(.004) + refl * (.04 + .96 * fres);
    col += vec3(1.) * pow(max(0., dot(rf, normalize(vec3(-.35, .9, .25)))), 300.) * 2.5;
    col += vec3(1., .9, .75) * pow(max(0., dot(rf, normalize(vec3(.75, .45, -.5)))), 120.) * 1.2;
    float edge = smoothstep(.0, .015, hgt(p.xz));
    col = mix(floorc * .25, col, edge);
  } else col = floorc;
  col *= 1. - .35 * dot(uv, uv);
  col = col / (1. + col * .25);
  gl_FragColor = vec4(pow(col, vec3(.4545)), 1.);
}`, {
    res: 1,
    before(t, dt, gl, u) {
      clock += dt;
      const idle = .18 + .14 * (.5 + .5 * Math.sin(clock * .45)), want = Math.min(1, idle + bands.bass * (lively ? 1 : .8));
      spike += (want - spike) * Math.min(1, dt * (want > spike ? 1.6 : .6));
      gl.uniform1f(u.uA, spike);
    }
  });
};
