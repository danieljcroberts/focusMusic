// Workout scenes: forward motion with a rhythm, for exercise and active work. Each moves steadily on its own and goes
// faster with the music's energy: the distance travelled (uC) is counted here, quicker when the bass and level are up.
//   Trail Run: running a forest path at sunrise, the view bobbing with each stride.
//   Night Ride: cycling a lit road at night, lamps sweeping past, handlebars below.
//   Rowing at Dawn: facing the stern of a rowing shell on a still lake, the oars driving, puddles left behind.
//   Floodlit Track: running a lane of an athletics track at night under the floodlights.
import { shaderScene } from './trip.js';
import { bands, musicLevel } from '../music.js';
import { lively } from '../view.js';

const H = `
float fbm3o(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.07 + 11.3; a *= .5; } return v; }
float dither(float t){ return (h21(gl_FragCoord.xy + fract(t)) - .5) / 160.; }
float px(){ return 1.5 / uRes.y; }
// The route: gentle bends either way, x as a function of distance along it.
float route(float z){ return 3. * sin(z * .045) + 1.2 * sin(z * .11 + 1.); }
`;
// Speed: a steady pace, quicker with the music. pace: metres per second at rest; push: how much the music adds.
function moving(pace, push, extra = {}) {
  let dist = 0;
  return {
    res: .8, ...extra,
    before(t, dt, gl, u) {
      dist += dt * pace * (1 + push * (bands.bass * .7 + musicLevel * .6)) * (lively ? 1.4 : 1);
      gl.uniform1f(u.uC, dist);
      if (extra.before) extra.before(t, dt, gl, u);
    },
  };
}
const build = (fs, o) => shaderScene(H + fs, o);

