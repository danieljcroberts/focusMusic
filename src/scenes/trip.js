// Trip: full-screen fragment shaders that move with the music. Slow and non-strobing by default; the Lively toggle
// speeds them up and lets the analyser push harder. Nothing here flashes.
import { W, H, DPR, lowPower, lively } from '../view.js';
import { bands, spectrum, musicLevel } from '../music.js';
import { setStatus } from '../status.js';
import { report } from '../diag.js';
import { addStage, glKit, glFailed } from './glass-shared.js';

const PRELUDE = `precision highp float;
uniform vec2 uRes; uniform float uT, uBass, uMid, uTreble, uLevel, uLively, uHue, uA, uB;
uniform sampler2D uSpec;
varying vec2 vUv;
#define PI 3.14159265
float h21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= .5; } return v; }
// Cosine palette (after Inigo Quilez): a + b * cos(2pi (c t + d))
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b * cos(6.28318 * (c * t + d)); }
vec3 hsv(float h, float s, float v){ vec3 k = abs(fract(vec3(h) + vec3(0., 2. / 3., 1. / 3.)) * 6. - 3.) - 1.; return v * mix(vec3(1.), clamp(k, 0., 1.), s); }
`;

// One full-screen shader on its own stage. o.speed scales the scene clock, o.res caps the render scale,
// o.spectrum uploads the analyser's bins as uSpec, o.before(t, dt, gl, u) sets scene uniforms.
export function shaderScene(fs, o = {}) {
  let stage, kit, failed = false, clock = 0, specC, specG, specIm;
  const u = {}, smooth = new Float32Array(256);
  return {
    kind: 'webgl',
    get canvas() { return stage; },
    init() {
      if (!stage) {
        stage = addStage(document.createElement('canvas'));
        try { kit = glKit(stage, PRELUDE + fs); } catch (e) { report(e); }
        if (!kit) { failed = true; return; }
        for (const n of ['uT', 'uBass', 'uMid', 'uTreble', 'uLevel', 'uLively', 'uHue', 'uRes', 'uA', 'uB']) u[n] = kit.u(n);
        specC = document.createElement('canvas'); specC.width = 256; specC.height = 1; specG = specC.getContext('2d'); specIm = specG.createImageData(256, 1);
      }
      if (failed) return;
      const r = Math.min(DPR, lowPower ? .7 : (o.res ?? 1.5)); stage.width = Math.round(W * r); stage.height = Math.round(H * r);
    },
    draw(t, dt) {
      if (failed) { glFailed(stage); return; }
      clock += dt * (lively ? 2.2 : 1) * (o.speed ?? 1);   // the scene keeps its own clock so the toggle never jumps
      const gl = kit.gl, k = lively ? 1.8 : 1;
      gl.uniform1f(u.uT, clock); gl.uniform2f(u.uRes, stage.width, stage.height);
      gl.uniform1f(u.uBass, Math.min(1, bands.bass * k)); gl.uniform1f(u.uMid, Math.min(1, bands.mid * k)); gl.uniform1f(u.uTreble, Math.min(1, bands.treble * k));
      gl.uniform1f(u.uLevel, musicLevel); gl.uniform1f(u.uLively, lively ? 1 : 0); gl.uniform1f(u.uHue, (clock * .008) % 1);
      if (o.spectrum) {
        const d = spectrum();
        for (let i = 0; i < 256; i++) { smooth[i] = Math.max(d[i], smooth[i] - dt * 140); specIm.data[i * 4] = smooth[i]; specIm.data[i * 4 + 3] = 255; }
        specG.putImageData(specIm, 0, 0); kit.tex('uSpec', 0, specC);
      }
      if (o.before) o.before(t, dt, gl, u);
      kit.draw();
    }
  };
}

/* Lava Lamp: a classic tapered lamp on a chrome base. Wax heats in a pool at the bottom, stretches as it rises, cools and
   sinks from the top; the glass curves the view like a lens, and the lamp's glow colours the room. The colours drift over minutes. */
