// Shader scenes, fourth set: a mountain hut in the snow, a hot spring at night, the desert at noon, a bus shelter in the
// rain and an observatory under the turning sky. Outdoor ones follow the clock (uA), the weather (uB) and the season.
import { shaderScene } from './trip.js';
import { daylight } from '../daylight.js';
import { weather } from '../weather.js';
import { season } from '../season.js';
import { moonPhase, MOON_GLSL } from '../moon.js';

const H = `
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
float dither(float t){ return (h21(gl_FragCoord.xy + fract(t)) - .5) / 160.; }
float px(){ return 1.5 / uRes.y; }
float aspW(float w){ return max(uRes.x / uRes.y, w); }
vec2 fit(float w){ vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; return uv * aspW(w) / (uRes.x / uRes.y); }
float wetness(){ return clamp((uB - .45) / .55, 0., 1.); }
float flakes(vec2 uv, float t, float s, float sp, float dens){
  vec2 g = uv * s + vec2(sin(t * .3 + uv.y * 3.) * .25, t * sp), c = floor(g), f = fract(g) - .5;
  vec2 o = (vec2(h21(c + 1.3), h21(c + 2.9)) - .5) * .6;
  return smoothstep(.1, .03, length(f - o)) * step(1. - dens, h21(c));
}
float streaks(vec2 uv, float t, float s, float dens){
  vec2 g = vec2((uv.x + uv.y * .12) * s, uv.y * s * .07 + t * 1.6), c = floor(g), f = fract(g);
  return step(1. - dens, h21(c)) * smoothstep(.06, .0, abs(f.x - .5) - .015) * smoothstep(0., .25, f.y) * smoothstep(1., .55, f.y);
}
`;
const build = (fs, o) => shaderScene(H + fs, { res: .8, ...o });
const byClock = (extra = {}) => ({ before(t, dt, gl, u) { gl.uniform1f(u.uA, daylight()); gl.uniform1f(u.uB, weather); }, ...extra });
const withSeason = fs => `const float SEASON = ${season()}.;\n` + fs;

/* Mountain Hut: a timber hut on a snowy slope at the treeline, its windows lit and smoke rising, pines around it and
   peaks behind. Snow falls in wet weather. Follows the clock. */