/* Trail Run */
const TRAIL = `
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, cz = uC;
  float stride = cz * 1.25;                                             // about one stride every 0.8 m
  float bob = abs(sin(stride * 3.1416)) * (.035 + .02 * uBass), roll = sin(stride * 3.1416) * .012;
  float camY = 1.65 + bob, camX = route(cz);
  float yaw = (route(cz + 8.) - camX) / 8.;
  vec2 q = vec2(uv.x * cos(roll) - uv.y * sin(roll), uv.x * sin(roll) + uv.y * cos(roll));
  vec3 rd = normalize(vec3(q.x, q.y - .04, 1.3));
  rd.xz = vec2(rd.x + rd.z * yaw, rd.z - rd.x * yaw);
  // Sky: sunrise, warm at the horizon, the sun ahead and a little to the side.
  vec3 sky = mix(vec3(1., .72, .45), vec3(.42, .6, .9), smoothstep(-.02, .45, rd.y));
  vec2 sun = vec2(.35 - yaw * 1.3, .08); float sd = length(q - sun);
  sky += vec3(1., .85, .6) * (smoothstep(.05, .045, sd) + exp(-sd * 4.) * .5);
  vec3 col = sky;
  float fogK = 0.;
  if (rd.y < 0.) {
    float tg = camY / -rd.y; vec3 p = rd * tg; float wz = cz + p.z, wx = camX + p.x;
    float off = abs(wx - route(wz));
    float trail = smoothstep(1.15, .95, off + .15 * noise(vec2(wz * .7, 1.)));
    vec3 grass = mix(vec3(.18, .3, .1), vec3(.32, .45, .16), noise(vec2(wx * 2., wz * 2.))) * (.85 + .3 * noise(vec2(wx * 9., wz * 9.)));
    vec3 dirt = mix(vec3(.45, .34, .22), vec3(.6, .48, .32), noise(vec2(wx * 3., wz * 3.))) * (.85 + .25 * noise(vec2(wx * 20., wz * 20.)));
    dirt *= 1. - .15 * smoothstep(.2, .9, off);                            // worn darker at the edges
    col = mix(grass, dirt, trail);
    col *= .8 + .35 * noise(vec2(wx * .3 + 4., wz * .3));                   // dappled light through the trees
    fogK = 1. - exp(-tg * .02);
    col = mix(col, sky * .9, fogK);
  }
  // Pines either side of the path, rows coming toward us, far ones first.
  float S = 4.;
  for (int i = 23; i >= 0; i--) {
    float row = floor(cz / S) + float(i) + 1., wz = row * S;
    for (int sd2 = 0; sd2 < 2; sd2++) {
      float side = sd2 == 0 ? -1. : 1., h = h21(vec2(row, side));
      float wx = route(wz) + side * (2.2 + h * 4.5);
      vec2 rel = vec2(wx - camX, wz - cz); rel = vec2(rel.x - rel.y * yaw, rel.y + rel.x * yaw);
      float vis = step(.6, rel.y); rel.y = max(rel.y, .6);
      float f = 1.3 / rel.y, sx = rel.x * f, by = (-camY) * f + .04, th = (9. + 6. * h21(vec2(row, side + 3.))) * f;
      float yq = q.y - by;
      float cw = th * .16 * (1. - clamp(yq / th, 0., 1.)) * (1. + .3 * abs(fract(yq / th * 5.) - .5));
      float tree = step(abs(q.x - sx), cw) * step(th * .18, yq) * step(yq, th) * vis;
      float trunk = step(abs(q.x - sx), .12 * f) * step(0., yq) * step(yq, th * .25) * vis;
      vec3 tc = mix(vec3(.06, .14, .07), vec3(.12, .24, .1), h) * (.7 + .5 * smoothstep(-cw, cw, q.x - sx + cw * .3));
      tc = mix(tc, sky * .85, 1. - exp(-rel.y * .03));
      col = mix(col, mix(vec3(.2, .13, .08), tc, .4), trunk);
      col = mix(col, tc, tree);
    }
  }
  // Light through the trees: shafts from the sun, stronger with the music.
  float sh = pow(noise(vec2(atan(q.y - sun.y, q.x - sun.x) * 8. + t * .02, 2.)), 3.) * smoothstep(1.2, .1, length(q - sun));
  col += vec3(1., .85, .6) * sh * (.12 + .08 * uLevel);
  col *= 1. - .25 * smoothstep(.5, 1.2, length(uv));
  col = 1. - exp(-col * 1.3);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const trailRunScene = () => build(TRAIL, moving(3.2, .6, { res: .75 }));

/* Night Ride */
const RIDE = `
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, cz = uC;
  float sway = sin(cz * .9) * .006;
  float camY = 1.3, camX = route(cz * .5) * .6;
  float yaw = (route((cz + 10.) * .5) * .6 - camX) / 10.;
  vec3 rd = normalize(vec3(uv.x + sway, uv.y - .02, 1.3)); rd.xz = vec2(rd.x + rd.z * yaw, rd.z - rd.x * yaw);
  vec3 sky = mix(vec3(.12, .08, .16), vec3(.01, .015, .04), smoothstep(-.02, .4, rd.y));
  sky += vec3(.45, .25, .18) * exp(-abs(rd.y) * 20.) * .5;                // the town's glow on the horizon
  vec3 col = sky;
  // A far skyline with lit windows.
  float bx = rd.x / rd.z * 6. + cz * .01, bc = floor(bx * 3.);
  float bh = .03 + .07 * h21(vec2(bc, 1.));
  if (rd.y > 0. && rd.y < bh) { col = vec3(.02, .02, .035); col += vec3(1., .8, .5) * step(.8, h21(floor(vec2(bx * 30., rd.y * 300.)))) * .6; }
  if (rd.y < 0.) {
    float tg = camY / -rd.y; vec3 p = rd * tg; float wz = cz + p.z, wx = camX + p.x;
    float rc = route(wz * .5) * .6, off = wx - rc;
    float road = step(abs(off), 3.5);
    vec3 asph = vec3(.035, .035, .045) * (.8 + .4 * noise(vec2(wx * 8., wz * 8.)));
    vec3 verge = vec3(.03, .045, .03);
    col = mix(verge, asph, road);
    col = mix(col, vec3(.8, .8, .7), step(abs(abs(off) - 3.3), .06) * road * .8);                 // edge lines
    col = mix(col, vec3(.9, .85, .6), step(abs(off), .07) * step(.5, fract(wz * .12)) * .9);       // centre dashes
    // Lamps every 18 m on the right: pools of light on the road, and their streaks in the wet.
    float lz = floor(wz / 18.) * 18. + 9., ld = length(vec2(off - 3.8, wz - lz));
    col += vec3(1., .75, .4) * exp(-ld * ld * .05) * .5 * road;
    col = mix(col, sky * .6, 1. - exp(-tg * .025));
  }
  // The lamps themselves, posts and heads, near ones bright.
  for (int i = 11; i >= 0; i--) {
    float wz = (floor(cz / 18.) + float(i) + 1.) * 18. - 9.;
    vec2 rel = vec2(route(wz * .5) * .6 + 3.8 - camX, wz - cz); rel = vec2(rel.x - rel.y * yaw, rel.y + rel.x * yaw);
    float vis = step(.5, rel.y); rel.y = max(rel.y, .5);
    float f = 1.3 / rel.y, sx = rel.x * f, by = -camY * f + .02, top = (5.5 - camY) * f + .02;
    float post = step(abs(uv.x - sx), max(px(), .08 * f)) * step(by, uv.y) * step(uv.y, top) * vis;
    col = mix(col, vec3(.04), post);
    vec2 hd = vec2(sx - .5 * f, top);
    col += vec3(1., .82, .5) * (smoothstep(.3 * f, 0., length(uv - hd)) * 1.5 + exp(-length(uv - hd) / f * 1.2) * .35) * exp(-rel.y * .01) * vis;
  }
  // Handlebars and the front light's beam on the road.
  col += vec3(1., .95, .85) * smoothstep(.5, 0., length((uv - vec2(0., -.3)) * vec2(.8, 2.4))) * .2;
  float bar = smoothstep(.012, .006, abs(uv.y + .44 + uv.x * uv.x * .25)) * step(abs(uv.x), .55);
  float grips = step(.45, abs(uv.x)) * step(abs(uv.x), .62) * smoothstep(.03, .02, abs(uv.y + .44 + uv.x * uv.x * .25));
  float stem = step(abs(uv.x), .025) * step(uv.y, -.43);
  col = mix(col, vec3(.05, .05, .06), max(max(bar, stem), grips));
  col += vec3(.3, .3, .35) * smoothstep(.004, 0., abs(uv.y + .438 + uv.x * uv.x * .25)) * step(abs(uv.x), .55) * .4;
  col *= 1. - .3 * smoothstep(.5, 1.2, length(uv));
  col = 1. - exp(-col * 1.5);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const nightRideScene = () => build(RIDE, moving(7., .5, { res: .8 }));

