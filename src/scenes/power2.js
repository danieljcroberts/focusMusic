// Four more takes on Clean Power, each in its own style: an offshore wind farm at sea (realistic), the valley as a
// blueprint (line art on blue), the valley as a paper-cut poster (flat layers with soft shadows), and a solar farm at
// noon with the heat shimmering off it. The palette is shared: navy, energy blue, pale sky, green.
// The shader ones follow the clock (uA, 0 night to 1 day) and the weather (uB); the poster is drawn on the 2D canvas.
import { shaderScene } from './trip.js';
import { daylight, skyMix } from '../daylight.js';
import { weather } from '../weather.js';
import { bands, musicLevel } from '../music.js';
import { W, H, ctx } from '../view.js';
import { rand, rgb, layer } from '../util.js';

const NAVY = [11, 31, 58], BLUE = [0, 160, 222], SKY = [168, 216, 240], PALE = [232, 244, 250], GREEN = [122, 193, 67];

const COMMON = `
float fbm3o(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.07 + 11.3; a *= .5; } return v; }
vec3 dmix(vec3 n, vec3 k, vec3 d, float a){ return a < .5 ? mix(n, k, a * 2.) : mix(k, d, (a - .5) * 2.); }
float stars(vec2 p, float t, float day){
  vec2 c = floor(p), f = fract(p) - .5; float h = h21(c);
  float r = length(f - (vec2(h21(c + 3.1), h21(c + 7.7)) - .5) * .6);
  return smoothstep(.09, .0, r) * step(.9, h) * (.6 + .4 * sin(t * 2. + h * 40.)) * (1. - smoothstep(0., .4, day));
}
// Distance from p to the segment a-b, and how far along it the nearest point lies (in hh).
float hh;
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; hh = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * hh); }
float dither(float t){ return (h21(gl_FragCoord.xy + fract(t)) - .5) / 160.; }
// A three-bladed turbine drawn in screen space: base, height, rotor angle, line width. Returns coverage.
float turbine(vec2 p, vec2 base, float h, float ang, float w){
  vec2 hub = base + vec2(0., h);
  float m = smoothstep(w, w * .4, seg(p, base, hub) - w * .5 * (1. - hh));   // the tower tapers
  m = max(m, smoothstep(w * 1.6, w * .8, length((p - hub - vec2(w * .6, 0.)) * vec2(1., 1.8))));   // nacelle
  for (int k = 0; k < 3; k++) {
    float a = ang + float(k) * 2.0944;
    vec2 tip = hub + vec2(cos(a), sin(a)) * h * .62;
    float d = seg(p, hub, tip);
    m = max(m, smoothstep(w * (1.3 - hh), w * (.5 - .4 * hh), d));             // blades taper to the tip
  }
  return m;
}`;
const build = (fs, o) => shaderScene(COMMON + fs, { res: .8, ...o });
const byClock = (extra = {}) => ({ before(t, dt, gl, u) { gl.uniform1f(u.uA, daylight()); gl.uniform1f(u.uB, weather + bands.bass * .3); }, ...extra });

/* Offshore Wind: rows of turbines standing in the sea to the horizon, the sun on the water, haze with distance,
   a service boat on its rounds. The rotors turn with the wind (and the bass), and their aviation lights blink at night. */