export const lavaScene = () => shaderScene(`
const float FLOOR = -.47, BASE_TOP = -.25, GLASS_TOP = .38, CAP_TOP = .45;
float glassR(float y) { float k = clamp((y - BASE_TOP) / (GLASS_TOP - BASE_TOP), 0., 1.); return mix(.128, .07, k) + .014 * sin(k * 3.14159); }
// Wax density at a point in "inside the glass" space; more than 1 is wax.
float wax(vec2 p) {
  float t = uT * .05, f = 0.;
  for (int i = 0; i < 8; i++) {
    float fi = float(i), sp = .5 + .45 * fract(fi * .618);
    float ph = fract(t * sp * .5 + fi * .37);
    float c = .5 - .5 * cos(ph * 6.28318);                     // slow at the bottom and top, quick in between
    float y = mix(-.205, .31, c), v = sin(ph * 6.28318);
    float r = (.026 + .02 * fract(fi * .73)) * (1. + uBass * .1) * (1. - .2 * c);   // wax shrinks a little as it cools
    float stretch = 1. + .55 * abs(v);
    float x = sin(t * (1.3 + fi * .4) + fi * 2.1) * glassR(y) * .45;
    vec2 d = (p - vec2(x, y)) / vec2(1. / sqrt(stretch), stretch);
    f += pow(r * r / (dot(d, d) + .00008), 1.6);   // a steep falloff keeps blobs apart until they touch
  }
  float pool = -.222 + .006 * sin(p.x * 55. + uT * .4) + .004 * sin(p.x * 90. - uT * .3);
  f += smoothstep(pool + .004, pool - .004, p.y) * 3. + .6 * exp(-(p.y - pool) * 70.);    // the hot pool at the bottom
  f += .3 * exp(-(.35 - p.y) * 90.);                                                     // a little cooled wax under the cap
  return f;
}
vec3 metal(float px, float y, vec3 glowC) {
  float band = .18 + .5 * exp(-pow((px + .38) / .22, 2.)) + .35 * exp(-pow((px - .55) / .09, 2.)) + .08 * sin(px * 9.);
  vec3 m = vec3(.62, .64, .68) * band;
  return m + glowC * .25 * smoothstep(-.6, .9, -px);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y * 1.28 + vec2(0., -.03);   // the lamp fills about three quarters of the height
  float px1 = 1.9 / uRes.y;
  // Two palettes that drift into each other over about ten minutes: violet liquid with orange wax, deep blue with red.
  float pk = .5 + .5 * sin(uT * .0105);
  vec3 liquid = mix(vec3(.30, .05, .36), vec3(.03, .10, .30), pk);
  vec3 waxLo = mix(vec3(.95, .26, .04), vec3(.88, .04, .10), pk);
  vec3 waxHi = mix(vec3(1., .66, .16), vec3(1., .42, .30), pk);
  vec3 glowC = mix(waxLo, liquid, .3);

  // The room: a dark wall lit by the lamp, a table top with a pool of light
  vec3 col = vec3(.035, .028, .04) + glowC * .45 * exp(-length((uv - vec2(0., .02)) * vec2(1.1, .75)) * 3.2) * (.85 + .15 * uLevel);
  if (uv.y < FLOOR) {
    float dz = (FLOOR - uv.y) * 4.;
    col = vec3(.06, .04, .035) * (1. - dz * .6) + glowC * .5 * exp(-length(vec2(uv.x * 2.2, (uv.y - FLOOR) * 9.)) * 2.4);
  }
  float y = uv.y, ax = abs(uv.x);

  // Base: a chrome cone, wide on the table, narrowing up to the glass
  float baseR = mix(.2, .128, smoothstep(FLOOR, BASE_TOP, y));
  float inBase = step(FLOOR, y) * step(y, BASE_TOP) * smoothstep(baseR + px1, baseR - px1, ax);
  if (inBase > 0.) {
    vec3 m = metal(uv.x / baseR, y, glowC);
    m *= .75 + .25 * smoothstep(FLOOR, FLOOR + .02, y);                    // darker foot
    m += glowC * .9 * smoothstep(BASE_TOP - .03, BASE_TOP, y);               // glow spilling from the bulb at the top
    col = mix(col, m, inBase);
  }

  // Cap: a small chrome cone on top
  float capR = mix(.072, .04, smoothstep(GLASS_TOP, CAP_TOP, y));
  float inCap = step(GLASS_TOP, y) * step(y, CAP_TOP) * smoothstep(capR + px1, capR - px1, ax);
  if (inCap > 0.) col = mix(col, metal(uv.x / capR, y, glowC) * .9, inCap);

  // The glass, and what is inside it
  float R = glassR(y);
  float inGlass = step(BASE_TOP, y) * step(y, GLASS_TOP) * smoothstep(R + px1, R - px1, ax);
  if (inGlass > 0.) {
    float px = clamp(uv.x / R, -.999, .999);
    float cyl = sqrt(1. - px * px);
    vec2 p = vec2(asin(px) * .6366 * R, y);                                  // the curved glass widens the middle and squeezes the edges
    float f = wax(p);
    float e = .004;
    vec2 grad = vec2(wax(p + vec2(e, 0.)) - f, wax(p + vec2(0., e)) - f) / e;
    float m = smoothstep(.92, 1.08, f);
    float heat = smoothstep(.25, -.22, y);                                  // hotter, brighter wax near the bulb
    float bulb = exp(-(y - BASE_TOP) * 4.5);

    vec3 liq = liquid * (.35 + 1.1 * bulb) * (.55 + .45 * cyl);
    liq += waxLo * .22 * smoothstep(.35, .95, f);                            // light scattered round the wax
    vec3 n = normalize(vec3(-grad * .012, 1.));
    float thick = smoothstep(1., 3.2, f);
    // Hot wax glows from within: brightest where it is thickest, deeper and redder towards its thin edges.
    float core = smoothstep(1.05, 6., f);
    vec3 w = mix(waxLo * .85, waxHi * 1.15, clamp(.1 + .75 * core + .2 * heat, 0., 1.)) * (.85 + .45 * heat + .2 * bulb);
    w *= .8 + .35 * n.z;                                                     // rounded edges fall off a little
    w += waxHi * pow(max(dot(n, normalize(vec3(-.5, .45, 1.))), 0.), 30.) * .3;   // a soft highlight in the wax's own colour
    vec3 inside = mix(liq, w, m);

    // Glass: two vertical reflections, a darker rim and a thin bright edge
    inside += vec3(1.) * (.16 * exp(-pow((px + .55) / .07, 2.)) + .07 * exp(-pow((px - .62) / .04, 2.)));
    inside *= .65 + .35 * cyl;
    inside += vec3(.9, .9, 1.) * .1 * smoothstep(.86, .99, abs(px));
    col = mix(col, inside, inGlass);
  }
  // A collar where glass meets base, and a soft halo around the whole lamp
  float collar = step(BASE_TOP - .006, y) * step(y, BASE_TOP + .006) * smoothstep(.135, .13, ax);
  col = mix(col, metal(uv.x / .13, y, glowC) * 1.1, collar);
  gl_FragColor = vec4(col, 1.);
}`, { speed: 1, res: 1.25 });

