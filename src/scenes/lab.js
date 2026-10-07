// Rain lab: the alternative rain renderers kept for comparison. Shown only when the page is opened with #lab.
import { W, H, DPR, ctx } from '../view.js';
import { rand, layer, plain, glow, wipe } from '../util.js';
import { img } from '../assets.js';
import { videoScene } from './video.js';
import { addStage, blurCanvas, BGS, bgPending, paintBg, makeSim, stretchOf, glKit, glFailed, dropSprite } from './glass-shared.js';

/* Alternative 1: Canvas+ — the 2D approach with a sharper clear-glass layer, uneven condensation, irregular drops and gusts */
export function rainPlusScene(opts = {}) {
  let sharp, near, mistU, fog, fctx, dl, dctx, sim, gust = 0, nextGust = 30, cars, bg = opts.bg || 'drawn', built = false;
  function lens(g, x, y, r, stretch, ang, wob) {
    const rx = r * (1 + .07 * Math.sin(wob)), ry = r * (1.08 + stretch + .05 * Math.cos(wob * 1.7)), cy = y - (ry - r);
    if (r < 1.4) {
      g.fillStyle = 'rgba(4,6,12,.4)'; g.beginPath(); g.arc(x, cy, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x - r * .5, cy - r * .5, Math.max(.6, r * .45), Math.max(.6, r * .45));
      return;
    }
    g.save();
    g.beginPath(); g.ellipse(x, cy, rx, ry, ang + .12 * Math.sin(wob * 2.3), 0, Math.PI * 2); g.clip();
    const k = 5, sw = rx * 2 * k, sh = ry * 2 * k;
    g.translate(x, cy); g.scale(1, -1);
    g.drawImage(sharp, (x - sw / 2) * DPR, (cy - sh / 2) * DPR, sw * DPR, sh * DPR, -rx, -ry, rx * 2, ry * 2);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const edge = g.createRadialGradient(x - rx * .1, cy - ry * .2, r * .3, x, cy, r * 1.08);
    edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(.7, 'rgba(0,0,0,.1)'); edge.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = edge; g.fillRect(x - rx - 2, cy - ry - 2, rx * 2 + 4, ry * 2 + 4);
    const caustic = g.createRadialGradient(x, cy + ry * .5, 0, x, cy + ry * .5, r * .75);
    caustic.addColorStop(0, 'rgba(255,244,226,.32)'); caustic.addColorStop(1, 'rgba(255,244,226,0)');
    g.fillStyle = caustic; g.fillRect(x - rx, cy - ry * .1, rx * 2, ry * 1.2);
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.beginPath(); g.ellipse(x - rx * .34, cy - ry * .46, r * .19, r * .12, -.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.25)';
    g.beginPath(); g.ellipse(x + rx * .28, cy + ry * .5, r * .22, r * .07, .3, 0, Math.PI * 2); g.fill();
  }
  function sprinkle(n) { for (let i = 0; i < n; i++) lens(dctx, rand(0, W), rand(0, H), Math.random() < .85 ? rand(.6, 1.6) : rand(1.6, 2.6), 0, 0, rand(0, 9)); }
  function buildBg() {
      let g;
      [sharp, g] = layer(W, H); paintBg(g, bg);
      [near] = blurCanvas(sharp, BGS[bg].file ? 3 : 2.2);
      let mist; [mist, g] = blurCanvas(sharp, 14);
      g.fillStyle = 'rgba(150,164,190,.14)'; g.fillRect(0, 0, W, H);
      // Condensation is heavier at the bottom and in the corners.
      g.globalCompositeOperation = 'destination-in';
      const lg = g.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, 'rgba(0,0,0,.88)'); lg.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = lg; g.fillRect(0, 0, W, H);
      const rg = g.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .2, W / 2, H * .45, Math.max(W, H) * .75);
      rg.addColorStop(0, 'rgba(0,0,0,.94)'); rg.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = rg; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
      mistU = mist;
      [fog, fctx] = layer(W, H); fctx.drawImage(mistU, 0, 0, W, H);
      [dl, dctx] = layer(W, H); sprinkle(Math.round(W * H / 300));
  }
  return {
    get bg() { return bg; },
    setBg(k) { bg = k; built = false; },
    init() {
      built = false; if (BGS[bg].file) img(BGS[bg].file);
      sim = makeSim(); for (let i = 0; i < Math.round(12 + W * H / 60000); i++) sim.spawn();
      cars = Array.from({ length: 6 }, () => ({ x: rand(0, W), y: H * rand(.89, .95), v: rand(14, 34) * (Math.random() < .5 ? -1 : 1), red: Math.random() < .5 }));
    },
    draw(t, dt) {
      if (!built) { if (bgPending(bg)) { ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, W, H); return; } buildBg(); built = true; }
      ctx.drawImage(near, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      if (bg === 'drawn') for (const c of cars) {
        c.x += c.v * dt; if (c.x < -60) c.x = W + 60; if (c.x > W + 60) c.x = -60;
        const col = c.red ? [255, 50, 60] : [255, 236, 200];
        glow(ctx, c.x, c.y, 30, col, .32); glow(ctx, c.x + 22, c.y, 30, col, .32);
      }
      ctx.globalCompositeOperation = 'source-over';
      fctx.globalAlpha = Math.min(1, dt / 11); fctx.drawImage(mistU, 0, 0, W, H); fctx.globalAlpha = 1;
      dctx.globalCompositeOperation = 'destination-out'; dctx.fillStyle = `rgba(0,0,0,${Math.min(1, dt / 90)})`; dctx.fillRect(0, 0, W, H); dctx.globalCompositeOperation = 'source-over';
      // Gusts: every half minute or so, a short burst of fresh rain.
      nextGust -= dt;
      if (nextGust <= 0) { gust = 2.2; nextGust = rand(25, 45); }
      const rate = gust > 0 ? 260 : 30; if (gust > 0) gust -= dt;
      sprinkle(Math.random() < dt * rate ? Math.max(1, Math.round(dt * rate)) : 0);
      if (Math.random() < dt * (gust > 0 ? 3 : W * H / 1500000) && sim.drops.length < 70) sim.spawn();
      sim.step(dt,
        (x0, y0, x1, y1, r) => { wipe(fctx, 1, x0, y0, x1, y1, r * 2.4, .25); wipe(fctx, 1, x0, y0, x1, y1, r * 1.3, .45); wipe(dctx, 1, x0, y0, x1, y1, r * 2.1, 1); },
        (x, y, r) => lens(dctx, x, y, r, 0, 0, rand(0, 9)));
      ctx.drawImage(fog, 0, 0, W, H);
      ctx.drawImage(dl, 0, 0, W, H);
      for (const d of sim.drops) lens(ctx, d.x, d.y, d.r, stretchOf(d), d.moving ? -d.ang * .8 : 0, d.seed);
    }
  };
}

