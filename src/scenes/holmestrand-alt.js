// Holmestrand in other styles, each drawing the same place from holm-geo.js: pixel art, a photographic shader,
// watercolour, layers for looking around, and a travel poster. All follow the clock and the weather.
import { W, H, ctx } from '../view.js';
import { layer, rgb, mix, glow } from '../util.js';
import { daylight, skyMix, twilight } from '../daylight.js';
import { weather } from '../weather.js';
import { seasonName } from '../season.js';
import { drawMoon } from '../moon.js';
import { tilt } from '../tilt.js';
import { geography } from './holm-geo.js';
import { shaderScene } from './trip.js';

const TAU = Math.PI * 2;
function seeded(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
// The light now: daylight (0 night to 1 day), the warm band at dawn and dusk, and how grey the weather is.
const lightNow = () => { const d = daylight(), tw = twilight(); return { d, tw, wx: weather, gold: tw * (1 - weather * .6), night: 1 - d }; };
// A key that changes when the light or weather has moved enough to repaint what is cached.
const lightKey = () => [W, H, Math.round(daylight() * 24), Math.round(weather * 5), seasonName()].join();
const LEAVES = { spring: [[150, 200, 110], [190, 220, 140]], summer: [[60, 110, 60], [90, 140, 70]], autumn: [[214, 128, 40], [190, 70, 34], [230, 180, 60]], winter: [[200, 206, 214], [150, 150, 156]] };

/* 1. Pixel: drawn small with a limited Nordic palette and dithered skies, then scaled up with hard edges. */
const PAL = ['#0b0f1e', '#141b33', '#1f2a4a', '#2d3b63', '#44507a', '#3b2f5c', '#6b4a7a', '#b06a7a', '#e09a78', '#f2c48a', '#ffe2a8',
  '#5d8fc8', '#86b3dc', '#b7d3ea', '#dfe9f2', '#f4f6f8', '#2a2e36', '#3f4550', '#5c6370', '#8a909a', '#c3c7cc', '#eceee8',
  '#1e3a2a', '#2f5a3a', '#4d7d48', '#7da35a', '#6e4a30', '#a8743c', '#d8a858', '#b23e2e', '#7a2a24', '#1d3550', '#2e5272', '#4a7698', '#78a2bf', '#ffd65a']
  .map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
const snap = c => { let best = PAL[0], bd = Infinity; for (const p of PAL) { const d = (p[0] - c[0]) ** 2 * .3 + (p[1] - c[1]) ** 2 * .59 + (p[2] - c[2]) ** 2 * .11; if (d < bd) { bd = d; best = p; } } return best; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
export function holmPixelScene() {
  let c, g, base, bg, key = '', geo, pw = 0, ph = 0, clouds = [], gulls = [], lit = [];
  function bake() {
    const L = lightNow(), port = H > W;
    pw = port ? 160 : 288; ph = Math.round(pw * H / W);
    [c, g] = [document.createElement('canvas'), null]; c.width = pw; c.height = ph; g = c.getContext('2d');
    base = document.createElement('canvas'); base.width = pw; base.height = ph; bg = base.getContext('2d');
    geo = geography(pw, ph);
    const X = u => Math.round(u * pw), Y = v => Math.round(v * ph), px = (x, y, col) => { bg.fillStyle = rgb(col); bg.fillRect(x, y, 1, 1); };
    const rect = (x, y, w, h, col) => { bg.fillStyle = rgb(snap(col)); bg.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
    // The sky: four stops from the top down to the horizon, dithered between the palette's nearest colours.
    const grey = L.wx * .6;
    const stops = [skyMix([10, 14, 32], [56, 50, 96], [92, 142, 200], L.d), skyMix([20, 28, 60], [110, 76, 122], [134, 178, 220], L.d), skyMix([36, 46, 84], [210, 130, 120], [184, 210, 232], L.d), skyMix([46, 56, 96], [244, 190, 130], [222, 233, 242], L.d)]
      .map(s => mix(s, [138, 144, 152].map(v => v * (.3 + .7 * L.d)), grey));
    const hyP = Y(geo.hy);
    for (let y = 0; y < hyP; y++) {
      const t = y / hyP * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(t)), f = t - i, a = snap(stops[i]), b = snap(stops[i + 1]);
      for (let x = 0; x < pw; x++) px(x, y, f > BAYER[(y % 4) * 4 + (x % 4)] ? b : a);
    }
    if (L.night > .6) { const r = seeded(4); for (let k = 0; k < pw * .25; k++) px(Math.floor(r() * pw), Math.floor(r() * hyP * .8), r() < .3 ? [244, 246, 248] : [138, 144, 154]); }
    // The hills across the water, the island, the fjord.
    const hillC = snap(mix(stops[3], skyMix([20, 24, 40], [90, 70, 100], [92, 110, 130], L.d), .55));
    for (let x = 0; x < pw; x++) { const top = Y(geo.hills(x / pw)); rect(x, top, 1, hyP - top + 1, hillC); }
    const water = [skyMix([14, 22, 44], [70, 66, 104], [62, 104, 140], L.d), skyMix([20, 34, 60], [120, 96, 120], [96, 140, 176], L.d)];
    for (let y = hyP; y < Y(geo.shore); y++) { const f = (y - hyP) / (Y(geo.shore) - hyP); for (let x = 0; x < pw; x++) px(x, y, snap(mix(water[1], water[0], clamp(f + (BAYER[(y % 4) * 4 + (x % 4)] - .5) * .25)))); }
    const isl = snap(skyMix([12, 20, 22], [44, 50, 54], [46, 78, 56], L.d));
    for (let x = X(geo.island.x0); x < pw; x++) { const top = Y(geo.island.top(x / pw)); rect(x, top, 1, Y(geo.island.base) - top + 1, isl); }
    // The waterfront: quay, masts, the block of flats, the mole and its trees.
    const sh = Y(geo.shore), dark = snap(skyMix([16, 18, 24], [60, 54, 62], [110, 112, 114], L.d)), treeC = snap(skyMix([10, 18, 14], [40, 50, 40], [56, 92, 58], L.d));
    rect(0, sh - 1, pw, 2, dark);
    for (const m of geo.masts) rect(X(m.x), sh - Y(m.h), 1, Y(m.h), [200, 204, 210]);
    rect(X(geo.block.x), sh - Y(geo.block.h), X(geo.block.w), Y(geo.block.h), skyMix([40, 36, 40], [100, 84, 80], [150, 120, 100], L.d));
    rect(X(geo.mole.x0), Y(geo.mole.y), X(geo.mole.x1 - geo.mole.x0), 1, dark);
    for (const tx of geo.mole.trees) rect(X(tx) - 1, Y(geo.mole.y) - 3, 3, 3, treeC);
    // The slope and the houses, row by row from the waterfront down; windows lit after dark.
    const slope = [skyMix([12, 18, 16], [60, 66, 52], [92, 122, 70], L.d), skyMix([8, 12, 10], [40, 46, 36], [70, 100, 56], L.d)];
    for (let y = sh + 1; y < ph; y++) { const f = (y - sh) / (ph - sh); for (let x = 0; x < pw; x++) px(x, y, snap(mix(slope[0], slope[1], clamp(f + (BAYER[(y % 4) * 4 + (x % 4)] - .5) * .3)))); }
    const shade = c2 => mix(c2, [20, 24, 40], .75 * L.night);
    lit = [];
    geo.rows.forEach((row, k) => {
      for (const t2 of row.tree) { const s = Math.max(2, Y(t2.s) * .9); rect(X(t2.x) - s / 2, Y(row.y) - s, s, s, mix(treeC, [30, 60, 30], .2)); }
      for (const hs of row.houses) {
        const x = X(hs.x), w = Math.max(3, X(hs.w)), hh = Math.max(2, Y(hs.h)), y = Y(row.y) - hh;
        rect(x, y, w, hh, shade(hs.col));
        const roofH = Math.max(1, Math.round(w * (hs.gable ? .35 : .18)));
        for (let i = 0; i < roofH; i++) { const inset = hs.gable ? roofH - 1 - i : 0; rect(x - 1 + inset, y - roofH + i, w + 2 - inset * 2, 1, shade(hs.roof)); }   // narrow at the ridge
        if (w >= 5) for (let i = 0; i < hs.win; i++) { const wx2 = x + 1 + Math.round(i * (w - 2) / hs.win), wy2 = y + Math.round(hh * .3); if (wx2 < x + w - 1) { rect(wx2, wy2, 1, Math.max(1, Math.round(hh * .25)), [40, 50, 70]); if (hs.lit > .45) lit.push([wx2, wy2, Math.max(1, Math.round(hh * .25)), hs.lit]); } }
      }
      if (k === geo.church.row) { const x = X(geo.church.x), y = Y(row.y), w = Math.max(5, X(row.size * 1.6)); rect(x, y - w * .8, w * 1.4, w * .8, shade([244, 244, 238])); rect(x + 1, y - w * 1.6, w * .45, w * .8, shade([244, 244, 238])); for (let i = 0; i < 4; i++) rect(x + 1 + w * .225 - i * .5 - .5, y - w * 1.6 - (4 - i), 1 + i, 1, [60, 64, 70]); }
    });
    // The guardrail and an autumn (or the season's) tree framing the right side.
    const leaf = LEAVES[seasonName()].map(c2 => snap(mix(c2, [20, 24, 40], .7 * L.night)));
    rect(0, ph - Y(.08), pw, 1, [200, 204, 210]); for (let x = 4; x < pw; x += 22) rect(x, ph - Y(.08), 1, Y(.08), [170, 176, 184]);
    const r = seeded(9), cx = pw * .95, cy = ph * .62;
    rect(cx - 1, cy, 2, ph - cy, [70, 56, 46]); rect(cx - 6, cy + 6, 6, 1, [70, 56, 46]);
    for (let k = 0; k < 26; k++) { const a = r() * TAU, d = Math.sqrt(r()) * pw * .07, x = cx + Math.cos(a) * d * 1.2, y = cy - pw * .02 + Math.sin(a) * d * .8, s2 = 3 + Math.round(r() * 3); rect(x - s2 / 2, y - s2 / 2, s2, s2, leaf[k % leaf.length]); }
    for (let k = 0; k < 90; k++) { const a = r() * TAU, d = Math.sqrt(r()) * pw * .085; px(Math.round(cx + Math.cos(a) * d * 1.2), Math.round(cy - pw * .02 + Math.sin(a) * d * .8), leaf[k % leaf.length]); }
    clouds = Array.from({ length: 5 + Math.round(L.wx * 6) }, () => ({ x: r() * pw, y: r() * hyP * .6, w: 14 + r() * 30, v: 1 + r() * 2 }));
    gulls = L.d > .3 ? Array.from({ length: 3 }, () => ({ x: r() * pw, y: hyP * (.4 + r() * .4), v: 3 + r() * 4, p: r() * 6 })) : [];
  }
  return {
    init() { key = ''; },
    draw(t, dt) {
      const k = lightKey(); if (k !== key) { key = k; bake(); }
      const L = lightNow();
      g.drawImage(base, 0, 0);
      const hyP = Math.round(geo.hy * ph), sh = Math.round(geo.shore * ph), sx = Math.round(geo.sunX * pw);
      // The sun (or moon), low over the island at dawn and dusk, and its path of glints on the water.
      const sy = Math.round(hyP * (.25 + .6 * (1 - L.d)) - 6);
      if (L.d > .25 && L.wx < .85) { g.fillStyle = L.gold > .3 ? '#ffd65a' : '#f4f6f8'; g.fillRect(sx - 3, sy - 2, 7, 5); g.fillRect(sx - 2, sy - 3, 5, 7); }
      else if (L.night > .6) { const my = Math.round(hyP * .25); g.fillStyle = '#eceee8'; g.fillRect(sx - 2, my - 3, 5, 7); g.fillRect(sx - 3, my - 2, 7, 5); g.fillStyle = '#c3c7cc'; g.fillRect(sx, my - 1, 2, 2); }
      g.fillStyle = L.night > .6 ? '#c3c7cc' : L.gold > .3 ? '#ffe2a8' : '#dfe9f2';
      for (let y = hyP + 1; y < sh - 1; y++) for (let k2 = 0; k2 < 2; k2++) { const x = sx + Math.round((Math.sin(y * 3.1 + t * 2 + k2 * 2) + Math.sin(y * 1.3 - t * 1.2)) * (2 + (y - hyP) * .25)); if (Math.sin(y * 7 + t * 5 + k2) > .2) g.fillRect(x, y, 2 + (k2 ? 0 : 1), 1); }
      // Shimmer across the rest of the fjord.
      g.fillStyle = 'rgba(223,233,242,.35)';
      for (let k2 = 0; k2 < 26; k2++) { const y = hyP + 2 + ((k2 * 7) % Math.max(1, sh - hyP - 3)), x = (k2 * 37 + t * (4 + k2 % 3)) % pw; g.fillRect(Math.round(x), y, 3, 1); }
      // Clouds drifting, blocky.
      for (const cl of clouds) {
        cl.x += cl.v * dt; if (cl.x > pw + cl.w) cl.x = -cl.w;
        g.fillStyle = L.night > .6 ? 'rgba(68,80,122,.8)' : L.gold > .3 ? 'rgba(242,196,138,.85)' : 'rgba(244,246,248,.9)';
        const x = Math.round(cl.x), y = Math.round(cl.y), w = Math.round(cl.w);
        g.fillRect(x, y, w, 3); g.fillRect(x + 3, y - 2, w - 8, 2); g.fillRect(x + w * .3, y - 4, w * .3, 2);
      }
      for (const gl of gulls) { gl.x += gl.v * dt; if (gl.x > pw + 4) gl.x = -4; const x = Math.round(gl.x), y = Math.round(gl.y + Math.sin(t + gl.p) * 2), f = Math.sin(t * 6 + gl.p) > 0; g.fillStyle = '#2a2e36'; g.fillRect(x - 2, y - (f ? 1 : 0), 2, 1); g.fillRect(x + 1, y - (f ? 1 : 0), 2, 1); g.fillRect(x, y, 1, 1); }
      // Windows coming on after dark, one or two flickering as people move about.
      if (L.night > .35) for (const [x, y, hgt, v] of lit) { if (v > .5 + .45 * (1 - L.night) && Math.sin(t * .3 + v * 40) > -.95) { g.fillStyle = '#ffd65a'; g.fillRect(x, y, 1, hgt); } }
      ctx.imageSmoothingEnabled = false; ctx.drawImage(c, 0, 0, W, H); ctx.imageSmoothingEnabled = true;
    },
  };
}

/* 2. Photographic: a shader. A deck of cloud lit from below near the sun, aerial haze on the hills, the fjord's waves
   in perspective reflecting the sky and the hills (more toward the horizon), a path of glitter under the sun, the
   town below a little out of focus with its windows lit after dark, then a filmic tone curve, a vignette and grain.
   uA daylight, uB weather, uC the warm dawn and dusk light. */
const PHOTO = `
float hillTop(float x, float yH){
  float h = .006 + .045 * exp(-pow((x - .08) / .22, 2.)) + .03 * exp(-pow((x - .3) / .18, 2.)) + .022 * exp(-pow((x - .5) / .2, 2.))
    + .03 * exp(-pow((x - .72) / .16, 2.)) + .02 * exp(-pow((x - .95) / .2, 2.));
  return yH + h + .005 * (fbm(vec2(x * 30., 1.)) - .5);
}
float islandTop(float x, float yH){
  float k = clamp((x - .64) / .4, 0., 1.), rise = x < .7 ? clamp((x - .64) / .06, 0., 1.) : 1.;
  return yH - .022 + .03 * pow(sin(k * PI), .6) * rise + .004 * (fbm(vec2(x * 90., 3.)) - .5);
}
vec3 seasonLeaf(float day, float gold){
  vec3 c = uLively > 2.5 ? vec3(.55, .56, .58) : uLively > 1.5 ? vec3(.62, .32, .1) : uLively > .5 ? vec3(.16, .3, .12) : vec3(.3, .46, .18);
  return c * (.18 + .82 * day) * (1. + gold * .3);
}
// Tree crowns seen from above: round canopies scattered on a grid, each lit on the sun's side, in the season's mix of
// colours. Returns the colour, and in .w how much of a crown covers this point (0 none).
vec4 canopy(vec2 q, float day, float gold, float dens){
  vec2 c = floor(q); float best = 0.; vec3 col = vec3(0.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = c + vec2(float(i), float(j)), o = vec2(h21(g), h21(g + 7.3)), ctr = g + .2 + .6 * o;
    float r = .35 + .35 * h21(g + 3.1), d = length(q - ctr) / r + .22 * (noise((q - ctr) * 7. + g) - .5);   // lumpy edges
    float here = step(h21(g + 11.) , dens) * smoothstep(1., .82, d);
    if (here > best) {
      best = here;
      float z = sqrt(max(0., 1. - d * d)), lit = .45 + .55 * clamp(dot(normalize(vec3(q - ctr, z * .8)), normalize(vec3(.5, .6, .7))), 0., 1.);
      float pick = h21(g + 5.7);
      vec3 leaf = uLively > 2.5 ? mix(vec3(.42, .36, .3), vec3(.86, .88, .9), step(.5, pick))
        : uLively > 1.5 ? (pick < .35 ? vec3(.8, .42, .1) : pick < .6 ? vec3(.86, .66, .16) : pick < .8 ? vec3(.62, .18, .08) : vec3(.22, .36, .14))
        : uLively > .5 ? mix(vec3(.12, .26, .1), vec3(.22, .38, .14), pick) : mix(vec3(.3, .48, .18), vec3(.5, .62, .26), pick);
      leaf = mix(leaf, vec3(dot(leaf, vec3(.33))), .3);   // muted, as leaves are seen at a distance
      col = leaf * lit * lit * (.75 + .5 * noise(q * 14.)) * (.16 + .84 * day) * (1. + gold * .35);
    }
  }
  return vec4(col, best);
}
vec3 skyCol(vec2 p, float yH, vec2 sun, float day, float gold, float wx){
  float h = clamp((p.y - yH) / (1. - yH), 0., 1.);
  vec3 zen = mix(vec3(.02, .03, .07), vec3(.18, .36, .66), day), hor = mix(vec3(.06, .08, .14), vec3(.66, .76, .86), day);
  hor = mix(hor, vec3(1., .62, .36), gold * .8); zen = mix(zen, vec3(.32, .26, .46), gold * .5);
  vec3 c = mix(hor, zen, pow(h, .6));
  float sd = length((p - sun) * vec2(uRes.x / uRes.y, 1.));
  c += vec3(1., .78, .52) * (exp(-sd * 9.) * .5 + exp(-sd * 60.) * 2.) * (.3 + .7 * day) * (1. - wx * .7) * step(.2, day);
  // The cloud deck: warped noise, dark bellies, bright where the sun reaches under it.
  vec2 q = vec2(p.x * uRes.x / uRes.y * 1.6 + uT * .004, (p.y - yH) * 4.);
  float warp = fbm(q * .8 + uT * .002);
  float d = smoothstep(.42 - wx * .25, .85, fbm(q * 1.4 + warp * 1.6)) * smoothstep(0., .25, h);
  vec3 cloud = mix(vec3(.05, .06, .09), vec3(.78, .8, .84), day) * (.55 + .45 * fbm(q * 3. + 4.));
  cloud = mix(cloud, vec3(1., .66, .42) * (.6 + .4 * day), gold * exp(-sd * 2.5) * (1. - h * .8));
  cloud *= 1. - .35 * smoothstep(.5, 1., fbm(q * 2.2 + 9.));   // bellies
  return mix(c, cloud, d * (.75 + .25 * wx));
}
void main(){
  vec2 p = gl_FragCoord.xy / uRes; float ar = uRes.x / uRes.y; bool port = ar < 1.;
  float day = uA, wx = uB, gold = uC, t = uT;
  float yH = 1. - (port ? .36 : .43), shoreY = 1. - (port ? .58 : .63);
  vec2 sun = vec2(port ? .62 : .7, yH + .05 + .38 * smoothstep(.25, 1., day));
  vec3 haze = mix(vec3(.08, .1, .16), vec3(.7, .76, .84), day); haze = mix(haze, vec3(.95, .66, .48), gold * .6);
  vec3 col;
  float hT = hillTop(p.x, yH), iT = islandTop(p.x, yH);
  if (p.y > hT) col = skyCol(p, yH, sun, day, gold, wx);
  else if (p.y > yH) {   // the hills across the water, blue with distance
    vec3 hill = mix(vec3(.02, .03, .04), vec3(.2, .27, .26), day) * (.8 + .4 * fbm(p * vec2(80., 200.)));
    col = mix(hill, haze, .35 + .25 * clamp((p.y - yH) / .05, 0., 1.));
  } else if (p.y > shoreY) {   // the fjord
    float depth = (yH - p.y) / (yH - shoreY);           // 0 at the horizon, 1 at the near shore
    float z = 1. / (depth + .04);
    vec2 wq = vec2(p.x * ar * z * 1.5, z * 2.) + vec2(t * .05, t * .1);
    float n1 = fbm(wq * 2.), n2 = fbm(wq * 2. + vec2(1.7, 9.2));
    vec2 nrm = vec2(n1 - .5, n2 - .5) * (.6 + wx * .8);
    float ry = yH + (yH - p.y) + nrm.y * .08 * (1. - depth * .5);   // the mirror of this point, broken by the waves
    vec2 rp = vec2(p.x + nrm.x * .02, ry);
    vec3 refl = rp.y > hillTop(rp.x, yH) ? skyCol(rp, yH, sun, day, gold, wx) : mix(mix(vec3(.02, .03, .04), vec3(.2, .27, .26), day), haze, .6);
    vec3 deep = mix(vec3(.01, .02, .04), vec3(.05, .14, .18), day);
    float fres = .25 + .7 * pow(1. - depth, 2.);
    col = mix(deep, refl, fres);
    // The sun's (or moon's) glitter: a column under it, sparkling with the waves.
    float sx = abs(p.x - sun.x) * ar / (.03 + .12 * depth);
    float sparkle = pow(max(0., n1 * n2 * 4. - .4), 3.) * exp(-sx * sx);
    vec3 glitC = day > .2 ? mix(vec3(1., .95, .85), vec3(1., .72, .42), gold) : vec3(.6, .66, .8) * .5;
    col += glitC * sparkle * (1.5 - wx) * 1.4;
    if (p.y < iT && p.y > yH - .03 && p.x > .64) {   // the island on the water: dark trees, a little lit along the top
      vec3 isl = mix(vec3(.01, .02, .02), vec3(.08, .16, .1), day) * (.7 + .6 * fbm(p * vec2(300., 120.)));
      col = mix(isl, haze, .3);
    }
  } else {   // the shore and the town on the slope, a little soft
    float v = (shoreY - p.y) / shoreY;                    // 0 at the waterfront, 1 at the bottom
    vec3 ground = mix(vec3(.01, .02, .015), vec3(.16, .2, .11), day) * (.7 + .5 * fbm(p * vec2(60., 40.)));
    col = ground;
    // Rows of houses down the slope, near ones larger; each row's houses can rise over the row behind, so the nearer
    // row is looked at first. Each house: a lit front, a shaded side, a roof, windows; edges softer toward the viewer.
    float rows = port ? 11. : 9.;
    float lightK = .22 + .78 * day;
    bool hit = false;
    for (int k = 1; k >= 0; k--) {
      if (!hit) {
      float rv = pow(v, 1. / 1.2) * rows, row = floor(rv) + float(k), fr = fract(rv) - float(k);   // fr: 0 at this row's top line, 1 at its base
      float size = .04 + .08 * (row / rows), blur = .02 + .12 * (row / rows);
      float cx = p.x / (size * 1.5) + row * 3.7, cell = floor(cx), fx = fract(cx) * 1.5 - .25 * h21(vec2(cell, row + 17.));   // irregular spacing
      float hsh = h21(vec2(cell, row)), w = .62 + .33 * hsh, hgt = .75 + .55 * h21(vec2(cell, row + 7.)), side = .18 + .1 * h21(vec2(cell, row + 9.));
      float exists = step(.15, h21(vec2(cell, row + 3.))) * step(row, rows);   // a few gaps, and nothing past the last row
      float wallTop = 1. - hgt * .38, roofTop = wallTop - hgt * .62;   // seen from above: more roof than wall
      float inX = smoothstep(0., blur * .3, fx) * smoothstep(w, w - blur * .3, fx);
      float gx = abs(fx / w - .5) * 2.;
      float roofEdge = roofTop + gx * hgt * .3;
      if (exists > .5 && fr > roofEdge && fr < 1. && inX > .5) {
        hit = true;
        vec3 wall = mix(mix(vec3(.93, .91, .86), vec3(.84, .64, .34), step(.62, hsh)), vec3(.66, .22, .16), step(.86, hsh));
        wall = mix(wall, vec3(.56, .6, .64), step(.46, hsh) * step(hsh, .62));
        vec3 roof = mix(vec3(.15, .16, .19), vec3(.42, .18, .13), step(.72, h21(vec2(cell, row + 11.))));
        float sunSide = step(.5, h21(vec2(cell, row + 13.)));
        if (fr < wallTop) col = roof * lightK * (.8 + .4 * (fr - roofEdge) / max(.01, wallTop - roofEdge));
        else {
          bool isSide = fx / w > 1. - side;
          col = wall * lightK * (isSide ? .62 : 1.) * (.9 + .1 * (1. - fr));
          float wyc = (fr - wallTop) / (1. - wallTop), wxc = fract((fx / w) * (isSide ? 2. : 3. + floor(hsh * 2.)));
          if (wxc > .32 && wxc < .68 && wyc > .22 && wyc < .58) {
            bool on = h21(vec2(cell * 5. + floor((fx / w) * 5.), row)) > .3;
            col = on && day < .62 ? vec3(1., .76, .42) * (1.25 - day) : mix(vec3(.08, .1, .14), haze * .5, .2) * lightK + vec3(.1) * day;
          }
        }
        col = mix(col, ground, smoothstep(.5, 0., inX) );
      }
      }
    }
    // Trees among the houses.
    vec4 cn = canopy(vec2(p.x * ar, p.y) * 19., day, gold, .62 + .25 * fbm(p * 5.));   // one scale: varying it with height would shear the crowns
    if (!hit) col = mix(col, cn.rgb, cn.w);
    else col = mix(col, cn.rgb, cn.w * step(.56, fbm(p * 9.)));   // and in front of some houses
    // The waterfront: a quay line, the marina's masts, the block of flats.
    float qd = (shoreY - p.y);
    if (qd < .006) col = mix(vec3(.03), vec3(.42, .42, .4), day);
    if (p.x > .04 && p.x < .26 && p.y > shoreY - .002 && p.y < shoreY + .04) {
      float m = fract(p.x / .012); if (m < .08 && p.y < shoreY + .02 + .02 * h21(vec2(floor(p.x / .012), 1.))) col = mix(vec3(.2), vec3(.86), day);
    }
    col = mix(col, haze, .12 * (1. - v));   // a little air between us and the waterfront
  }
  if (p.y > shoreY && p.y < shoreY + .045 && p.x > .2 && p.x < .27) {   // the block of flats on the quay
    vec3 b = mix(vec3(.04), vec3(.5, .42, .36), day);
    vec2 g = fract(vec2(p.x * 300., p.y * 260.));
    if (g.x > .3 && g.y > .4) b = day < .5 && h21(floor(vec2(p.x * 300., p.y * 260.))) > .5 ? vec3(1., .8, .45) : b * .6;
    col = b;
  }
  if (p.y > shoreY - .002 && p.y < shoreY + .006 && p.x > .3 && p.x < .5) {   // the mole and its trees
    col = mix(vec3(.02), vec3(.3, .32, .3), day);
    if (p.y > shoreY + .001 && fract(p.x / .016) < .55) col = mix(vec3(.01, .02, .01), vec3(.1, .2, .1), day);
  }
  // Out-of-focus leaves in the near corners, soft discs with brighter rims, as a lens sees them.
  for (int i = 0; i < 7; i++) {
    float fi = float(i); vec2 c = vec2(fi < 4. ? -.02 + fi * .045 : .94 + (fi - 4.) * .04, -.02 + .12 * h21(vec2(fi, 2.)));
    c += vec2(sin(t * .3 + fi), cos(t * .25 + fi * 2.)) * .004;
    float r = .045 + .03 * h21(vec2(fi, 5.)), d = length((p - c) * vec2(ar, 1.));
    float disc = smoothstep(r, r * .85, d), rim = smoothstep(r * .7, r * .95, d) * disc;
    col = mix(col, seasonLeaf(day, gold) * 1.3 + rim * .15, disc * .55);
  }
  col = col / (1. + col * .9) * 1.6;   // a filmic shoulder
  col *= 1. - .35 * pow(length((p - .5) * vec2(ar, 1.)) * .9, 2.);
  col += (h21(gl_FragCoord.xy + fract(t)) - .5) * .035;
  gl_FragColor = vec4(col, 1.);
}`;
export const holmPhotoScene = () => shaderScene(PHOTO, { res: .9, before(t, dt, gl, u) {
  const L = lightNow(); gl.uniform1f(u.uA, L.d); gl.uniform1f(u.uB, L.wx); gl.uniform1f(u.uC, L.gold);
  gl.uniform1f(u.uLively, ['spring', 'summer', 'autumn', 'winter'].indexOf(seasonName()));   // the season, for the leaves
} });

/* 3. Watercolour: soft washes on textured paper, darker where each wash dried, pigment settling into the paper's grain,
   blooms in the sky, and fine sepia ink for the houses, the masts and the church. A cloud wash drifts slowly; the
   water shimmers in dabs; gulls are ink ticks. The palette follows the clock: warm at dusk, indigo at night. */
export function holmWatercolourScene() {
  let paper, art, clouds, key = '', geo, r = seeded(5), gulls = [];
  const jag = (x, amp, seed) => amp * (Math.sin(x * .07 + seed) * .5 + Math.sin(x * .19 + seed * 2.1) * .3 + Math.sin(x * .47 + seed * .7) * .2);
  // A wash over a region: three slightly different passes, then a darker edge where the pigment gathered as it dried.
  function wash(g, path, col, a, edge = .35) {
    for (let k = 0; k < 3; k++) { g.save(); g.translate((r() - .5) * 3, (r() - .5) * 3); g.globalAlpha = a * (.45 + .2 * k); g.fillStyle = rgb(col); g.fill(path()); g.restore(); }
    g.globalAlpha = a * edge; g.strokeStyle = rgb(col.map(v => v * .7)); g.lineWidth = 1.6; g.stroke(path()); g.globalAlpha = 1;
  }
  const band = (top, bottom, seed, amp = 4) => () => { const p = new Path2D(); p.moveTo(-10, bottom(-10)); for (let x = -10; x <= W + 10; x += 6) p.lineTo(x, top(x) + jag(x, amp, seed)); for (let x = W + 10; x >= -10; x -= 6) p.lineTo(x, bottom(x)); p.closePath(); return p; };
  function bake() {
    const L = lightNow(); r = seeded(5); geo = geography(W, H);
    const X = u => u * W, Y = v => v * H;
    // Paper: warm white with fibres and grain.
    let g; [paper, g] = layer(W, H);
    g.fillStyle = '#f3eee2'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < W * H / 60; k++) { g.fillStyle = `rgba(${r() < .5 ? '120,100,70' : '255,255,250'},${.03 + r() * .05})`; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1); }
    [art, g] = layer(W, H);
    const tint = c => mix(c, L.night > .5 ? [52, 60, 120] : [240, 150, 90], L.night > .5 ? .55 * L.night : .45 * L.gold);
    // The sky: a graded wash, blooms where it was wet.
    const top = tint(skyMix([60, 70, 130], [150, 120, 170], [120, 170, 214], L.d)), low = tint(skyMix([90, 96, 150], [244, 176, 130], [214, 222, 226], L.d));
    { const gr = g.createLinearGradient(0, 0, 0, Y(geo.hy) + 6); gr.addColorStop(0, rgb(top, .6)); gr.addColorStop(1, rgb(low, .55)); g.fillStyle = gr; g.fillRect(0, 0, W, Y(geo.hy) + 6); }
    for (let k = 0; k < 7; k++) {   // blooms: paler patches where water ran back into the drying wash
      const x = r() * W, y = r() * Y(geo.hy) * .8, rr = 40 + r() * 90; g.fillStyle = rgb(mix(low, [255, 255, 255], .5), .14);
      g.beginPath(); for (let a = 0; a <= TAU + .01; a += TAU / 24) { const rad = rr * (.75 + .25 * Math.sin(a * 3 + k) + .1 * r()); g.lineTo(x + Math.cos(a) * rad * 1.5, y + Math.sin(a) * rad * .6); } g.fill();
    }
    // The hills across, the water, the island: each a wash, the far ones paler.
    const hillC = tint(skyMix([60, 64, 100], [150, 120, 140], [130, 150, 170], L.d));
    wash(g, band(x => Y(geo.hills(x / W)), () => Y(geo.hy) + 4, 1, 2), hillC, .55);
    const waterC = tint(skyMix([40, 50, 100], [120, 110, 150], [96, 140, 176], L.d));
    wash(g, band(() => Y(geo.hy), () => Y(geo.shore) + 4, 2, 1), waterC, .45, .2);
    g.strokeStyle = rgb(mix(waterC, [255, 255, 255], .6)); g.globalAlpha = .5; g.lineWidth = 2;
    for (let k = 0; k < 40; k++) { const y = Y(geo.hy) + 6 + r() * (Y(geo.shore) - Y(geo.hy) - 10), x = r() * W, w = 10 + r() * 50; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + (r() - .5)); g.stroke(); }   // the paper left white for the light on the water
    g.globalAlpha = 1;
    const islC = tint(skyMix([30, 40, 50], [80, 80, 70], [70, 110, 80], L.d));
    wash(g, () => { const p = new Path2D(); p.moveTo(X(geo.island.x0), Y(geo.island.base)); for (let u = geo.island.x0; u <= 1.04; u += .005) p.lineTo(X(u), Y(geo.island.top(u)) + jag(X(u), 1.5, 3)); p.lineTo(W + 10, Y(geo.island.base)); p.closePath(); return p; }, islC, .7);
    // The slope: a green wash, then the town in ink and small washes, row by row.
    const slopeC = tint(skyMix([30, 40, 40], [110, 110, 80], [120, 150, 90], L.d));
    wash(g, band(() => Y(geo.shore), () => H + 10, 4, 2), slopeC, .5);
    const ink = L.night > .6 ? 'rgba(30,26,40,.85)' : 'rgba(70,50,36,.8)';
    g.lineWidth = 1; g.strokeStyle = ink;
    for (const m of geo.masts) { g.beginPath(); g.moveTo(X(m.x), Y(geo.shore)); g.lineTo(X(m.x) + (r() - .5), Y(geo.shore) - Y(m.h)); g.stroke(); }
    wash(g, () => { const p = new Path2D(); p.rect(X(geo.block.x), Y(geo.shore) - Y(geo.block.h), X(geo.block.w), Y(geo.block.h)); return p; }, tint([150, 120, 100]), .6);
    g.strokeStyle = ink; g.strokeRect(X(geo.block.x), Y(geo.shore) - Y(geo.block.h), X(geo.block.w), Y(geo.block.h));
    g.beginPath(); g.moveTo(X(geo.mole.x0), Y(geo.mole.y)); g.lineTo(X(geo.mole.x1), Y(geo.mole.y)); g.stroke();
    for (const tx of geo.mole.trees) { g.fillStyle = rgb(tint([70, 100, 60]), .6); g.beginPath(); g.arc(X(tx), Y(geo.mole.y) - 4, 4, 0, TAU); g.fill(); }
    const leaf = LEAVES[seasonName()];
    geo.rows.forEach((row, k) => {
      for (const t2 of row.tree) { if (r() < .4) continue; g.fillStyle = rgb(tint(leaf[Math.floor(r() * leaf.length)]), .3); const s2 = Y(t2.s) * .7; for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(X(t2.x) + (r() - .5) * s2, Y(row.y) - s2 * (.5 + r() * .5), s2 * (.3 + r() * .3), 0, TAU); g.fill(); } }
      for (const hs of row.houses) {
        const x = X(hs.x), w = X(hs.w), h = Y(hs.h), y = Y(row.y) - h, roofH = w * (hs.gable ? .35 : .15);
        g.fillStyle = rgb(tint(hs.col), .55); g.fillRect(x + (r() - .5) * 2, y + (r() - .5) * 2, w, h);
        g.fillStyle = rgb(tint(hs.roof), .6); g.beginPath(); g.moveTo(x - 2, y); if (hs.gable) g.lineTo(x + w / 2, y - roofH); else { g.lineTo(x + 1, y - roofH); g.lineTo(x + w - 1, y - roofH); } g.lineTo(x + w + 2, y); g.closePath(); g.fill();
        g.strokeStyle = ink; g.lineWidth = .8;
        g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y); g.lineTo(x - 2, y); if (hs.gable) g.lineTo(x + w / 2, y - roofH); else { g.lineTo(x + 1, y - roofH); g.lineTo(x + w - 1, y - roofH); } g.lineTo(x + w + 2, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h); g.stroke();
        for (let i = 0; i < hs.win; i++) { const wx2 = x + (i + .5) * w / hs.win - 1.5, wy2 = y + h * .3; if (L.night > .4 && hs.lit > .45) { g.fillStyle = 'rgba(255,200,90,.85)'; g.fillRect(wx2, wy2, 3, h * .3); } else g.strokeRect(wx2, wy2, 3, h * .3); }
      }
      if (k === geo.church.row) { const x = X(geo.church.x), y = Y(row.y), w = X(row.size * 1.1); g.fillStyle = 'rgba(250,248,240,.9)'; g.fillRect(x, y - w * .7, w * 1.4, w * .7); g.fillRect(x + 2, y - w * 1.5, w * .4, w * .8); g.strokeStyle = ink; g.strokeRect(x, y - w * .7, w * 1.4, w * .7); g.beginPath(); g.moveTo(x + 2, y - w * 1.5); g.lineTo(x + 2 + w * .2, y - w * 2.1); g.lineTo(x + 2 + w * .4, y - w * 1.5); g.closePath(); g.stroke(); g.strokeRect(x + 2, y - w * 1.5, w * .4, w * .8); }
    });
    // Granulation: pigment settled in the paper's grain, over everything.
    g.globalCompositeOperation = 'multiply';
    for (let k = 0; k < W * H / 90; k++) { g.fillStyle = `rgba(110,90,70,${.04 + r() * .06})`; g.fillRect(r() * W, r() * H, 1.5, 1.5); }
    g.globalCompositeOperation = 'source-over';
    // A cloud wash to drift: soft grey-blue blots, wider than the screen.
    [clouds, g] = layer(W * 2, Y(geo.hy) * .8);
    const cc = tint(skyMix([70, 76, 110], [200, 150, 150], [230, 232, 236], L.d));
    for (let k = 0; k < 10 + L.wx * 14; k++) { const x = r() * W * 2, y = r() * Y(geo.hy) * .6, rr = 30 + r() * 70; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, rgb(cc, .5)); gr.addColorStop(.7, rgb(cc, .3)); gr.addColorStop(1, rgb(cc.map(v => v * .85), 0)); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rr * 1.8, rr * .6, 0, 0, TAU); g.fill(); }
    gulls = L.d > .3 ? Array.from({ length: 3 }, () => ({ x: r() * W, y: Y(geo.hy) * (.3 + r() * .4), v: 8 + r() * 10, p: r() * 6 })) : [];
  }
  return {
    init() { key = ''; },
    draw(t, dt) {
      const k = lightKey(); if (k !== key) { key = k; bake(); }
      ctx.drawImage(paper, 0, 0, W, H);
      ctx.drawImage(art, 0, 0, W, H);
      const cw = W * 2, off = (t * 4) % cw;
      ctx.globalAlpha = .85; ctx.drawImage(clouds, -off, 0, cw, H * geo.hy * .8); ctx.drawImage(clouds, cw - off, 0, cw, H * geo.hy * .8); ctx.globalAlpha = 1;
      // Dabs of light on the water, coming and going.
      ctx.fillStyle = 'rgba(255,252,240,.6)';
      for (let i = 0; i < 18; i++) { const a = Math.sin(t * .7 + i * 2.3); if (a < .3) continue; const x = W * geo.sunX + Math.sin(i * 7.1) * W * .12, y = H * (geo.hy + (geo.shore - geo.hy) * ((i * .37) % 1)); ctx.globalAlpha = (a - .3) * .9; ctx.fillRect(x, y, 6 + (i % 3) * 4, 1.5); }
      ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(70,50,36,.8)'; ctx.lineWidth = 1.2;
      for (const gl of gulls) { gl.x += gl.v * dt; if (gl.x > W + 10) gl.x = -10; const y = gl.y + Math.sin(t * .5 + gl.p) * 4, f = Math.sin(t * 5 + gl.p) * 2; ctx.beginPath(); ctx.moveTo(gl.x - 6, y - f); ctx.quadraticCurveTo(gl.x - 2, y - 3, gl.x, y); ctx.quadraticCurveTo(gl.x + 2, y - 3, gl.x + 6, y - f); ctx.stroke(); }
    },
  };
}