const OFFSHORE = `
vec3 sunL, sunC; float tw;
vec3 skyAt(vec3 rd, float day, float t){
  vec3 zen = dmix(vec3(.012, .022, .07), vec3(.1, .14, .36), vec3(.2, .48, .9), day);
  vec3 hor = dmix(vec3(.05, .07, .14), vec3(.95, .6, .4), vec3(.72, .85, .95), day);
  vec3 sky = mix(hor, zen, smoothstep(-.02, .45, rd.y));
  sky += vec3(1., .5, .25) * tw * exp(-abs(rd.y) * 10.) * .5;
  float sd = max(dot(rd, sunL), 0.);
  sky += sunC * (pow(sd, 1200.) * 1.5 + pow(sd, 24.) * .3 + pow(sd, 2.) * .1);
  if (rd.y > .005) {
    float cd = 2.8 / rd.y; vec2 q = mat2(.82, .57, -.57, .82) * (rd.xz * cd * .06) + vec2(t * .006, 0.);
    float n = fbm3o(q), nl = fbm3o(q + sunL.xz * .06);
    float cov = smoothstep(.5, .68, n) * (1. - smoothstep(20., 60., cd)) * smoothstep(.005, .08, rd.y);
    vec3 lit = mix(vec3(1.), sunC, .5) * (.4 + .6 * day + .4 * tw), dark = mix(zen, hor, .4);
    sky = mix(sky, mix(dark, lit, smoothstep(-.1, .2, nl - n) * .6 + .3), cov);
  }
  return sky;
}
float wave(vec2 p, float t){
  return .5 * sin(p.y * 1.1 - t * 1.) + .25 * sin((p.x * .6 + p.y * 1.2) * 1.9 + t * 1.5) + .15 * sin((p.x * 1.4 - p.y * .8) * 3.3 - t * 2.1)
       + .5 * noise(p * 1.1 + vec2(t * .3, -t * .5)) + .25 * noise(p * 2.6 - vec2(t * .5, t * .2));
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT, day = uA, wind = uB;
  tw = 1. - abs(day * 2. - 1.);
  float sunUp = smoothstep(.5, 1., day), moonK = 1. - smoothstep(0., .1, day);
  sunL = normalize(mix(vec3(.5, .02 + .7 * sunUp, 1.), vec3(-.6, .5, .8), moonK));
  sunC = mix(mix(vec3(1., .5, .25), vec3(1., .96, .88), sunUp), vec3(.55, .65, .9) * .5, moonK);
  vec3 rd = normalize(vec3(uv.x, uv.y + .03, 1.));
  vec3 col;
  float horizonY = -.03;
  if (rd.y >= 0.) {
    col = skyAt(rd, day, t);
    col += stars(uv * 150., t, day) * vec3(.9, .95, 1.);
  } else {
    float d = 1.2 / -rd.y;                              // the sea is 1.2 below the eye
    vec3 p = rd * d;
    float amp = exp(-d * .015) * (1. + .3 * wind);
    float e = .02 + d * .004;
    float w0 = wave(p.xz, t), wx = wave(p.xz + vec2(e, 0.), t), wz = wave(p.xz + vec2(0., e), t);
    vec3 n = normalize(vec3(-(wx - w0) / e * .1 * amp, 1., -(wz - w0) / e * .1 * amp));
    vec3 rr = reflect(rd, n); rr.y = abs(rr.y);
    vec3 refl = skyAt(rr, day, t);
    float fres = .04 + .96 * pow(1. - max(dot(-rd, n), 0.), 5.);
    vec3 deep = dmix(vec3(.01, .02, .04), vec3(.08, .08, .13), vec3(.03, .2, .32), day);
    col = mix(deep, refl, clamp(fres * 1.6, 0., 1.));
    col += sunC * pow(max(dot(rr, sunL), 0.), 300.) * .8 * (1. - moonK * .6);
    float crest = smoothstep(.6, 1.1, w0) * exp(-d * .03) * wind * .5;      // whitecaps when it blows
    col = mix(col, vec3(.85, .9, .95) * (.3 + .7 * day), crest);
    col = mix(col, mix(deep, refl, .4), smoothstep(30., 140., d));
  }
  // Haze: everything far fades toward the horizon colour.
  vec3 hazeC = skyAt(normalize(vec3(uv.x, .01, 1.)), day, t);
  // Turbines: a grid out at sea, far rows first so the near ones draw over them. Eye 1.2 above the sea; towers 1 tall.
  float rot = t * (.9 + 1.6 * wind);
  float white = .6 + .4 * day;
  for (int r = 0; r < 6; r++) for (int c = 0; c < 5; c++) {
    float fr = 5. - float(r), fc = float(c);
    float z = 5.5 + fr * fr * 2.2 + fr * 4. + h21(vec2(fr, fc)) * .5;
    float x = (fc - 2.) * (3.2 + fr * 1.1) + sin(fr * 2. + fc) * .4 - 1.5;
    float bx = x / z;
    float vis = step(abs(bx - uv.x), 1.2 / z + .02);
    vec2 base = vec2(bx, -1.2 / z + .03);
    float h = 1. / z;
    float ph = h21(vec2(fc, fr + 9.)) * 6.28, sp = .9 + .2 * h21(vec2(fr, fc + 3.));
    float m = turbine(uv, base, h, rot * sp + ph, .006 / sqrt(z) + .0012) * vis;
    vec3 tc = mix(vec3(.96, .97, 1.) * white, hazeC, .35 + .6 * smoothstep(5., 80., z));
    tc = mix(tc, tc * .6, smoothstep(base.y + h * .5, base.y, uv.y) * .3);      // darker toward the water
    col = mix(col, tc, m * (1. - smoothstep(60., 140., z)));
    // A soft streak of the tower in the water under it.
    float streak = exp(-abs(uv.x - bx) * 220. * sqrt(z)) * smoothstep(base.y, base.y - h * .9, uv.y) * smoothstep(base.y - h * 1.1, base.y - h * .3, uv.y);
    col += tc * streak * vis * .25 * (.5 + .5 * noise(vec2(uv.x * 200., uv.y * 60. + t)));
    // Aviation light at night, blinking.
    float blink = step(.4, sin(t * 1.6 + ph)) * (1. - smoothstep(0., .3, day));
    col += vec3(1., .2, .15) * blink * vis * exp(-length(uv - base - vec2(0., h)) * 900. * sqrt(z) / 4.) * .9;
  }
  // The service boat: a small hull with a wheelhouse, bobbing on its way across.
  float bz = 9.5, bxp = mod(t * .18, 10.) - 5.;
  vec2 bb = vec2(bxp / bz, -1.2 / bz + .03 + .003 * sin(t * 1.3));
  float hull = step(abs(uv.x - bb.x), .028) * step(bb.y - .005, uv.y) * step(uv.y, bb.y + .006) + step(abs(uv.x - bb.x - .006), .009) * step(bb.y + .006, uv.y) * step(uv.y, bb.y + .018);
  col = mix(col, vec3(.95, .5, .1) * (.3 + .7 * day), clamp(hull, 0., 1.));
  col += vec3(1.) * exp(-length(uv - bb - vec2(.004, .014)) * 600.) * (1. - day) * .6;
  col = mix(col, hazeC, smoothstep(.02, -.01, abs(uv.y - horizonY)) * .35 * (.5 + .5 * wind));    // sea haze at the horizon
  col = 1. - exp(-col * 1.5);
  col += dither(t);
  gl_FragColor = vec4(col, 1.);
}`;
export const offshoreScene = () => build(OFFSHORE, byClock({ res: .8 }));