const FS_DROPS = `precision mediump float;
uniform sampler2D uSharp, uSoft, uMist, uFog, uDrops;
varying vec2 vUv;
void main(){
vec4 d = texture2D(uDrops, vUv);
float a = smoothstep(.42, .6, d.a);
vec2 n = (d.rg - .5) * 2.;
float th = d.b;
float fog = texture2D(uFog, vUv).a;
vec3 base = mix(texture2D(uSoft, vUv).rgb, texture2D(uMist, vUv).rgb, fog);
vec2 off = vec2(-n.x, n.y) * .06 * (.35 + th);
vec3 refr = texture2D(uSharp, vUv + off).rgb * mix(.55, 1.3, th) + .04;
vec3 N = normalize(vec3(n.x, -n.y, th * 1.1 + .1));
vec3 L = normalize(vec3(-.45, .6, .65));
float spec = pow(max(dot(reflect(-L, N), vec3(0., 0., 1.)), 0.), 22.);
float caustic = smoothstep(.25, .95, n.y) * smoothstep(.0, .5, th) * .3;
float rim = smoothstep(.45, .0, th) * .45;
vec3 col = mix(base, refr * (1. - rim) + spec * 1.1 + caustic * vec3(1., .95, .85), a);
gl_FragColor = vec4(col, 1.);
}`;