const HUT = `
float peaks(float x, float k){ return .5 * abs(sin(x * 1.1 + k)) + .3 * noise(vec2(x * 3.5, k)) + .12 * noise(vec2(x * 12., k + 2.)); }
float pine(vec2 q, float h){   // a fir: stacked triangles, q relative to its base, h its height
  float w = .3 * h * (1. - clamp(q.y / h, 0., 1.)) + .02 * h;
  float tiers = abs(fract(q.y / h * 4.) - .5);
  return step(0., q.y) * step(q.y, h) * step(abs(q.x), w * (.7 + .5 * tiers));
}
void main(){
  vec2 uv = fit(1.1); float t = uT, day = uA, wet = wetness();
  vec3 col = mix(dmix(vec3(.05, .07, .14), vec3(.7, .45, .4), vec3(.75, .85, .95), day), dmix(vec3(.01, .015, .04), vec3(.15, .12, .3), vec3(.3, .55, .9), day), smoothstep(-.1, .5, uv.y));
  col += stars(uv * 150., t, day) * vec3(.9, .95, 1.);
  float full = 1. - abs(MOONP * 2. - 1.);
  vec2 mp = vec2(-.38, .34); float md = length(uv - mp);
  col = mix(col, vec3(1., .97, .9), smoothstep(.035, .033, md) * moonLit((uv - mp) / .034) * (1. - day * .7));
  col += vec3(.5, .55, .8) * exp(-md * 6.) * .15 * full * (1. - day);
  // Peaks behind, snow on them lit by the moon or the sun.
  vec3 snowN = vec3(.3, .36, .55), snowD = vec3(.95, .97, 1.);
  for (int i = 0; i < 2; i++) {
    float k = float(i), base = .02 - k * .1, h = base + (.3 - k * .08) * peaks(uv.x * (1.3 + k * .6) + k * 3., k * 2.);
    vec3 rock = dmix(vec3(.04, .05, .09), vec3(.3, .2, .25), vec3(.45, .42, .45), day);
    vec3 sn = dmix(snowN * (1. - k * .3), vec3(.8, .6, .6), snowD, day) * (.85 + .3 * noise(uv * 30.));
    float slope = (peaks((uv.x + .01) * (1.3 + k * .6) + k * 3., k * 2.) - peaks((uv.x - .01) * (1.3 + k * .6) + k * 3., k * 2.)) * 5.;
    vec3 mc = mix(rock, sn, smoothstep(.2, .6, noise(uv * 20. + k) + .4 * (h - uv.y) * 6. - abs(slope) * .3));
    mc = mix(mc, col, .35 * (1. - k) * (1. - day * .5));
    col = mix(col, mc, smoothstep(h + .002, h - .002, uv.y));
  }
  // The slope: snow falling away to the right, with the odd rock and the shadow of the trees.
  float ground = -.12 + .06 * uv.x + .03 * noise(vec2(uv.x * 3., 1.)) + .01 * noise(vec2(uv.x * 14., 2.));
  vec3 gs = dmix(vec3(.2, .25, .42), vec3(.75, .62, .65), vec3(.96, .97, 1.), day) * (.85 + .15 * noise(uv * 40.) + .05 * noise(uv * 200.));
  gs *= 1. - .25 * smoothstep(.0, .06, ground - uv.y) * (1. - day * .5);
  col = mix(col, gs, smoothstep(ground + .002, ground - .002, uv.y));
  // Pines: a stand behind the hut and a few in front, darker nearer.
  for (int i = 0; i < 14; i++) {
    float fi = float(i), x = -.75 + fi * .13 + .04 * sin(fi * 5.), near = step(9.5, fi);
    float gy = -.12 + .06 * x + .03 * noise(vec2(x * 3., 1.)) - near * .12 - (1. - near) * .01;
    float h = .14 + .1 * h21(vec2(fi, 3.)) + near * .14;
    float tree = pine(uv - vec2(x + near * .35 * sign(x), gy), h);
    vec3 tc = mix(dmix(vec3(.03, .05, .05), vec3(.08, .1, .09), vec3(.1, .2, .12), day), dmix(vec3(.2, .25, .4), vec3(.7, .6, .62), vec3(.9, .93, .97), day), .3 * smoothstep(.3, .6, noise(uv * 50. + fi)));   // snow on the boughs
    col = mix(col, tc * (1. - near * .5), tree);
  }
  // The hut: a low timber cabin with a snow-laden roof, two lit windows, a door, a chimney and smoke.
  vec2 hp = uv - vec2(.12, -.12 + .06 * .12 + .03 * noise(vec2(.36, 1.)));
  float wall = step(-.17, hp.x) * step(hp.x, .17) * step(0., hp.y) * step(hp.y, .13);
  float roof = step(-.21, hp.x) * step(hp.x, .21) * step(.13 - (.21 - abs(hp.x)) * 0., hp.y) * step(hp.y, .13 + .1 * (1. - abs(hp.x) / .21));
  float snowRoof = roof * step(.13 + .1 * (1. - abs(hp.x) / .21) - .025, hp.y);
  vec3 timber = dmix(vec3(.05, .035, .025), vec3(.3, .18, .12), vec3(.45, .3, .2), day) * (.8 + .3 * step(.5, fract(hp.y * 60.)));
  col = mix(col, timber, wall);
  col = mix(col, dmix(vec3(.04, .035, .03), vec3(.2, .14, .1), vec3(.3, .22, .16), day), roof);
  col = mix(col, gs * 1.05, snowRoof);
  float win = (step(abs(hp.x + .09), .025) + step(abs(hp.x - .06), .025)) * step(abs(hp.y - .07), .028);
  float panes = step(.5, fract(hp.x * 40.)) * step(.5, fract(hp.y * 36.)) * .0 + step(abs(fract(hp.x * 20.) - .5), .04) + step(abs(fract(hp.y * 18.) - .5), .04);
  col = mix(col, mix(vec3(1., .75, .4), vec3(.08, .05, .03), clamp(panes, 0., 1.) * .8) * (1.2 - .3 * day), win * wall);
  col += vec3(1., .7, .35) * win * wall * .4 * (1. - day);
  col = mix(col, dmix(vec3(.03, .02, .015), vec3(.15, .1, .07), vec3(.22, .15, .1), day), step(abs(hp.x + .01), .022) * step(0., hp.y) * step(hp.y, .07));   // the door
  col += vec3(1., .75, .4) * exp(-length(hp - vec2(-.09, .07)) * 10.) * .12 * (1. - day) + vec3(1., .75, .4) * exp(-length(hp - vec2(.06, .07)) * 10.) * .12 * (1. - day);   // light on the snow
  float chim = step(abs(hp.x - .11), .018) * step(.15, hp.y) * step(hp.y, .26);
  col = mix(col, dmix(vec3(.04, .035, .035), vec3(.2, .16, .16), vec3(.3, .26, .26), day), chim);
  vec2 sp = hp - vec2(.11, .27); float up = max(sp.y, 0.);
  float smoke = smoothstep(.02 + up * .25, 0., abs(sp.x - up * up * .8 - .02 * sin(t * .5 + up * 8.))) * step(0., sp.y) * smoothstep(.5, .05, up) * (.5 + .5 * fbm3o(vec2(sp.x * 8., up * 5. - t * .15)));
  col = mix(col, dmix(vec3(.3, .3, .36), vec3(.6, .5, .5), vec3(.85), day), smoke * .5);
  // Snow in the air: a little always, more in wet weather.
  col += vec3(.85, .88, .95) * (flakes(uv, t, 10., .35, .25 + .4 * wet) * .5 + flakes(uv + 2., t, 18., .5, .2 + .4 * wet) * .35) * (.5 + .5 * day + .2);
  col = 1. - exp(-col * 1.5);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const hutScene = () => build(MOON_GLSL(moonPhase()) + HUT, byClock({ res: .85 }));

/* Hot Spring: a stone-edged pool steaming in the cold, lanterns glowing on the rocks, the water mirroring them, snow or
   maple leaves drifting down by season, bamboo behind. Follows the clock. */
const ONSEN = `
void main(){
  vec2 uv = fit(1.1); float t = uT, day = uA;
  vec3 col = dmix(vec3(.02, .03, .05), vec3(.25, .2, .3), vec3(.5, .62, .72), day);
  col = mix(col, col * .5, smoothstep(.1, .5, uv.y));
  // Bamboo and pines behind, a dark screen.
  float bx = uv.x * 26. + .4 * noise(vec2(uv.y * 2., 1.)), bc = floor(bx), bf = fract(bx) - .5, bh = h21(vec2(bc, 3.));
  float bam = step(abs(bf), .12 + .08 * bh) * step(.3, bh) * step(.06, uv.y) * step(uv.y, .5 + .4 * bh);
  float node = step(abs(fract(uv.y * 9. + bh) - .5), .04);
  vec3 bamC = mix(vec3(.2, .3, .12), vec3(.32, .42, .18), bh) * (.75 + .5 * smoothstep(-.2, .2, bf)) * (1. - node * .3);
  col = mix(col, bamC * dmix(vec3(.2, .25, .4), vec3(.7, .6, .65), vec3(1.), day), bam);
  float leaves_ = smoothstep(.55, .7, fbm3o(uv * 6. + 4.)) * step(.25, uv.y);
  col = mix(col, vec3(.1, .18, .08) * dmix(vec3(.3, .35, .5), vec3(.7, .6, .65), vec3(1.), day), leaves_ * .8);
  col = mix(col, dmix(vec3(.02, .03, .03), vec3(.08, .1, .08), vec3(.15, .22, .14), day), smoothstep(.1, .08, uv.y) * step(.02, uv.y) * step(.4, noise(vec2(uv.x * 10., 5.))));
  // The pool: its edge of rounded stones, the water lit from the lanterns, steam over it.
  float edge = -.05 + .04 * noise(vec2(uv.x * 4., 1.)) - .12 * (1. - smoothstep(.0, .2, abs(uv.x) - .3));
  float inPool = smoothstep(edge, edge - .01, uv.y) * step(-.48, uv.y);
  vec3 lan1 = vec3(-.42, .02, 0.), lan2 = vec3(.4, -.02, 0.);
  vec2 wq = vec2(uv.x, (uv.y - edge) * 1.6);
  float rip = sin(wq.x * 40. + t) * .004 + sin(wq.y * 60. - t * 1.3) * .003;
  vec3 water = dmix(vec3(.03, .06, .08), vec3(.15, .2, .25), vec3(.3, .45, .5), day);
  water += vec3(1., .6, .25) * (exp(-abs(uv.x + rip - lan1.x) * 9.) * .5 + exp(-abs(uv.x + rip - lan2.x) * 9.) * .5) * smoothstep(-.5, edge, uv.y) * (1.1 - day * .8);   // lantern light laid in the water
  water += vec3(.5, .6, .7) * pow(fbm3o(vec2(uv.x * 6. + t * .08, uv.y * 14. - t * .1)), 3.) * .35;
  water += vec3(1., .6, .25) * .3 * (exp(-length(vec2((uv.x - lan1.x) * 1.5, uv.y - edge + .05 + rip * 6.)) * 12.) + exp(-length(vec2((uv.x - lan2.x) * 1.5, uv.y - edge + .05 + rip * 6.)) * 12.)) * (1. - day * .8);   // the lanterns mirrored
  col = mix(col, water, inPool);
  // Stones round the rim: domes in a row, mossy on top.
  for (int i = 0; i < 16; i++) {
    float fi = float(i), sx = -.75 + fi * .1 + .02 * sin(fi * 3.), sy = -.05 + .04 * noise(vec2(sx * 4., 1.)) - .12 * (1. - smoothstep(.0, .2, abs(sx) - .3)) + .005;
    float r = .032 + .02 * h21(vec2(fi, 2.));
    vec2 dq = (uv - vec2(sx, sy)) / vec2(r * 1.4, r * .8);
    float dome = sqrt(max(0., 1. - dot(dq, dq)));
    float st = smoothstep(1., .95, length(dq));
    vec3 sc = mix(vec3(.25, .24, .22), vec3(.5, .48, .45), .5 + .5 * dq.y * dome) * dmix(vec3(.25, .28, .4), vec3(.8, .6, .6), vec3(1.), day);
    sc += vec3(1., .6, .25) * (exp(-length(uv - lan1.xy) * 5.) + exp(-length(uv - lan2.xy) * 5.)) * .5 * (1. - day * .8);
    sc = mix(sc, vec3(.2, .3, .12) * (.4 + .6 * day + .2), smoothstep(.3, .8, dq.y) * smoothstep(.4, .7, noise(uv * 40. + fi)) * .7);
    if (SEASON == 3.) sc = mix(sc, vec3(.9, .92, .97) * (.4 + .6 * day + .2), smoothstep(.2, .7, dq.y) * .9);   // snow on the stones
    col = mix(col, sc, st);
  }
  // Two stone lanterns: a pedestal, the lit box and a little roof.
  for (int i = 0; i < 2; i++) {
    vec2 lp = i == 0 ? lan1.xy : lan2.xy, q = uv - lp;
    vec3 stone = dmix(vec3(.12, .13, .18), vec3(.4, .36, .38), vec3(.6, .58, .56), day);
    col = mix(col, stone, step(abs(q.x), .018) * step(-.1, q.y) * step(q.y, 0.));
    col = mix(col, stone * .8, step(abs(q.x), .05) * step(-.1, q.y) * step(q.y, -.08));
    float box = step(abs(q.x), .035) * step(0., q.y) * step(q.y, .06);
    col = mix(col, vec3(1., .72, .35) * (1.3 - .5 * day), box * step(.5, fract(q.x * 60.) + step(abs(q.x), .01)));
    col = mix(col, stone, box * step(abs(fract(q.x * 60.) - .5), .12) * (1. - step(abs(q.x), .01)) * 0.);
    col = mix(col, stone, step(abs(q.x), .06 - q.y * .3) * step(.06, q.y) * step(q.y, .1));
    col += vec3(1., .65, .3) * exp(-length(q - vec2(0., .03)) * 14.) * .5 * (1. - day * .8) * (.9 + .1 * sin(t * 3. + float(i)));
  }
  // Steam: slow plumes lifting off the water, thicker when it is colder (night, winter).
  float cold = (1. - day * .6) * (SEASON == 3. ? 1.2 : SEASON == 1. ? .5 : .85);
  vec2 sq = vec2(uv.x * 2. + fbm3o(vec2(uv.x * 3., uv.y * 2. - t * .1)) * .6, (uv.y - edge) * 1.5 - t * .12);
  float steam = fbm4(sq * 2.5) * smoothstep(edge - .1, edge + .25, uv.y) * smoothstep(edge + .6, edge + .05, uv.y) * step(-.35, uv.y);
  col = mix(col, dmix(vec3(.35, .38, .48), vec3(.7, .6, .62), vec3(.9, .92, .95), day) * (1. + .3 * (exp(-length(uv - lan1.xy) * 3.) + exp(-length(uv - lan2.xy) * 3.))), smoothstep(.3, .75, steam) * .55 * cold);
  // What falls: snow in winter, maple leaves in autumn, petals in spring.
  float fall = SEASON == 1. ? 0. : flakes(uv, t, 12., SEASON == 3. ? .4 : .2, SEASON == 3. ? .3 : .1);
  vec3 fc = SEASON == 3. ? vec3(.92, .94, 1.) : SEASON == 2. ? vec3(.85, .3, .1) : vec3(1., .8, .85);
  col = mix(col, fc * (.5 + .5 * day + .1), fall * .9);
  col *= 1. - .3 * smoothstep(.5, 1.2, length(uv));
  col = 1. - exp(-col * 1.5);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const onsenScene = () => build(withSeason(ONSEN), byClock({ res: .85 }));

/* Desert at Noon: dunes bleached white under a high sun, a mesa far off wobbling in the heat, a dust devil now and
   then, a hawk turning high up. The horizon shimmers. */
const NOON = `
void main(){
  vec2 uv = fit(1.1); float t = uT, asp = aspW(1.1);
  // Heat shimmer: the view near the horizon is displaced by rising air.
  float hz = -.02;
  float shim = smoothstep(.25, 0., abs(uv.y - hz)) * .006;
  vec2 v = uv + vec2(noise(vec2(uv.x * 40., uv.y * 60. + t * 6.)) - .5, noise(vec2(uv.x * 30. + 9., uv.y * 50. + t * 7.)) - .5) * shim;
  vec3 col = mix(vec3(.85, .9, .95), vec3(.35, .55, .9), smoothstep(hz, .5, v.y));
  vec2 sun = vec2(.1, .42); float sd = length(uv - sun);
  col += vec3(1., .98, .9) * (smoothstep(.05, .045, sd) + exp(-sd * 2.5) * .6 + exp(-sd * .8) * .25);
  // A mesa and far hills in the haze.
  float hills = step(v.y, hz + .015 + .012 * noise(vec2(v.x * 4., 1.)) + .006 * noise(vec2(v.x * 15., 3.)));
  col = mix(col, mix(vec3(.72, .6, .55), col, .6), hills * step(hz, v.y));
  // The mesa: a flat top with a notch, sloping scree below the cliffs, strata across the face, hazed by distance.
  float mx = v.x + .3, my = v.y - hz;
  float capW = .13 + .02 * noise(vec2(my * 30., 1.)), topH = .075 - .012 * smoothstep(.0, .03, abs(mx - .05)) * step(.02, mx) * step(mx, .08);
  float cliff = step(abs(mx), capW) * step(my, topH) * step(.03, my);
  float scree = step(abs(mx), capW + (.03 - my) * 4.) * step(my, .03) * step(0., my);
  vec3 mc = mix(vec3(.62, .42, .35), vec3(.78, .6, .48), step(.5, fract(my * 90.)) * .5 + .5 * smoothstep(-.1, .1, -mx));
  mc = mix(mc, vec3(.8, .66, .55), scree);
  col = mix(col, mix(mc, col, .45), max(cliff, scree) * step(hz, v.y));
  // The dunes, pale and sharp-crested, brightest facing the sun.
  for (int i = 0; i < 5; i++) {
    float k = float(i), sc = 1.5 + k * .8, base = hz - .02 - k * .09, amp = .07 + k * .035;
    float x = v.x * sc + k * 4.;
    float r = base + amp * (1. - abs(noise(vec2(x * .6, k)) * 2. - 1.)) * .9;
    float slope = (noise(vec2((x + .02) * .6, k)) - noise(vec2((x - .02) * .6, k))) * 25.;
    float lit = smoothstep(-.6, .6, slope);
    vec3 c = mix(vec3(.74, .56, .36), vec3(1., .94, .8), lit) * (.96 + .08 * noise(vec2(v.x * 60. + v.y * 20., v.y * 300.)));
    c = mix(c, vec3(.88, .88, .9), .3 * (1. - k / 4.));   // haze on the far ones
    col = mix(col, c, smoothstep(r + .002, r - .002, v.y));
    // Sand lifting off the crests in the wind.
    col += vec3(1., .95, .85) * fbm3o(vec2(v.x * 10. + t * 1.2, v.y * 40.)) * smoothstep(r + .04, r, v.y) * smoothstep(r - .004, r + .004, v.y) * .25;
  }
  // A dust devil crossing the middle distance every few minutes.
  float cyc = mod(t, 240.), ph = cyc / 50.;
  if (ph < 1.) {
    float dx = -asp * .5 - .1 + ph * (asp + .2), base = hz - .11;
    vec2 q = uv - vec2(dx, base); float up = clamp(q.y / .22, 0., 1.);
    float w = .012 + .05 * up, lean = up * up * .08 + .01 * sin(t * 2. + up * 10.);
    float devil = smoothstep(w, w * .3, abs(q.x - lean)) * step(0., q.y) * smoothstep(.25, .12, q.y) * (.4 + .6 * fbm3o(vec2(q.x * 20., up * 6. - t * 1.5)));
    col = mix(col, vec3(.85, .72, .55), devil * .6 * sin(ph * 3.1416));
  }
  // A hawk circling high, a small dark shape with slow wingbeats.
  vec2 hc = vec2(-.2 + .25 * cos(t * .07), .25 + .06 * sin(t * .07)); vec2 hq = (uv - hc) / .016;
  float flap = .3 * sin(t * 1.5); float wing = smoothstep(.12, .0, abs(hq.y - flap * abs(hq.x) + .15 * abs(hq.x) * abs(hq.x)) - .08) * step(abs(hq.x), 1.);
  col = mix(col, vec3(.12, .1, .08), max(wing, smoothstep(.25, .1, length(hq * vec2(1., 2.)))) * .9);
  col = 1. - exp(-col * 1.25);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const noonDesertScene = () => build(NOON, { res: .85 });

/* Bus Shelter: under the shelter's roof on a wet evening, looking out at the street. Rain runs off the roof's edge,
   headlights come and go along the road, the shelter's timetable glows beside you, a lamp hums across the way. */
const SHELTER = `
void main(){
  vec2 uv = fit(1.1); float t = uT, day = uA, wet = max(.3, wetness());
  float asp = aspW(1.1);
  vec3 col = mix(dmix(vec3(.07, .08, .12), vec3(.45, .33, .38), vec3(.6, .66, .72), day), dmix(vec3(.02, .025, .05), vec3(.18, .16, .3), vec3(.4, .5, .65), day), smoothstep(-.05, .4, uv.y));
  // Across the road: a row of houses with some lit windows, and a lamp.
  float hz = -.02;
  float hx = uv.x * 4., cell = floor(hx), fx = fract(hx);
  float top = hz + .14 + .05 * h21(vec2(cell, 1.));
  float house = step(uv.y, top) * step(hz, uv.y);
  vec3 hc = dmix(vec3(.05, .05, .07), vec3(.25, .2, .22), vec3(.5, .48, .5), day) * (.8 + .4 * h21(vec2(cell, 2.)));
  col = mix(col, hc, house);
  float win = step(abs(fract(hx * 3.) - .5), .18) * step(abs(fract((uv.y - hz) * 14.) - .5), .25) * step(hz + .02, uv.y) * step(uv.y, top - .02);
  float lit = step(.55, h21(vec2(cell * 3. + floor(fx * 3.), floor((uv.y - hz) * 14.)))) * (1. - day * .7);
  col = mix(col, mix(dmix(vec3(.03, .04, .06), vec3(.15, .15, .2), vec3(.5, .55, .6), day), vec3(1., .8, .5), lit), win * house);
  vec2 lamp = vec2(.3, hz + .22);
  col = mix(col, vec3(.02), step(abs(uv.x - lamp.x), .004) * step(hz, uv.y) * step(uv.y, lamp.y));
  col += vec3(1., .85, .6) * (smoothstep(.012, .008, length(uv - lamp)) + exp(-length(uv - lamp) * 6.) * .35) * (1. - day * .8);
  // The road: wet, with the lights drawn down into it, and a car's headlights passing every so often.
  if (uv.y < hz) {
    float dpt = hz - uv.y;
    vec3 road = dmix(vec3(.03, .035, .05), vec3(.12, .11, .13), vec3(.3, .3, .32), day) * (.85 + .3 * noise(vec2(uv.x * 40., uv.y * 200.)));
    road += vec3(1., .85, .6) * exp(-abs(uv.x - lamp.x) * 10.) * smoothstep(.3, 0., dpt) * .25 * (1. - day * .8) * (.7 + .3 * noise(vec2(uv.x * 100., uv.y * 80. - t)));
    road += vec3(1., .8, .5) * .08 * (1. - day * .8) * smoothstep(.25, 0., dpt);
    col = road;
    col = mix(col, vec3(.6, .6, .62) * (.3 + .7 * day + .2), step(abs(dpt - .17), .003) * step(.5, fract(uv.x * 6. + t * .0)) * .6);   // the centre line
  }
  float car = mod(t, 23.), cph = car / 7.;
  if (cph < 1.) {
    float cx = mix(-asp * .6, asp * .6, cph), cy = hz - .06;
    vec2 cq = uv - vec2(cx, cy);
    col = mix(col, vec3(.02, .02, .03), step(abs(cq.x), .09) * step(0., cq.y) * step(cq.y, .05) + step(abs(cq.x - .01), .06) * step(.05, cq.y) * step(cq.y, .085));
    col += vec3(1., .95, .8) * (exp(-length(cq - vec2(.085, .015)) * 60.) * 1.5 + exp(-length(cq - vec2(.085, .015)) * 8.) * .3) * (1. - day * .5);
    col += vec3(1., .2, .1) * exp(-length(cq - vec2(-.09, .02)) * 90.) * .8;
    col += vec3(1., .95, .8) * exp(-abs(uv.x - cx - .1) * 12.) * smoothstep(0., .25, hz - uv.y) * step(uv.y, cy) * .25 * (1. - day * .5);   // on the wet road
  }
  // Rain: streaks in the air, and the run-off from the roof's edge as a curtain of drips.
  col += vec3(.7, .72, .8) * (streaks(uv, t, 60., .25 * wet) * .25 + streaks(uv + 1.3, t * 1.2, 110., .2 * wet) * .12);
  float roofY = .3;
  float drip = step(.0, roofY - uv.y) * step(roofY - uv.y, .5);
  vec2 dg = vec2(uv.x * 30., (roofY - uv.y) * 6. - t * 2.5), dc = floor(dg), df = fract(dg) - .5;
  float dropM = smoothstep(.2, .05, length(df * vec2(2., 1.))) * step(.5, h21(dc)) * step(fract(dc.x * .37 + t * .05), .6);
  col += vec3(.8, .85, .95) * dropM * drip * .6 * (.5 + .5 * day + .2);
  col = mix(col, col * .5, smoothstep(.0, .02, uv.y - (roofY - .02)) * (1. - step(roofY, uv.y)));
  // The shelter itself: the roof's underside at the top, a post at the left, the glowing timetable panel on the right.
  col = mix(col, vec3(.05, .05, .06) * (.8 + .4 * noise(uv * 30.)), step(roofY, uv.y));
  col = mix(col, vec3(.07, .07, .08), step(abs(uv.x + asp * .5 + .18), .025) * step(-.6, uv.y) * step(uv.y, roofY));
  vec2 tp = uv - vec2(asp * .5 - .22, -.05);
  float panel = step(abs(tp.x), .1) * step(abs(tp.y), .16);
  col = mix(col, vec3(.07, .07, .08), step(abs(tp.x), .115) * step(abs(tp.y), .175));
  vec3 paper = vec3(.95, .93, .85) * (.5 + .5 * (1. - day) + .3);
  float lines = step(.6, fract(tp.y * 40.)) * step(abs(tp.x), .08) * step(abs(tp.y), .12) * step(.3, h21(floor(tp * 40.)));
  col = mix(col, mix(paper, vec3(.2, .2, .25), lines * .8), panel);
  col = mix(col, vec3(.85, .25, .15), panel * step(abs(tp.y - .135), .015) * step(abs(tp.x), .08));   // the route's colour band
  col += vec3(1., .95, .85) * panel * .15 * (1. - day) + vec3(.9, .85, .7) * exp(-length(tp) * 3.) * .15 * (1. - day);
  col = 1. - exp(-col * 1.5);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const shelterScene = () => build(SHELTER, byClock({ res: .85 }));

/* Observatory: a dome on a dark hill with its slit open to a sky that turns slowly through the night, the Milky Way
   across it, a red work light at the door, satellites and meteors passing. Always night: it is a scene for the stars. */
const OBSERVATORY = `
vec3 skyAt(vec2 p, float t){
  // The sky turns about a pole up and to the left, one full turn a day; stars at two scales and the Milky Way band.
  vec2 pole = vec2(-.45, .55), d = p - pole; float a = t * .00007 + 2.;   // a real sidereal rate, give or take
  vec2 r = vec2(cos(a) * d.x - sin(a) * d.y, sin(a) * d.x + cos(a) * d.y);
  vec3 col = vec3(.004, .006, .016);
  float band = exp(-pow(dot(r, normalize(vec2(.6, -.8))) * 3., 2.));
  col += vec3(.18, .18, .26) * band * (fbm4(r * 2.5 + 3.) * .7 + .3) * .3 * (1. - smoothstep(.45, .65, fbm3o(r * 6.)) * .6);   // the band, with dust lanes through it
  col += stars(r * 110., t, 0.) * vec3(.9, .92, 1.) + stars(r * 240. + 5., t * 1.3, 0.) * .5 + band * stars(r * 400. + 9., t, 0.) * .4;
  return col;
}
void main(){
  vec2 uv = fit(1.15); float t = uT, asp = aspW(1.15);
  vec3 col = skyAt(uv, t);
  // A satellite crossing in a straight line every few minutes, and a meteor now and then.
  float cyc = mod(t, 190.), ph = cyc / 45.;
  if (ph < 1.) { vec2 sp = mix(vec2(-asp * .5, .1), vec2(asp * .5, .35), ph); col += vec3(.9, .95, 1.) * smoothstep(.004, .0, length(uv - sp)) * .9; }
  float mcyc = mod(t + 20., 37.), mph = mcyc / 1.1;
  if (mph < 1.) { vec2 a = vec2(.3 + .3 * sin(floor((t + 20.) / 37.)), .4), b = a + vec2(-.25, -.12); vec2 h = mix(a, b, mph); float dm = seg(uv, mix(a, h, .8), h); col += vec3(1.) * smoothstep(.003, .0, dm) * (1. - mph) * hh; }
  // The hill: a dark ridge with a few pines, and the dome on it.
  float hill = -.22 + .05 * noise(vec2(uv.x * 2., 1.)) + .01 * noise(vec2(uv.x * 12., 2.));
  vec3 ground = vec3(.012, .014, .02) * (.8 + .4 * noise(uv * 30.));
  col = mix(col, ground, smoothstep(hill + .002, hill - .002, uv.y));
  for (int i = 0; i < 7; i++) { float fi = float(i), x = -.6 + fi * .2 + .05 * sin(fi * 4.); if (abs(x) > .25) { vec2 q = uv - vec2(x, -.22 + .05 * noise(vec2(x * 2., 1.))); float h = .06 + .03 * h21(vec2(fi, 1.)); col = mix(col, vec3(.008, .01, .014), step(0., q.y) * step(q.y, h) * step(abs(q.x), .02 * (1. - q.y / h) + .003)); } }
  vec2 dp = uv - vec2(0., hill + .02);
  float base = step(abs(dp.x), .17) * step(0., dp.y) * step(dp.y, .16);
  float dome = step(length((dp - vec2(0., .16)) * vec2(1., 1.)), .17) * step(.16, dp.y);
  vec3 wall = vec3(.05, .055, .07) * (.8 + .3 * noise(uv * 60.)) + vec3(.02, .025, .04) * smoothstep(-.17, .17, dp.x);
  col = mix(col, wall, base);
  vec3 domeC = vec3(.06, .065, .08) * (.5 + .9 * smoothstep(-.17, .1, dp.x)) + vec3(.03, .035, .05) * smoothstep(.16, .33, dp.y);
  domeC += vec3(.02, .025, .04) * step(.5, fract(atan(dp.x, dp.y - .16) * 2.2));   // the panels
  col = mix(col, domeC, dome);
  // The slit, open to the sky: through it the stars, and the telescope's tube reaching up, its end catching a little light.
  float slit = dome * step(abs(dp.x - .03), .022) * step(.2, dp.y);
  col = mix(col, skyAt(uv, t) * .9 + vec3(.0, .0, .01), slit);
  float tube = slit * step(abs(dp.x - .03), .011) * step(dp.y, .3);
  col = mix(col, vec3(.04, .045, .06) + vec3(.1, .08, .06) * smoothstep(.27, .3, dp.y), tube);
  // The door with its red work light, a window glowing red-dim, and the light on the ground.
  col = mix(col, vec3(.02, .02, .025), step(abs(dp.x - .1), .02) * step(0., dp.y) * step(dp.y, .06));
  col += vec3(1., .15, .1) * (smoothstep(.006, .003, length(dp - vec2(.1, .075))) + exp(-length(dp - vec2(.1, .075)) * 20.) * .3) * (.8 + .2 * sin(t * .7));
  col = mix(col, vec3(.3, .05, .04), step(abs(dp.x + .08), .015) * step(abs(dp.y - .09), .012) * base);
  col += vec3(.3, .05, .04) * exp(-length(uv - vec2(.1, hill)) * 15.) * .2;
  col = 1. - exp(-col * 1.5);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const observatoryScene = () => build(OBSERVATORY, { res: .85 });