/* 4. Layers: flat shapes in depth, the far ones fading into the haze, each layer moving with the phone's tilt by its
   depth (tilt.js): the hills hardly at all, every row of houses down the slope a little more, and a branch of the
   season's tree nearest of all. Clouds drift, the water glints, leaves fall past in autumn, windows light after dark. */
export function holmLayersScene() {
  let layers = [], key = '', geo, clouds = [], fall = [], L0;
  const OVX = .06, OVY = .05;
  const mk = () => { const [c, g] = layer(W * (1 + OVX * 2), H * (1 + OVY * 2)); g.translate(W * OVX, H * OVY); return [c, g]; };
  function bake() {
    const L = L0 = lightNow(), r = seeded(21); geo = geography(W, H);
    const X = u => u * W, Y = v => v * H;
    const haze = skyMix([30, 36, 70], [236, 170, 140], [196, 212, 226], L.d);
    const lightC = L.night > .5 ? [80, 90, 140] : L.gold > .3 ? [255, 210, 170] : [255, 252, 245];
    const tone = (col, depth) => mix(col.map((v, i) => v * lightC[i] / 255 * (.3 + .7 * L.d)), haze, Math.pow(1 - depth, 1.3) * .8);
    layers = [];
    const add = (depth, paint, after) => { const [c, g] = mk(); paint(g); layers.push({ c, depth, after }); };
    add(0, g => {   // the sky
      const gr = g.createLinearGradient(0, -H * OVY, 0, Y(geo.hy)); gr.addColorStop(0, rgb(skyMix([8, 12, 32], [70, 60, 120], [80, 140, 210], L.d))); gr.addColorStop(1, rgb(haze));
      g.fillStyle = gr; g.fillRect(-W * OVX, -H * OVY, W * (1 + OVX * 2), H * (1 + OVY * 2));
      if (L.d > .25) { glow(g, X(geo.sunX), Y(geo.hy) * (.35 + .5 * (1 - L.d)), H * .25, L.gold > .3 ? [255, 190, 130] : [255, 250, 230], .45); glow(g, X(geo.sunX), Y(geo.hy) * (.35 + .5 * (1 - L.d)), H * .03, [255, 250, 240], .95); }
      else { for (let k = 0; k < W * H / 3000; k++) { g.fillStyle = `rgba(240,240,255,${.3 + r() * .6})`; g.fillRect(r() * W, r() * Y(geo.hy) * .9, 1.2, 1.2); } drawMoon(g, X(geo.sunX), Y(geo.hy) * .3, Math.min(W, H) * .03, 'rgba(240,236,220,.95)'); }
    }, drawClouds);
    add(.12, g => { g.fillStyle = rgb(tone([50, 70, 80], .12)); g.beginPath(); g.moveTo(-W * OVX, Y(geo.hy) + 2); for (let x = -W * OVX; x <= W * (1 + OVX); x += 4) g.lineTo(x, Y(geo.hills(x / W))); g.lineTo(W * (1 + OVX), Y(geo.hy) + 2); g.fill(); });
    add(.22, g => {   // the fjord and the island
      const gr = g.createLinearGradient(0, Y(geo.hy), 0, Y(geo.shore)); gr.addColorStop(0, rgb(mix(haze, [255, 255, 255], .1))); gr.addColorStop(1, rgb(tone([40, 80, 110], .5)));
      g.fillStyle = gr; g.fillRect(-W * OVX, Y(geo.hy), W * (1 + OVX * 2), Y(geo.shore) - Y(geo.hy) + 4);
      g.fillStyle = rgb(tone([40, 70, 50], .25)); g.beginPath(); g.moveTo(X(geo.island.x0), Y(geo.island.base)); for (let u = geo.island.x0; u <= 1.1; u += .005) g.lineTo(X(u), Y(geo.island.top(u))); g.lineTo(X(1.1), Y(geo.island.base)); g.fill();
      g.globalAlpha = .35; g.scale(1, -1); g.translate(0, -2 * Y(geo.island.base)); g.fill(); g.setTransform(1, 0, 0, 1, W * OVX, H * OVY); g.globalAlpha = 1;   // its reflection
    }, drawGlints);
    add(.32, g => {   // the waterfront
      const dark = tone([60, 60, 66], .32);
      g.fillStyle = rgb(dark); g.fillRect(-W * OVX, Y(geo.shore) - 2, W * (1 + OVX * 2), 4);
      g.strokeStyle = rgb(tone([230, 232, 236], .32)); g.lineWidth = 1; for (const m of geo.masts) { g.beginPath(); g.moveTo(X(m.x), Y(geo.shore)); g.lineTo(X(m.x), Y(geo.shore) - Y(m.h)); g.stroke(); }
      g.fillStyle = rgb(tone([150, 120, 100], .32)); g.fillRect(X(geo.block.x), Y(geo.shore) - Y(geo.block.h), X(geo.block.w), Y(geo.block.h));
      g.fillStyle = rgb(dark); g.fillRect(X(geo.mole.x0), Y(geo.mole.y), X(geo.mole.x1 - geo.mole.x0), 2);
      g.fillStyle = rgb(tone([50, 80, 50], .32)); for (const tx of geo.mole.trees) { g.beginPath(); g.arc(X(tx), Y(geo.mole.y) - 4, 4.5, 0, TAU); g.fill(); }
    });
    const leaf = LEAVES[seasonName()], sunRight = new Date().getHours() < 12;
    geo.rows.forEach((row, k) => {
      const depth = .4 + .5 * k / (geo.rows.length - 1);
      add(depth, g => {
        g.fillStyle = rgb(tone([90, 120, 70], depth)); g.fillRect(-W * OVX, Y(row.y) - Y(row.size) * .4, W * (1 + OVX * 2), H * 1.2);
        for (const t2 of row.tree) { g.fillStyle = rgb(tone(leaf[Math.floor(r() * leaf.length)], depth)); g.beginPath(); g.arc(X(t2.x), Y(row.y) - Y(t2.s) * .7, Y(t2.s) * .7, 0, TAU); g.fill(); }
        for (const hs of row.houses) {
          const x = X(hs.x), w = X(hs.w), h = Y(hs.h), y = Y(row.y) - h, roofH = w * (hs.gable ? .38 : .16), side = w * .22;
          g.fillStyle = rgb(tone(hs.col, depth)); g.fillRect(x, y, w, h);
          g.fillStyle = 'rgba(30,20,40,.25)'; g.fillRect(sunRight ? x : x + w - side, y, side, h);   // the shaded side
          g.fillStyle = rgb(tone(hs.roof, depth)); g.beginPath(); g.moveTo(x - w * .05, y); if (hs.gable) g.lineTo(x + w / 2, y - roofH); else { g.lineTo(x + w * .08, y - roofH); g.lineTo(x + w * .92, y - roofH); } g.lineTo(x + w * 1.05, y); g.fill();
          for (let i = 0; i < hs.win; i++) { const on = L.night > .4 && hs.lit > .45; g.fillStyle = on ? 'rgb(255,206,110)' : rgb(tone([50, 60, 80], depth)); g.fillRect(x + (i + .5) * w / hs.win - w * .05, y + h * .3, w * .1, h * .3); }
        }
        if (k === geo.church.row) { const x = X(geo.church.x), y = Y(row.y), w = X(row.size * 1.2); g.fillStyle = rgb(tone([248, 246, 240], depth)); g.fillRect(x, y - w * .8, w * 1.5, w * .8); g.fillRect(x + w * .1, y - w * 1.6, w * .45, w * .8); g.fillStyle = rgb(tone([60, 64, 70], depth)); g.beginPath(); g.moveTo(x + w * .1, y - w * 1.6); g.lineTo(x + w * .325, y - w * 2.3); g.lineTo(x + w * .55, y - w * 1.6); g.fill(); }
      });
    });
    add(1.15, g => {   // the nearest: a branch of the season's tree over the top right, and the guardrail
      g.strokeStyle = rgb(mix([40, 30, 26], [10, 10, 16], L.night)); g.lineCap = 'round';
      const bx = W * 1.02, by = H * .05;
      for (const [len, ang, wd] of [[.5, 3.5, 10], [.35, 3.0, 7], [.3, 3.9, 6]]) { g.lineWidth = wd; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx - W * len * .4, by + H * .1, bx + Math.cos(ang) * W * len, by + Math.sin(ang) * -H * len * .3 + H * len * .4); g.stroke(); }
      for (let k = 0; k < 70; k++) { const a = r(), x = bx - W * (.05 + .45 * a), y = by + H * (.02 + .25 * r() * a + .1 * a); g.fillStyle = rgb(mix(leaf[k % leaf.length], [20, 20, 30], .7 * L.night)); g.beginPath(); g.ellipse(x, y, 10 + r() * 10, 6 + r() * 6, r() * 3, 0, TAU); g.fill(); }
      g.fillStyle = rgb(mix([190, 196, 204], [40, 44, 60], L.night)); g.fillRect(-W * OVX, H * .93, W * (1 + OVX * 2), 4); for (let x = -W * OVX; x < W * (1 + OVX); x += W * .12) g.fillRect(x, H * .93, 4, H * .1);
    });
    clouds = Array.from({ length: 4 + Math.round(L.wx * 6) }, () => ({ x: r() * W * 1.3, y: Y(geo.hy) * (.1 + .5 * r()), w: W * (.12 + .2 * r()), v: 3 + r() * 5 }));
    fall = seasonName() === 'autumn' ? Array.from({ length: 16 }, () => ({ x: r() * W, y: r() * H, v: 20 + r() * 30, p: r() * 6, c: leaf[Math.floor(r() * leaf.length)] })) : [];
  }
  function drawClouds(t, dt, x0, y0) {
    const col = L0.night > .5 ? [60, 66, 100] : L0.gold > .3 ? [250, 200, 180] : [250, 250, 252];
    for (const c of clouds) {
      c.x -= c.v * dt; if (c.x < -c.w) c.x = W + c.w;
      ctx.fillStyle = rgb(col, .85); ctx.beginPath(); ctx.ellipse(x0 + c.x + W * OVX, y0 + c.y + H * OVY, c.w * .5, c.w * .08, 0, 0, TAU); ctx.ellipse(x0 + c.x + W * OVX + c.w * .1, y0 + c.y + H * OVY - c.w * .05, c.w * .25, c.w * .08, 0, 0, TAU); ctx.fill();
    }
  }
  function drawGlints(t, dt, x0, y0) {
    ctx.fillStyle = L0.night > .5 ? 'rgba(220,226,255,.5)' : 'rgba(255,250,236,.7)';
    for (let i = 0; i < 22; i++) { const a = Math.sin(t * .8 + i * 2.1); if (a < .2) continue; const fy = (i * .37) % 1, x = x0 + W * OVX + W * geo.sunX + Math.sin(i * 5.3 + t * .1) * W * (.02 + .08 * fy), y = y0 + H * OVY + H * (geo.hy + (geo.shore - geo.hy) * fy); ctx.globalAlpha = a; ctx.fillRect(x, y, 8 + fy * 16, 1.5); }
    ctx.globalAlpha = 1;
  }
  return {
    init() { key = ''; },
    draw(t, dt) {
      const k = lightKey(); if (k !== key) { key = k; bake(); }
      const look = tilt(dt);
      for (const l of layers) {
        const x = -W * OVX - look.x * l.depth * W * .045, y = -H * OVY - look.y * l.depth * H * .03;
        ctx.drawImage(l.c, x, y, W * (1 + OVX * 2), H * (1 + OVY * 2));
        if (l.after) l.after(t, dt, x, y);
      }
      for (const f of fall) {
        f.y += f.v * dt; f.x += Math.sin(t + f.p) * 20 * dt - 8 * dt; if (f.y > H + 10) { f.y = -10; f.x = Math.random() * W; }
        ctx.save(); ctx.translate(f.x - look.x * W * .06, f.y); ctx.rotate(t * 2 + f.p); ctx.fillStyle = rgb(f.c); ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.5, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
    },
  };
}