/* Kaleidoscope: a drifting noise field folded into mirror segments */
export const kaleidoScene = () => shaderScene(`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT * .07;
  float segs = 6. + 2. * floor(uLively * 1.5 + uBass * 2.4);
  float a = atan(uv.y, uv.x) + t * .25, r = length(uv);
  float s = 2. * PI / segs;
  a = mod(a, s); a = abs(a - s * .5);
  vec2 p = r * vec2(cos(a), sin(a)) + vec2(t * .5, t * .2);
  float n = fbm(p * 3. + fbm(p * 2. - t));
  float rings = sin(r * 18. - t * 4. + n * 8.);
  vec3 col = pal(n + uHue + r * .4, vec3(.5), vec3(.5), vec3(1.), vec3(0., .33, .67));
  col *= .55 + .45 * smoothstep(-.2, .8, rings);
  col += vec3(1., .95, .8) * smoothstep(.72, .95, n) * .5 * (.4 + uTreble);
  col *= smoothstep(1.25, .3, r);
  gl_FragColor = vec4(col, 1.);
}`);

/* Liquid Marble: domain-warped noise, inks folding into each other */
export const marbleScene = () => shaderScene(`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT * .05;
  vec2 p = uv * 2.2;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t * .7));
  vec2 r = vec2(fbm(p + 4. * q + vec2(1.7, 9.2) + t * .5), fbm(p + 4. * q + vec2(8.3, 2.8) - t * .3));
  float f = fbm(p + 4. * r * (1. + uBass * .4));
  vec3 col = mix(vec3(.05, .02, .12), vec3(.9, .2, .5), clamp(f * f * 3., 0., 1.));
  col = mix(col, vec3(.1, .8, .9), clamp(length(q), 0., 1.));
  col = mix(col, vec3(1., .85, .4), clamp(r.x * r.x, 0., 1.) * .8);
  col = mix(col, hsv(uHue + f * .3, .6, 1.), .22 + .2 * uMid);
  col *= .55 + 1.2 * f;
  gl_FragColor = vec4(col, 1.);
}`);

