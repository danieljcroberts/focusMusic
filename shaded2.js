import{_n as e,r as t}from"./music.js";import{c as n,s as r,u as i}from"./app.js";import{r as a,t as o}from"./moon.js";var s=`
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
float fbm3o(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.07 + 11.3; a *= .5; } return v; }
vec3 dmix(vec3 n, vec3 k, vec3 d, float a){ return a < .5 ? mix(n, k, a * 2.) : mix(k, d, (a - .5) * 2.); }
float stars(vec2 p, float t, float day){
  vec2 c = floor(p), f = fract(p) - .5; float h = h21(c);
  float r = length(f - (vec2(h21(c + 3.1), h21(c + 7.7)) - .5) * .6);
  float s = smoothstep(.09, .0, r) * step(.9, h) * (.6 + .4 * sin(t * 2. + h * 40.));
  return s * (1. - smoothstep(0., .4, day));
}
// Distance from p to the segment a-b.
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
float dither(float t){ return (h21(gl_FragCoord.xy + fract(t)) - .5) / 160.; }
`,c=(e,t)=>r(s+e,{res:.75,...t}),l=(e={})=>({before(e,t,r,a){r.uniform1f(a.uA,n()),r.uniform1f(a.uB,i)},...e}),u=`
float dens(vec3 p, int oct){
  float r = length(p.xz - vec2(0., 62.));
  float shape = smoothstep(1.3, 2.6, p.y) * smoothstep(8.5, 5.5, p.y) * smoothstep(26., 8., r);
  float anvil = smoothstep(4.5, 7., p.y) * smoothstep(9.5, 8., p.y) * smoothstep(44., 18., r) * .6;   // the flat top spreads wider
  vec3 w = p * vec3(.13, .18, .13) + vec3(uT * .004, 0., 0.);
  float n = fbm3(w, oct);
  return max(0., n - .38 + .3 * shape + .2 * anvil) * max(shape, anvil) * 5.;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT, flash = uA, wx = uB;
  vec3 rd = normalize(vec3(uv.x, uv.y + .1, 1.));
  float sd = floor(uB * 97.);
  vec3 lp = vec3((fract(sin(sd * 12.9) * 43758.) - .5) * 24., 2.5 + fract(sin(sd * 7.1) * 9133.) * 3., 56. + (fract(sin(sd * 3.7) * 2671.) - .5) * 14.);
  // Night sky with a last band of light low down, stars above; the moon behind the bank now and then.
  vec3 sky = mix(vec3(.1, .11, .17), vec3(.01, .012, .03), smoothstep(-.02, .35, rd.y));
  sky += stars(uv * 150., t, 0.) * vec3(.9, .95, 1.) * smoothstep(.05, .2, rd.y);
  vec3 col = sky;
  float T = 1.;
  if (rd.y > -.005 && rd.y < .45) {
    float t0 = max(34., 1.2 / max(rd.y, .02)), t1 = min(9.8 / max(rd.y, .02), 100.);
    int N = \${STEPS};
    if (t1 > t0) {
      float step_ = (t1 - t0) / float(N), tt = t0 + step_ * h31(vec3(gl_FragCoord.xy, 1.));
      vec3 acc = vec3(0.);
      for (int i = 0; i < 48; i++) {
        if (i >= N || T < .03) break;
        vec3 p = rd * tt;
        float d = dens(p, 4);
        if (d > .001) {
          float up = smoothstep(1.5, 4.5, p.y);
          float sh = exp(-dens(p + vec3(0., .6, 0.), 2) * 2.);
          vec3 c = mix(vec3(.02, .022, .032), vec3(.15, .16, .2), sh * (.15 + .85 * up));
          c += vec3(.75, .8, 1.) * flash * 4. * exp(-length(p - lp) * .16);     // lit from within
          c += vec3(.22, .2, .17) * exp(-abs(p.y - 1.6) * 2.) * (1. - exp(-d)) * .4;   // the base catches the last light
          float a = 1. - exp(-d * step_ * .9);
          acc += T * a * c; T *= 1. - a;
        }
        tt += step_;
      }
      col = acc + T * sky;
    }
  }
  // A glow in the sky around the strike, and sometimes a thin bolt below the base, far away.
  vec2 ls = vec2(lp.x / lp.z, lp.y / lp.z - .1);
  col += vec3(.6, .65, .9) * flash * .35 * exp(-length(uv - ls) * 4.) * T;
  float bolt = step(.5, fract(sd * .37));
  if (bolt > 0. && flash > .2) {
    vec2 a = vec2(ls.x, 1.5 / lp.z - .1), b = vec2(ls.x + .01, -.095);
    float dmin = 1.;
    vec2 q0 = a;
    for (int k = 1; k <= 6; k++) {
      float fk = float(k) / 6.;
      vec2 q1 = mix(a, b, fk) + vec2(h21(vec2(sd, fk)) - .5, 0.) * .025;
      dmin = min(dmin, seg(uv, q0, q1)); q0 = q1;
    }
    col += vec3(.8, .85, 1.) * flash * smoothstep(.004, .0, dmin) * 1.2;
  }
  // Rain curtains under the bank, drifting; a lone tree and a fence line on the plain; the ground.
  float el = uv.y + .1;
  float shaft = smoothstep(.4, .8, fbm3o(vec2(uv.x * 3. + t * .01, 1.))) * smoothstep(.1, .02, el) * smoothstep(-.02, .01, el);
  float streak = .8 + .2 * noise(vec2(uv.x * 60., uv.y * 5. + t * 1.5));
  col = mix(col, vec3(.09, .1, .13) + vec3(.5, .55, .8) * flash * .15, shaft * (.5 + .4 * wx) * streak);
  float hill = -.1 + .006 * noise(vec2(uv.x * 6., 2.)) + .003 * noise(vec2(uv.x * 40., 3.));
  vec3 ground = vec3(.012, .016, .012) + vec3(.3, .33, .45) * flash * .05 * smoothstep(-.5, -.1, uv.y);
  ground *= .8 + .3 * noise(vec2(uv.x * 30., uv.y * 200.));
  // Tree: a trunk and three round masses.
  vec2 tp = vec2(-.33, hill + .005);
  float tree = smoothstep(.006, .003, abs(uv.x - tp.x) - .003) * step(tp.y, uv.y) * step(uv.y, tp.y + .06);
  tree = max(tree, smoothstep(.045, .04, length((uv - tp - vec2(0., .085)) * vec2(1., 1.2))));
  tree = max(tree, smoothstep(.035, .03, length(uv - tp - vec2(-.03, .07))));
  tree = max(tree, smoothstep(.033, .028, length(uv - tp - vec2(.03, .072))));
  // Fence posts and a wire.
  float px = uv.x * 14. + 3.;
  float post = step(.1, uv.x) * smoothstep(.06, .03, abs(fract(px) - .5)) * step(hill - .002, uv.y) * step(uv.y, hill + .016);
  float wire = step(.1, uv.x) * smoothstep(.0015, .0005, abs(uv.y - hill - .012)) * .7;
  col = mix(col, ground, smoothstep(hill + .003, hill - .003, uv.y));
  col = mix(col, vec3(.004, .005, .008), max(max(tree, post), wire));
  col = 1. - exp(-col * 1.6);
  col += dither(t);
  gl_FragColor = vec4(col, 1.);
}`;function d(){let n=0,r=5,a=[],o=.37;return c(u.replace("${STEPS}",String(e?22:36)),{res:.7,heavy:!0,before(s,c,l,u){if(r-=c*(.6+i*1.2+t.bass*.8),r<=0){o=Math.random();let t=1+Math.floor(Math.random()*3);a=Array.from({length:t},(e,t)=>({at:s+t*(.1+Math.random()*.15),amp:t?.4+Math.random()*.4:1})),r=2+Math.random()*(e?14:10)}n=0;for(let e of a){let t=s-e.at;t>=0&&(n=Math.max(n,e.amp*(t<.05?t/.05:Math.exp(-(t-.05)*7))))}l.uniform1f(u.uA,n),l.uniform1f(u.uB,o)}})}var f=`
float rings(vec2 p, float t, float rate){
  float h = 0.;
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float cyc = t * rate * (.6 + .4 * fract(fi * .37)) + fi * .713;
    float age = fract(cyc), id = floor(cyc);
    vec2 c = vec2(h21(vec2(id, fi)) * 7. - 3.5, h21(vec2(fi, id + 3.)) * 6. + .5);   // within the view
    float d = length(p - c), r = age * 2.6;
    h += sin((d - r) * 12.) * exp(-abs(d - r) * 4.) * (1. - age) * (1. - age) * .5 * step(d, r + .5);
  }
  return h;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT, day = uA, wx = uB;
  // Looking down at about 50 degrees; the water is a plane 2 below the eye.
  vec3 rd = normalize(vec3(uv.x, uv.y - .75, 1.));
  float dist = 2. / -rd.y;
  vec3 p = rd * dist;
  vec2 q = p.xz;
  float rate = .4 + .55 * wx;
  float e = .02;
  float h0 = rings(q, t, rate), hx = rings(q + vec2(e, 0.), t, rate), hz = rings(q + vec2(0., e), t, rate);
  vec2 slope = vec2(hx - h0, hz - h0) / e;
  slope += .03 * vec2(noise(q * 2. + t * .2) - .5, noise(q * 2. + 7. - t * .15) - .5) * 2.;   // a breath of wind
  vec3 n = normalize(vec3(-slope.x * .25, 1., -slope.y * .25));
  // The bed: silt, pebbles and weed, seen through the water with a refraction shift.
  vec2 rq = q + slope * .06 - rd.xz * .5;
  float silt = fbm3o(rq * 1.5), peb = noise(rq * 9.), weed = smoothstep(.55, .7, fbm3o(rq * .8 + 3.));
  vec3 bedN = vec3(.05, .07, .05), bedD = vec3(.2, .22, .14);
  vec3 bed = dmix(bedN * .35, bedN * 1.3, bedD, day) * (.7 + .6 * silt) * (.8 + .4 * smoothstep(.6, .75, peb));
  bed = mix(bed, dmix(vec3(.02, .05, .03), vec3(.08, .14, .07), vec3(.12, .3, .12), day), weed * .7);
  float depth = 1.2 + .8 * fbm3o(q * .4 + 9.);
  vec3 water = dmix(vec3(.01, .02, .03), vec3(.03, .05, .07), vec3(.06, .14, .16), day);
  vec3 under = mix(bed, water, 1. - exp(-depth * (.9 - .3 * day)));
  // A fish crossing below, a dark shape with a slow wag.
  float fp = fract(t * .025), side = step(.5, fract(floor(t * .025) * .5));
  vec2 fc = vec2(mix(-7., 7., fp) * (side * 2. - 1.), 1.5 * sin(fp * 6.3) - .5);
  vec2 fr = (q - fc) * vec2(1., 2.5);
  float fish = smoothstep(1.1, .8, length(fr + vec2(.15 * sin(t * 6. + fr.x * 2.) * fr.x, 0.)));
  under = mix(under, under * .3, fish * .8 * exp(-depth * .2));
  // The surface: the sky mirrored by the Fresnel amount, and a moon or sun highlight on the ripples.
  vec3 rr = reflect(rd, n);
  vec3 L = normalize(vec3(-.35, .55, .6));
  float sl = max(dot(rr, L), 0.);
  vec3 skyC = dmix(vec3(.1, .13, .22), vec3(.35, .25, .32), vec3(.55, .65, .78), day) * (.6 + .4 * smoothstep(-.2, .8, rr.y));
  skyC += dmix(vec3(.5, .6, .9), vec3(1., .7, .5), vec3(1., .97, .9), day) * (pow(sl, 6.) * .35 + pow(sl, 60.) * .5 + pow(sl, 600.) * 1.5) * (.6 + .4 * (1. - day));
  float fres = .06 + .94 * pow(1. - max(dot(-rd, n), 0.), 4.);
  vec3 col = mix(under, skyC, clamp(fres * 1.5, 0., 1.));
  // Lily pads: discs on the surface that drift and turn, with a notch and a soft shadow.
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    vec2 c = vec2(h21(vec2(fi, 1.)) * 6. - 3., h21(vec2(fi, 2.)) * 4.5 + 2.) + vec2(sin(t * .05 + fi), cos(t * .04 + fi * 2.)) * .3;   // within the view
    float r = .35 + .3 * h21(vec2(fi, 3.));
    vec2 d = q - c; float ang = atan(d.y, d.x) + t * .02 * (fract(fi * .5) - .25);
    float notch = step(abs(ang - 1.), .25) * step(length(d), r * 1.1);
    float pad = smoothstep(r, r - .04, length(d)) * (1. - notch);
    vec3 padC = dmix(vec3(.025, .05, .03), vec3(.1, .17, .08), vec3(.2, .4, .16), day) * (.8 + .4 * noise(d * 8.)) * (.6 + .4 * smoothstep(-r, r, d.y - d.x * .3));
    padC = mix(padC, padC * 1.3, smoothstep(.03, .0, abs(abs(ang - 1.) - .25) - .01) * step(length(d), r));
    float shadow = smoothstep(r + .25, r, length(d + vec2(.1, .1))) * (1. - notch);
    col = mix(col, col * .55, shadow * .6 * (1. - pad));
    col = mix(col, padC, pad);
    // Every third pad carries a water lily: pointed petals, white to pink, with a gold centre.
    if (mod(fi, 3.) < .5) {
      vec2 fq = d - vec2(r * .15, -r * .1); float fa = atan(fq.y, fq.x) + fi, fl = length(fq);
      float petals = smoothstep(.0, .02, r * .42 * (.55 + .45 * abs(cos(fa * 4.))) - fl);
      vec3 petC = mix(vec3(1., .96, .96), vec3(.95, .55, .7), h21(vec2(fi, 9.)) * (1. - fl / (r * .42))) * (.35 + .65 * day + .2);
      col = mix(col, petC, petals);
      col = mix(col, vec3(1., .78, .25) * (.4 + .6 * day), smoothstep(r * .1, r * .06, fl));
    }
  }
  col = 1. - exp(-col * 1.7);
  col += dither(t);
  gl_FragColor = vec4(col, 1.);
}`,p=()=>c(f,l({res:.8})),m=`
float lights(vec2 p, float scale, float density, float t){
  vec2 g = p * scale; vec2 c = floor(g), f = fract(g) - .5;
  float h = h21(c + 5.);
  float town = smoothstep(.32, .6, noise(vec2(c.x * .06, 3.)));              // lights gather into towns with dark country between
  vec2 o = (vec2(h21(c + 1.1), h21(c + 2.3)) - .5) * .8;
  float d = length(f - o);
  return (smoothstep(.1, .0, d) + exp(-d * 5.) * .18) * step(1. - density * town, h) * (.7 + .3 * sin(t * 2. + h * 50.));
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT;
  float sway = sin(t * 1.7) * .002 + sin(t * .4) * .003;
  vec2 v = uv - vec2(0., sway);
  // Sky and far hills.
  // A moonlit night: a deep blue sky, tonight's moon, and thin cloud drifting past lit from behind.
  vec3 col = mix(vec3(.07, .085, .17), vec3(.012, .016, .04), smoothstep(-.1, .45, v.y));
  float full = 1. - abs(MOONP * 2. - 1.);
  vec2 mp = vec2(.32 - fract(t * .0006) * .05, .27); float md = length(v - mp);
  col += vec3(.35, .4, .6) * exp(-md * 4.) * (.08 + .22 * full);
  col += stars(uv * 170., t, 0.) * vec3(.9, .95, 1.) * smoothstep(.0, .15, v.y);
  float disc = smoothstep(.032, .029, md);
  col = mix(col, vec3(1., .97, .9), disc * moonLit((v - mp) / .031));
  float cl = smoothstep(.5, .78, fbm3o(vec2(v.x * 1.6 + t * .012, v.y * 5. + 3.))) * smoothstep(.02, .2, v.y);
  col = mix(col, vec3(.16, .18, .28) * (.5 + .9 * exp(-md * 3.) * (.4 + .6 * full)), cl * .7);
  float hx = v.x + t * .03;
  float hill = -.02 + .06 * (.5 + .5 * sin(hx * 2.1)) + .04 * noise(vec2(hx * 4., 1.)) + .01 * noise(vec2(hx * 20., 2.));
  col = mix(col, vec3(.022, .026, .05), smoothstep(hill + .003, hill - .003, v.y));
  col += vec3(.12, .14, .22) * smoothstep(.006, .0, abs(v.y - hill + .002)) * (.3 + .7 * full) * .5;   // moonlight along the ridge
  // Town lights on the plain between the hills and the track, warm and the odd cold one, in two bands.
  vec2 lp = vec2(v.x + t * .08, v.y);
  float L1 = lights(lp, 50., .3, t) * smoothstep(-.09, -.05, v.y) * smoothstep(hill, hill - .03, v.y);
  vec2 lp2 = vec2(v.x + t * .16, v.y);
  float L2 = lights(lp2, 26., .3, t) * smoothstep(-.14, -.1, v.y) * smoothstep(-.06, -.09, v.y);
  float cold = step(.7, h21(floor(lp * 50.) + 9.));
  col += mix(vec3(1., .75, .45), vec3(.55, .8, 1.), cold) * L1 * 1.5;
  col += mix(vec3(1., .78, .5), vec3(.6, .8, 1.), step(.7, h21(floor(lp2 * 26.) + 9.))) * L2 * 1.8;
  col += vec3(.5, .35, .5) * exp(-abs(v.y + .06) * 18.) * .08;        // the town's glow on the air
  // A station: a lit platform with lamps and a blue sign, passing for a few seconds every minute or so.
  float cyc = t / 75., ph = fract(cyc);
  float sx = v.x + (ph - .5) * 6.5;                                    // its position slides from right to left
  float len = 2.2;
  float onPlat = step(0., sx) * step(sx, len);
  float platY = -.17;
  float plat = onPlat * step(platY - .03, v.y) * step(v.y, platY);
  col = mix(col, vec3(.14, .13, .11), plat);
  float lampX = fract(sx * 2.5), lampOn = onPlat * step(lampX, .08) * step(.1, sx);
  float lampY = -.05;
  col += vec3(1., .95, .8) * onPlat * smoothstep(.06, .0, length(vec2(fract(sx * 2.5) - .04, v.y - lampY) * vec2(.4, 1.))) * .9;
  col += vec3(1., .9, .7) * onPlat * .12 * smoothstep(lampY + .02, platY, v.y) * smoothstep(platY - .04, lampY, v.y) * (.5 + .5 * cos((fract(sx * 2.5) - .04) * 6.28 * 1.2));
  float sign_ = onPlat * step(abs(sx - len * .5), .1) * step(abs(v.y + .1), .012);
  col = mix(col, vec3(.3, .55, 1.), sign_);
  // The embankment below the window and the ground rushing past.
  float bank = -.24;
  col = mix(col, vec3(.01, .009, .014) * (.6 + .4 * noise(vec2(v.x * 10. + t * 3., v.y * 40.))), smoothstep(bank + .003, bank - .003, v.y));
  // A fence along the track, closer and faster still.
  float fx_ = fract((v.x + t * .9) * 9.);
  float fence = smoothstep(.04, .02, abs(fx_ - .5)) * step(bank - .03, v.y) * step(v.y, bank + .03);
  fence = max(fence, smoothstep(.003, .001, abs(v.y - bank - .02)) * .6);
  col = mix(col, vec3(.006, .005, .008), fence);
  // Poles with cross-arms, close and fast, with a wire sagging between them.
  float px = (v.x + t * .5) * 2.4;
  float pf = fract(px), pole = smoothstep(.015, .008, abs(pf - .5)) * step(-.22, v.y) * step(v.y, .16);
  pole = max(pole, step(abs(pf - .5), .05) * step(abs(v.y - .14), .004));
  float sag = .13 - .035 * (1. - cos(pf * 6.28)) * .5;
  float wire = smoothstep(.0025, .0008, abs(v.y - sag)) * .7;
  col = mix(col, vec3(.004, .004, .006), max(pole, wire));
  // Rain on the glass: drops driven back along the window, and faint reflections of the carriage lamps.
  vec2 rp = vec2(uv.x * 1.2 + uv.y * .25 + t * .3, uv.y * 2.);
  vec2 rc = floor(rp * 7.), rf = fract(rp * 7.) - .5;
  float rh = h21(rc + 1.7);
  vec2 ro = (vec2(h21(rc + 4.), h21(rc + 8.)) - .5) * .6;
  float drop = smoothstep(.12, .05, length((rf - ro) * vec2(1.6, 1.))) * step(.84, rh) * .45;
  float trail = smoothstep(.012, .0, abs(rf.y - ro.y)) * step(.9, rh) * step(ro.x, rf.x) * smoothstep(.5, ro.x, rf.x) * .5;
  col += (drop + trail * .25) * (vec3(.5, .55, .7) * .2 + col * .9);
  for (int i = 0; i < 3; i++) { vec2 lc = vec2(-.45 + .45 * float(i), .3); col += vec3(1., .85, .65) * exp(-length((uv - lc) * vec2(1., 2.)) * 14.) * .06; }
  // The carriage faintly mirrored in the glass: a warm wash low down.
  col += vec3(.08, .055, .03) * smoothstep(-.05, -.33, uv.y);
  // The window frame: a dark top, a sill, and the pillar on the right.
  float x01 = uv.x * uRes.y / uRes.x + .5;
  float frame = step(.4, uv.y) + step(uv.y, -.33) + step(.94, x01);
  vec3 frameC = vec3(.03, .025, .025) * (.8 + .4 * smoothstep(.36, .42, abs(uv.y)));
  col = mix(col, frameC, clamp(frame, 0., 1.));
  col = mix(col, vec3(.08, .07, .06), smoothstep(.004, .0, abs(uv.y + .33)) * .7);
  col = 1. - exp(-col * 1.6);
  col += dither(t);
  gl_FragColor = vec4(col, 1.);
}`,h=()=>c(o(a())+m,{res:.85,speed:1}),g=`
float flame(vec2 p, float t, float bass){
  // p: x across the firebox (-1..1), y up from the grate (0..1).
  float n = fbm3o(vec2(p.x * 3., p.y * 2.2 - t * 2.4)) * .65 + .35 * noise(vec2(p.x * 7. + t * .5, p.y * 4. - t * 4.));
  float tongues = .6 + .4 * sin(p.x * 9. + t * 3. + n * 4.);
  float height = .55 + .25 * tongues + .15 * bass;
  float body = smoothstep(.9, .2, abs(p.x) - .1 * n) * smoothstep(height, height * .2, p.y + (n - .5) * .5);
  return body * (.5 + n);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT, bass = uBass;
  float asp = uRes.x / uRes.y;
  // Layout: the fireplace centred a little right, the window on the left when there is room.
  float fx = asp > 1.2 ? .12 : 0., fw = .3, base = -.3, fh = .34;
  vec2 fp = vec2((uv.x - fx) / fw, (uv.y - base) / fh);         // firebox space
  float f1 = flame(fp, t, bass), f2 = flame(fp * vec2(1.3, 1.) + vec2(.4, .05), t * 1.2 + 3., bass) * .8, f3 = flame(fp * vec2(1.1, 1.) - vec2(.45, .02), t * .9 + 7., bass) * .7;
  float fire = max(f1, max(f2, f3));
  float flick = .8 + .12 * sin(t * 7.3) + .06 * sin(t * 13.1) + .1 * bass;
  float glow = flick * (.6 + .4 * fire);
  // The room: stone surround, a mantel, the hearth floor, lit by the fire.
  vec3 col = vec3(.03, .018, .012);
  vec2 sp = uv - vec2(fx, base);
  float inBox = step(abs(sp.x), fw * 1.05) * step(0., sp.y) * step(sp.y, fh * 1.25 - .1 * (sp.x * sp.x) / (fw * fw));   // an arch
  float surround = step(abs(sp.x), fw * 1.6) * step(-.02, sp.y) * step(sp.y, fh * 1.7);
  vec2 brick = vec2(uv.x * 22. + step(.5, fract(uv.y * 14.)) * .5, uv.y * 14.);
  float mortar = smoothstep(.04, .08, abs(fract(brick.x) - .5)) * smoothstep(.04, .08, abs(fract(brick.y) - .5));
  float stone = .55 + .45 * noise(floor(brick) * 3.1) ;
  vec3 stoneC = vec3(.32, .22, .16) * stone * (.6 + .4 * mortar) * (.5 + .5 * noise(uv * 90.));
  float lit = glow * (1.4 / (1. + 7. * length(sp - vec2(0., .12)))) ;
  vec3 fireL = vec3(1., .55, .25);
  col = mix(col, stoneC * (.15 + lit * fireL * 2.5), surround);
  float mantel = step(abs(sp.x), fw * 1.75) * step(fh * 1.7, sp.y) * step(sp.y, fh * 1.85);
  col = mix(col, vec3(.22, .13, .08) * (.3 + lit * 1.5), mantel);
  // The floor in front, with the firelight on it.
  float floor_ = step(uv.y, base - .02);
  vec3 floorC = vec3(.16, .09, .06) * (.8 + .4 * noise(vec2(uv.x * 40., uv.y * 6.))) * (.2 + lit * 2.) * (.6 + .4 * smoothstep(-.5, -.3, uv.y));
  col = mix(col, floorC, floor_ * (1. - inBox));
  // The firebox: dark, with the back wall lit by the flames.
  vec3 boxC = vec3(.02, .01, .008) + fireL * fire * .12 + fireL * glow * .08 * smoothstep(.6, .0, sp.y / fh);
  col = mix(col, boxC, inBox);
  // Logs: two dark rounds with glowing cracks.
  for (int i = 0; i < 2; i++) {
    vec2 lc = vec2(fx + (float(i) - .5) * .11, base + .03 + float(i) * .018);
    vec2 d = (uv - lc) * vec2(1., 2.6); d = vec2(d.x * .96 + d.y * .3, d.y);
    float log_ = smoothstep(.09, .085, length(d));
    float crack = smoothstep(.55, .7, noise(uv * 70. + float(i) * 9.)) * smoothstep(.09, .04, length(d));
    vec3 logC = vec3(.06, .03, .02) * (.6 + .4 * noise(vec2(uv.x * 120., uv.y * 30.)));
    logC = mix(logC, vec3(1., .45, .1) * (.7 + .3 * sin(t * 4. + float(i) * 2.)) * (.8 + bass * .5), crack);
    col = mix(col, logC, log_ * inBox);
  }
  // Flames, additive, from deep red through orange to a pale core.
  vec3 fc = mix(vec3(.6, .05, 0.), vec3(1., .45, .05), smoothstep(.1, .5, fire));
  fc = mix(fc, vec3(1., .9, .6), smoothstep(.55, 1., fire));
  col += fc * fire * 1.3 * inBox;
  // Embers rising from the fire, wobbling.
  for (int g = 0; g < 2; g++) {
    vec2 ep = vec2((uv.x - fx) / fw, (uv.y - base) / fh - t * (.35 + float(g) * .2));
    vec2 ec = floor(ep * vec2(8., 4.) + float(g) * 7.), ef = fract(ep * vec2(8., 4.) + float(g) * 7.) - .5;
    float eh = h21(ec);
    vec2 eo = (vec2(h21(ec + 2.), h21(ec + 5.)) - .5) * .6 + vec2(.1 * sin(t * 3. + eh * 20.), 0.);
    float rise = fract((uv.y - base) / fh * .5 + eh);
    float ember = smoothstep(.07, .0, length((ef - eo) * vec2(1., 2.))) * step(.85, eh) * (1. - rise) * step(abs((uv.x - fx) / fw), .7) * step(base, uv.y) * step(uv.y, base + fh * 1.1);
    col += vec3(1., .5, .15) * ember * 1.2;
  }
  // The window: night-blue glass with rain, a wooden frame, and a little of the firelight on the inside of the glass.
  if (asp > 1.2) {
    vec2 wc = vec2(-.42, .08), ws = vec2(.14, .2);
    vec2 wp = (uv - wc) / ws;
    float inWin = step(abs(wp.x), 1.) * step(abs(wp.y), 1.);
    vec3 glass = mix(vec3(.05, .08, .13), vec3(.1, .13, .2), smoothstep(-1., 1., wp.y)) + fireL * glow * .05;
    vec2 rp = vec2(wp.x * 6. + sin(wp.y * 3.) * .2, wp.y * 3. + t * 1.3);
    vec2 rc = floor(rp), rf = fract(rp) - .5;
    float drop = smoothstep(.25, .0, length((rf - (vec2(h21(rc), h21(rc + 3.)) - .5) * .6) * vec2(3., .6))) * step(.7, h21(rc + 7.));
    glass += drop * .12;
    float bars = step(abs(wp.x), .04) + step(abs(wp.y), .04);
    float frame = step(1., max(abs(wp.x), abs(wp.y))) * step(max(abs(wp.x), abs(wp.y)), 1.12);
    vec3 wood = vec3(.14, .07, .04) * (.5 + lit * 1.2);
    col = mix(col, glass, inWin);
    col = mix(col, wood, clamp(bars * inWin + frame, 0., 1.));
  }
  col += fireL * glow * .06 * (1. - smoothstep(.2, .9, length(uv - vec2(fx, base))));    // the fire's light on the air
  col = 1. - exp(-col * 1.5);
  col += dither(t);
  gl_FragColor = vec4(col, 1.);
}`,_=()=>c(g,{res:.85,speed:1}),v=`
vec3 LAMPC = vec3(1., .72, .4);
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT;
  vec3 rd = normalize(vec3(uv.x, uv.y - .06, 1.));
  float travel = t * 12.;
  // Sky: deep blue to a pink glow at the horizon, stars, and the skyline.
  vec3 col = mix(vec3(.3, .1, .3), vec3(.02, .02, .09), smoothstep(-.02, .4, rd.y));
  col += vec3(1., .3, .5) * exp(-abs(rd.y + .01) * 18.) * .25;
  col += stars(uv * 150., t, 0.) * vec3(.9, .95, 1.) * smoothstep(.05, .25, rd.y);
  float bx = uv.x * 9. + 3.;
  float bh = .005 + .05 * pow(h21(vec2(floor(bx), 1.)), 2.) + .02 * h21(vec2(floor(bx * 3.), 2.));
  float city = step(uv.y + .06, bh) * step(-.06, uv.y);
  vec3 cityC = vec3(.03, .02, .05);
  vec2 wc = floor(vec2(bx * 14., (uv.y + .06) * 180.));
  float win = step(.78, h21(wc)) * step(.25, fract(bx * 14.)) * step(.2, fract((uv.y + .06) * 180.));
  cityC += mix(vec3(1., .75, .45), vec3(.5, .85, 1.), step(.7, h21(wc + 3.))) * win * .8;
  col = mix(col, cityC, city);
  // The road: a plane 1.4 below the eye.
  float T = 1.;
  if (rd.y < -.002) {
    float d = 1.4 / -rd.y;
    vec3 p = rd * d;
    float z = p.z + travel;
    float road = smoothstep(3.2, 3., abs(p.x));
    float edge = smoothstep(.06, .0, abs(abs(p.x) - 2.9) - .04) * road;
    float dash = step(abs(p.x), .08) * step(fract(z / 6.), .35) * road;
    vec3 asphalt = vec3(.05, .045, .07) * (.9 + .15 * noise(p.xz * vec2(6., .8) + vec2(0., travel * .8)));
    vec3 verge = vec3(.02, .02, .018) * (.85 + .25 * noise(p.xz * vec2(2., .3) + vec2(0., travel * .3)));
    vec3 g = mix(verge, asphalt, road);
    g = mix(g, vec3(.6, .55, .7), edge * .4);
    g = mix(g, vec3(.95, .85, .6), dash * .7);
    // Wet asphalt: each lamp's light lies in a smeared vertical streak under it, and the tail lights too.
    float wet = .75 + .25 * noise(p.xz * vec2(2., .4) + 3.);
    vec3 refl = vec3(0.);
    for (int i = 0; i < 8; i++) {
      float lz = (floor((travel + 1.) / 11.) + float(i)) * 11. - travel;
      if (lz < .5) continue;
      for (int s = 0; s < 2; s++) {
        float lx = (float(s) * 2. - 1.) * 4.2;
        float dx = p.x - lx, dz = p.z - lz;
        refl += LAMPC * exp(-dx * dx * 1.2 - abs(dz) * .35) * .35 / (1. + lz * .02);
      }
    }
    float carZ = 11. + sin(t * .21) * 2.5, carX = .9 + sin(t * .13) * .5;
    for (int s = 0; s < 2; s++) { float lx = carX + (float(s) * 2. - 1.) * .62; refl += vec3(1., .15, .15) * exp(-(p.x - lx) * (p.x - lx) * 8. - abs(p.z - carZ) * .6) * .4 * step(p.z, carZ); }
    g += refl * wet * road;
    col = mix(col, g, smoothstep(.0, .01, -rd.y));
    col = mix(col, vec3(.08, .05, .1), smoothstep(30., 110., d) * .7);     // haze with distance
  }
  // Lamps: poles and heads projected into the view, the glow added over everything.
  for (int i = 0; i < 8; i++) {
    float lz = (floor((travel + 1.) / 11.) + float(i)) * 11. - travel;
    if (lz < .5) continue;
    for (int s = 0; s < 2; s++) {
      float lx = (float(s) * 2. - 1.) * 4.2;
      vec2 base = vec2(lx / lz, -1.4 / lz + .06), top = vec2(lx / lz, (5.2 - 1.4) / lz + .06), arm = vec2((lx - (float(s) * 2. - 1.) * .9) / lz, top.y);
      float w = .09 / lz;
      float pole = smoothstep(w, w * .5, seg(uv, base, top)) + smoothstep(w, w * .5, seg(uv, top, arm));
      col = mix(col, vec3(.01, .008, .015), clamp(pole, 0., 1.));
      float fade = smoothstep(90., 30., lz);
      col += LAMPC * (exp(-length(uv - arm) * lz * 2.5) * 1.2 + exp(-length(uv - arm) * 9.) * .06) * fade;
    }
  }
  // The car ahead: a dark body, tail lights that glow, a little mist behind it.
  float carZ = 11. + sin(t * .21) * 2.5, carX = .9 + sin(t * .13) * .5;
  vec2 c0 = vec2((carX - .85) / carZ, -1.1 / carZ + .06), c1 = vec2((carX + .85) / carZ, (.95 - 1.4) / carZ + .06);
  float body = step(c0.x, uv.x) * step(uv.x, c1.x) * step(c0.y, uv.y) * step(uv.y, c1.y);
  float roof = step(c0.x + .25 / carZ, uv.x) * step(uv.x, c1.x - .25 / carZ) * step(c1.y, uv.y) * step(uv.y, c1.y + .45 / carZ);
  col = mix(col, vec3(.02, .015, .03), clamp(body + roof, 0., 1.));
  col += vec3(.25, .2, .3) * roof * smoothstep(c1.y + .45 / carZ, c1.y + .2 / carZ, uv.y) * .3;
  for (int s = 0; s < 2; s++) {
    vec2 l = vec2((carX + (float(s) * 2. - 1.) * .62) / carZ, (.72 - 1.4) / carZ + .06);
    col += vec3(1., .12, .15) * (exp(-length(uv - l) * carZ * 6.) * 1.5 + exp(-length(uv - l) * 12.) * .12);
  }
  // Drizzle in the headlights, faint.
  vec2 rp = vec2(uv.x * 160. + uv.y * 12., uv.y * 7. + t * 5.);
  float rain = smoothstep(.72, .8, noise(rp)) * smoothstep(.0, -.4, uv.y) * .05;
  col += rain;
  col = 1. - exp(-col * 1.5);
  col += dither(t);
  gl_FragColor = vec4(col, 1.);
}`,y=()=>c(v,{res:.8,speed:1});export{y as driveScene,_ as hearthScene,p as pondScene,d as stormScene,h as trainScene};