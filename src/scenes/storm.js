// Supercell: a rotating storm seen from the ground. The cloud deck is ray-marched as a volume: noise wound around a
// lowered wall cloud, turning faster near the centre so it draws itself into spiral bands, lit from above and dark beneath.
// Lightning glows inside the cloud (never a full-screen flash), more often with the bass; the mids quicken the rotation.
import { shaderScene } from './trip.js';
import { bands } from '../music.js';
import { weather } from '../weather.js';
import { lowPower } from '../view.js';

const FS = `
float h31(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1., 0., 0.)), f.x), mix(h31(i + vec3(0., 1., 0.)), h31(i + vec3(1., 1., 0.)), f.x), f.y),
             mix(mix(h31(i + vec3(0., 0., 1.)), h31(i + vec3(1., 0., 1.)), f.x), mix(h31(i + vec3(0., 1., 1.)), h31(i + vec3(1., 1., 1.)), f.x), f.y), f.z);
}
float fbm3(vec3 p, int oct){
  float v = 0., a = .5;
  for (int i = 0; i < 5; i++) { if (i >= oct) break; v += a * n3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= .5; }
  return v;
}
const vec3 C = vec3(.6, 0., 9.);                 // the storm's axis, ahead of the viewer
float baseH(float r){ return 1.15 - .55 * exp(-r * r * .08); }   // the cloud base sags into a wall cloud near the axis
// Cloud density at p. oct trades detail for speed (the light sample uses fewer octaves).
float dens(vec3 p, int oct){
  vec2 rel = p.xz - C.xz;
  float r = length(rel);
  float ang = uT * .045 * (1. + uMid * .6) * 3.2 / (r + 1.4);    // differential rotation: the inside turns faster
  float s = sin(ang), c = cos(ang);
  vec2 rr = vec2(c * rel.x - s * rel.y, s * rel.x + c * rel.y);
  vec3 q = vec3(C.x + rr.x, p.y, C.z + rr.y);
  float bh = baseH(r) + .14 * (n3(q * vec3(.9, .6, .9)) - .5);     // a lumpy, rolling underside
  float shape = smoothstep(bh, bh + .22, p.y) * smoothstep(4.4, 2.6, p.y);
  float arms = .2 * sin(atan(rel.y, rel.x) * 2. - log(r + .6) * 3.6 + uT * .03);    // spiral banding
  vec3 w = q * .55 + vec3(0., -uT * .015, uT * .01);
  w += .55 * vec3(n3(w * .5 + 3.1), 0., n3(w * .5 + 7.7));          // a little warp makes the masses billow
  float n = fbm3(w, oct);
  return max(0., n + arms - .47) * shape * 5.;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  vec3 rd = normalize(vec3(uv.x, uv.y + .25, 1.));   // looking up into the storm; the horizon sits low
  float t = uT;
  // The lightning's place in the cloud for this strike (uB carries a seed), and its brightness now (uA).
  float sd = floor(uB * 97.);
  vec3 lp = C + vec3((fract(sin(sd * 12.9) * 43758.) - .5) * 9., 2. + fract(sin(sd * 7.1) * 9133.) * .9, (fract(sin(sd * 3.7) * 2671.) - .5) * 8.);
  float flash = uA;

  // Sky behind the storm: dark overhead, a pale clearer band low on the horizon where light gets in under the deck.
  float el = rd.y;
  vec3 sky = mix(vec3(.36, .36, .34), vec3(.07, .09, .12), smoothstep(-.02, .3, el));
  sky += vec3(.8, .62, .4) * exp(-abs(el + .004) * 40.) * (.4 + .15 * sin(uv.x * 2.1 + 1.));   // warm light under the storm, uneven
  sky += vec3(.5, .55, .5) * exp(-abs(el - .05) * 25.) * .15;   // a paler band where the deck lifts
  sky += vec3(.7, .75, 1.) * flash * .08 * exp(-length(rd.xy - normalize(lp - vec3(0.)).xy) * 3.);

  vec3 col = sky; float T = 1.;
  if (rd.y > .015) {
    float t0 = .72 / rd.y, t1 = min(4.4 / rd.y, 70.);
    int N = ${'${STEPS}'};
    float dt = (t1 - t0) / float(N);
    float tt = t0 + dt * h31(vec3(gl_FragCoord.xy, t));      // jitter hides banding
    vec3 L = normalize(vec3(-.5, 1., .25));
    vec3 acc = vec3(0.);
    vec3 haze = vec3(.2, .22, .22);
    for (int i = 0; i < 64; i++) {
      if (i >= N || T < .03) break;
      vec3 p = rd * tt;
      float d = dens(p, 4) * smoothstep(70., 40., tt);   // far cloud thins out instead of stopping at a hard edge
      if (d > .001) {
        float sh = exp(-dens(p + L * .35, 3) * 2.8);         // how much light gets down to here from above
        float up = smoothstep(.8, 3.4, p.y);                   // tops are brighter, the underside dark
        float edge = 1. - exp(-d * 2.);                          // thin edges catch more light (a cheap powder term)
        vec3 c = mix(vec3(.06, .07, .085), vec3(.7, .73, .76), sh * (.25 + .75 * up) * (.55 + .45 * edge));
        c += vec3(.05, .08, .06) * (1. - up);                  // a faint green cast under the base, as supercells have
        float bl = baseH(length(p.xz - C.xz));
        c += vec3(.55, .45, .32) * exp(-max(0., p.y - bl) * 7.) * edge * .9;   // low light from the horizon catches only the skin of the base
        c *= .55 + .9 * n3(p * vec3(1.6, 2.4, 1.6) + vec3(0., 0., uT * .02));   // rags and folds in the underside
        c = mix(haze, c, exp(-tt * .032));                     // distance fades the cloud into the haze at the horizon
        c += vec3(.75, .8, 1.) * flash * 5. * exp(-length(p - lp) * .85);   // lit from within by lightning
        float a = 1. - exp(-d * dt * 1.1);
        acc += T * a * c; T *= 1. - a;
      }
      tt += dt;
    }
    col = acc + T * sky;
  }

  // Rain shafts hanging under the storm, between the cloud base and the ground.
  if (el < .12 && el > -.04) {
    float x = uv.x * 2.2 + t * .006;
    float shaft = smoothstep(.45, .85, fbm3(vec3(x * 1.6, 0., t * .01), 3)) * smoothstep(.12, .03, el) * smoothstep(-.03, .02, el);
    float streak = .82 + .18 * n3(vec3(uv.x * 55., uv.y * 4. + t * 1.6, 0.));
    col = mix(col, vec3(.12, .14, .16) + vec3(.6, .65, .8) * flash * .1, shaft * .65 * streak * (.6 + .5 * uLevel));
  }
  // Hills in front, black against the light band, catching a little of the lightning.
  float hill = -.012 + .03 * fbm3(vec3(uv.x * 3.1, 3.1, 0.), 4) + .012 * sin(uv.x * 1.3) + .006 * n3(vec3(uv.x * 40., 1., 0.));   // fields, hedges and trees   // in view angle, like the horizon
  if (el < hill + .01) {
    float k = smoothstep(hill, hill - .004, el);
    // A wheat field running up to the hills, bent flat in waves by the outflow wind, lit by the band of light.
    float depth = clamp((hill - el) * 5., 0., 1.);
    float wave = sin(uv.x * 14. + el * 90. + t * 2.5) * .5 + .5;
    vec3 ground = mix(vec3(.3, .22, .1), vec3(.06, .05, .035), smoothstep(0., .6, depth)) * (.7 + .3 * n3(vec3(uv.x * (20. + depth * 80.), el * 150., 1.)) + .15 * wave * depth);
    ground += vec3(.4, .45, .55) * flash * .08;
    col = mix(col, ground, k);
    // A far farm's lights at the foot of the hills.
    for (int i = 0; i < 4; i++) { float fi = float(i); vec2 lp2 = vec2(.2 + fi * .11, -.016 + .004 * sin(fi)); col += vec3(1., .8, .5) * exp(-length(uv - lp2) * 450.) * .8 * k; }
  }
  col = 1. - exp(-col * 1.5);                                   // gentle tone curve
  col = pow(col, vec3(1.08));
  gl_FragColor = vec4(col, 1.);
}`;