/* 5. Poster: a vintage travel poster. A handful of flat colours that change with the hour, sun rays turning slowly
   behind the island, the fjord in stylised wave lines, the town as bold blocks with hard shadows, a sailboat crossing,
   a printed grain and a cream border. */
export function holmPosterScene() {
  let fore, grain, key = '', geo, P;
  // The poster's inks for the hour: sky, sky light, rays, hills, water, water light, land, ink (outlines and shadows).
  const inks = L => L.night > .55 ? { sky: [24, 32, 64], sky2: [44, 56, 98], ray: [56, 70, 120], hill: [16, 22, 44], water: [20, 40, 70], water2: [70, 96, 140], land: [26, 40, 40], ink: [10, 12, 22], sun: [240, 232, 200], paper: [26, 28, 40] }
    : L.gold > .35 ? { sky: [238, 150, 96], sky2: [250, 206, 140], ray: [246, 182, 112], hill: [110, 64, 90], water: [80, 74, 120], water2: [246, 190, 130], land: [96, 92, 60], ink: [44, 30, 40], sun: [255, 236, 170], paper: [244, 230, 204] }
    : { sky: [236, 226, 196], sky2: [246, 238, 214], ray: [242, 218, 160], hill: [56, 86, 110], water: [38, 110, 130], water2: [190, 226, 222], land: [104, 140, 84], ink: [30, 40, 50], sun: [238, 180, 60], paper: [244, 236, 214] };
  function bake() {
    const L = lightNow(), r = seeded(8); geo = geography(W, H); P = inks(L);
    const X = u => u * W, Y = v => v * H;
    let g; [fore, g] = layer(W, H);
    // The hills, the island and the fjord with its wave lines.
    g.fillStyle = rgb(P.hill); g.beginPath(); g.moveTo(0, Y(geo.hy) + 1); for (let x = 0; x <= W; x += 4) g.lineTo(x, Y(geo.hills(x / W))); g.lineTo(W, Y(geo.hy) + 1); g.fill();
    g.fillStyle = rgb(P.water); g.fillRect(0, Y(geo.hy), W, Y(geo.shore) - Y(geo.hy) + 2);
    g.fillStyle = rgb(mix(P.hill, P.ink, .4)); g.beginPath(); g.moveTo(X(geo.island.x0), Y(geo.island.base)); for (let u = geo.island.x0; u <= 1.05; u += .005) g.lineTo(X(u), Y(geo.island.top(u))); g.lineTo(W, Y(geo.island.base)); g.fill();
    // The land: the slope in two flat greens, the waterfront, the town as bold blocks with hard shadows.
    g.fillStyle = rgb(P.land); g.fillRect(0, Y(geo.shore), W, H);
    g.fillStyle = rgb(mix(P.land, P.ink, .25)); for (let k = 0; k < 5; k++) { const y = Y(geo.shore) + (H - Y(geo.shore)) * (k + .5) / 5; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 20) g.lineTo(x, y + Math.sin(x * .01 + k) * 8); g.lineTo(W, H); g.lineTo(0, H); g.fill(); g.globalAlpha = .5; } g.globalAlpha = 1;
    g.fillStyle = rgb(P.ink); g.fillRect(0, Y(geo.shore) - 2, W, 3);
    g.strokeStyle = rgb(P.sky2); g.lineWidth = 1.5; for (const m of geo.masts) { g.beginPath(); g.moveTo(X(m.x), Y(geo.shore)); g.lineTo(X(m.x), Y(geo.shore) - Y(m.h)); g.stroke(); }
    g.fillStyle = rgb(P.ink); g.fillRect(X(geo.block.x), Y(geo.shore) - Y(geo.block.h), X(geo.block.w), Y(geo.block.h)); g.fillRect(X(geo.mole.x0), Y(geo.mole.y), X(geo.mole.x1 - geo.mole.x0), 3);
    for (const tx of geo.mole.trees) { g.beginPath(); g.arc(X(tx), Y(geo.mole.y) - 4, 5, 0, TAU); g.fill(); }
    const walls = [P.sky2, mix(P.sun, P.sky2, .4), [196, 80, 60], P.sky2, mix(P.water2, P.sky2, .5)].map(c => L.night > .55 ? mix(c, P.sky, .6) : c);
    geo.rows.forEach((row, k) => {
      for (const t2 of row.tree) { if (r() < .5) continue; g.fillStyle = rgb(mix(P.land, P.ink, .45)); g.beginPath(); g.arc(X(t2.x), Y(row.y) - Y(t2.s) * .6, Y(t2.s) * .6, 0, TAU); g.fill(); }
      for (const hs of row.houses) {
        const x = X(hs.x), w = X(hs.w), h = Y(hs.h), y = Y(row.y) - h, roofH = w * (hs.gable ? .45 : .2);
        g.fillStyle = rgb(walls[Math.floor(hs.lit * walls.length) % walls.length]); g.fillRect(x, y, w, h);
        g.fillStyle = rgb(P.ink, .35); g.fillRect(x + w * .72, y, w * .28, h);   // the hard shadow side
        g.fillStyle = rgb(hs.roof[0] > 100 ? [176, 64, 44] : P.ink); g.beginPath(); g.moveTo(x - w * .06, y); if (hs.gable) g.lineTo(x + w / 2, y - roofH); else { g.lineTo(x, y - roofH); g.lineTo(x + w, y - roofH); } g.lineTo(x + w * 1.06, y); g.fill();
        g.fillStyle = L.night > .4 && hs.lit > .45 ? rgb([255, 214, 120]) : rgb(P.ink); for (let i = 0; i < hs.win; i++) g.fillRect(x + (i + .5) * w / hs.win - w * .05, y + h * .32, w * .1, h * .28);
      }
      if (k === geo.church.row) { const x = X(geo.church.x), y = Y(row.y), w = X(row.size * 1.3); g.fillStyle = rgb(P.sky2); g.fillRect(x, y - w * .8, w * 1.5, w * .8); g.fillRect(x + w * .1, y - w * 1.7, w * .45, w * .9); g.fillStyle = rgb(P.ink); g.beginPath(); g.moveTo(x + w * .1, y - w * 1.7); g.lineTo(x + w * .325, y - w * 2.5); g.lineTo(x + w * .55, y - w * 1.7); g.fill(); }
    });
    // Printed grain over all, and the cream border of the sheet.
    [grain, g] = layer(W, H);
    for (let k = 0; k < W * H / 50; k++) { g.fillStyle = `rgba(${r() < .5 ? '0,0,0' : '255,255,255'},${.04 + r() * .05})`; g.fillRect(r() * W, r() * H, 1, 1); }
    const m = Math.min(W, H) * .035; g.fillStyle = rgb(P.paper); g.fillRect(0, 0, W, m); g.fillRect(0, H - m, W, m); g.fillRect(0, 0, m, H); g.fillRect(W - m, 0, m, H);
    g.strokeStyle = rgb(P.ink); g.lineWidth = 2; g.strokeRect(m, m, W - m * 2, H - m * 2);
  }
  return {
    init() { key = ''; },
    draw(t) {
      const k = lightKey(); if (k !== key) { key = k; bake(); }
      const X = u => u * W, Y = v => v * H, sx = X(geo.sunX), sy = Y(geo.hy) - Y(.02);
      const gr = ctx.createLinearGradient(0, 0, 0, Y(geo.hy)); gr.addColorStop(0, rgb(P.sky)); gr.addColorStop(1, rgb(P.sky2)); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, Y(geo.hy) + 2);
      // Sun rays, turning slowly.
      ctx.fillStyle = rgb(P.ray); const n = 18, a0 = t * .01;
      for (let i = 0; i < n; i++) { const a = a0 + i * TAU / n; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * W * 1.5, sy + Math.sin(a) * W * 1.5); ctx.lineTo(sx + Math.cos(a + TAU / n / 2) * W * 1.5, sy + Math.sin(a + TAU / n / 2) * W * 1.5); ctx.fill(); }
      ctx.fillStyle = rgb(P.sun); ctx.beginPath(); ctx.arc(sx, sy, Math.min(W, H) * .07, Math.PI, 0); ctx.fill();
      ctx.drawImage(fore, 0, 0, W, H);
      // The fjord's wave lines, drifting; the sun's path in broken bars.
      ctx.strokeStyle = rgb(P.water2); ctx.lineWidth = 1.5;
      for (let k = 0; k < 9; k++) {
        const y = Y(geo.hy) + (Y(geo.shore) - Y(geo.hy)) * (k + .6) / 9.5, amp = 1 + k * .5, len = 18 + k * 6;
        for (let x = ((t * (6 + k) + k * 37) % (len * 3)) - len * 3; x < W; x += len * 3) { ctx.beginPath(); for (let i = 0; i <= len; i += 3) ctx.lineTo(x + i, y + Math.sin(i / len * TAU) * amp); ctx.stroke(); }
      }
      ctx.fillStyle = rgb(P.sun, .85);
      for (let k = 0; k < 8; k++) { const y = Y(geo.hy) + 4 + k * (Y(geo.shore) - Y(geo.hy) - 8) / 8, w = 30 + k * 10 + Math.sin(t + k) * 6; ctx.fillRect(sx - w / 2, y, w, 2.5); }
      // A sailboat crossing.
      const bx = ((t * 6) % (W * 1.4)) - W * .2, by = Y(geo.hy) + (Y(geo.shore) - Y(geo.hy)) * .45, s = Math.min(W, H) * .03;
      ctx.fillStyle = rgb(P.ink); ctx.beginPath(); ctx.moveTo(bx - s, by); ctx.lineTo(bx + s, by); ctx.lineTo(bx + s * .7, by + s * .3); ctx.lineTo(bx - s * .7, by + s * .3); ctx.fill();
      ctx.fillStyle = rgb(P.sky2); ctx.beginPath(); ctx.moveTo(bx, by - s * 1.6); ctx.lineTo(bx + s * .8, by - s * .1); ctx.lineTo(bx, by - s * .1); ctx.fill();
      ctx.drawImage(grain, 0, 0, W, H);
    },
  };
}