/* Power Blueprint: the valley as an engineer's drawing. White line-work on blueprint blue with a fine grid: the dam in
   section with hatching, the ridge line, turbines turning, the solar array, pylons with the lines strung between them,
   dimension lines and a compass. Pulses run along the lines with the music. */
const BLUEPRINT = `
float W_;
float line(float d){ return smoothstep(W_, W_ * .3, d); }
float ridge(float x){ return .14 + .08 * sin(x * 2.1 + 1.) + .05 * sin(x * 5.3) + .02 * sin(x * 11.); }
float sag(vec2 p, vec2 a, vec2 b, float s){      // a hanging line, as eight segments
  float d = 1.; vec2 q0 = a;
  for (int i = 1; i <= 8; i++) { float f = float(i) / 8.; vec2 q1 = mix(a, b, f) - vec2(0., s * sin(f * 3.14159)); d = min(d, seg(p, q0, q1)); q0 = q1; }
  return d;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT, asp = uRes.x / uRes.y;
  W_ = 1.4 / uRes.y;
  vec3 paper = vec3(.04, .12, .28) * (.9 + .2 * noise(uv * 300.)) * (1. - .25 * smoothstep(.4, 1.1, length(uv)));
  vec3 ink = vec3(.85, .93, 1.);
  // Grid: fine every .05, heavier every .25.
  vec2 g = abs(fract(uv / .05 + .5) - .5) * .05, G = abs(fract(uv / .25 + .5) - .5) * .25;
  float grid = line(min(g.x, g.y)) * .12 + line(min(G.x, G.y)) * .2;
  grid *= .8 + .2 * uBass;
  vec3 col = paper + ink * grid * .35;
  float m = 0.;
  // Border and title block.
  vec2 lim = vec2(asp * .5 - .04, .46);
  float border = line(abs(max(abs(uv.x) - lim.x, abs(uv.y) - lim.y)));
  m = max(m, border);
  vec2 tb = vec2(lim.x - (asp < 1. ? .22 : .3), -lim.y + .08);
  if (uv.x > tb.x && uv.y < tb.y) {
    m = max(m, line(abs(uv.x - tb.x)) + line(abs(uv.y - tb.y)));
    for (int i = 1; i < 4; i++) m = max(m, line(abs(uv.y - tb.y + float(i) * .025)) * .6);
    m = max(m, line(abs(uv.x - tb.x - .1)) * .6);
  }
  // Ground line and the ridge behind it.
  float ground = -.12;
  m = max(m, line(abs(uv.y - ground)));
  float r = ridge(uv.x);
  m = max(m, line(abs(uv.y - r) * .7) * step(ground, uv.y));
  // Hatching under the ground line, sparse.
  float hatch = step(.9, fract((uv.x + uv.y) * 40.)) * step(ground - .03, uv.y) * step(uv.y, ground) * .5;
  m = max(m, hatch);
  // The dam, in section: a curved face from the crest down to the foot, a hatched body.
  vec2 crest = vec2(-.55, .12), foot = vec2(-.5, ground);
  float face = 1.; vec2 q0 = crest;
  for (int i = 1; i <= 6; i++) { float f = float(i) / 6.; vec2 q1 = mix(crest, foot, f) + vec2(f * f * .06, 0.); face = min(face, seg(uv, q0, q1)); q0 = q1; }
  float back = seg(uv, crest - vec2(.05, 0.), foot - vec2(.12, 0.));
  m = max(m, line(face) + line(back) + line(seg(uv, crest - vec2(.05, 0.), crest)));
  float inDam = step(crest.x - .05 - (uv.y - crest.y) / (foot.y - crest.y) * .07, uv.x) * step(uv.x, crest.x + pow((crest.y - uv.y) / (crest.y - foot.y), 2.) * .06) * step(ground, uv.y) * step(uv.y, crest.y);
  m = max(m, inDam * step(.85, fract((uv.x - uv.y) * 50.)) * .45);
  // Reservoir water line behind the dam: a dashed level line.
  m = max(m, line(abs(uv.y - .09)) * step(uv.x, crest.x - .05) * step(.5, fract(uv.x * 30.)) * .7);
  // Powerhouse: a box at the foot with a door.
  m = max(m, line(abs(max(abs(uv.x + .4) - .05, abs(uv.y - ground - .03) - .03))));
  m = max(m, line(abs(max(abs(uv.x + .39) - .01, abs(uv.y - ground - .015) - .015))) * .7);
  // Turbines on the ridge, turning; one of them with a dimension line beside it.
  float rot = t * (.8 + uB * 1.2);
  for (int i = 0; i < 4; i++) {
    float fi = float(i), x = -.1 + fi * .22;
    vec2 base = vec2(x, ridge(x));
    float h = .13 + .02 * sin(fi * 2.);
    m = max(m, turbine(uv, base, h, rot + fi * 1.7, W_ * 1.2));
    m = max(m, line(abs(length(uv - base - vec2(0., h)) - h * .62)) * .35);   // the rotor's swept circle, faint
  }
  // Dimension line beside the first turbine: vertical with ticks.
  { vec2 b = vec2(-.1, ridge(-.1)); float hgt = .13;
    float dl = seg(uv, b + vec2(-.06, 0.), b + vec2(-.06, hgt));
    dl = min(dl, seg(uv, b + vec2(-.08, 0.), b + vec2(-.04, 0.))); dl = min(dl, seg(uv, b + vec2(-.08, hgt), b + vec2(-.04, hgt)));
    m = max(m, line(dl) * .8); }
  // Solar array on the near slope: rows of tilted panels in outline, each a parallelogram.
  vec2 fieldA = vec2(asp < 1. ? -lim.x + .05 : .05, ground - (asp < 1. ? .2 : .3)), fieldB = vec2(asp < 1. ? lim.x - .05 : lim.x - .34, ground - .05);
  if (uv.x > fieldA.x && uv.x < fieldB.x && uv.y > fieldA.y && uv.y < fieldB.y) {
    vec2 pq = (uv - fieldA) / (fieldB - fieldA);
    float rows = 5., cols = 9.;
    vec2 cell = vec2(pq.x * cols - pq.y * .4, pq.y * rows);
    vec2 cf = fract(cell), cc = floor(cell);
    float inside = step(.08, cf.x) * step(cf.x, .92) * step(.15, cf.y) * step(cf.y, .75);
    float edge = inside * (1. - step(.12, cf.x) * step(cf.x, .88) * step(.19, cf.y) * step(cf.y, .71));
    m = max(m, edge * .9);
    m = max(m, inside * step(.93, fract(cf.x * 3.)) * .35 + inside * step(.9, fract(cf.y * 2.)) * .35);   // cell lines
    // The sweep of the day's light across the array, as a slow brightening.
    m = max(m, inside * .2 * smoothstep(.3, 0., abs(pq.x - fract(t * .04))));
  }
  float fd = abs(max(abs(uv.x - (fieldA.x + fieldB.x) * .5) - (fieldB.x - fieldA.x) * .5, abs(uv.y - (fieldA.y + fieldB.y) * .5) - (fieldB.y - fieldA.y) * .5));
  m = max(m, line(fd) * .5);
  // Dimension line under the array.
  { float y = fieldA.y - .03; float dl = seg(uv, vec2(fieldA.x, y), vec2(fieldB.x, y));
    dl = min(dl, seg(uv, vec2(fieldA.x, y - .015), vec2(fieldA.x, y + .015))); dl = min(dl, seg(uv, vec2(fieldB.x, y - .015), vec2(fieldB.x, y + .015)));
    m = max(m, line(dl) * .8); }
  // Pylons and the lines between them, from the powerhouse across to the right edge, with pulses on their way.
  vec2 py[4]; py[0] = vec2(-.3, ground + .13); py[1] = vec2(.05, ground + .16); py[2] = vec2(.4, ground + .15); py[3] = vec2(.75, ground + .17);
  float pulse = 0.;
  for (int i = 0; i < 4; i++) {
    vec2 p = py[i];
    float pd = seg(uv, p - vec2(.012, p.y - ground), p); pd = min(pd, seg(uv, p + vec2(.012, -(p.y - ground)), p));
    pd = min(pd, seg(uv, p - vec2(.02, .01), p + vec2(.02, -.01)));
    m = max(m, line(pd));
    float yy = (uv.y - ground) / (p.y - ground), hw = .012 * (1. - yy);
    float lattice = step(0., yy) * step(yy, .95) * step(abs(uv.x - p.x), hw) * line(abs(abs(fract(yy * 6.) - .5) * 2. * hw - abs(uv.x - p.x)));   // the zigzag bracing
    m = max(m, lattice * .8);
    if (i < 3) {
      vec2 a = p + vec2(0., -.01), b = py[i + 1] + vec2(0., -.01);
      m = max(m, line(sag(uv, a, b, .03)) * .8);
      for (int k = 0; k < 3; k++) {
        float f = fract(t * .12 + float(k) / 3. + float(i) * .3);
        vec2 q = mix(a, b, f) - vec2(0., .03 * sin(f * 3.14159));
        pulse += exp(-length(uv - q) * 160.) * (.8 + .7 * uLevel);
      }
    }
  }
  // Compass: a circle with a north needle, top right.
  vec2 cp = vec2(lim.x - .09, lim.y - .09);
  float cd = abs(length(uv - cp) - .05); cd = min(cd, seg(uv, cp, cp + vec2(0., .05))); cd = min(cd, seg(uv, cp - vec2(.015, .01), cp + vec2(0., .05))); cd = min(cd, seg(uv, cp + vec2(.015, -.01), cp + vec2(0., .05)));
  m = max(m, line(cd));
  m = max(m, line(abs(length(uv - cp) - .062)) * .4);
  col = mix(col, ink, clamp(m, 0., 1.) * .95);
  col += vec3(.3, .75, 1.) * pulse;
  col += dither(t);
  gl_FragColor = vec4(col, 1.);
}`;
export const blueprintScene = () => build(BLUEPRINT, { res: 1, speed: 1, before(t, dt, gl, u) { gl.uniform1f(u.uB, weather); } });