export function supercellScene() {
  // Lightning envelope, driven from here: a strike every several seconds (sooner with the bass and in wild weather),
  // each a quick rise and a slower fade with a second or third flicker, and never more than one every 1.2 s.
  let env = 0, wait = 3, flick = [], seed = .37;
  const build = steps => shaderScene(FS.replace('${STEPS}', String(steps)), {
    speed: 1, res: .7, heavy: true,
    before(t, dt, gl, u) {
      wait -= dt * (1 + bands.bass * 2.5 + weather * .8);
      if (wait <= 0) {
        seed = Math.random(); const n = 1 + Math.floor(Math.random() * 3), at = t;
        flick = Array.from({ length: n }, (_, i) => ({ at: at + i * (.09 + Math.random() * .12), amp: i ? .45 + Math.random() * .4 : 1 }));
        wait = 1.2 + Math.random() * (lowPower ? 9 : 7);
      }
      env = 0;
      for (const f of flick) { const k = t - f.at; if (k >= 0) env = Math.max(env, f.amp * (k < .06 ? k / .06 : Math.exp(-(k - .06) * 6.5))); }
      gl.uniform1f(u.uA, env * (.75 + .25 * bands.bass));
      gl.uniform1f(u.uB, seed);
    }
  });
  return lowPower ? build(28) : build(44);
}