// v2: crisper drop edges, a thin dark outline, stronger lensing, highlight and focused light.
const FS_DROPS2 = `precision mediump float;
uniform sampler2D uSharp, uSoft, uMist, uFog, uDrops;
varying vec2 vUv;
void main(){
vec4 d = texture2D(uDrops, vUv);
float a = smoothstep(.5, .62, d.a);
vec2 n = (d.rg - .5) * 2.;
float th = d.b;
float fog = texture2D(uFog, vUv).a;
vec3 base = mix(texture2D(uSoft, vUv).rgb, texture2D(uMist, vUv).rgb, fog);
vec2 off = vec2(-n.x, n.y) * .085 * (.3 + th);
vec3 refr = texture2D(uSharp, vUv + off).rgb * mix(.5, 1.45, th) + .05;
vec3 N = normalize(vec3(n.x, -n.y, th * .9 + .08));
vec3 L = normalize(vec3(-.45, .6, .65));
float spec = pow(max(dot(reflect(-L, N), vec3(0., 0., 1.)), 0.), 16.);
float caustic = smoothstep(.2, .95, n.y) * smoothstep(0., .45, th) * .5;
float rim = smoothstep(.55, 0., th) * .75;
float outline = smoothstep(.48, .55, d.a) - smoothstep(.56, .72, d.a);
vec3 col = mix(base, refr * (1. - rim) + spec * 1.5 + caustic * vec3(1., .95, .85), a);
gl_FragColor = vec4(col * (1. - outline * .4), 1.);
}`;

/* Alternatives 2 and 5: drops simulated on the CPU, refracted per pixel on the GPU (city drawing or a real photo behind) */
export function rainGLScene(opts) {
  let stage, kit, failed = false, built = false, sim, fogC, fogG, dropC, dropG, mapC, mapG, nextGust = 30, gust = 0, bg = opts.bg || 'drawn';
  const MS = .5, FSc = .25, grow = opts.v2 ? 1.2 : 1;
  function stamp(g, x, y, r, stretch, scale) {
    r *= grow;
    const ry = r * (1.08 + stretch);
    g.drawImage(dropSprite(), (x - r) * scale, (y - ry * 2 + r * 1.08) * scale, r * 2 * scale, ry * 2 * scale);
  }
  function sprinkle(n) { for (let i = 0; i < n; i++) stamp(dropG, rand(0, W), rand(0, H), Math.random() < .85 ? rand(.8, 1.8) : rand(1.8, 2.8), 0, MS); }
  function build() {
    let [sharp, g] = layer(W, H);
    paintBg(g, bg);
    const [soft] = blurCanvas(sharp, BGS[bg].file ? 3 : 2.4);
    const [mist, mg] = blurCanvas(sharp, 14);
    mg.fillStyle = 'rgba(150,164,190,.14)'; mg.fillRect(0, 0, W, H);
    kit.tex('uSharp', 0, sharp); kit.tex('uSoft', 1, soft); kit.tex('uMist', 2, mist);
  }
  return {
    kind: 'webgl',
    get canvas() { return stage; },
    get bg() { return bg; },
    setBg(k) { bg = k; built = false; if (BGS[k].file) img(BGS[k].file); },
    init() {
      if (!stage) {
        stage = addStage(document.createElement('canvas'));
        try { kit = glKit(stage, opts.v2 ? FS_DROPS2 : FS_DROPS); } catch (e) { console.warn(e); }
        if (!kit) failed = true;
      }
      const r = Math.min(DPR, 1.5); stage.width = Math.round(W * r); stage.height = Math.round(H * r);
      [fogC, fogG] = plain(W * FSc, H * FSc); fogG.fillStyle = '#fff'; fogG.fillRect(0, 0, fogC.width, fogC.height);
      [dropC, dropG] = plain(W * MS, H * MS); [mapC, mapG] = plain(W * MS, H * MS);
      sprinkle(Math.round(W * H / 300));
      sim = makeSim(); for (let i = 0; i < Math.round(12 + W * H / 60000); i++) sim.spawn();
      built = false;
      if (BGS[bg].file) img(BGS[bg].file);
    },
    draw(t, dt) {
      if (failed) { glFailed(stage); return; }
      if (!built) { if (bgPending(bg)) return; build(); built = true; }
      fogG.fillStyle = `rgba(255,255,255,${Math.min(1, dt / 11)})`; fogG.fillRect(0, 0, fogC.width, fogC.height);
      dropG.globalCompositeOperation = 'destination-out'; dropG.fillStyle = `rgba(0,0,0,${Math.min(1, dt / 90)})`;
      dropG.fillRect(0, 0, dropC.width, dropC.height); dropG.globalCompositeOperation = 'source-over';
      nextGust -= dt; if (nextGust <= 0) { gust = 2.2; nextGust = rand(25, 45); }
      const rate = gust > 0 ? 260 : 30; if (gust > 0) gust -= dt;
      sprinkle(Math.random() < dt * rate ? Math.max(1, Math.round(dt * rate)) : 0);
      if (Math.random() < dt * (gust > 0 ? 3 : W * H / 1500000) && sim.drops.length < 70) sim.spawn();
      sim.step(dt,
        (x0, y0, x1, y1, r) => { wipe(fogG, FSc, x0, y0, x1, y1, r * 2.6, .22); wipe(fogG, FSc, x0, y0, x1, y1, r * 1.4, .45); wipe(dropG, MS, x0, y0, x1, y1, r * 2.1, 1); },
        (x, y, r) => stamp(dropG, x, y, r, 0, MS));
      mapG.clearRect(0, 0, mapC.width, mapC.height);
      mapG.drawImage(dropC, 0, 0);
      for (const d of sim.drops) stamp(mapG, d.x, d.y, d.r, stretchOf(d), MS);
      kit.tex('uFog', 3, fogC); kit.tex('uDrops', 4, mapC);
      kit.draw();
    }
  };
}

