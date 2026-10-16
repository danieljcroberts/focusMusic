// Shader scenes, third set: rebuilds of the older flat scenes (Aquarium, Forest at Dusk, Desert Night, Volcano Island,
// Koi Pond, Zen Garden, Mars Dust Storm, Comet Pass) and new ones (Polar Night, Midnight Sun, Train by Day, Rain on a
// Tent, Kelp Forest). Outdoor ones follow the clock (uA, 0 night to 1 day) and the weather (uB). Nothing here flashes.
import { shaderScene } from './trip.js';
import { daylight } from '../daylight.js';
import { weather } from '../weather.js';
import { lowPower } from '../view.js';
import { moonPhase, MOON_GLSL } from '../moon.js';

const H = `
float h31(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1., 0., 0.)), f.x), mix(h31(i + vec3(0., 1., 0.)), h31(i + vec3(1., 1., 0.)), f.x), f.y),
             mix(mix(h31(i + vec3(0., 0., 1.)), h31(i + vec3(1., 0., 1.)), f.x), mix(h31(i + vec3(0., 1., 1.)), h31(i + vec3(1., 1., 1.)), f.x), f.y), f.z);
}
float fbm3o(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.07 + 11.3; a *= .5; } return v; }
float fbm4(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 7.7; a *= .5; } return v; }
vec3 dmix(vec3 n, vec3 k, vec3 d, float a){ return a < .5 ? mix(n, k, a * 2.) : mix(k, d, (a - .5) * 2.); }
float stars(vec2 p, float t, float day){
  vec2 c = floor(p), f = fract(p) - .5; float h = h21(c);
  float r = length(f - (vec2(h21(c + 3.1), h21(c + 7.7)) - .5) * .6);
  return smoothstep(.09, .0, r) * step(.9, h) * (.6 + .4 * sin(t * 2. + h * 40.)) * (1. - smoothstep(0., .4, day));
}
float hh;
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; hh = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * hh); }
// Weather overlays. wetness(): 0 in fair weather, rising to 1 as uB nears its wettest.
float wetness(){ return clamp((uB - .45) / .55, 0., 1.); }
// Falling snow: one layer of flakes at scale s, falling at sp; returns coverage.
float flakes(vec2 uv, float t, float s, float sp, float dens){
  vec2 g = uv * s + vec2(sin(t * .3 + uv.y * 3.) * .25, t * sp), c = floor(g), f = fract(g) - .5;
  vec2 o = (vec2(h21(c + 1.3), h21(c + 2.9)) - .5) * .6;
  return smoothstep(.1, .03, length(f - o)) * step(1. - dens, h21(c));
}
// Rain streaks: thin slanted lines falling, at scale s.
float streaks(vec2 uv, float t, float s, float dens){
  vec2 g = vec2((uv.x + uv.y * .12) * s, uv.y * s * .07 + t * 1.6), c = floor(g), f = fract(g);
  return step(1. - dens, h21(c)) * smoothstep(.06, .0, abs(f.x - .5) - .015) * smoothstep(0., .25, f.y) * smoothstep(1., .55, f.y);
}
float dither(float t){ return (h21(gl_FragCoord.xy + fract(t)) - .5) / 160.; }
float px(){ return 1.5 / uRes.y; }
// Portrait framing: on a tall screen, zoom out until at least w of the scene's width shows, so its subject stays in view.
float aspW(float w){ return max(uRes.x / uRes.y, w); }
vec2 fit(float w){ vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; return uv * aspW(w) / (uRes.x / uRes.y); }
// As fit, and also lowers the horizon on a tall screen, so the sky fills the frame rather than an empty foreground.
vec2 fitLow(float w, float k){ float pf = 1. - (uRes.x / uRes.y) / aspW(w); return fit(w) + vec2(0., pf * k); }
// A fish facing +x at c, size s, turned to dir (1 or -1): colour in rgb, coverage in a.
vec4 fish(vec2 p, vec2 c, float s, float dir, float t, float ph, vec3 top, vec3 belly, float spots){
  vec2 q = (p - c) / s; q.x *= dir;
  float wag = sin(t * 5. + ph) * .18;
  q.y -= wag * max(0., -q.x) * .7;
  float body = length(q * vec2(1., 2.7)) - 1.;
  vec2 tq = q - vec2(-1.05, 0.);
  float tail = max(abs(tq.y) - (-tq.x) * .95 - .04, max(tq.x - .05, -tq.x - .55));
  float fin = length((q - vec2(.05, .42)) * vec2(2.6, 4.)) - 1.;
  float d = min(min(body, tail), fin);
  float a = smoothstep(px() / s, -px() / s, d * .3);
  vec3 col = mix(belly, top, smoothstep(-.25, .25, q.y));
  col = mix(col, vec3(.95, .25, .1), spots * smoothstep(.55, .62, noise(q * 2.2 + ph * 7.)) * step(body, 0.));
  col *= .75 + .25 * smoothstep(-1., .6, q.x);
  col = mix(col, vec3(.02), smoothstep(.12, .07, length(q - vec2(.62, .1))));
  return vec4(col, a);
}
`;
const build = (fs, o) => shaderScene(H + fs, { res: .8, ...o });
const withMoon = fs => MOON_GLSL(moonPhase()) + fs;   // tonight's phase
const byClock = (extra = {}) => ({ before(t, dt, gl, u) { gl.uniform1f(u.uA, daylight()); gl.uniform1f(u.uB, weather); }, ...extra });
const season = () => { const m = new Date().getMonth(); return m <= 1 || m === 11 ? 3 : m <= 4 ? 0 : m <= 7 ? 1 : 2; };   // spring 0, summer 1, autumn 2, winter 3
const withSeason = fs => `const float SEASON = ${season()}.;\n` + fs;

/* Aquarium: a planted tank seen through the glass. Light falls in shafts from the surface and ripples over the gravel,
   plants sway, fish go about their day at three depths, and bubbles rise from the corner. */
