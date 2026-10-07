// Glass scenes: rain, snow and café steam on a window, drawn with one GPU shader fed by a small drop simulation.
import { W, H, DPR, lowPower } from '../view.js';
import { rand, layer, plain, wipe } from '../util.js';
import { img } from '../assets.js';
import { weather } from '../weather.js';
import { musicLevel, musicPlaying } from '../music.js';
import { addStage, blurCanvas, BGS, bgPending, paintBg, makeSim, glKit, glFailed, dropSprite } from './glass-shared.js';

/* Improved: procedural droplets and runs for density, plus up to 16 simulated drops that merge and wipe real trails */
const FS_IMPROVED = `precision highp float;
uniform sampler2D uSharp, uSoft, uMist, uFog, uBeads;
uniform vec2 uRes; uniform float uT, uRain, uMistAmt, uRunsOn, uBladeOn;
uniform vec3 uTintMul, uTintAdd;
uniform vec4 uBlade[2];
uniform vec4 uRun[24];
uniform vec4 uD[16];
float h21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float pathX(float y, float n){ return .5 + .11 * sin(y * 5.3 + n * 40.) + .045 * sin(y * 13.1 + n * 17.); }
vec3 dots(vec2 p, float t, float density, float seed){
vec2 g = p * density, id = floor(g), f = fract(g) - .5;
float n = h21(id + seed);
vec2 c = (vec2(n, fract(n * 7.13)) - .5) * .5;   // centre within ±.25 and radius ≤ .24, so neighbours never overlap
float life = fract(t * .035 + n * 3.7);
float fade = smoothstep(0., .03, life) * smoothstep(1., .55, life);
float r = (.06 + .18 * fract(n * 31.7)) * fade;
float rs = max(r, 1e-3);
vec2 d = f - c;
float m = smoothstep(rs, rs * .72, length(d)) * step(1. - uRain, fract(n * 91.3)) * step(.001, r);
return vec3(m, d / rs * m);
}
vec4 runs(vec2 p, float cols){
// One run per column, driven from JavaScript (uRun: y, radius, alive, path seed) so runs can be swallowed by bigger drops.
float colW = 1. / cols;
float col = floor(p.x / colW);
float idx = clamp(col + 12., 0., 23.);
vec4 R = vec4(0.);
for (int i = 0; i < 24; i++) { if (float(i) == idx) R = uRun[i]; }   // GLSL ES 1.0 only allows constant or loop indices here
if (R.z <= .001) return vec4(0.);
vec2 f = vec2(fract(p.x / colW), p.y + .5);
float y = R.x, r = R.y, alive = R.z, n2 = R.w;
float dropOn = step(.999, alive);      // once swallowed, the drop vanishes but its trail lingers and fades
vec2 asp = vec2(1., 1. / colW);
vec2 d = (f - vec2(pathX(y, n2), y)) * asp;
float m = smoothstep(r, r * .76, length(d * vec2(1., .88))) * dropOn;
float tx = pathX(f.y, n2), above = f.y - y;
float trail = smoothstep(r * 1.1, r * .2, abs(f.x - tx)) * smoothstep(-.01, .02, above) * smoothstep(.5, 0., above) * alive;
float k = fract(f.y * 30. + n2);
vec2 bd = vec2(f.x - tx, (k - .5) / 30. * asp.y);
float br = .05 * step(.45, fract(floor(f.y * 30. + n2) * 7.3 + n2 * 3.));
float bs = max(br, 1e-3);
float bead = smoothstep(bs, bs * .6, length(bd)) * step(.001, br) * trail * step(.02, above);
float mask = max(m, bead);
vec2 nrm = m > bead ? d / r : bd / bs;
return vec4(mask, nrm * mask, trail);
}
void main(){
vec2 uv = gl_FragCoord.xy / uRes;
vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
float t = uT;
float fogMask = texture2D(uFog, uv).a;
float keep = smoothstep(.25, .85, fogMask);

// One droplet layer and one run layer, so nothing slides over anything else.
vec3 s1 = dots(p, t, 34., 1.);
vec4 r1 = runs(p, 9.) * uRunsOn;
float dk = keep * (1. - smoothstep(0., .4, r1.w)) * (1. - r1.x);   // runs absorb the droplets they cross
// Running drops stay whole when they cross a cleared trail; only the tiny droplets are wiped away.
float pm = max(s1.x * dk, r1.x);
vec2 pn = s1.yz * dk + r1.yz;
float procClear = r1.w * keep;

vec4 b = texture2D(uBeads, uv);
float bm = smoothstep(.5, .62, b.a);
vec2 bn = (b.rg - .5) * 2.; bn.y = -bn.y;

// Simulated drops as metaballs: touching drops pull into one shape.
vec2 fp = gl_FragCoord.xy;
float field = 0.; vec2 grad = vec2(0.); float rr = 0.;
for (int i = 0; i < 16; i++) {
  vec4 d = uD[i];
  if (d.z <= 0.) continue;
  vec2 q = fp - d.xy;
  if (q.y > 0.) q.y /= 1. + d.w;
  float q2 = dot(q, q) + 1.;
  float k = d.z * d.z / q2;
  field += k; grad += -2. * k * q / q2;
  if (k > .25) rr = max(rr, d.z);
}
float sm = smoothstep(.88, 1.12, field);

float mask; vec2 n; float th; vec2 off;
if (sm > .01) {
  mask = sm;
  n = -normalize(grad + 1e-6) * sqrt(clamp(1. / max(field, 1e-3), 0., 1.));
  th = sqrt(clamp(1. - dot(n, n), 0., 1.));
  off = -n * rr * 1.8 / uRes;
} else if (bm > .01) {
  mask = bm; n = bn; th = b.b; off = -n * .012;
} else {
  mask = pm; n = pn; th = sqrt(clamp(1. - dot(n, n), 0., 1.)); off = -n * .04;
}

float cond = mix(.8, 1., smoothstep(.65, 0., uv.y)) * (.92 + .08 * sin(p.x * 3.1 + sin(p.y * 2.3))) * uMistAmt;
float clearAmt = max(procClear * .55, 1. - fogMask);
// Wiped glass is lifted slightly so trails read as clearer, not darker.
vec3 mistC = texture2D(uMist, uv).rgb;
mistC = mistC * uTintMul + uTintAdd;   // steam picks up the room light: warm in the café, green in the greenhouse
vec3 base = mix(texture2D(uSoft, uv).rgb * 1.03 + .015, mistC, clamp(cond * (1. - clearAmt * .85), 0., 1.));
vec3 refr = texture2D(uSharp, clamp(uv + off, 0., 1.)).rgb * mix(.55, 1.35, th) + .04;
vec3 N = normalize(vec3(n, th + .15));
vec3 L = normalize(vec3(-.4, .6, .7));
float spec = pow(max(dot(reflect(-L, N), vec3(0., 0., 1.)), 0.), 18.);
float caustic = smoothstep(.25, .95, -n.y) * smoothstep(0., .45, th) * .4;
float rim = smoothstep(.5, 0., th) * .6;
vec3 col = mix(base, refr * (1. - rim) + spec * 1.3 + caustic * vec3(1., .95, .85), mask);
// Wiper blades: a dark rubber edge with a wet highlight behind it.
for (int i = 0; i < 2; i++) {
  vec4 B = uBlade[i]; vec2 a = B.xy, b = B.zw, ab = b - a;
  float h = clamp(dot(fp - a, ab) / max(dot(ab, ab), 1.), 0., 1.);
  float dist = length(fp - (a + ab * h));
  col *= 1. - uBladeOn * .9 * smoothstep(4.5, 1.5, dist);
  col += uBladeOn * vec3(.12, .13, .16) * smoothstep(12., 4.5, dist) * step(4.5, dist);
}
gl_FragColor = vec4(col, 1.);
}`;
export function rainImprovedScene(opts = {}) {
  // rain: outside the glass, with shader runs and gusts. cafe and greenhouse: condensation inside, slower mist; the café is
  // wiped by a hand now and then, the greenhouse drips from the roof. car: rain on a windscreen with wipers.
  const mode = opts.mode || 'rain', cafe = mode === 'cafe', greenhouse = mode === 'greenhouse', car = mode === 'car', steam = cafe || greenhouse;
  let stage, kit, failed = false, built = false, bg = opts.bg || 'tokyo', sim, fogC, fogG, beadC, beadG;
  let uT, uRes, uRain, uD, uRunU, uMistAmt, uTintMul, uTintAdd, uRunsOn, uBladeOn, uBladeU, rain = .6, gust = 0, nextGust = 20, maxDrops = 16;
  let wipeTimer = rand(40, 90), wiping = 0, wipeX = 0, wipeY = 0, wipeDir = 1;
  let wiperTimer = 6, wiper = 0; const WIPE = 1.5, bladeData = new Float32Array(8);
  const FSc = .25, BS = .5, MAX = 16, packed = new Float32Array(MAX * 4);
  // Shader runs live here so the simulation can see them. Columns are indexed -12..11 around the screen centre.
  const COLS = 9, NCOL = 24, runs = Array.from({ length: NCOL }, () => ({ phase: 'wait', wait: rand(0, 12), ph: 0, rate: .05, y: 1.06, r0: .1, n2: 0, alive: 0 }));
  const runData = new Float32Array(NCOL * 4);
  const pathX = (y, n) => .5 + .11 * Math.sin(y * 5.3 + n * 40) + .045 * Math.sin(y * 13.1 + n * 17);
  function build() {
    let [sharp, g] = layer(W, H); paintBg(g, bg);
    const [soft] = blurCanvas(sharp, BGS[bg].file ? 3 : 2.4);
    const [mist, mg] = blurCanvas(sharp, 14); mg.fillStyle = cafe ? 'rgba(190,170,150,.22)' : greenhouse ? 'rgba(160,190,160,.2)' : 'rgba(150,164,190,.18)'; mg.fillRect(0, 0, W, H);
    kit.tex('uSharp', 0, sharp); kit.tex('uSoft', 1, soft); kit.tex('uMist', 2, mist);
  }
  function spawn(top) {
    if (sim.drops.length >= maxDrops) return;
    if (top) sim.spawn(rand(0, W), rand(-10, H * .3), rand(2.6, 3.4));
    else sim.spawn(rand(0, W), rand(H * .05, H * .9), rand(1.7, 2.2));   // condensation that gathers until it is heavy enough to run
  }
  function stepRuns(dt, level) {
    const colW = 1 / COLS, kmin = Math.max(-12, Math.floor(-W / (2 * H) / colW)), kmax = Math.min(11, Math.floor(W / (2 * H) / colW));
    for (let k = kmin; k <= kmax; k++) {
      const R = runs[k + 12];
      if (R.phase === 'wait') {
        R.wait -= dt;
        if (R.wait <= 0) { R.phase = 'run'; R.ph = 0; R.n2 = Math.random(); R.r0 = .09 + .04 * Math.random(); R.rate = .035 + .03 * Math.random(); R.alive = 1; }
      } else if (R.phase === 'run') {
        R.ph += dt * R.rate * (.8 + .5 * level);
        const e = Math.pow(R.ph, 1.6) + .015 * Math.sin(R.ph * 38 + R.n2 * 9) * R.ph;   // accelerating fall with a slight stick-slip
        R.y = 1.06 - e * 1.14;
        if (R.y < -.08) { R.phase = 'fade'; R.alive = .999; }
      } else if (R.phase === 'fade') {
        R.alive -= dt / 2.5;
        if (R.alive <= 0) { R.alive = 0; R.phase = 'wait'; R.wait = rand(2, 10) / (level * level + .05); }   // heavier rain, shorter gaps
      }
    }
  }
  // A simulated drop that touches a shader run swallows it: the run's trail lingers, the drop grows and lurches on.
  function absorb() {
    const colW = 1 / COLS;
    for (let k = -12; k <= 11; k++) {
      const R = runs[k + 12]; if (R.phase !== 'run') continue;
      const prog = Math.max(0, Math.min(1, 1 - R.y)), rr = R.r0 * (1 + .55 * prog) * colW * H;
      const x = (k + pathX(R.y, R.n2)) * colW * H + W / 2, y = (1 - R.y) * H;
      for (const d of sim.drops) {
        const dx = d.x - x, dy = d.y - y, lim = (d.r + rr) * .9;
        if (dx * dx + dy * dy < lim * lim) {
          R.phase = 'fade'; R.alive = .999;
          d.r = Math.min(sim.maxR, Math.sqrt(d.r * d.r + rr * rr * .5));
          d.pause = 0; d.v = Math.max(d.v, 40) + 30; d.x = (d.x + x) / 2;
          break;
        }
      }
    }
  }
  function packRuns() {
    for (let i = 0; i < NCOL; i++) {
      const R = runs[i], prog = Math.max(0, Math.min(1, 1 - R.y));
      runData[i * 4] = R.y; runData[i * 4 + 1] = R.r0 * (1 + .55 * prog); runData[i * 4 + 2] = R.alive; runData[i * 4 + 3] = R.n2;
    }
  }
  return {
    kind: 'webgl',
    get canvas() { return stage; },
    get bg() { return bg; },
    setBg(k) { bg = k; built = false; if (BGS[k].file) img(BGS[k].file); },
    init() {
      if (!stage) {
        stage = addStage(document.createElement('canvas'));
        try { kit = glKit(stage, FS_IMPROVED); } catch (e) { console.warn(e); }
        if (!kit) { failed = true; return; }
        uT = kit.u('uT'); uRes = kit.u('uRes'); uRain = kit.u('uRain'); uD = kit.u('uD[0]') || kit.u('uD'); uRunU = kit.u('uRun[0]') || kit.u('uRun');
        uMistAmt = kit.u('uMistAmt'); uTintMul = kit.u('uTintMul'); uTintAdd = kit.u('uTintAdd'); uRunsOn = kit.u('uRunsOn');
        uBladeOn = kit.u('uBladeOn'); uBladeU = kit.u('uBlade[0]') || kit.u('uBlade');
      }
      if (failed) return;
      const r = Math.min(DPR, lowPower ? .8 : 1.5); stage.width = Math.round(W * r); stage.height = Math.round(H * r);
      maxDrops = lowPower ? 10 : 16;
      [fogC, fogG] = plain(W * FSc, H * FSc); fogG.fillStyle = '#fff'; fogG.fillRect(0, 0, fogC.width, fogC.height);
      [beadC, beadG] = plain(W * BS, H * BS);
      // Every big drop runs and leaves a trail; still drops are condensation gathering until they are heavy enough to go.
      sim = makeSim(steam
        ? { maxR: 5.2, beadChance: 1, beadGap: [6, 13], moveR: 2.4, speed: 1.2, pauseRate: .6, gather: .004, beadCost: .015, stillGrow: .04 }
        : { maxR: 5.2, beadChance: 1, beadGap: [6, 13], moveR: 2.4, speed: 1.8, pauseRate: .4, gather: .004, beadCost: .015, stillGrow: .03 });
      for (let i = 0; i < 8; i++) spawn(!steam && i < 3);
      built = false; if (BGS[bg].file) img(BGS[bg].file);
    },
    draw(t, dt) {
      if (failed) { glFailed(stage); return; }
      if (!built) { if (bgPending(bg)) return; build(); built = true; }
      const level = steam ? .5 : Math.min(1, weather * ((car ? .95 : .8) + .45 * musicLevel));
      // Mist returns (slowly for steam), old beads evaporate.
      fogG.fillStyle = `rgba(255,255,255,${Math.min(1, dt / (steam ? 26 : 11))})`; fogG.fillRect(0, 0, fogC.width, fogC.height);
      beadG.globalCompositeOperation = 'destination-out'; beadG.fillStyle = `rgba(0,0,0,${Math.min(1, dt / 40)})`;
      beadG.fillRect(0, 0, beadC.width, beadC.height); beadG.globalCompositeOperation = 'source-over';
      if (!steam) {
        // Gusts come more often in heavy weather; the music's loudness also lifts the rain a little.
        nextGust -= dt;
        if (nextGust <= 0) { gust = rand(3, 5); nextGust = rand(25, 45) / (.5 + weather); for (let i = 0; i < 3; i++) spawn(true); }
        if (gust > 0) gust -= dt;
        rain += ((.3 + .65 * level + (gust > 0 ? .2 : 0)) * (lowPower ? .7 : 1) - rain) * Math.min(1, dt * 1.5);
        if (Math.random() < dt * (.05 + .3 * level)) spawn(Math.random() < .4);
        stepRuns(dt, level); absorb();
      } else {
        rain += (.45 - rain) * Math.min(1, dt);
        if (Math.random() < dt * .25) spawn(false);
        if (greenhouse && Math.random() < dt * .4) spawn(true);   // drips from the roof glass
        // Every minute or two a hand wipes an arc through the steam, which slowly fogs back over.
        wipeTimer -= dt;
        if (cafe && wipeTimer <= 0) { wiping = 1.2; wipeTimer = rand(90, 180); wipeX = rand(.3, .7) * W; wipeY = rand(.35, .6) * H; wipeDir = Math.random() < .5 ? 1 : -1; }
        if (wiping > 0) {
          const p0 = 1 - wiping / 1.2; wiping -= dt; const p1 = 1 - Math.max(0, wiping) / 1.2;
          const arc = p => ({ x: wipeX + wipeDir * (p - .5) * W * .55, y: wipeY - Math.sin(p * Math.PI) * H * .12 });
          const q0 = arc(p0), q1 = arc(p1);
          wipe(fogG, FSc, q0.x, q0.y, q1.x, q1.y, 70, .9); wipe(beadG, BS, q0.x, q0.y, q1.x, q1.y, 70, 1);
        }
      }
      sim.step(dt,
        (x0, y0, x1, y1, r) => { wipe(fogG, FSc, x0, y0, x1, y1, r * 2, .25); wipe(fogG, FSc, x0, y0, x1, y1, r * 1.1, .55); wipe(beadG, BS, x0, y0, x1, y1, r * 2, 1); },
        (x, y, r) => { const sz = Math.max(1.4, r * 1.35); beadG.drawImage(dropSprite(), (x - sz) * BS, (y - sz) * BS, sz * 2 * BS, sz * 2 * BS); });
      // Wipers: both blades sweep out and back, clearing mist and beads and taking any drops in their path.
      bladeData.fill(0); let bladeOn = 0;
      if (car) {
        wiperTimer -= dt;
        if (wiper <= 0 && wiperTimer <= 0) { wiper = WIPE; wiperTimer = rand(3, 7) / (.25 + level); }
        if (wiper > 0) {
          wiper -= dt; bladeOn = 1;
          const sweep = Math.sin((1 - Math.max(0, wiper) / WIPE) * Math.PI);   // out, then back
          const len = H * .78, w = Math.max(18, H * .03), k = stage.width / W;
          [W * .28, W * .7].forEach((px, i) => {
            const py = H * 1.04, ang = -Math.PI * .5 + (sweep - .5) * Math.PI * .72;
            const tx = px + Math.cos(ang) * len, ty = py + Math.sin(ang) * len;
            wipe(fogG, FSc, px, py, tx, ty, w, .95); wipe(beadG, BS, px, py, tx, ty, w, 1);
            for (let j = sim.drops.length - 1; j >= 0; j--) {
              const d = sim.drops[j], ax = d.x - px, ay = d.y - py, h = Math.max(0, Math.min(1, (ax * (tx - px) + ay * (ty - py)) / (len * len)));
              if (Math.hypot(ax - (tx - px) * h, ay - (ty - py) * h) < w * .7) sim.drops.splice(j, 1);
            }
            bladeData.set([px * k, (H - py) * k, tx * k, (H - ty) * k], i * 4);
          });
        }
      }
      const sc = stage.width / W;
      packed.fill(0);
      sim.drops.slice(0, MAX).forEach((d, i) => {
        packed[i * 4] = d.x * sc; packed[i * 4 + 1] = (H - d.y) * sc; packed[i * 4 + 2] = d.r * sc; packed[i * 4 + 3] = Math.min(.42, d.moving ? d.v / (d.r * 17 * 1.8) * .42 : 0);
      });
      packRuns();
      const gl = kit.gl;
      gl.uniform1f(uT, t); gl.uniform2f(uRes, stage.width, stage.height); gl.uniform1f(uRain, rain);
      gl.uniform4fv(uD, packed); gl.uniform4fv(uRunU, runData);
      gl.uniform1f(uMistAmt, (musicPlaying ? .8 + .35 * (1 - musicLevel) : 1) * (steam ? 1.15 : 1));   // quiet passages let the mist thicken
      if (cafe) { gl.uniform3f(uTintMul, 1.1, .98, .84); gl.uniform3f(uTintAdd, .07, .035, 0); }
      else if (greenhouse) { gl.uniform3f(uTintMul, .9, 1.06, .9); gl.uniform3f(uTintAdd, .02, .06, .02); }
      else { gl.uniform3f(uTintMul, 1, 1, 1); gl.uniform3f(uTintAdd, 0, 0, 0); }
      gl.uniform1f(uRunsOn, steam ? 0 : 1);
      gl.uniform1f(uBladeOn, bladeOn); gl.uniform4fv(uBladeU, bladeData);
      kit.tex('uFog', 3, fogC); kit.tex('uBeads', 4, beadC);
      kit.draw();
    }
  };
}