/* Alternative 3: one procedural shader — drops, runs, beads and the cleared trails all come from maths, no simulation */
const FS_PROC = `precision highp float;
uniform sampler2D uSharp, uSoft, uMist;
uniform vec2 uRes; uniform float uT;
float h21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float pathX(float y, float n){ return .5 + .11 * sin(y * 5.3 + n * 40.) + .045 * sin(y * 13.1 + n * 17.); }
vec3 dots(vec2 p, float t, float density, float seed){
vec2 g = p * density, id = floor(g), f = fract(g) - .5;
float n = h21(id + seed);
vec2 c = (vec2(n, fract(n * 7.13)) - .5) * .7;
float life = fract(t * .035 + n * 3.7);
float fade = smoothstep(0., .03, life) * smoothstep(1., .55, life);
float r = (.09 + .2 * fract(n * 31.7)) * fade;
vec2 d = f - c;
float rs = max(r, 1e-3);
float m = smoothstep(rs, rs * .72, length(d)) * step(.3, fract(n * 91.3)) * step(.001, r);
return vec3(m, d / max(r, 1e-3) * m);
}
vec4 runs(vec2 p, float t, float cols, float seed){
vec2 cell = vec2(1. / cols, 2.6 / cols);
vec2 g = p / cell;
g.y += h21(vec2(floor(g.x), seed)) * 7.;
vec2 id = floor(g), f = fract(g);
float n = h21(id + seed * 3.1);
float active = step(.5, fract(n * 17.3));
float ph = fract(t * (.05 + .07 * fract(n * 5.7)) + n);
float y = clamp(1. - (ph + .03 * sin(ph * 40. + n * 9.)), 0., 1.);
vec2 asp = vec2(1., cell.y / cell.x);
vec2 d = (f - vec2(pathX(y, n), y)) * asp;
float r = .17 + .08 * fract(n * 13.1);
float alive = smoothstep(0., .06, ph) * smoothstep(1., .9, ph) * active;
float m = smoothstep(r, r * .76, length(d * vec2(1., .88))) * alive;
float tx = pathX(f.y, n), above = f.y - y;
float trail = smoothstep(r * 1.1, r * .2, abs(f.x - tx)) * smoothstep(-.02, .03, above) * smoothstep(.45, 0., above) * smoothstep(1., .8, f.y) * alive;
float k = fract(f.y * 14. + n);
vec2 bd = vec2(f.x - tx, (k - .5) / 14. * asp.y);
float br = .055 * step(.45, fract(floor(f.y * 14. + n) * 7.3 + n));
float bs = max(br, 1e-3);
float bead = smoothstep(bs, bs * .6, length(bd)) * step(.001, br) * trail * step(.05, above);
float mask = max(m, bead);
vec2 nrm = m > bead ? d / r : bd / max(br, 1e-3);
return vec4(mask, nrm * mask, trail);
}
void main(){
vec2 uv = gl_FragCoord.xy / uRes;
vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
float t = uT;
vec3 s1 = dots(p, t, 24., 1.), s2 = dots(p * 1.7 + .3, t * 1.3, 34., 7.);
vec4 r1 = runs(p, t, 5., 3.), r2 = runs(p * 1.23 + vec2(.37, .11), t * .9, 7., 11.);
float mask = max(max(s1.x, s2.x), max(r1.x, r2.x));
vec2 nrm = s1.yz + s2.yz + r1.yz + r2.yz;
float clearA = max(r1.w, r2.w);
vec3 base = mix(texture2D(uMist, uv).rgb, texture2D(uSoft, uv).rgb, clearA * .55);
float th = sqrt(clamp(1. - dot(nrm, nrm), 0., 1.));
vec3 refr = texture2D(uSharp, uv - nrm * .04).rgb * mix(.6, 1.3, th) + .04;
vec3 N = normalize(vec3(nrm, th + .2));
vec3 L = normalize(vec3(-.4, .6, .7));
float spec = pow(max(dot(reflect(-L, N), vec3(0., 0., 1.)), 0.), 22.);
float caustic = smoothstep(.25, .95, -nrm.y) * smoothstep(0., .5, th) * .3;
float rim = smoothstep(.45, 0., th) * .4;
gl_FragColor = vec4(mix(base, refr * (1. - rim) + spec * 1.1 + caustic * vec3(1., .95, .85), mask), 1.);
}`;
export function rainShaderScene(opts = {}) {
  let stage, kit, failed = false, uT, uRes, bg = opts.bg || 'drawn', built = false;
  function build() {
    let [sharp, g] = layer(W, H); paintBg(g, bg);
    const [soft] = blurCanvas(sharp, BGS[bg].file ? 3 : 2.4);
    const [mist, mg] = blurCanvas(sharp, 14); mg.fillStyle = 'rgba(150,164,190,.22)'; mg.fillRect(0, 0, W, H);
    kit.tex('uSharp', 0, sharp); kit.tex('uSoft', 1, soft); kit.tex('uMist', 2, mist);
  }
  return {
    kind: 'webgl',
    get canvas() { return stage; },
    get bg() { return bg; },
    setBg(k) { bg = k; built = false; if (BGS[k].file) img(BGS[k].file); },
    init() {
      if (!stage) {
        stage = addStage(document.createElement('canvas'));
        try { kit = glKit(stage, FS_PROC); } catch (e) { console.warn(e); }
        if (!kit) { failed = true; return; }
        uT = kit.u('uT'); uRes = kit.u('uRes');
      }
      if (failed) return;
      const r = Math.min(DPR, 1.5); stage.width = Math.round(W * r); stage.height = Math.round(H * r);
      built = false; if (BGS[bg].file) img(BGS[bg].file);
    },
    draw(t) {
      if (failed) { glFailed(stage); return; }
      if (!built) { if (bgPending(bg)) return; build(); built = true; }
      kit.gl.uniform1f(uT, t); kit.gl.uniform2f(uRes, stage.width, stage.height);
      kit.draw();
    }
  };
}

/* Alternative 4: filmed footage (CC0) as a seamless 16-second loop */
export const rainFilmScene = () => videoScene({ src: 'rain-window.mp4', poster: 'rain-window-poster.jpg' });