const AQUARIUM = `
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, asp = uRes.x / uRes.y;
  vec3 col = mix(vec3(.01, .07, .1), vec3(.07, .3, .34), smoothstep(-.55, .5, uv.y));
  col += vec3(.1, .3, .3) * exp(-length(uv - vec2(0., .55)) * 2.) * .5;
  // The back: dark rock and moss.
  float rocks = -.18 + .14 * fbm3o(vec2(uv.x * 2.2 + 3., 1.)) + .05 * sin(uv.x * 1.3);
  col = mix(col, vec3(.02, .08, .07) * (.7 + .5 * noise(uv * 20.)), smoothstep(rocks + .01, rocks - .01, uv.y) * .85);
  // Shafts from the surface, brighter with the music.
  float sh = pow(noise(vec2(uv.x * 2.5 + uv.y * .9 + t * .04, 3.)), 3.) * smoothstep(-.5, .5, uv.y);
  col += vec3(.35, .65, .6) * sh * (.3 + .15 * uLevel);
  // Plants: strands of three kinds, swaying, darker further back.
  for (int i = 0; i < 14; i++) {
    float fi = float(i), x0 = (h21(vec2(fi, 2.)) - .5) * asp * .95, h = .25 + .35 * h21(vec2(fi, 5.)), back = h21(vec2(fi, 9.));
    float base = -.4, y = uv.y - base, k = clamp(y / h, 0., 1.);
    float x = x0 + sin(t * .6 + fi + y * 5.) * .03 * k + sin(t * .23 + fi * 2.) * .02 * k;
    float w = (.012 + .01 * h21(vec2(fi, 11.))) * (1. - .7 * k);
    float leaf = smoothstep(w + px(), w, abs(uv.x - x)) * step(0., y) * step(y, h);
    vec3 g = mix(vec3(.08, .35, .14), vec3(.2, .55, .2), h21(vec2(fi, 13.))) * (.5 + .5 * k) * (1. - .45 * back);
    col = mix(col, g, leaf);
  }
  // Gravel with caustics.
  float floorY = -.4 + .015 * sin(uv.x * 4.);
  if (uv.y < floorY) {
    float grain = noise(uv * 150.), pebbles = noise(uv * 26.);
    vec3 gc = mix(vec3(.42, .36, .28), vec3(.72, .64, .5), grain) * (.55 + .45 * pebbles);
    float ca = pow(abs(sin(noise(uv * 7. + vec2(t * .2, 0.)) * 6.28 + noise(uv * 11. - t * .15) * 5.)), 10.);
    gc += vec3(.5, .8, .75) * ca * .5;
    col = mix(col, gc * (.6 + .4 * smoothstep(-.6, floorY, uv.y)), smoothstep(floorY, floorY - .01, uv.y));
  }
  // Fish at three depths: small and pale at the back, larger and bright in front.
  for (int i = 0; i < 11; i++) {
    float fi = float(i), depth = h21(vec2(fi, 21.)), sp = .05 + .05 * h21(vec2(fi, 23.)), dir = h21(vec2(fi, 25.)) < .5 ? -1. : 1.;
    float span = asp + .6, x = (mod(t * sp + h21(vec2(fi, 27.)) * span, span) - span * .5) * dir;
    vec2 c = vec2(x, -.25 + .55 * h21(vec2(fi, 29.)) + .04 * sin(t * .5 + fi));
    float s = .025 + .035 * depth;
    int kind = int(mod(fi, 4.));
    vec3 top = kind == 0 ? vec3(1., .5, .15) : kind == 1 ? vec3(.3, .45, .95) : kind == 2 ? vec3(.85, .85, .9) : vec3(.95, .75, .2);
    vec4 f = fish(uv, c, s, dir, t, fi * 3.7, top, top * .55 + .2, kind == 2 ? 1. : 0.);
    col = mix(col, mix(col, f.rgb, .45 + .55 * depth), f.a);
  }
  // Bubbles from the corner.
  for (int i = 0; i < 14; i++) {
    float fi = float(i), y = mod(t * (.12 + .05 * h21(vec2(fi, 31.))) + fi * .09, 1.1) - .45;
    vec2 c = vec2(asp * .5 - .12 + .015 * sin(t * 2. + fi * 3.), y);
    float r = .006 + .006 * h21(vec2(fi, 33.)), d = abs(length(uv - c) - r);
    col += vec3(.7, .9, .95) * smoothstep(px(), 0., d) * .6;
  }
  // The glass: a soft sheen and darker edges.
  col += vec3(.06) * smoothstep(.02, 0., abs(uv.x + asp * .3 + uv.y * .2) - .03);
  col *= 1. - .35 * smoothstep(.4, 1.1, length(uv * vec2(.8, 1.)));
  col = 1. - exp(-col * 1.4);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const aquariumScene = () => build(AQUARIUM, { res: .85 });

/* Forest at Dusk: a painted wood at the last of the light. Five depths of firs, mist lying between them and drifting,
   tonight's moon, the first stars, and fireflies in the near grass. Brighter or darker with the clock. */
const FOREST = `
float firs(float x, float k){
  float cell = floor(x), f = fract(x) - .5, h = h21(vec2(cell, k));
  float tall = .5 + .5 * h, w = .32 + .1 * h21(vec2(cell, k + 3.));
  return tall * max(0., 1. - abs(f) / w) + .15 * noise(vec2(x * 6., k));   // a triangle with ragged edges
}
void main(){
  vec2 uv = fitLow(1.1, .6); float t = uT, d = clamp(uA, .15, .7);
  vec3 col = mix(vec3(.7, .42, .48), vec3(.18, .16, .38), smoothstep(-.2, .5, uv.y));
  col = mix(col * .45, col, (d - .15) / .55);
  col += vec3(1., .6, .4) * exp(-abs(uv.y + .05) * 6.) * .3 * d;
  col += stars(uv * 150., t, d * .5) * vec3(.9, .9, 1.);
  vec2 mp = vec2(.42, .32); float disc = smoothstep(.04, .038, length(uv - mp)), moon = disc * moonLit((uv - mp) / .04);
  col = mix(col, col * .7 + vec3(.05, .05, .08), disc * (1. - moon));      // the dark side, faintly
  col += vec3(1., .95, .85) * moon + vec3(.6, .6, .8) * exp(-length(uv - mp) * 8.) * .2 * (1. - abs(MOONP * 2. - 1.));
  for (int i = 0; i < 5; i++) {
    float k = float(i), z = 4. - k * .7, drift = t * .002 * (k + 1.);
    float top = -.05 - k * .08 + firs(uv.x * (2. + k * 1.3) + k * 7. + drift, k) * (.12 + k * .05);
    vec3 tc = mix(vec3(.3, .25, .4), vec3(.02, .02, .04), k / 4.) * (.5 + d);
    col = mix(col, tc, smoothstep(top + .002, top - .002, uv.y));
    // Mist after each of the far layers.
    if (i < 4) { float m = fbm3o(vec2(uv.x * 2. + t * .01 * (k + 1.), uv.y * 6. + k)) * smoothstep(top - .02, top - .12, uv.y) * smoothstep(top - .3, top - .1, uv.y);
      col = mix(col, vec3(.55, .45, .6) * (.4 + .8 * d), m * .45); }
  }
  // Fireflies in the near grass.
  for (int i = 0; i < 2; i++) {
    float s = 9. + float(i) * 6.;
    vec2 g = uv * s + vec2(t * .05, sin(t * .2) * .2), c = floor(g), f = fract(g) - .5; float h = h21(c + float(i) * 9.);
    vec2 o = (vec2(h21(c + 1.7), h21(c + 4.1)) - .5) * .7 + .15 * vec2(sin(t * .7 + h * 20.), cos(t * .5 + h * 13.));
    float blink = pow(.5 + .5 * sin(t * (1. + h) + h * 40.), 6.);
    col += vec3(.85, 1., .4) * smoothstep(.07, 0., length(f - o)) * step(.82, h) * blink * smoothstep(-.1, -.4, uv.y) * (1. - d);
  }
  col = 1. - exp(-col * 1.5);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const forestDuskScene = () => build(withMoon(FOREST), byClock({ res: .8 }));

/* Desert Night: dunes under a huge moon. Five ranks of dunes with sharp crests, lit on one face and shadowed on the
   other, sand smoking off the crests in the wind, and a caravan's lanterns crossing a far ridge. Day turns it gold. */
const DESERT = `
float dune(float x, float k){ float n = noise(vec2(x, k)); return 1. - abs(n * 2. - 1.); }
float ridge(float x, float k){ return dune(x * .45 + k * 5., k) * .75 + noise(vec2(x * 1.3 + k, k + 3.)) * .25; }
void main(){
  vec2 uv = fit(1.1); float t = uT, day = uA, wind = uB;
  vec3 sky = mix(dmix(vec3(.06, .07, .18), vec3(.8, .5, .45), vec3(.85, .75, .6), day), dmix(vec3(.01, .015, .05), vec3(.2, .15, .35), vec3(.35, .55, .85), day), smoothstep(-.1, .55, uv.y));
  vec3 col = sky + stars(uv * 150., t, day) * vec3(.9, .9, 1.);
  vec2 mp = vec2(-.35, .28); float md = length(uv - mp);
  float full = 1. - abs(MOONP * 2. - 1.), disc = smoothstep(.09, .088, md), lit = disc * moonLit((uv - mp) / .09);
  col = mix(col, col * .9 + vec3(.015, .015, .03), disc * (1. - lit) * (1. - day));   // the dark side, faintly
  col += vec3(1., .97, .9) * lit * (1. - .75 * day) + vec3(.6, .65, .9) * exp(-md * 5.) * .3 * (1. - day) * (.3 + .7 * full);
  vec3 sandL = dmix(vec3(.32, .34, .5) * (.55 + .45 * full), vec3(.95, .6, .4), vec3(1., .78, .5), day), sandD = dmix(vec3(.06, .06, .14), vec3(.4, .2, .2), vec3(.62, .4, .25), day);
  for (int i = 0; i < 5; i++) {
    float k = float(i), sc = 1.5 + k * .9, base = -.02 - k * .1, amp = .1 + k * .04;
    float x = uv.x * sc + t * .0015 * (k + 1.);
    float r = base + amp * ridge(x, k);
    float xs = x + (r - uv.y) * sc * 1.2;                                    // faces slant down from each crest
    float slope = (ridge(xs + .01, k) - ridge(xs - .01, k)) / .02;
    float lit = smoothstep(-.4, .4, -slope);                                  // the face toward the moon
    vec3 c = mix(sandD, sandL, lit * .85 + .1) * (.6 + .4 * (1. - k / 5.));
    c *= .93 + .12 * noise(vec2(uv.x * 60. + uv.y * 30., uv.y * 260.));                     // ripples in the sand
    c = mix(c, sky, .5 * (1. - k / 4.) * (1. - day * .3));                    // the far dunes fade into the night
    col = mix(col, c, smoothstep(r + .002, r - .002, uv.y));
    // Sand blown off the crest.
    float blow = fbm3o(vec2(uv.x * 10. + t * (1. + wind), uv.y * 40.)) * smoothstep(r + .05, r, uv.y) * smoothstep(r - .005, r + .005, uv.y);
    col += sandL * blow * .35 * (.3 + wind);
    if (i == 1) {   // the caravan's lanterns along the second ridge
      for (int j = 0; j < 5; j++) {
        float lx = mod(-t * .006 + float(j) * .045, 2.4) - 1.2;
        float ly = base + amp * ridge(lx * sc + t * .0015 * (k + 1.), k) + .006;
        col += vec3(1., .7, .3) * exp(-length(uv - vec2(lx, ly)) * 400.) * 1.5 * (1. - day);
      }
    }
  }
  col = 1. - exp(-col * 1.4);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const desertScene = () => build(withMoon(DESERT), byClock({ res: .85 }));

/* Volcano Island: an island across dark water, glowing at the summit. Lava ribbons pulse down one flank, a plume rises
   and leans with the wind, lit orange from beneath, sparks lift, and the glow lies on the sea. */
const VOLCANO = `
float island(float x){ float c = .1; return -.04 + .33 * exp(-pow(abs(x - c) * 3.2, 1.4)) - .05 * exp(-pow((x - c) * 30., 2.)) + .02 * noise(vec2(x * 12., 1.)); }
void main(){
  vec2 uv = fit(0.95); float t = uT, day = uA, wind = uB;
  vec3 col = mix(dmix(vec3(.08, .04, .06), vec3(.6, .3, .25), vec3(.6, .7, .85), day), dmix(vec3(.01, .01, .03), vec3(.15, .1, .25), vec3(.3, .5, .8), day), smoothstep(-.05, .5, uv.y));
  col += stars(uv * 150., t, day) * vec3(.9, .9, 1.);
  vec2 summit = vec2(.1, island(.1) - .01);
  // The plume: rising and leaning downwind, its underside lit by the glow.
  vec2 q = uv - summit; float up = max(q.y, 0.);
  float lean = q.x - up * up * (.6 + .8 * wind) - up * .2;
  float width = .03 + up * .35;
  float plume = smoothstep(width, width * .2, abs(lean)) * step(0., q.y) * smoothstep(.75, .2, up);
  float puff = fbm4(vec2(lean * 6., up * 4. - t * .08));
  vec3 smoke = mix(vec3(.25, .12, .08) * (1. + 3. * exp(-up * 6.)), dmix(vec3(.06), vec3(.3, .28, .3), vec3(.6), day), smoothstep(0., .4, up));
  col = mix(col, smoke, plume * smoothstep(.35, .7, puff));
  // The island, dark rock, with the glow at the top and lava down the right flank.
  float h = island(uv.x);
  if (uv.y < h && uv.y > -.04) {
    float fromTop = (summit.y - uv.y);
    vec3 rock = dmix(vec3(.02, .015, .015), vec3(.12, .07, .06), vec3(.25, .22, .2), day) * (.7 + .4 * noise(uv * 40.));
    for (int j = 0; j < 3; j++) {
      float fj = float(j), len = .12 + .06 * fj, dir = .25 + .35 * fj;
      float cx = summit.x + fromTop * dir + .015 * sin(fromTop * 30. + fj * 2.) + .008 * sin(fromTop * 71. + fj);
      float w = .002 + .006 * fromTop;
      float flow = smoothstep(w, w * .3, abs(uv.x - cx)) * step(0., fromTop) * smoothstep(len, len * .6, fromTop);
      float pulse = .7 + .3 * sin(fromTop * 60. - t * 1.2 + fj) + .3 * uBass;
      rock += vec3(1., .35, .05) * flow * pulse * 1.8;
      rock += vec3(.6, .15, .02) * smoothstep(w * 5., 0., abs(uv.x - cx)) * step(0., fromTop) * smoothstep(len, len * .5, fromTop) * .4;
    }
    rock += vec3(1., .4, .1) * exp(-length(uv - summit) * 18.) * 1.2;
    col = mix(col, rock, smoothstep(h + .002, h - .002, uv.y));
  }
  col += vec3(1., .5, .15) * exp(-length(uv - summit) * 6.) * .35;
  // Sparks lifting from the crater.
  for (int i = 0; i < 12; i++) {
    float fi = float(i), life = fract(t * (.15 + .1 * h21(vec2(fi, 1.))) + h21(vec2(fi, 2.)));
    vec2 p = summit + vec2((h21(vec2(fi, 3.)) - .5) * .06 + life * life * .1 * (.5 + wind), life * .22);
    col += vec3(1., .6, .2) * exp(-length(uv - p) * 700.) * (1. - life) * 2.;
  }
  // The sea, with the glow laid on it.
  if (uv.y < -.04) {
    float d = -.04 - uv.y;
    vec3 sea = dmix(vec3(.01, .01, .02), vec3(.08, .06, .1), vec3(.1, .25, .38), day);
    float rip = noise(vec2(uv.x * 30. + t * .2, uv.y * 300. / (d * 6. + .5) - t)) ;
    sea += vec3(1., .4, .1) * exp(-abs(uv.x - summit.x) * 10.) * smoothstep(.25, .0, d) * rip * .6;
    sea += vec3(1., .4, .1) * exp(-abs(uv.x - summit.x - .15) * 14.) * smoothstep(.2, 0., d) * rip * .25;
    col = sea;
  }
  col = 1. - exp(-col * 1.5);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const volcanoScene = () => build(VOLCANO, byClock({ res: .85 }));

/* Koi Pond: looking down into a garden pond. Koi turn slowly under the surface, their shadows on the stones below, the
   light ripples over the bottom, lily pads and fallen petals drift, and rain rings come with the weather. */
const KOI = `
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, day = uA, wet = uB, asp = uRes.x / uRes.y;
  // Surface slope: a breath of wind and, in wet weather, rain rings.
  vec2 sl = vec2(noise(uv * 6. + t * .3) - .5, noise(uv * 6. + 9. - t * .25) - .5) * .02;
  for (int i = 0; i < 6; i++) {
    float fi = float(i), cyc = t * (.3 + wet) * (.5 + .5 * h21(vec2(fi, 4.))) + fi * .37, age = fract(cyc), id = floor(cyc);
    vec2 c = (vec2(h21(vec2(id, fi)), h21(vec2(fi, id + 2.))) - .5) * vec2(asp, 1.);
    float dd = length(uv - c), r = age * .18;
    sl += normalize(uv - c + 1e-4) * sin((dd - r) * 120.) * exp(-abs(dd - r) * 60.) * (1. - age) * .006 * step(.25, wet);
  }
  vec2 b = uv + sl * 2.;
  // The bottom: stones and sand, dark green, with ripple-light over it.
  float stones = noise(b * 14.), sand = noise(b * 90.);
  vec3 bottom = mix(vec3(.05, .09, .07), vec3(.16, .2, .14), smoothstep(.4, .7, stones)) * (.85 + .3 * sand);
  float ca = pow(abs(sin(noise(b * 6. + t * .15) * 6.28 + noise(b * 10. - t * .1) * 5.)), 12.);
  bottom += vec3(.4, .5, .35) * ca * .25 * (.3 + .7 * day);
  vec3 col = bottom * mix(vec3(.45, .55, .7), vec3(1.), day);
  // Koi, with their shadows a little offset on the bottom.
  for (int i = 0; i < 6; i++) {
    float fi = float(i), sp = .03 + .02 * h21(vec2(fi, 7.)), ph = fi * 2.1;
    vec2 c = vec2(sin(t * sp + ph) * asp * .38, sin(t * sp * 1.6 + ph * 1.3) * .32);
    vec2 v = vec2(cos(t * sp + ph) * asp * .38, cos(t * sp * 1.6 + ph * 1.3) * .32 * 1.6);
    float ang = atan(v.y, v.x); vec2 r = vec2(cos(-ang) * (b.x - c.x) - sin(-ang) * (b.y - c.y), sin(-ang) * (b.x - c.x) + cos(-ang) * (b.y - c.y));
    vec2 rs = r - vec2(.012, -.018);
    vec4 sh = fish(rs, vec2(0.), .065, 1., t, ph, vec3(0.), vec3(0.), 0.);
    col = mix(col, col * .45, sh.a * .6);
    vec3 skin = mod(fi, 3.) == 0. ? vec3(.95, .93, .88) : mod(fi, 3.) == 1. ? vec3(1., .5, .12) : vec3(.95, .85, .7);
    vec4 f = fish(r, vec2(0.), .065, 1., t, ph, skin, skin * .85, mod(fi, 3.) == 1. ? 0. : 1.);
    col = mix(col, f.rgb * mix(vec3(.5, .55, .7), vec3(1.), day), f.a * .92);
  }
  // Depth and the sky on the surface.
  vec3 skyC = dmix(vec3(.03, .05, .1), vec3(.5, .35, .4), vec3(.65, .78, .88), day);
  float fres = .1 + .4 * smoothstep(.0, .02, length(sl));
  col = mix(col, skyC, fres * .35);
  col += vec3(1.) * pow(max(0., dot(normalize(vec3(sl * 40., 1.)), normalize(vec3(.4, .5, .8)))), 60.) * .4;
  // Lily pads and petals floating on top.
  for (int i = 0; i < 7; i++) {
    float fi = float(i); vec2 c = (vec2(h21(vec2(fi, 11.)), h21(vec2(fi, 13.))) - .5) * vec2(asp * .9, .9) + .02 * vec2(sin(t * .05 + fi), cos(t * .04 + fi));
    vec2 d = uv - c; float rr = .06 + .04 * h21(vec2(fi, 15.)), an = atan(d.y, d.x) + fi;
    float pad = smoothstep(rr, rr - .004, length(d)) * (1. - step(abs(mod(an, 6.283) - 1.), .22));
    vec3 pc = mix(vec3(.08, .25, .1), vec3(.25, .45, .18), noise(d * 30.)) * (.55 + .45 * day) * (.8 + .3 * smoothstep(-rr, rr, d.y));
    col = mix(col, col * .6, smoothstep(rr + .02, rr, length(d + vec2(.01, .012))) * (1. - pad));   // the pad's shadow
    col = mix(col, pc, pad);
  }
  for (int i = 0; i < 16; i++) {
    float fi = float(i); vec2 c = (vec2(fract(h21(vec2(fi, 17.)) + t * .004 * (h21(vec2(fi, 19.)) - .5)), h21(vec2(fi, 21.))) - .5) * vec2(asp, 1.);
    float p = smoothstep(.009, .006, length((uv - c) * vec2(1., 1.6)));
    col = mix(col, vec3(1., .78, .82) * (.4 + .6 * day), p * (SEASON == 0. ? 1. : SEASON == 2. ? .0 : .25));
    col = mix(col, vec3(.85, .45, .1) * (.4 + .6 * day), p * (SEASON == 2. ? 1. : 0.));   // autumn: maple leaves instead
  }
  col *= 1. - .3 * smoothstep(.5, 1.2, length(uv));
  col = 1. - exp(-col * 1.6);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const koiScene = () => build(withSeason(KOI), byClock({ res: .85 }));

/* Zen Garden: raked gravel from above. Rings around the stones and straight lines elsewhere, lit low across the ridges
   so the pattern stands out, moss around the stones, their shadows, and a slow sweep of the rake re-drawing the lines. */
const ZEN = `
vec3 stone(int i){ return i == 0 ? vec3(-.32, .12, .1) : i == 1 ? vec3(.28, -.08, .075) : vec3(.42, .22, .05); }
float field(vec2 p, float t){
  float dmin = 9.; for (int i = 0; i < 3; i++) { vec3 s = stone(i); dmin = min(dmin, length((p - s.xy) * vec2(1., 1.25)) - s.z); }
  float rings = dmin * 150., lines = (p.y + .01 * sin(p.x * 3.)) * 150.;
  float k = smoothstep(.07, .14, dmin);
  float ph = mix(rings, lines, k);
  float raked = smoothstep(.0, .06, abs(p.x - (mod(t * .006, 2.4) - 1.2)) - .02);   // the rake passing
  return (.5 + .5 * sin(ph)) * (.4 + .6 * raked);
}
void main(){
  vec2 uv = fit(1.15); float t = uT, day = uA;
  vec2 L = normalize(vec2(-.7, .5));
  float e = .002, h0 = field(uv, t), hx = field(uv + vec2(e, 0.), t), hy = field(uv + vec2(0., e), t);
  vec2 g = vec2(hx - h0, hy - h0) / e;
  float shade = .8 + .2 * clamp(dot(-g, L) * .008, -1., 1.);
  vec3 gravel = mix(vec3(.72, .69, .62), vec3(.86, .83, .76), noise(uv * 220.)) * shade * (.9 + .1 * noise(uv * 40.));
  vec3 col = gravel;
  // The season on the gravel: cherry petals in spring, maple leaves in autumn, a dusting of snow in winter.
  if (SEASON == 3.) col = mix(col, vec3(.93, .95, .98), .4 + .08 * noise(uv * 12.));
  if (SEASON == 0. || SEASON == 2.) {
    for (int i = 0; i < 26; i++) {
      float fi = float(i); vec2 c = (vec2(h21(vec2(fi, 41.)), h21(vec2(fi, 43.))) - .5) * vec2(2.2, 1.1);
      float a = h21(vec2(fi, 47.)) * 6.28; vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * (uv - c);
      float sz = SEASON == 0. ? .009 : .016;
      float leaf = SEASON == 0. ? smoothstep(1., .8, length(q / vec2(sz, sz * .65)))
                                : smoothstep(1., .8, length(q / vec2(sz, sz * .55)) + .25 * abs(sin(atan(q.y, q.x) * 2.5)));
      vec3 lc = SEASON == 0. ? mix(vec3(1., .86, .9), vec3(.96, .62, .74), h21(vec2(fi, 49.))) : mix(vec3(.85, .22, .08), vec3(.95, .6, .12), h21(vec2(fi, 49.)));
      col = mix(col, col * .7, smoothstep(1.2, .8, length((q + vec2(.003, -.003)) / vec2(sz, sz * .7))) * .5);   // its shadow
      col = mix(col, lc, leaf);
    }
  }
  for (int i = 0; i < 3; i++) {
    vec3 s = stone(i); vec2 d = (uv - s.xy) * vec2(1., 1.25);
    float r = length(d) - s.z;
    // A long soft shadow toward the lower right, and a dark line where stone meets gravel.
    col = mix(col, col * .55, smoothstep(.05, 0., length((uv - s.xy + L * s.z * .6) * vec2(1., 1.25)) - s.z * 1.05) * .7);
    col = mix(col, col * .6, smoothstep(.012, 0., r) * step(0., r));
    // The stone: pale granite, lit from the upper left, with a soft sheen and moss in its lower hollows.
    float dome = sqrt(max(0., 1. - pow(length(d) / s.z, 2.)));
    vec3 nrm = normalize(vec3(d / s.z * .9, dome + .15)), Ld = normalize(vec3(L, .7));
    float lam = clamp(dot(nrm, Ld), 0., 1.), spec = pow(max(dot(reflect(-Ld, nrm), vec3(0., 0., 1.)), 0.), 12.);
    vec3 rock = mix(vec3(.42, .41, .39), vec3(.68, .66, .62), noise(uv * 30. + float(i) * 4.)) * (.3 + .85 * lam) + spec * .18;
    rock *= .9 + .1 * noise(uv * 160.);
    float moss = smoothstep(.55, .72, noise(uv * 26. + float(i) * 7.)) * smoothstep(.1, -.4, dot(normalize(d + 1e-4), -L)) * smoothstep(-s.z * .7, -s.z * .15, -length(d) + s.z * .0);
    rock = mix(rock, vec3(.22, .36, .13) * (.7 + .5 * noise(uv * 120.)), moss * .85);
    if (SEASON == 3.) rock = mix(rock, vec3(.9, .92, .96) * (.7 + .3 * lam), .7 * smoothstep(.55, .85, nrm.z) * smoothstep(.0, .5, dot(normalize(d + 1e-4), L)));   // snow on top
    col = mix(col, rock, smoothstep(.003, -.003, r));
  }
  vec3 tint = dmix(vec3(.32, .4, .62), vec3(1., .78, .62), vec3(1., .98, .94), day);
  col *= tint * (.6 + .4 * day);
  col += vec3(.06, .03, 0.) * (1. - abs(day * 2. - 1.));
  col *= 1. - .25 * smoothstep(.5, 1.2, length(uv));
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const zenScene = () => build(withSeason(ZEN), byClock({ res: .9 }));

/* Mars Dust Storm: the plain from a rover's mast. The ground is ray-marched with rocks and drifts, the butterscotch sky
   holds a small pale sun with the blue Martian halo, and a wall of dust comes and goes across the plain. */
const MARS = `
float ground(vec2 p){ return fbm4(p * .12) * 2.2 + .25 * noise(p * 1.1) + .08 * noise(p * 4.); }
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT;
  vec3 ro = vec3(t * .15, 1.6, 0.), rd = normalize(vec3(uv.x, uv.y - .12, 1.));
  vec3 sunD = normalize(vec3(.6, .18, 1.));
  float storm = .5 + .5 * sin(t * .012), wall = 18. + 25. * (1. - storm);
  vec3 sky = mix(vec3(.85, .6, .42), vec3(.55, .38, .3), smoothstep(-.05, .5, rd.y));
  float sd = max(dot(rd, sunD), 0.);
  sky += vec3(.55, .7, .95) * pow(sd, 40.) * .6 + vec3(1., .97, .9) * pow(sd, 1200.) * 1.2;
  vec3 col = sky; float dist = 60.;
  float tt = .5; bool hit = false;
  for (int i = 0; i < ${'${STEPS}'}; i++) {
    vec3 p = ro + rd * tt; float h = ground(p.xz);
    if (p.y < h) { hit = true; dist = tt; break; }
    tt += max(.08, (p.y - h) * .5) * (1. + tt * .02);
    if (tt > 60.) break;
  }
  if (hit) {
    vec3 p = ro + rd * dist; float e = .05;
    vec3 n = normalize(vec3(ground(p.xz - vec2(e, 0.)) - ground(p.xz + vec2(e, 0.)), 2. * e, ground(p.xz - vec2(0., e)) - ground(p.xz + vec2(0., e))));
    float lam = max(dot(n, sunD), 0.);
    vec3 dirt = mix(vec3(.45, .2, .1), vec3(.72, .42, .26), noise(p.xz * 3.)) * (.75 + .25 * noise(p.xz * 20.));
    dirt = mix(dirt, vec3(.25, .12, .08), smoothstep(.55, .7, noise(p.xz * 2.5)) * .6);   // dark rocks
    col = dirt * (.25 + .9 * lam);
  }
  // Dust: thicker beyond the storm's front, rolling.
  float fog = 1. - exp(-dist * .02);
  float front = smoothstep(wall - 6., wall + 4., dist) * (.55 + .45 * fbm4(vec2(rd.x * 6. + t * .02, rd.y * 10.)));
  vec3 dust = vec3(.78, .55, .38) * (.8 + .3 * fbm3o(uv * 4. + t * .03));
  col = mix(col, dust, clamp(fog + front * storm, 0., 1.));
  col = mix(col, dust, smoothstep(.1, -.15, rd.y - .02) * 0.);
  col *= 1. - .25 * smoothstep(.5, 1.2, length(uv));
  col = 1. - exp(-col * 1.5);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const marsScene = () => build(MARS.replace('${STEPS}', String(lowPower ? 60 : 90)), { res: .7, heavy: true });

/* Comet Pass: a comet crossing the stars over twenty minutes. A bright nucleus in its coma, a broad curved dust tail
   and a straight blue ion tail streaming away from the sun, below the Milky Way. */
const COMET = `
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, asp = uRes.x / uRes.y;
  vec3 col = vec3(.005, .008, .02);
  vec2 mw = vec2(.6, -.8); float band = exp(-pow(dot(uv, normalize(mw)) * 2.6, 2.));
  col += vec3(.25, .22, .3) * band * fbm4(uv * 3. + 2.) * .5;
  col += stars(uv * 120., t, 0.) * vec3(.9, .92, 1.) + stars(uv * 260. + 3., t * 1.3, 0.) * .5;
  float k = uA;
  vec2 c = mix(vec2(-asp * .4, -.32), vec2(asp * .4, -.05), k);
  vec2 away = normalize(vec2(.35, .95)), perp = vec2(-away.y, away.x);
  vec2 d = uv - c; float a = dot(d, away), b = dot(d, perp);
  // Dust tail: broad, curving, yellow-white, striated.
  float bc = b - a * a * .5, w = .008 + a * .1;
  float dustT = exp(-bc * bc / (w * w)) * exp(-a * 2.6) * step(0., a) * (.6 + .4 * fbm3o(vec2(a * 6. - t * .02, bc * 30.)));
  col += vec3(1., .9, .7) * dustT * .7;
  // Ion tail: narrow, straight, blue, with knots drifting out.
  float bi = dot(d, vec2(-normalize(away + vec2(-.15, .02)).y, normalize(away + vec2(-.15, .02)).x)), wi = .003 + a * .02;
  float ion = exp(-bi * bi / (wi * wi)) * exp(-a * 1.2) * step(0., a) * (.6 + .5 * noise(vec2(a * 20. - t * .3, 1.)));
  col += vec3(.4, .65, 1.) * ion * .8;
  // Coma and nucleus.
  col += vec3(.75, .95, .9) * exp(-length(d) * 40.) * .9 + vec3(1.) * exp(-length(d) * 600.) * 2.;
  col = 1. - exp(-col * 1.5);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const cometScene = () => build(COMET, { res: .9, before(t, dt, gl, u) { gl.uniform1f(u.uA, (Date.now() / 1000 % 1200) / 1200); } });

// Aurora curtains, as in the Aurora scene, for the polar night.
const AUR = `
vec3 aurora(vec3 rd, float t){
  vec3 col = vec3(0.); float flow = t * (.012 + .01 * uMid);
  for (int i = 0; i < 16; i++) {
    float fi = float(i), h = 1.1 + fi * .12, d = h / max(rd.y, .02);
    if (d > 70.) break;
    vec2 q = rd.xz * d, p = vec2(q.x * .45 + flow, q.y * .07 + flow * .3);
    float band = fbm3o(p * vec2(.5, 1.) + vec2(0., fbm3o(p * .35 + 5.) * 1.6));
    float rib = smoothstep(.38, .48, band) * smoothstep(.66, .54, band) * (.55 + .45 * noise(vec2(q.x * 1.8 + flow * 6., fi * .07)));
    float patch = smoothstep(.1, .6, noise(vec2(rd.x / rd.z * 2.5 + t * .008, 2. + fi * .02)));
    float k = fi / 15.;
    vec3 c = mix(vec3(.15, 1., .45), vec3(.7, .3, .95), smoothstep(.2, 1., k));
    col += c * rib * patch * exp(-k * 2.) * (1. - smoothstep(30., 70., d)) * .15;
  }
  return col;
}`;

/* Polar Night: a fjord in the north in midwinter. A deep blue noon twilight on the horizon, snowy mountains on both
   sides, the aurora overhead and in the still water, and a few cabin lights along the shore. */
const POLAR = AUR + `
float mtn(float x, float s){ return .5 * abs(sin(x * 1.4 + s)) + .35 * noise(vec2(x * 3., s)) + .15 * noise(vec2(x * 11., s)); }
vec3 scene(vec2 uv, float t, bool refl){
  vec3 rd = normalize(vec3(uv.x, uv.y + .1, 1.));
  vec3 col = mix(vec3(.08, .14, .3), vec3(.01, .02, .06), smoothstep(-.05, .45, uv.y));
  col += vec3(.2, .3, .55) * exp(-abs(uv.y + .02) * 10.) * .5 * (.6 + .4 * uA);
  col += stars(uv * 150., t, 0.) * vec3(.9, .95, 1.) * (refl ? .4 : 1.);
  col += aurora(rd, t) * (1. + .3 * uBass);
  float asp = aspW(1.15);
  float leftM = -.06 + .3 * smoothstep(-.1, -asp * .5, uv.x) * mtn(uv.x * 2., 1.) * .9;
  float rightM = -.06 + .28 * smoothstep(.15, asp * .5, uv.x) * mtn(uv.x * 2.3, 4.) * .9;
  float farM = -.04 + .06 * mtn(uv.x * 3., 7.);
  float m = max(max(leftM, rightM), farM);
  vec3 snow = vec3(.25, .32, .45) + aurora(normalize(vec3(uv.x, .3, 1.)), t) * .25;
  snow *= .6 + .4 * noise(uv * vec2(10., 30.)) + .2 * step(.55, noise(uv * vec2(6., 40.)));
  col = mix(col, snow * (1. - .4 * step(m, farM + .0001)), smoothstep(m + .002, m - .002, uv.y) * step(-.06, uv.y));
  return col;
}
void main(){
  vec2 uv = fitLow(1.15, .15); float t = uT, shore = -.06;
  vec3 col;
  if (uv.y > shore) col = scene(uv, t, false);
  else {
    float d = shore - uv.y, rip = sin(uv.y * 160. + t * .5 + sin(uv.x * 20.)) * .002 * (1. + d * 4.);
    col = scene(vec2(uv.x + rip, 2. * shore - uv.y + rip), t, true) * .7 + vec3(.0, .01, .02);
  }
  for (int i = 0; i < 6; i++) {   // cabin lights on the shore and their streaks in the water
    float fi = float(i), x = -.5 + fi * .19 + .05 * sin(fi * 3.);
    vec2 p = vec2(x, shore + .006);
    col += vec3(1., .75, .4) * exp(-length(uv - p) * 500.) * 1.4;
    col += vec3(1., .7, .35) * exp(-abs(uv.x - x) * 300.) * smoothstep(shore, shore - .12, uv.y) * step(uv.y, shore) * (.3 + .3 * noise(vec2(uv.x * 100., uv.y * 200. - t)));
  }
  // Snow in wet weather: three depths of flakes drifting down, and the aurora fading behind the cloud.
  float wet = wetness();
  if (wet > 0.) {
    col = mix(col, vec3(.04, .05, .08), wet * .35 * smoothstep(-.1, .3, uv.y));
    col += vec3(.75, .8, .9) * (flakes(uv, t, 9., .5, .5) * .5 + flakes(uv + 3., t, 16., .7, .45) * .35 + flakes(uv + 7., t, 28., .9, .4) * .2) * wet;
  }
  col = 1. - exp(-col * 1.6);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const polarNightScene = () => build(POLAR, byClock({ res: .75 }));

/* Midnight Sun: a fishing village in the far north at midnight in summer. The sun hangs just above the sea, gold on the
   water, jagged peaks behind, and red cabins on stilts with fish racks along the shore. */
const MIDNIGHT = `
void main(){
  vec2 uv = fitLow(1.15, .7); float t = uT, asp = aspW(1.15), hz = -.02;
  vec2 sun = vec2(asp * .2, .03 + .01 * sin(t * .01));
  vec3 col = mix(vec3(1., .72, .45), vec3(.42, .5, .72), smoothstep(-.02, .5, uv.y));
  col += vec3(1., .6, .3) * exp(-length(uv - sun) * 3.) * .5 + vec3(1., .95, .8) * smoothstep(.05, .046, length(uv - sun));
  float clouds = smoothstep(.55, .75, fbm3o(vec2(uv.x * 1.5 + t * .004, uv.y * 6.))) * smoothstep(.08, .25, uv.y);
  col = mix(col, vec3(1., .7, .55), clouds * .5);
  // Jagged peaks across the water.
  float pk = hz + .02 + .2 * pow(abs(sin(uv.x * 2.4 + 1.)), 3.) * smoothstep(asp * .1, -asp * .5, uv.x) + .05 * noise(vec2(uv.x * 9., 3.)) + .03 * abs(sin(uv.x * 17.));
  col = mix(col, mix(vec3(.3, .25, .35), col, .45), smoothstep(pk + .002, pk - .002, uv.y) * step(hz, uv.y));
  // The sea and the sun's path on it.
  if (uv.y < hz) {
    float d = hz - uv.y;
    vec3 sea = mix(vec3(.55, .45, .5), vec3(.12, .15, .26), smoothstep(0., .4, d));
    float glit = pow(noise(vec2(uv.x * 80. / (d * 8. + .3), uv.y * 400. - t * 1.5)), 6.) * exp(-abs(uv.x - sun.x) * (6. / (d * 6. + .2)));
    sea += vec3(1., .8, .5) * glit * 2. + vec3(1., .6, .3) * exp(-abs(uv.x - sun.x) * 12.) * smoothstep(.3, 0., d) * .25;
    col = sea;
  }
  // The shore, the cabins on stilts, the fish racks.
  float shore = -.24 + .02 * noise(vec2(uv.x * 5., 1.));
  for (int i = 0; i < 4; i++) {
    float fi = float(i), x = -asp * .48 + fi * .17, w = .065, h = .06, base = shore + .05;
    vec2 q = uv - vec2(x, base);
    float body = step(0., q.x) * step(q.x, w) * step(0., q.y) * step(q.y, h);
    float roof = step(h, q.y) * step(q.y, h + .035 - abs(q.x - w * .5) * .9) * step(-.008, q.x) * step(q.x, w + .008);
    float stilt = step(abs(fract((q.x) / w * 3.) - .5), .08) * step(-.05, q.y) * step(q.y, 0.) * step(0., q.x) * step(q.x, w);
    float win = step(abs(q.x - w * .5), .008) * step(abs(q.y - h * .55), .01);
    col = mix(col, vec3(.55, .1, .07) * (.8 + .2 * step(.5, fract(q.x * 120.))), body);
    col = mix(col, vec3(.15, .12, .12), max(roof, stilt));
    col = mix(col, vec3(1., .85, .6), win * body);
    // Its reflection in the water below the stilts.
    vec2 rq = vec2(q.x, -q.y - .1);
    col = mix(col, vec3(.4, .1, .08), step(0., rq.x) * step(rq.x, w) * step(0., rq.y) * step(rq.y, h) * .35 * step(uv.y, base - .05));
  }
  for (int i = 0; i < 2; i++) {   // fish racks, wooden A-frames with rails
    float x0 = asp * .05 + float(i) * .22, base = shore + .015;
    vec2 q = uv - vec2(x0, base);
    float r = min(min(seg(q, vec2(0.), vec2(.02, .07)), seg(q, vec2(.04, 0.), vec2(.02, .07))), min(seg(q, vec2(.14, 0.), vec2(.16, .07)), seg(q, vec2(.18, 0.), vec2(.16, .07))));
    r = min(r, seg(q, vec2(.02, .065), vec2(.16, .065)));
    col = mix(col, vec3(.18, .12, .08), smoothstep(px() * 1.5, 0., r));
    col = mix(col, vec3(.6, .5, .35), step(abs(q.y - .045), .012) * step(.025, q.x) * step(q.x, .155) * step(.5, fract(q.x * 70.)) * .8);
  }
  col = mix(col, vec3(.12, .1, .08) * (.8 + .3 * noise(uv * 40.)), smoothstep(shore + .002, shore - .002, uv.y));
  // Drizzle in wet weather: a grey veil over the sun and fine streaks of rain.
  float wet = wetness();
  if (wet > 0.) {
    col = mix(col, vec3(.45, .45, .5) * (.6 + .4 * smoothstep(-.3, .4, uv.y)), wet * .45);
    col += vec3(.7, .7, .75) * (streaks(uv, t, 70., .25) * .22 + streaks(uv + 1.7, t * 1.3, 120., .2) * .14) * wet;
  }
  col = 1. - exp(-col * 1.4);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const midnightSunScene = () => build(MIDNIGHT, byClock({ res: .85 }));

/* Train by Day: the carriage window on a bright morning. Low hills, a lake, birch woods and fields slide past at their
   own speeds, the poles flick by, and summer clouds drift overhead. Follows the season. */
const DAYTRAIN = `
// One row of birches sliding past at speed sp: rounded ragged crowns on white trunks, in groves with open field between.
// Returns the colour over the background and its coverage.
vec4 trees(vec2 v, float t, float sp, float sc, float y0, float sz, vec3 leaves, float seed){
  vec3 o = vec3(0.); float a = 0.;
  float X = (v.x + t * sp) * sc;
  for (int i = -1; i <= 1; i++) {
    float c = floor(X) + float(i), h = h21(vec2(c, seed));
    float grove = smoothstep(.3, .55, noise(vec2(c * .13, seed)));
    float here = step(h, .15 + .8 * grove);
    float cx = (c + .5 + (h21(vec2(c, seed + 1.)) - .5) * .6) / sc - t * sp;
    float hh = sz * (.75 + .5 * h21(vec2(c, seed + 2.)));
    vec2 cc = vec2(cx, y0 + hh * .85), d = (v - cc) / (hh * .62);
    float ang = atan(d.y, d.x), rr = 1. + .22 * noise(vec2(ang * 2.5 + c, seed)) + .14 * noise(d * 5. + c);
    float crown = smoothstep(rr, rr - .1, length(d * vec2(1.25, .85))) * here;   // birch crowns: taller than wide
    float trunk = step(abs(v.x - cx), sz * .045) * step(y0, v.y) * step(v.y, cc.y) * here;
    vec3 tc = mix(vec3(.93, .91, .87), vec3(.12), step(.7, noise(vec2(c * 7., v.y * 90.))));
    vec3 lc = leaves * (.7 + .5 * smoothstep(-1., 1., d.y - d.x * .4)) * (.85 + .3 * noise(d * 7. + c));
    o = mix(o, tc, trunk); a = max(a, trunk);
    o = mix(o, lc, crown); a = max(a, crown);
  }
  return vec4(o, a);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT;
  float sway = sin(t * 1.6) * .002; vec2 v = uv - vec2(0., sway);
  vec3 col = mix(vec3(.75, .85, .92), vec3(.3, .55, .88), smoothstep(-.05, .45, v.y));
  float cl = smoothstep(.5, .72, fbm4(vec2(v.x * 1.4 + t * .01, v.y * 4.))) * smoothstep(.0, .2, v.y);
  col = mix(col, vec3(1.), cl * .85);
  vec3 grass = SEASON == 3. ? vec3(.88, .9, .94) : SEASON == 2. ? vec3(.62, .5, .22) : SEASON == 0. ? vec3(.45, .65, .25) : vec3(.35, .55, .18);
  vec3 leaves = SEASON == 3. ? vec3(.45, .42, .4) : SEASON == 2. ? vec3(.85, .6, .15) : SEASON == 0. ? vec3(.6, .78, .35) : vec3(.3, .5, .2);
  float hill = -.02 + .06 * fbm3o(vec2((v.x + t * .01) * 2., 1.));
  vec3 farG = SEASON == 3. ? vec3(.8, .84, .9) : vec3(.32, .5, .3);
  col = mix(col, mix(farG, col, .45), smoothstep(hill + .002, hill - .002, v.y));
  // The land between the hills and the track: meadow with patches, hazier toward the hills.
  float land = hill - .012;
  vec3 ground = mix(grass * .85, grass * 1.08, smoothstep(.35, .65, noise(vec2((v.x + t * .07) * 3., v.y * 14.)))) * (.9 + .2 * noise(vec2((v.x + t * .1) * 40., v.y * 60.)));
  ground = mix(ground, mix(farG, col, .35), smoothstep(-.12, land, v.y) * .6);
  col = mix(col, ground, smoothstep(land + .003, land - .003, v.y));
  float lake = -.06; float lk = step(v.y, hill - .005) * step(lake - .03, v.y) * step(.45, noise(vec2((v.x + t * .03) * 1.2, 4.)));
  col = mix(col, mix(vec3(.4, .6, .8), vec3(.85, .9, .95), noise(vec2((v.x + t * .03) * 30., v.y * 200.)) * .4), lk * step(v.y, lake + .02));
  // Birch woods in two rows: far ones slow and hazy, near ones quick.
  vec4 far = trees(v, t, .05, 22., -.04, .05, mix(leaves, vec3(.6, .7, .8), .25), 3.);
  col = mix(col, far.rgb, far.a);
  vec4 near = trees(v, t, .13, 7., -.2, .13, leaves, 11.);
  col = mix(col, near.rgb, near.a);
  // Fields close by, rushing past with their furrows.
  float fy = -.2;
  if (v.y < fy) { float fx = v.x + t * .5; vec3 fc = mix(grass * .85, grass * 1.05, smoothstep(.3, .7, noise(vec2(fx * .8, v.y * 3.)))) * (.8 + .3 * noise(vec2(fx * 40., v.y * 20.))); col = fc; }
  // Poles and wires.
  float pf = fract((v.x + t * .9) * 1.6);
  col = mix(col, vec3(.2, .16, .12), step(abs(pf - .5), .01) * step(-.25, v.y) * step(v.y, .2));
  col = mix(col, vec3(.15), smoothstep(.0025, .001, abs(v.y - (.17 - .03 * (1. - cos(pf * 6.283)) * .5))) * .6);
  // Wet weather: an overcast sky, and drops on the glass blown back along it by the train's speed.
  float wet = wetness();
  if (wet > 0.) {
    col = mix(col, vec3(.55, .58, .62) * (.7 + .3 * smoothstep(-.3, .4, v.y)), wet * .4);
    for (int i = 0; i < 2; i++) {
      float sc = 14. + float(i) * 11.;
      vec2 g = vec2(uv.x * sc * .35 + t * (1.2 + float(i) * .5), uv.y * sc), c = floor(g), f = fract(g) - .5;
      float h = h21(c + float(i) * 7.), on = step(1. - (.18 + .22 * wet), h), r = .08 + .1 * h21(c + 3.3);
      f -= (vec2(h21(c + 1.1), h21(c + 5.7)) - .5) * .5;                               // each drop somewhere in its cell
      float trail = smoothstep(r * .5, 0., abs(f.y + .04 * f.x)) * smoothstep(-.5, 0., f.x) * step(f.x, 0.);   // a streak behind it
      float bead = smoothstep(r, r * .6, length(f * vec2(.8, 1.)));
      col = mix(col, col * .7 + vec3(.12, .13, .15), (bead * .8 + trail * .3) * on * wet);
      col += vec3(.9) * smoothstep(r * .45, 0., length(f - vec2(r * .3, r * .3))) * on * wet * .4;
    }
  }
  // The frame.
  float x01 = uv.x * uRes.y / uRes.x + .5;
  float frame = step(.38, uv.y) + step(uv.y, -.33) + step(.95, x01) + step(x01, .03);
  col = mix(col, vec3(.32, .28, .26), clamp(frame, 0., 1.));
  col = mix(col, vec3(.6, .55, .5), smoothstep(.004, 0., abs(uv.y + .33)) * .8);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const dayTrainScene = () => build(withSeason(DAYTRAIN), byClock({ res: .85 }));

/* Rain on a Tent: inside a small tent at night, a lantern glowing. Rain beads on the fly and runs down the sloping
   panels, the fabric breathes with the wind, and the light flickers softly. Heavier with the weather. */
const TENT = `
// The fabric's drop shadows: soft round marks of the drops sitting on the fly, some sliding down the slope (dir).
float drops(vec2 p, float t, float s, float dens, vec2 dir){
  vec2 g = p * s, c = floor(g), f = fract(g) - .5;
  float h = h21(c), on = step(1. - dens, h), slide = step(.8, h);
  vec2 o = (vec2(h21(c + 1.7), h21(c + 3.1)) - .5) * .5 + dir * slide * (fract(t * (.05 + .1 * h21(c + 5.))) - .5) * .9;
  float r = .1 + .1 * h21(c + 9.);
  float m = smoothstep(r, r * .25, length(f - o));
  float trail = slide * smoothstep(.06, .0, abs(dot(f - o, vec2(-dir.y, dir.x)))) * smoothstep(.0, -.4, dot(f - o, dir)) * smoothstep(-.6, -.1, dot(f - o, dir)) * .5;
  return max(m, trail) * on;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, wet = uB, asp = uRes.x / uRes.y;
  float flick = .93 + .04 * sin(t * 7.) + .03 * sin(t * 13.1);
  vec2 lamp = vec2(.02 * sin(t * .6), .14 + .005 * sin(t * .9));          // the lantern sways a little on its cord
  float floorY = -.42, apex = .52;
  float halfW = .62 * (apex - uv.y) / (apex - floorY);                     // the end wall narrows to the ridge
  bool wall = abs(uv.x) < halfW;
  // Light from the lantern, falling off with distance, a little brighter on the end wall it faces.
  float Ld = length((uv - lamp) * vec2(1., 1.2));
  float light = flick * (1.15 / (1. + 7. * Ld * Ld)) + .04;
  vec3 fabric = vec3(.86, .5, .2);
  vec3 col;
  if (wall) {
    col = fabric * light * 1.08;
    float weave = .94 + .06 * step(.5, fract(uv.x * 260.)) * step(.5, fract(uv.y * 260.));
    col *= weave;
    // The door: a zip in an arch, and a mesh window at its top.
    float dx = abs(uv.x), arch = uv.y > .02 ? length(vec2(uv.x, (uv.y - .02) * 1.1)) - .2 : dx - .2;
    float zip = smoothstep(.006, .0, abs(arch)) * step(uv.y, .24) * (.6 + .4 * step(.5, fract((uv.y + dx) * 90.)));
    col = mix(col, col * .45, zip);
    float mesh = step(arch, -.02) * step(.06, uv.y);
    col = mix(col, col * (.35 + .25 * step(.5, fract(uv.x * 120.)) * step(.5, fract(uv.y * 120.))), mesh * .8);
    col = mix(col, col * .7, drops(uv + vec2(0., .3), t, 16., .2 + .35 * wet, vec2(0., -1.)) * (1. - mesh) * .6);
  } else {
    // The side panels slope away; drops slide down and outward along them.
    float side = sign(uv.x), slopeK = smoothstep(halfW, halfW + .6, abs(uv.x));
    col = fabric * light * (.75 - .2 * slopeK);
    col *= .96 + .04 * sin(uv.x * 9. - uv.y * 4. + t * (.6 + wet)) * (1. + wet);   // the fabric breathing in the wind
    col = mix(col, col * .62, drops(vec2(uv.x * .9, uv.y + abs(uv.x) * .4), t, 13., .25 + .4 * wet, normalize(vec2(side * .7, -1.))) * .75);
  }
  // Seams: the ridge corners and a band where wall meets panel.
  col = mix(col, col * .55, smoothstep(.006, .0, abs(abs(uv.x) - halfW)) * step(floorY, uv.y));
  // The groundsheet and a sleeping bag in the corner.
  if (uv.y < floorY) col = vec3(.1, .12, .1) * (.5 + 1.4 * light) * (.85 + .15 * noise(uv * 50.));
  vec2 bq = (uv - vec2(-asp * .32, -.47)) / vec2(.42, .14);
  float bag = smoothstep(1., .96, length(bq)) * step(-.47, uv.y - .0);
  vec3 bagC = mix(vec3(.12, .2, .32), vec3(.2, .3, .45), smoothstep(-.6, .8, bq.y)) * (.5 + 1.2 * light) * (.85 + .15 * step(.5, fract(bq.x * 6.)));
  col = mix(col, bagC, smoothstep(1., .97, length(bq)));
  // The lantern: a cord up to the ridge, a cap, and the glowing glass.
  col = mix(col, vec3(.05), smoothstep(.003, .0, abs(uv.x - lamp.x * (uv.y - apex) / (lamp.y - apex))) * step(lamp.y + .05, uv.y) * step(uv.y, apex));
  vec2 lq = uv - lamp;
  col = mix(col, vec3(.08, .07, .06), step(abs(lq.x), .028) * step(abs(lq.y - .05), .012));
  float glass = smoothstep(.032, .028, length(lq * vec2(1., .75)));
  col = mix(col, vec3(1., .82, .5) * (1.4 + .3 * flick), glass);
  col += vec3(1., .7, .35) * exp(-length(lq) * 22.) * .7 * flick;
  col *= 1. - .35 * smoothstep(.45, 1.1, length(uv * vec2(.8, 1.)));
  col = 1. - exp(-col * 1.5);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const tentScene = () => build(TENT, byClock({ res: .85 }));

/* Kelp Forest: down among the kelp. Tall stalks with their blades sway in the swell, light comes down in shafts, marine
   snow drifts, and fish pass in the blue beyond. Moves with the music's middle. */
const KELP = `
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, asp = uRes.x / uRes.y;
  vec3 col = mix(vec3(.0, .05, .09), vec3(.05, .35, .45), smoothstep(-.6, .55, uv.y));
  float sh = pow(noise(vec2(uv.x * 2. + uv.y * .7 + t * .03, 2.)), 3.) * smoothstep(-.4, .6, uv.y);
  col += vec3(.3, .7, .65) * sh * .4;
  float sway = 1. + .5 * uMid;
  for (int i = 0; i < 16; i++) {
    float fi = float(i), depth = h21(vec2(fi, 3.)), x0 = (h21(vec2(fi, 1.)) - .5) * asp * 1.1;
    float y = uv.y + .55, k = clamp(y / 1.3, 0., 1.);
    float x = x0 + (sin(t * .4 + fi + y * 2.) * .05 + sin(t * .17 + fi * 2.) * .04) * k * sway;
    float stalk = smoothstep(.006, .003, abs(uv.x - x)) * step(0., y);
    // Long ribbon blades, alternating sides, angled up from the stalk and fluttering in the swell; each pixel checks
    // the blade of its own segment and the one below, since blades reach up past the next node.
    float blade = 0.;
    for (int jj = 0; jj < 2; jj++) {
      float sy = y * 5. + fi * .37, j = floor(sy) - float(jj);
      float valid = step(1., j) * step(j, 6.);
      vec2 b = vec2(x, (j - fi * .37) / 5. - .55);
      float side = mod(j, 2.) * 2. - 1., fl = .3 * sin(t * .7 + j * 1.7 + fi) * sway;
      vec2 dir = normalize(vec2(side * (.55 + fl), 1.)), perp = vec2(-dir.y, dir.x);
      float along = dot(uv - b, dir), across = dot(uv - b, perp), len = .17 + .07 * h21(vec2(fi, j));
      float w = .017 * sin(3.1416 * clamp(along / len, 0., 1.)) * (1. + .3 * sin(along * 70. + t * 2.));
      blade = max(blade, valid * step(0., along) * step(along, len) * smoothstep(w, w * .5, abs(across + .012 * sin(along * 18. + t))));
    }
    float lit = smoothstep(-.4, .6, uv.y) * (.6 + .6 * sh);
    vec3 kc = mix(vec3(.16, .14, .04), vec3(.62, .5, .14), lit) * (.85 + .3 * noise(vec2(y * 30., fi))) * (.35 + .65 * k);
    kc = mix(kc, col, depth * .6);                                         // the far ones fade into the blue
    col = mix(col, kc, max(stalk, blade * .92));
  }
  for (int i = 0; i < 5; i++) {   // fish far off
    float fi = float(i), sp = .03 + .02 * h21(vec2(fi, 8.)), span = asp + .4;
    vec2 c = vec2(mod(t * sp + h21(vec2(fi, 9.)) * span, span) - span * .5, -.1 + .4 * h21(vec2(fi, 10.)));
    vec4 f = fish(uv, c, .02, 1., t, fi, vec3(.1, .2, .25), vec3(.15, .3, .35), 0.);
    col = mix(col, f.rgb, f.a * .6);
  }
  vec2 g = uv * 30. + vec2(0., t * .3), c = floor(g), f = fract(g) - .5;   // marine snow
  col += vec3(.7, .85, .85) * smoothstep(.06, 0., length(f - (vec2(h21(c), h21(c + 4.)) - .5) * .7)) * step(.85, h21(c + 9.)) * .5;
  float floorY = -.5 + .04 * noise(vec2(uv.x * 4., 1.));
  if (uv.y < floorY) col = mix(vec3(.04, .1, .1), vec3(.12, .2, .18), noise(uv * 20.));
  col *= 1. - .35 * smoothstep(.5, 1.2, length(uv));
  col = 1. - exp(-col * 1.5);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const kelpScene = () => build(KELP, { res: .85 });