/* Rowing at Dawn: looking back over the stern; the shell surges with each stroke. */
const ROW = `
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, cz = uC;
  float ph = fract(cz * .22), drive = smoothstep(.0, .35, ph) * smoothstep(1., .45, ph);   // the stroke: catch, drive, recovery
  float lean = (drive - .5) * .02;
  vec3 rd = normalize(vec3(uv.x, uv.y - .02 + lean, 1.4));
  vec3 sky = mix(vec3(1., .78, .62), vec3(.55, .65, .85), smoothstep(-.02, .4, rd.y));
  vec3 col = sky;
  float hz = -.005 + lean;
  // The far shore: a dark tree line with mist lying on the water.
  float shore = hz + .016 + .028 * fbm3o(vec2(uv.x * 2.5, 1.)) + .01 * pow(noise(vec2(uv.x * 60., 2.)), 2.) + .006 * noise(vec2(uv.x * 140., 3.));   // wooded hills, ragged with treetops
  vec3 land = mix(vec3(.16, .17, .2), sky, .4);
  if (uv.y > hz && uv.y < shore) col = land;
  if (uv.y < hz) {
    float d = hz - uv.y, tg = 1. / d;
    vec2 w = vec2(uv.x * tg, tg + cz);
    float rip = noise(vec2(w.x * 2., w.y * 1.5 - t * .2)) * .015 + noise(w * 6.) * .005;
    vec2 rf = vec2(uv.x + rip * 3., 2. * hz - uv.y + rip);
    vec3 refl = mix(vec3(1., .78, .62), vec3(.55, .65, .85), smoothstep(-.02, .4, rf.y));
    float rshore = hz + .018 + .03 * fbm3o(vec2(rf.x * 2.5, 1.));
    if (rf.y < rshore) refl = mix(land, refl, .25);
    col = mix(refl * .85, vec3(.2, .28, .38), smoothstep(0., .5, d) * .5);
    // Puddles left by the blades: swirl pairs every stroke, either side, drifting away behind the boat.
    for (int i = 0; i < 8; i++) {
      float k = float(i), sz = (floor(cz * .22) - k) / .22 + .3, rel = cz - sz + 1.5;
      float vis = step(1.6, rel); rel = max(rel, 1.6);
      for (int s = 0; s < 2; s++) {
        float side = s == 0 ? -1. : 1.;
        vec2 pp = vec2(side * 2.6 / rel, hz - 1. / rel);
        float r = length((uv - pp) * vec2(1., 3.5)) * rel;
        col += vec3(.9, .92, .95) * smoothstep(.12, 0., abs(r - .35 - .1 * sin(t * 2. + k))) * .25 * exp(-rel * .08) * vis;
      }
    }
    // The wake: a smooth V behind the stern.
    float wv = abs(abs(uv.x) - d * .55);
    col += vec3(.85, .88, .92) * smoothstep(.004 + d * .04, 0., wv) * .18 * smoothstep(.0, .2, d) * (.6 + .4 * noise(vec2(uv.x * 40., d * 60. - t)));
  }
  // Mist on the water.
  col = mix(col, vec3(.95, .85, .8), smoothstep(.06, 0., abs(uv.y - hz)) * .35 * (.7 + .3 * fbm3o(vec2(uv.x * 3. + t * .02, 1.))));
  // The shell: a narrow deck converging to the stern, with the rigger and oars sweeping either side.
  float deckW = .04 + (-.15 - uv.y) * .35;
  float deck = step(uv.y, -.15) * step(abs(uv.x), deckW);
  col = mix(col, mix(vec3(.75, .74, .7), vec3(.4, .38, .36), smoothstep(-.15, -.6, uv.y)), deck);
  col = mix(col, vec3(.15), deck * step(abs(abs(uv.x) - deckW + .01), .006));
  float swing = mix(.6, -.5, drive);                                     // the oar angle through the stroke
  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1. : 1.;
    vec2 pin = vec2(side * .3, -.3), dir = normalize(vec2(side * (.75 + .25 * cos(swing)), .1 * sin(swing) - .12 - .18 * drive));
    vec2 rel2 = uv - pin; float al = dot(rel2, dir), ac = dot(rel2, vec2(-dir.y, dir.x));
    float shaft = step(0., al) * step(al, .5) * smoothstep(.008, .004, abs(ac));
    float blade = step(.42, al) * step(al, .58) * smoothstep(.035, .025, abs(ac) - (al - .42) * .1);
    col += vec3(1.) * smoothstep(.05, 0., length(uv - pin - dir * .5) - .02) * drive * .25 * step(uv.y, hz);   // splash at the catch
    col = mix(col, vec3(.08, .08, .09), shaft);
    col = mix(col, vec3(.85, .2, .2), blade);                              // painted blades
    col = mix(col, vec3(.15), step(length(rel2), .02));                   // the gate
  }
  col *= 1. - .25 * smoothstep(.5, 1.2, length(uv));
  col = 1. - exp(-col * 1.3);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
export const rowingScene = () => build(ROW, moving(1.6, .5, { res: .8 }));

/* Floodlit Track */
const TRACK = `
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, cz = uC;
  float stride = cz * .7, bob = abs(sin(stride * 3.1416)) * .03 * (1. + uBass * .5);
  float camY = 1.6 + bob;
  // The oval: 100 m straights and 100 m bends; on a bend the view turns steadily.
  float lap = mod(cz, 400.), onBend = step(100., mod(lap, 200.)), bendK = onBend * 3.1416 / 100.;
  vec3 rd = normalize(vec3(uv.x, uv.y - .03, 1.3));
  vec3 sky = mix(vec3(.04, .05, .1), vec3(.005, .008, .02), smoothstep(0., .4, rd.y));
  vec3 col = sky;
  // The stands: a dark bank with crowd dots, and four floodlight towers flaring.
  float stand = .02 + .1 * smoothstep(.0, .5, abs(rd.x / rd.z)) ;
  if (rd.y > 0. && rd.y < stand) {
    col = vec3(.03, .03, .045);
    vec2 g = vec2(rd.x / rd.z * 120. + cz * .6 * (1. + onBend * 3.), rd.y * 400.);
    col += hsl2(vec3(h21(floor(g)), .5, .4)) * step(.55, h21(floor(g) + 3.)) * .25;
  }
  for (int i = 0; i < 4; i++) {
    float fi = float(i), lx = mod(fi * 1.1 - cz * .004 * (1. + onBend * 4.), 4.4) - 2.2, ly = .22 + .03 * sin(fi * 2.);
    vec2 lp = vec2(lx, ly);
    col += vec3(.95, .97, 1.) * (smoothstep(.03, .01, length((uv - lp) * vec2(1., 1.6))) * 1.2 + exp(-length(uv - lp) * 6.) * .3);
    col = mix(col, vec3(.06), step(abs(uv.x - lx), .006) * step(.02, uv.y) * step(uv.y, ly - .02));
  }
  if (rd.y < 0.) {
    float tg = camY / -rd.y; vec3 p = rd * tg;
    float bx = p.x - bendK * p.z * p.z * .5;                                // the lanes curve away on a bend
    float lane = bx / 1.22 + 3.5;                                            // lane 4 under us
    vec3 surf = vec3(.55, .16, .1) * (.75 + .3 * noise(vec2(bx * 20., (cz + p.z) * 20.)));
    float inTrack = step(-.5, lane) * step(lane, 8.5);
    vec3 infield = vec3(.06, .2, .07) * (.7 + .3 * step(.5, fract((cz + p.z) * .1)));
    col = mix(infield, surf, inTrack);
    col = mix(col, vec3(.95), smoothstep(.04 / 1.22, 0., abs(fract(lane + .5) - .5) / 1.22 * 1.22 - .0) * inTrack * step(abs(fract(lane + .5) - .5), .03) * .9);
    float wz = cz + p.z, fin = step(abs(mod(wz, 400.) - 2.), .25);            // the finish line
    col = mix(col, vec3(.95), fin * inTrack * .8);
    col *= .55 + .6 * exp(-tg * .03);                                        // the floodlight falls off with distance
    col = mix(col, sky, 1. - exp(-tg * .012));
  }
  col *= 1. - .3 * smoothstep(.5, 1.2, length(uv));
  col = 1. - exp(-col * 1.5);
  gl_FragColor = vec4(col + dither(t), 1.);
}`;
const HSL = `
vec3 hsl2(vec3 c){ vec3 rgb = clamp(abs(mod(c.x * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); return c.z + c.y * (rgb - .5) * (1. - abs(2. * c.z - 1.)); }
`;
export const trackScene = () => build(HSL + TRACK, moving(6.5, .6, { res: .8 }));