/* Paper Valley: the valley cut from coloured paper. Sky, sun, clouds, mountains, fjord, dam, hills, the solar field,
   turbines and pylons are flat shapes stacked with soft shadows between the layers. The clouds drift, the turbines turn,
   the water's edge breathes, and the palette follows the clock. */
export function paperValleyScene() {
  let base, built = -1, s, hy, turbines, clouds, grain;
  const stale = () => Math.abs(daylight() - built) > .04;
  const shadow = (g, on) => { g.shadowColor = on ? 'rgba(5,15,35,.35)' : 'transparent'; g.shadowBlur = on ? 14 * s : 0; g.shadowOffsetY = on ? 5 * s : 0; };
  const poly = (g, pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); };
  const ridge = (y0, amp, seed, step = 24) => { const pts = [[-30, H + 30]]; for (let x = -30; x <= W + 30; x += step) pts.push([x, y0 - amp * (.5 + .5 * Math.sin(x * .005 + seed) * Math.sin(x * .0021 + seed * 2.1)) - amp * .15 * Math.abs(Math.sin(x * .02 + seed))]); pts.push([W + 30, H + 30]); return pts; };
  function build() {
    const d = daylight(); built = d; s = Math.min(W, H) / 800; hy = H * (W > H ? .5 : .46);
    let g; [base, g] = layer(W, H);
    g.fillStyle = rgb(skyMix([8, 20, 44], [60, 90, 140], SKY, d)); g.fillRect(0, 0, W, H);
    // A paper sun (or moon), with a ring of lighter paper round it.
    const sx = W * .76, sy = hy * (.3 + .3 * (1 - d)), sr = Math.min(W, H) * .06;
    g.fillStyle = rgb(skyMix([30, 44, 80], [120, 140, 190], [200, 230, 245], d)); g.beginPath(); g.arc(sx, sy, sr * 2.2, 0, Math.PI * 2); g.fill();
    shadow(g, true); g.fillStyle = rgb(skyMix([220, 225, 240], [255, 210, 150], [255, 250, 225], d)); g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill(); shadow(g, false);
    // Far mountains with snow, mid mountains.
    shadow(g, true);
    poly(g, ridge(hy - H * .02, H * .2, 1.7), rgb(skyMix([24, 44, 80], [80, 110, 160], [150, 190, 220], d)));
    shadow(g, false);
    g.save(); g.beginPath(); const far = ridge(hy - H * .02, H * .2, 1.7); far.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.clip();
    poly(g, [[-30, 0], ...far.slice(1, -1).map(p => [p[0], p[1] + H * .045 + Math.sin(p[0] * .04) * 4 * s]), [W + 30, 0]].reverse(), rgb(skyMix([70, 90, 120], [200, 215, 235], PALE, d))); g.restore();
    shadow(g, true);
    poly(g, ridge(hy + H * .01, H * .12, 4.2), rgb(skyMix([14, 32, 60], [40, 75, 120], [90, 140, 185], d)));
    // Fjord: a band of blue paper with a scalloped near edge.
    const wy = hy + H * .02, water = skyMix([10, 28, 56], [20, 80, 140], [40, 150, 210], d);
    const wave = []; for (let x = -30; x <= W + 30; x += 20) wave.push([x, wy + H * .07 + Math.sin(x * .03) * 4 * s]);
    poly(g, [[-30, wy], [W + 30, wy], ...wave.reverse()], rgb(water));
    g.fillStyle = rgb(PALE, .25); for (let i = 0; i < 14; i++) { const x = rand(0, W), y = wy + H * rand(.015, .055); g.beginPath(); g.roundRect(x, y, rand(20, 60) * s, 3 * s, 2); g.fill(); }
    // Dam and near hills.
    const dx = W * (W > H ? .22 : .26), dw = Math.min(W * .3, 300 * s * 1.6), dTop = hy + H * .06, dBot = hy + H * .2;
    const hill = skyMix([10, 24, 36], [30, 70, 60], GREEN, d);
    poly(g, [[-30, H + 30], [-30, dTop - H * .04], [dx - dw * .6, dTop - H * .05], [dx - dw * .5, dTop], [dx - dw * .5, H + 30]], rgb(hill.map(v => v * .85)));
    poly(g, [[dx + dw * .5, H + 30], [dx + dw * .5, dTop], [dx + dw * .8, dTop - H * .05], [dx + dw * 1.4, dTop - H * .01], [W + 30, dTop + H * .02], [W + 30, H + 30]], rgb(hill.map(v => v * .85)));
    g.fillStyle = rgb(skyMix([90, 100, 120], [180, 190, 205], [236, 240, 244], d));
    g.beginPath(); g.moveTo(dx - dw / 2, dTop); g.quadraticCurveTo(dx, dTop + H * .015, dx + dw / 2, dTop); g.lineTo(dx + dw * .42, dBot); g.quadraticCurveTo(dx, dBot + H * .03, dx - dw * .42, dBot); g.fill();
    g.fillStyle = rgb(skyMix([60, 70, 90], [140, 150, 170], [200, 210, 220], d)); g.fillRect(dx - dw * .16, dBot + H * .01, dw * .32, H * .035);
    g.fillStyle = rgb(PALE, .9); g.beginPath(); g.moveTo(dx - dw * .05, dTop + H * .012); g.lineTo(dx + dw * .05, dTop + H * .012); g.lineTo(dx + dw * .07, dBot); g.lineTo(dx - dw * .07, dBot); g.fill();
    // Near slope with the solar field: a green paper hill and a sheet of small navy panels.
    const fy = H * (W > H ? .72 : .7);
    poly(g, [[-30, H + 30], [-30, fy - H * .02], [W * .5, fy - H * .1], [W + 30, fy - H * .03], [W + 30, H + 30]], rgb(hill));
    shadow(g, false);
    const pw = 40 * s, ph = 15 * s;
    for (let r = 0; r < (W > H ? 5 : 6); r++) {
      const y = fy + r * ph * 1.9 + ph, k = 1 + r * .18;
      for (let x = W * .1 - (r % 2) * pw * .5; x < W * .95; x += pw * k * 1.12) {
        g.fillStyle = rgb(skyMix([8, 16, 34], NAVY, [18, 46, 90], d)); g.beginPath(); g.moveTo(x + pw * k * .12, y); g.lineTo(x + pw * k, y); g.lineTo(x + pw * k * .88, y + ph * k); g.lineTo(x, y + ph * k); g.fill();
        g.fillStyle = rgb(BLUE, .8); g.fillRect(x + pw * k * .12, y, pw * k * .88, 1.5 * s);
      }
    }
    // Pylons and lines, as thin cut strips.
    const pylons = [[dx + dw * .3, dBot - H * .02], [W * .52, fy - H * .09], [W * .82, fy - H * .075], [W + 40, fy - H * .1]];
    g.strokeStyle = rgb(skyMix([30, 40, 60], [60, 80, 110], [60, 80, 100], d)); g.lineWidth = Math.max(1.5, 2 * s); g.lineCap = 'round';
    for (const [x, y] of pylons) { g.beginPath(); g.moveTo(x - 8 * s, y + 60 * s); g.lineTo(x, y); g.lineTo(x + 8 * s, y + 60 * s); g.moveTo(x - 12 * s, y + 8 * s); g.lineTo(x + 12 * s, y + 8 * s); g.stroke(); }
    g.lineWidth = Math.max(1, 1.2 * s);
    for (let k = 0; k < pylons.length - 1; k++) { const [x0, y0] = pylons[k], [x1, y1] = pylons[k + 1]; g.beginPath(); g.moveTo(x0, y0 + 8 * s); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 30 * s, x1, y1 + 8 * s); g.stroke(); }
    // Turbines: on the mid ridge and in the fjord.
    turbines = [];
    const n = W > H ? 5 : 3;
    for (let i = 0; i < n; i++) { const x = W * (.48 + i * (.48 / n)); turbines.push({ x, y: hy + H * .01 - H * .12 * (.5 + .5 * Math.sin(x * .005 + 4.2) * Math.sin(x * .0021 + 8.8)) + 2, h: (64 + 18 * Math.sin(i * 2.3)) * s, ph: rand(0, 6.28), sp: rand(.85, 1.15) }); }
    for (let i = 0; i < (W > H ? 2 : 1); i++) turbines.push({ x: W * (.64 + i * .16), y: wy + H * .045, h: 42 * s, ph: rand(0, 6.28), sp: rand(.9, 1.1) });
    clouds = clouds || Array.from({ length: 5 }, (_, i) => ({ x: rand(0, W), y: hy * (.12 + .5 * (i / 5)), w: rand(110, 220) * s, v: rand(4, 9) * s }));
    // Paper grain, drawn once.
    if (!grain) { let gg; [grain, gg] = layer(256, 256); const im = gg.createImageData(256, 256); for (let i = 0; i < im.data.length; i += 4) { const v = 118 + Math.random() * 20; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } gg.putImageData(im, 0, 0); }
  }
  function cloud(c, d) {
    const col = rgb(skyMix([40, 56, 96], [170, 160, 200], [255, 255, 255], d));
    shadow(ctx, true); ctx.fillStyle = col; ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.w * .22, c.w * .11); ctx.fill();
    ctx.beginPath(); ctx.arc(c.x + c.w * .35, c.y, c.w * .17, 0, Math.PI * 2); ctx.arc(c.x + c.w * .6, c.y + c.w * .02, c.w * .13, 0, Math.PI * 2); ctx.fill();
    shadow(ctx, false);
  }
  function turbine(tb, t, d, speed) {
    const { x, y, h } = tb, rot = t * speed * tb.sp + tb.ph, white = rgb(skyMix([170, 180, 200], [225, 230, 240], [255, 255, 255], d));
    shadow(ctx, true); ctx.fillStyle = white;
    ctx.beginPath(); ctx.moveTo(x - h * .04, y); ctx.lineTo(x - h * .018, y - h); ctx.lineTo(x + h * .018, y - h); ctx.lineTo(x + h * .04, y); ctx.fill();
    for (let k = 0; k < 3; k++) {
      const a = rot + k * Math.PI * 2 / 3, ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca, b = h * .6;
      ctx.beginPath(); ctx.moveTo(x + nx * h * .03, y - h + ny * h * .03); ctx.lineTo(x + ca * b, y - h + sa * b); ctx.lineTo(x - nx * h * .03, y - h - ny * h * .03); ctx.fill();
    }
    shadow(ctx, false);
    ctx.fillStyle = rgb(BLUE); ctx.beginPath(); ctx.arc(x, y - h, h * .035, 0, Math.PI * 2); ctx.fill();
  }
  return {
    init() { built = -1; },
    draw(t, dt) {
      if (built < 0 || stale()) build();
      const d = daylight();
      ctx.drawImage(base, 0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hy); ctx.clip();
      for (const c of clouds) { c.x += c.v * dt * (.5 + weather); if (c.x > W + 20) c.x = -c.w - 20; cloud(c, d); }
      ctx.restore();
      const speed = .5 + 1.6 * weather + .4 * bands.bass;
      for (const tb of turbines) turbine(tb, t, d, speed);
      // Pulses on the lines: little paper dots of energy blue.
      ctx.fillStyle = rgb(BLUE, .5 + .5 * musicLevel);
      for (let k = 0; k < 4; k++) { const u = (t * .06 + k / 4) % 1, x = W * (.2 + u * .9), y = H * (W > H ? .6 : .58) + Math.sin(u * 9) * 8 * s; ctx.beginPath(); ctx.arc(x, y, 3 * s, 0, Math.PI * 2); ctx.fill(); }
      // Paper grain over everything.
      ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .35;
      for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) ctx.drawImage(grain, x, y);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  };
}

