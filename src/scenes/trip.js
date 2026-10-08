// Trip: full-screen fragment shaders that move with the music. Slow and non-strobing by default; the Lively toggle
// speeds them up and lets the analyser push harder. Nothing here flashes.
import { W, H, DPR, lowPower, lively } from '../view.js';
import { bands, spectrum, musicLevel } from '../music.js';
import { setStatus } from '../status.js';
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
function shaderScene(fs, o = {}) {
  let stage, kit, failed = false, clock = 0, specC, specG, specIm;
  const u = {}, smooth = new Float32Array(256);
  return {
    kind: 'webgl',
    get canvas() { return stage; },
    init() {
      if (!stage) {
        stage = addStage(document.createElement('canvas'));
        try { kit = glKit(stage, PRELUDE + fs); } catch (e) { console.warn(e); }
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

/* Lava Lamp: warm wax rising and merging in a tall glass, lit from below */
export const lavaScene = () => shaderScene(`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT * .11;
  vec2 b = abs(uv) - vec2(.17, .40);
  float body = length(max(b, 0.)) - .06;
  float inside = smoothstep(.004, -.004, body);
  float f = 0.;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float ph = fract(t * (.35 + .3 * fract(fi * .618)) + fi * .37);
    float y = -.36 + .72 * (.5 - .5 * cos(ph * 2. * PI));
    float x = sin(t * (.9 + .4 * fi) + fi * 2.1) * .1;
    float r = .036 + .028 * fract(fi * .73) + uBass * .015;
    vec2 d = uv - vec2(x, y);
    f += r * r / (dot(d, d) + .0004);
  }
  f += .7 * smoothstep(-.34, -.46, uv.y);
  float blob = smoothstep(.85, 1.05, f);
  float grad = clamp((uv.y + .45) / .9, 0., 1.);
  vec3 wax = mix(vec3(1., .28, .14), vec3(1., .78, .28), grad) + uMid * .12;
  vec3 liquid = mix(vec3(.16, .02, .1), vec3(.42, .08, .22), grad);
  liquid += vec3(1., .5, .2) * exp(-(uv.y + .5) * 6.) * .5;
  vec3 col = mix(liquid, wax, blob);
  col += wax * .35 * smoothstep(.5, .85, f) * (1. - blob);
  col += vec3(1., .92, .8) * .14 * smoothstep(0., .03, -body) * smoothstep(.16, .11, abs(uv.x + .12)) * smoothstep(.46, .3, abs(uv.y));
  vec3 room = vec3(.03, .02, .03) + vec3(.5, .15, .1) * exp(-length(uv * vec2(1., .7) + vec2(0., .25)) * 3.) * .4;
  col = mix(room, col, inside);
  float base = step(uv.y, -.44) * step(-.5, uv.y) * step(abs(uv.x), .2 + (uv.y + .44) * -.8);
  float cap = step(.44, uv.y) * step(uv.y, .49) * step(abs(uv.x), .16 - (uv.y - .44) * .8);
  vec3 metal = vec3(.5, .45, .4) * (.5 + .5 * smoothstep(.2, 0., abs(uv.x + .06)));
  col = mix(col, metal * (.6 + .6 * exp(-(uv.y + .5) * 8.)), max(base, cap));
  gl_FragColor = vec4(col, 1.);
}`, { speed: 1 });

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