/* Snow on glass: falling snow behind the window at three depths, flakes that land and melt into droplets, frost at the edges */
const FS_SNOW = `precision highp float;
uniform sampler2D uSharp, uSoft, uMist;
uniform vec2 uRes; uniform float uT, uSnow, uMistAmt, uPile, uFogAmt;
varying vec2 vUv;
float h21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float flakes(vec2 p, float t, float density, float speed, float size, float soft, float seed){
vec2 g = p * density; g.y += t * speed;
g.x += sin(t * .6 + floor(g.y) * 1.3 + seed) * .18;
vec2 id = floor(g), f = fract(g) - .5;
float n = h21(id + seed);
vec2 c = (vec2(n, fract(n * 7.13)) - .5) * .6;
float r = size * (.6 + .4 * fract(n * 31.7));
return smoothstep(r, r * soft, length(f - c)) * step(1. - uSnow, fract(n * 91.3));
}
vec4 landed(vec2 p, float t, float density, float seed){
vec2 g = p * density, id = floor(g), f = fract(g) - .5;
float n = h21(id + seed);
vec2 c = (vec2(n, fract(n * 7.13)) - .5) * .5;
float life = fract(t * .022 + n * 5.1);
float snowy = smoothstep(0., .04, life) * smoothstep(.55, .38, life);
float watery = smoothstep(.38, .55, life) * smoothstep(1., .82, life);
float r = .08 + .16 * fract(n * 31.7);
vec2 d = f - c; float L = length(d);
float flake = smoothstep(r, r * .45, L) * (.7 + .3 * noise(d * 40. + n * 10.)) * snowy;
float dropR = max(r * .7, 1e-3);
float drop = smoothstep(dropR, dropR * .72, L) * watery;
float on = step(1. - uSnow * 1.1, fract(n * 53.7));
return vec4(flake * on, d / dropR * drop * on, drop * on);
}
void main(){
vec2 uv = gl_FragCoord.xy / uRes;
vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
float t = uT;
vec3 soft = texture2D(uSoft, uv).rgb, mist = texture2D(uMist, uv).rgb;
mist = mist * vec3(.9, .95, 1.05) + vec3(.02, .03, .05);
vec3 col = mix(soft, mist, clamp(uFogAmt * uMistAmt, 0., 1.));
float s1 = flakes(p, t, 14., .4, .025, .2, 1.) * .3;
float s2 = flakes(p + .3, t, 8., .42, .024, .3, 5.) * .5;
float s3 = flakes(p * .8 + .7, t, 5., .47, .024, .15, 9.) * .75;
col += vec3(.9, .93, 1.) * (s1 + s2 + s3) * (1. - uFogAmt * .45);
vec2 e = abs(p) / vec2(uRes.x / uRes.y * .5, .5);
float edge = pow(max(e.x, e.y), 6.);
float frost = smoothstep(.2, 1., edge + noise(p * 18.) * .25) * .85;
col = mix(col, vec3(.86, .9, .96), frost * (.7 + .3 * noise(p * 60.)));
vec4 L1 = landed(p, t, 18., 2.), L2 = landed(p * 1.6 + .4, t * 1.1, 26., 8.);
float white = max(L1.x, L2.x), dm = max(L1.w, L2.w);
vec2 nrm = L1.w > L2.w ? L1.yz : L2.yz;
float th = sqrt(clamp(1. - dot(nrm, nrm), 0., 1.));
vec3 refr = texture2D(uSharp, clamp(uv - nrm * .03, 0., 1.)).rgb * mix(.6, 1.3, th) + .04;
vec3 N = normalize(vec3(nrm, th + .2));
vec3 Ld = normalize(vec3(-.4, .6, .7));
float spec = pow(max(dot(reflect(-Ld, N), vec3(0., 0., 1.)), 0.), 22.);
col = mix(col, refr + spec, dm);
col = mix(col, vec3(.95, .97, 1.), white * .9);
float pileH = (.02 + .03 * noise(vec2(p.x * 9., 1.))) * uPile;
float sill = smoothstep(pileH + .01, pileH - .004, uv.y);
col = mix(col, vec3(.9, .93, .97) * (.9 + .1 * noise(p * 80.)), sill);
gl_FragColor = vec4(col, 1.);
}`;
export function snowScene(opts = {}) {
  let stage, kit, failed = false, built = false, bg = opts.bg || 'toronto', uT, uRes, uSnow, uMistAmt, uPile, uFogAmt, pile = 0;
  function build() {
    let [sharp, g] = layer(W, H); paintBg(g, bg);
    const [soft] = blurCanvas(sharp, BGS[bg].file ? 3 : 2.4);
    const [mist, mg] = blurCanvas(sharp, 14); mg.fillStyle = 'rgba(190,204,228,.2)'; mg.fillRect(0, 0, W, H);
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
        try { kit = glKit(stage, FS_SNOW); } catch (e) { console.warn(e); }
        if (!kit) { failed = true; return; }
        uT = kit.u('uT'); uRes = kit.u('uRes'); uSnow = kit.u('uSnow'); uMistAmt = kit.u('uMistAmt'); uPile = kit.u('uPile'); uFogAmt = kit.u('uFogAmt');
      }
      if (failed) return;
      const r = Math.min(DPR, lowPower ? .8 : 1.5); stage.width = Math.round(W * r); stage.height = Math.round(H * r);
      built = false; if (BGS[bg].file) img(BGS[bg].file);
    },
    draw(t, dt) {
      if (failed) { glFailed(stage); return; }
      if (!built) { if (bgPending(bg)) return; build(); built = true; }
      pile = Math.min(1, pile + dt / 600);   // the sill fills over about ten minutes
      const snow = Math.min(1, weather * (.7 + .4 * musicLevel)) * (lowPower ? .7 : 1);
      const gl = kit.gl;
      gl.uniform1f(uT, t); gl.uniform2f(uRes, stage.width, stage.height); gl.uniform1f(uSnow, snow); gl.uniform1f(uPile, pile);
      gl.uniform1f(uFogAmt, .5); gl.uniform1f(uMistAmt, musicPlaying ? .8 + .35 * (1 - musicLevel) : 1);
      kit.draw();
    }
  };
}