/* Solar Noon: low across a solar farm under a hard blue sky. Rows of panels run to the horizon, the sky lies in their
   glass, the air shimmers with heat near the ground, a hawk circles, and turbines turn far off. Follows the clock. */
const SOLAR = `
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT, day = uA;
  float sunUp = smoothstep(.5, 1., day), moonK = 1. - smoothstep(0., .1, day), tw = 1. - abs(day * 2. - 1.);
  vec3 sunL = normalize(mix(vec3(.3, .05 + .9 * sunUp, .6), vec3(-.5, .5, .7), moonK));
  vec3 sunC = mix(mix(vec3(1., .55, .3), vec3(1., .98, .92), sunUp), vec3(.55, .65, .9) * .5, moonK);
  // Heat shimmer: the view wobbles a little just above the horizon, more by day.
  float horizon = .06;
  float shim = smoothstep(.12, 0., abs(uv.y - horizon)) * day;
  vec2 sv = uv + vec2(noise(vec2(uv.x * 40., uv.y * 90. + t * 3.)) - .5, noise(vec2(uv.x * 30. + 9., uv.y * 80. - t * 2.5)) - .5) * .006 * shim;
  vec3 rd = normalize(vec3(sv.x, sv.y - horizon, 1.));
  vec3 zen = dmix(vec3(.012, .02, .07), vec3(.1, .14, .36), vec3(.12, .4, .9), day);
  vec3 hor = dmix(vec3(.05, .07, .14), vec3(.95, .6, .4), vec3(.72, .86, .95), day);
  vec3 skyC = mix(hor, zen, smoothstep(-.02, .5, rd.y));
  skyC += vec3(1., .5, .25) * tw * exp(-abs(rd.y) * 10.) * .5;
  float sd = max(dot(rd, sunL), 0.);
  skyC += sunC * (pow(sd, 1500.) * 1.5 + pow(sd, 20.) * .25 + pow(sd, 2.) * .08);
  skyC += stars(uv * 150., t, day) * vec3(.9, .95, 1.);
  if (rd.y > .01) {   // a few fair-weather cumulus
    float cd = 2.2 / rd.y; vec2 q = mat2(.82, .57, -.57, .82) * (rd.xz * cd * .09) + vec2(t * .01, 0.);
    float n = fbm3o(q); float cov = smoothstep(.55, .72, n) * (1. - smoothstep(20., 60., cd)) * smoothstep(.01, .1, rd.y);
    vec3 cc = mix(mix(zen, hor, .5), vec3(1.) * (.5 + .5 * day), smoothstep(.55, .8, n + .1 * (fbm3o(q + sunL.xz * .1) - n)) * .6 + .4);
    skyC = mix(skyC, cc, cov);
  }
  vec3 col = skyC;
  if (rd.y < 0.) {
    // Rows of panels: tilted planes, front edge .3 up, back edge 1.1 up over 1.6 of depth, every 3 along z, with a
    // service lane every 24 across. Tested near to far so a near row hides what is behind it; the ground shows between.
    float pitch = 3., depth = 1.6, slope = .5, E = 2.6, y0 = -E + .3;
    float best = -1., kk = 0.; vec3 hp = vec3(0.);
    for (int i = 0; i < 30; i++) {
      float zk = 1.4 + float(i) * pitch;
      float tt = (y0 - slope * zk) / (rd.y - slope * rd.z);
      if (tt <= 0.) continue;
      vec3 p = rd * tt;
      float k = (p.z - zk) / depth;
      if (k < 0. || k > 1.) continue;
      if (abs(mod(p.x + 12., 24.) - 12.) < 1.1) continue;      // the lane, straight ahead
      best = tt; kk = k; hp = p; break;
    }
    float dg = -E / rd.y;
    vec3 pg = rd * dg;
    vec3 gnd = dmix(vec3(.03, .035, .03), vec3(.3, .22, .16), vec3(.55, .5, .36), day) * (.75 + .5 * noise(pg.xz * 6.)) * (.8 + .3 * noise(pg.xz * 40.));
    gnd += vec3(.1, .18, .04) * smoothstep(.4, .7, noise(pg.xz * 2. + 5.)) * day;
    // Posts under each row throw a little shade on the ground.
    float rowK = fract((pg.z - 1.4) / pitch) * pitch / depth;
    gnd *= 1. - .35 * step(rowK, 1.) * step(1.3, abs(mod(pg.x + 12., 24.) - 12.)) * day;
    col = mix(gnd, hor, smoothstep(25., 120., dg));
    if (best > 0.) {
      float d = best, k = kk; vec3 p = hp;
      vec3 nrm = normalize(vec3(0., 1., -slope));
      vec3 glass = dmix(vec3(.01, .02, .05), vec3(.05, .07, .14), vec3(.03, .07, .16), day);
      vec3 rr = reflect(rd, nrm);
      vec3 reflSky = mix(hor, zen, smoothstep(-.1, .6, rr.y));
      float fres = .15 + .85 * pow(1. - max(dot(-rd, nrm), 0.), 3.);
      vec3 face = mix(glass, reflSky, fres * (.5 + .5 * day));
      float cellX = abs(fract(p.x / .6) - .5), cellZ = abs(fract(k * 3.) - .5);
      float grid = smoothstep(.46, .49, max(cellX, cellZ)) * exp(-d * .025);
      face = mix(face, vec3(0., .63, .87) * (.3 + .7 * day), grid * .55);
      float frame = step(.975, k) + step(k, .025) + step(abs(fract(p.x / 6.) - .5), .004);
      face = mix(face, vec3(.6, .64, .68) * (.3 + .7 * day), clamp(frame, 0., 1.) * exp(-d * .02));
      face += sunC * pow(max(dot(rr, sunL), 0.), 80.) * .5 * (.5 + .5 * day) * (1. - moonK);     // the sun in the glass
      face += vec3(.9, .95, 1.) * smoothstep(.2, 0., abs(fract(t * .02) * 60. - p.z)) * .08 * day;   // a slow sweep of light down the rows
      col = mix(face, hor, smoothstep(25., 120., d));
    }
  }
  // Far turbines on the horizon.
  float rot = t * (.8 + uB * 1.2);
  for (int i = 0; i < 6; i++) {
    float fi = float(i), z = 60. + fi * 14. + mod(fi * 7., 11.), x = (fi - 2.5) * 11. + sin(fi * 3.) * 3.;
    vec2 base = vec2(x / z, -2.6 / z + horizon);
    float m = turbine(uv, base, 1.2 / z, rot + fi * 1.9, .0025);
    col = mix(col, mix(vec3(.97) * (.5 + .5 * day), hor, .6), m);
  }
  // A hawk circling high, a small dark chevron on a slow loop.
  vec2 hp = vec2(.15 + .22 * cos(t * .13), .25 + .08 * sin(t * .26));
  vec2 hv = (uv - hp) * 60.; float flap = .3 + .25 * sin(t * 5.);
  float hawk = smoothstep(.09, .03, abs(hv.y - flap * abs(hv.x)) ) * step(abs(hv.x), .9) * step(-.2, uv.y);
  col = mix(col, vec3(.1, .08, .05), hawk * .8 * day);
  col = 1. - exp(-col * 1.5);
  col += dither(t);
  gl_FragColor = vec4(col, 1.);
}`;
export const solarNoonScene = () => build(SOLAR, byClock({ res: .85 }));