/* Mandelbrot Drift: a slow zoom into the seahorse valley, looping before single precision runs out */
export const mandelScene = () => shaderScene(`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float cyc = mod(uT * .011 + .3, 1.);   // open part-way in, not on the fade
  float zoom = exp(cyc * 7.);
  vec2 c = vec2(-.74364388, .13182590) + uv * 2.4 / zoom;
  vec2 z = vec2(0.); float n = 0.;
  for (int i = 0; i < 160; i++) { z = vec2(z.x * z.x - z.y * z.y, 2. * z.x * z.y) + c; if (dot(z, z) > 64.) break; n += 1.; }
  float sn = n - log2(log2(dot(z, z) + 1e-9)) + 4.;
  vec3 col = pal(sn * .02 + uHue * 2. + uT * .015 + uBass * .05, vec3(.5), vec3(.5), vec3(1., 1., .9), vec3(.1, .35, .6));
  col = mix(col, vec3(.02, .01, .05), step(159.5, n));
  float fade = smoothstep(0., .05, cyc) * smoothstep(1., .95, cyc);
  gl_FragColor = vec4(col * fade, 1.);
}`, { res: 1 });

/* Tunnel: flying down a lit tube whose walls breathe with the bass */
export const tunnelScene = () => shaderScene(`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT * .45;
  uv += vec2(sin(t * .3), cos(t * .23)) * .12;
  float a = atan(uv.y, uv.x), r = length(uv);
  r *= 1. + uBass * .12 * sin(a * 3. + t);
  vec2 st = vec2(a / PI * 3., 1. / (r + .02) + t);
  float grid = smoothstep(.02, .08, abs(fract(st.x) - .5)) * smoothstep(.02, .08, abs(fract(st.y * .5) - .5));
  float n = fbm(vec2(cos(a), sin(a)) * 1.5 + vec2(0., st.y * .5) + t * .1);   // periodic around the tube, so no seam
  vec3 col = pal(st.y * .05 + n + uHue, vec3(.45), vec3(.5), vec3(1.), vec3(0., .25, .5));
  col = mix(col * .4, col, grid);
  col *= smoothstep(0., .25, r) * (1. - .5 * uTreble * (1. - grid));
  col += vec3(.9, .95, 1.) * (1. - smoothstep(0., .12, r)) * .6;
  gl_FragColor = vec4(col, 1.);
}`);

/* Spectrum Garden: the analyser's bins as a ring of light that grows with each band */
export const spectrumScene = () => shaderScene(`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float a = atan(uv.y, uv.x), r = length(uv);
  float bin = abs(a) / PI;
  float v = texture2D(uSpec, vec2(pow(bin, 1.6) * .6 + .002, .5)).r;
  float base = .18 + uBass * .03;
  float h = base + v * .32;
  float ring = smoothstep(h + .012, h - .012, r) * smoothstep(base - .012, base + .012, r);
  vec3 col = hsv(bin * .8 + uHue, .8, 1.) * ring;
  col += hsv(bin * .8 + uHue + .1, .6, 1.) * exp(-(r - h) * 12.) * step(h, r) * .5 * v;
  col += vec3(.1, .08, .2) * exp(-r * 2.);
  col += hsv(uHue + .5, .5, 1.) * (1. - smoothstep(0., base * (.5 + uLevel * .5), r)) * .35;
  col += pal(r * 2. - uT * .05 + a / PI, vec3(.1), vec3(.1), vec3(1.), vec3(0., .3, .6)) * smoothstep(h + .02, h + .3, r) * .6;
  gl_FragColor = vec4(col, 1.);
}`, { spectrum: true });

/* Breathing Mandala: petals that open and close on a 4-7-8 breath, with the cue in the status line */
export const mandalaScene = () => {
  let phase = '';
  const ease = x => x * x * (3 - 2 * x);
  return shaderScene(`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float a = atan(uv.y, uv.x), r = length(uv);
  float s = .22 + .2 * uA;
  float rr = r / s;
  float petals = .5 + .5 * cos(a * 8. + sin(rr * 3. - uT * .1) * .5);
  float rings = .5 + .5 * sin(rr * 9. - uA * 3.);
  float m = smoothstep(1.4, .2, rr) * (petals * .6 + rings * .4);
  vec3 col = pal(rr * .25 + uHue + uA * .1, vec3(.5), vec3(.45), vec3(1.), vec3(0., .2, .45)) * m;
  col += hsv(uHue + .6, .4, 1.) * exp(-rr * 2.5) * .5;
  col += vec3(.02, .02, .05);
  gl_FragColor = vec4(col, 1.);
}`, {
    speed: 1,
    before(t, dt, gl, u) {
      // The breath keeps real time whatever the Lively setting: 4 s in, 7 s hold, 8 s out.
      const p = t % 19;
      const [b, ph] = p < 4 ? [ease(p / 4), 'Breathe in'] : p < 11 ? [1, 'Hold'] : [1 - ease((p - 11) / 8), 'Breathe out'];
      gl.uniform1f(u.uA, b);
      if (ph !== phase) { phase = ph; setStatus(ph); }
    }
  });
};

/* Nebula: layered gas lit from within, with stars behind it, drifting slowly */
export const nebulaScene = () => shaderScene(`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT * .02;
  vec2 p = uv * 1.6 + vec2(t * .6, t * .25);
  float n1 = fbm(p + fbm(p * 1.7 - t));
  float n2 = fbm(p * 2.3 + vec2(3.1, 7.7) + fbm(p * 3.1 + t * .7));
  float n3 = fbm(p * .7 - vec2(9.2, 2.4) + t * .3);
  vec3 col = vec3(.01, .01, .03);
  col += vec3(.55, .12, .45) * smoothstep(.35, .85, n1) * .8;
  col += vec3(.1, .35, .75) * smoothstep(.4, .9, n2) * .7;
  col += vec3(.95, .55, .25) * pow(smoothstep(.55, 1., n3 * n1 * 2.), 1.5) * (1. + uBass * .6);
  col += vec3(.9, .85, 1.) * pow(smoothstep(.6, 1., n1 * n2 * 2.2), 3.) * .6;
  // dark dust lanes
  col *= .5 + .5 * smoothstep(.2, .6, fbm(p * 2.8 + vec2(4.4, 1.9)));
  // stars behind the gas, dimmed where it is thick
  vec2 sp = gl_FragCoord.xy / uRes.y * 90.;
  vec2 id = floor(sp), f = fract(sp) - .5;
  float h = h21(id);
  float star = smoothstep(.08, .0, length(f - (vec2(h, fract(h * 9.3)) - .5) * .8)) * step(.93, h);
  float twinkle = .6 + .4 * sin(uT * (1. + h * 3.) + h * 20.);
  col += vec3(.9, .95, 1.) * star * twinkle * (1. - smoothstep(.3, .8, n1 + n2 * .5)) * 1.2;
  col = mix(col, hsv(uHue, .5, 1.) * length(col) * .6, .12 * uLively);
  gl_FragColor = vec4(col, 1.);
}`, { speed: 1 });

/* Plasma: the old sine-sum plasma, slowed down and softened */
export const plasmaScene = () => shaderScene(`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT * .22;
  float v = sin(uv.x * 5. + t) + sin((uv.y * 5. + t) * .7) + sin((uv.x + uv.y) * 4. + t * .5) + sin(length(uv * 6. + vec2(sin(t * .3), cos(t * .4))) - t);
  vec3 col = pal(v * .12 + uHue + uMid * .05, vec3(.45), vec3(.3), vec3(1.), vec3(0., .33, .67));
  col = mix(col, vec3(dot(col, vec3(.333))), .35 - uLively * .3);
  gl_FragColor = vec4(col, 1.);
}`);
