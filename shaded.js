import{S as e}from"./util.js";import{t}from"./daylight.js";import{a as n,c as r,i,u as a}from"./app.js";import{n as o,t as s}from"./aurora.js";var c=`
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
}`,l=`
float fbm3o(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.07 + 11.3; a *= .5; } return v; }
vec3 dmix(vec3 n, vec3 k, vec3 d, float a){ return a < .5 ? mix(n, k, a * 2.) : mix(k, d, (a - .5) * 2.); }
// Stars on a fixed grid of the sky, twinkling; fades with the daylight.
float stars(vec2 p, float t, float day){
  vec2 c = floor(p), f = fract(p) - .5; float h = h21(c);
  float r = length(f - (vec2(h21(c + 3.1), h21(c + 7.7)) - .5) * .6);
  float s = smoothstep(.09, .0, r) * step(.9, h) * (.6 + .4 * sin(t * 2. + h * 40.));
  return s * (1. - smoothstep(0., .4, day));
}`,u=(e,t)=>r(c+l+e,{res:.75,...t}),d=(e={})=>({before(n,r,i,o){i.uniform1f(o.uA,t()),i.uniform1f(o.uB,a),i.uniform1f(o.uC,s),e.before&&e.before(n,r,i,o)},...e}),f=`
vec3 aurora(vec3 rd, float t){
  vec3 col = vec3(0.);
  float flow = t * (.012 + .01 * uMid);
  for (int i = 0; i < 20; i++) {
    float fi = float(i), h = 1.1 + fi * .11;
    float d = h / max(rd.y, .02);
    if (d > 70.) break;
    vec2 q = rd.xz * d;
    vec2 p = vec2(q.x * .45 + flow, q.y * .07 + flow * .3);
    float band = fbm3o(p * vec2(.5, 1.) + vec2(0., fbm3o(p * .35 + 5.) * 1.6));      // ribbons folded by a second noise
    float rib = smoothstep(.38, .48, band) * smoothstep(.66, .54, band);
    rib *= .55 + .45 * noise(vec2(q.x * 1.8 + flow * 6., fi * .07));          // fine rays along the curtain
    float patch = smoothstep(.1, .6, noise(vec2(rd.x / rd.z * 2.5 + t * .008, 2. + fi * .02)));   // the curtain comes and goes along its length
    float k = fi / 19.;
    vec3 c = mix(vec3(.15, 1., .45), vec3(.75, .25, .95), smoothstep(.15, .95, k));
    c = mix(c, vec3(1., .35, .45), smoothstep(.75, 1., k) * .35);     // a red fringe at the very top
    col += c * rib * patch * exp(-k * 2.) * (1. - smoothstep(30., 70., d)) * .13;
  }
  return col;
}
float ridge(float x, float s){ return .5 * sin(x * 1.7 + s) + .3 * sin(x * 3.9 + s * 2.) + .2 * (noise(vec2(x * 7., s)) - .5) * 2.; }
vec3 scene(vec2 uv, float t, float day, bool refl){
  vec3 rd = normalize(vec3(uv.x, uv.y + .1, 1.));
  float el = uv.y;
  vec3 sky = dmix(vec3(.008, .018, .05), vec3(.12, .12, .28), vec3(.32, .55, .85), day);
  vec3 low = dmix(vec3(.05, .13, .18), vec3(.72, .48, .42), vec3(.78, .86, .9), day);
  vec3 col = mix(low, sky, smoothstep(-.1, .45, el));
  col += stars(uv * 140., t, day) * vec3(.9, .95, 1.) * (refl ? .4 : 1.);
  float night = 1. - day;
  col += aurora(rd, t) * (.04 + .96 * night) * (1. + .35 * uBass) * (.35 + 1.3 * uC);   // uC: tonight's real aurora strength
  // Two ridges: a hazy far one and a black near one with a treeline.
  float far = -.03 + .07 * ridge(uv.x, 1.3);
  vec3 farC = dmix(vec3(.03, .07, .1), vec3(.2, .16, .26), vec3(.4, .5, .6), day);
  col = mix(col, farC, smoothstep(far + .004, far - .004, el));
  float near = -.1 + .045 * ridge(uv.x * 1.6, 4.1) + .012 * pow(noise(vec2(uv.x * 160., 5.)), 3.) * 2.;
  vec3 nearC = dmix(vec3(.004, .012, .015), vec3(.03, .03, .05), vec3(.1, .16, .12), day);
  col = mix(col, nearC, smoothstep(near + .003, near - .003, el));
  return col;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float day = uA, t = uT, lake = -.19;
  vec3 col;
  if (uv.y > lake) col = scene(uv, t, day, false);
  else {
    float depth = lake - uv.y;
    float rip = sin(uv.y * 90. + t * .6 + sin(uv.x * 30. + t * .3)) * .003 * (1. + depth * 3.);
    vec2 m = vec2(uv.x + rip * .5, 2. * lake - uv.y + rip);
    vec3 r = scene(m, t, day, true);
    vec3 water = dmix(vec3(.004, .01, .02), vec3(.05, .04, .08), vec3(.08, .16, .24), day);
    col = mix(water, r, .55 - .3 * smoothstep(0., .3, depth));
    col += noise(vec2(uv.x * 60., uv.y * 300. - t * .4)) * .015 * (1. - day);       // faint streaks on the surface
    // Reeds and a dark shore at the bottom edge.
    float shore = -.47 + .02 * noise(vec2(uv.x * 9., 1.));
    col = mix(col, vec3(.004, .008, .008), smoothstep(shore + .004, shore - .004, uv.y));
  }
  col = 1. - exp(-col * 1.6);
  col += (h21(gl_FragCoord.xy + fract(uT)) - .5) / 160.;        // a little dither keeps the gradients smooth
  gl_FragColor = vec4(col, 1.);
}`,p=()=>(o(),u(f,d({speed:1}))),m=`
float deck(vec3 p, int oct){
  vec3 q = p + vec3(0., 0., uT * .9);
  float top = -1. - .45 * noise(q.xz * .11) - .25 * noise(q.xz * .31 + 3.);     // towers and gaps in the deck
  float shape = smoothstep(top, top - .5, p.y);
  float n = fbm3(q * .28 + vec3(0., 0., uT * .01), oct);
  return max(0., n - .36 + .3 * shape) * shape * 3.;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float day = uA, t = uT;
  vec3 rd = normalize(vec3(uv.x, uv.y - .06, 1.));
  float sunUp = smoothstep(.45, 1., day), moonK = 1. - smoothstep(0., .12, day);
  vec3 L = normalize(mix(vec3(.6, .02 + .7 * sunUp, .9), vec3(-.5, .55, .6), moonK));
  vec3 lightC = mix(mix(vec3(1., .55, .3), vec3(1., .97, .9), sunUp), vec3(.5, .6, .85) * .6, moonK);
  // Sky, with a warm band at the horizon around dusk and dawn.
  float tw = 1. - abs(day * 2. - 1.);
  vec3 zen = dmix(vec3(.01, .015, .06), vec3(.08, .1, .34), vec3(.22, .45, .85), day);
  vec3 hor = dmix(vec3(.05, .06, .13), vec3(.95, .55, .35), vec3(.75, .85, .95), day);
  vec3 sky = mix(hor, zen, smoothstep(-.05, .5, rd.y));
  sky += vec3(1., .5, .25) * tw * exp(-abs(rd.y + .03) * 12.) * .5;
  float sd = max(dot(rd, L), 0.);
  sky += lightC * (pow(sd, 900.) * 1.2 + pow(sd, 20.) * .25 + pow(sd, 3.) * .08) * mix(1., .35, moonK);
  sky += stars(uv * 150., t, day) * vec3(.9, .95, 1.);
  // Thin cirrus far above.
  if (rd.y > .02) { float cd = 3.5 / rd.y; vec2 cq = mat2(.82, .57, -.57, .82) * (rd.xz * cd);   // turned, so the noise grid never lines up with the view
    float ci = smoothstep(.5, .8, fbm3o(cq * .05 + vec2(0., t * .006))) * exp(-cd * .025) * smoothstep(.02, .12, rd.y);
    sky = mix(sky, mix(hor, vec3(1.), .5) * (.6 + .4 * sunUp), ci * .35); }
  vec3 col = sky;
  // The deck below, marched from its top to its base.
  if (rd.y < -.012) {
    float t0 = -.5 / rd.y, t1 = min(-2.4 / rd.y, 90.);
    int N = \${STEPS};
    float step_ = (t1 - t0) / float(N), T = 1.;
    float tt = t0 + step_ * h31(vec3(gl_FragCoord.xy, t));
    vec3 acc = vec3(0.);
    vec3 shade = mix(zen, hor, .5) * .9;
    for (int i = 0; i < 64; i++) {
      if (i >= N || T < .02) break;
      vec3 p = rd * tt;
      float d = deck(p, 4);
      if (d > .001) {
        float sh = exp(-deck(p + L * .7, 2) * 2.5);
        float edge = 1. - exp(-d * 1.5);
        vec3 c = mix(shade, lightC * (1. + .5 * tw * (1. - edge)), sh * (.4 + .6 * edge));
        c = mix(c, hor, smoothstep(20., 90., tt));                    // haze toward the horizon
        float a = 1. - exp(-d * step_ * 1.2);
        acc += T * a * c; T *= 1. - a;
      }
      tt += step_;
    }
    col = acc + T * sky;
  }
  // The wing: a dark wedge from the lower left, a lit upper edge, a red lamp and a white strobe at the tip.
  vec2 tip = vec2(min(.3, uRes.x / uRes.y * .5 - .12), -.33);
  float topE = tip.y + (uv.x - tip.x) * -.12, botE = tip.y - .06 + (uv.x - tip.x) * -.25;
  float wing = step(uv.x, tip.x) * step(botE, uv.y) * step(uv.y, topE);
  vec3 wingC = mix(vec3(.04, .045, .06), lightC * .25 + hor * .3, smoothstep(0., .12, topE - uv.y) * .5 + .4) * (.3 + .7 * day + .3 * tw);
  wingC += hor * .5 * smoothstep(.006, 0., topE - uv.y);               // the edge catches the sky
  col = mix(col, wingC, wing);
  float dl = length(uv - tip);
  col += vec3(1., .15, .15) * exp(-dl * 90.) * .9;
  float c = fract(t / 1.5); float blink = step(c, .05) + step(.15, c) * step(c, .2);
  col += vec3(1.) * blink * exp(-dl * 30.) * .8;
  col = 1. - exp(-col * 1.5);
  col += (h21(gl_FragCoord.xy + fract(uT)) - .5) / 160.;        // a little dither keeps the gradients smooth
  gl_FragColor = vec4(col, 1.);
}`;function h(){return u(m.replace("${STEPS}",String(e?20:34)),d({res:.7,heavy:!0}))}var g=`
vec3 sunL; vec3 sunC; float tw;
vec3 skyAt(vec3 rd, float day, float t){
  vec3 zen = dmix(vec3(.01, .02, .07), vec3(.1, .13, .36), vec3(.25, .5, .9), day);
  vec3 hor = dmix(vec3(.05, .07, .14), vec3(.98, .6, .38), vec3(.78, .87, .95), day);
  hor = mix(hor, hor * vec3(.86, .94, 1.08) + .02, WINTER); zen = mix(zen, zen * vec3(.85, .92, 1.), WINTER);
  hor = mix(hor, hor * vec3(1.06, 1., .9), SUMMER);
  vec3 sky = mix(hor, zen, smoothstep(-.02, .45, rd.y));
  sky += vec3(1., .45, .2) * tw * exp(-abs(rd.y) * 10.) * (.6 + .2 * SUMMER - .25 * WINTER);
  float sd = max(dot(rd, sunL), 0.);
  sky += sunC * (pow(sd, 1200.) * 1.5 + pow(sd, 24.) * .35 + pow(sd, 2.) * .12);
  // Clouds: a plane above, shaded toward the sun and pink underneath at dusk.
  if (rd.y > .005) {
    float cd = 2.8 / rd.y; vec2 q = rd.xz * cd * .06 + vec2(t * .007, 0.);
    float n = fbm3o(q), nl = fbm3o(q + sunL.xz * .06);
    float cov = smoothstep(.46 - .08 * WINTER + .05 * SUMMER, .66, n) * (1. - smoothstep(20., 60., cd)) * smoothstep(.005, .08, rd.y);
    vec3 lit = mix(vec3(1.), sunC, .5) * (.4 + .6 * day + .4 * tw), dark = mix(zen, hor, .4);
    vec3 cc = mix(dark, lit, smoothstep(-.1, .2, nl - n) * .6 + .3);
    cc = mix(cc, vec3(1., .55, .45) * (.3 + .7 * day), tw * .4);
    sky = mix(sky, cc, cov);
  }
  return sky;
}
float wave(vec2 p, float t){
  return .5 * sin(p.y * 1.3 - t * 1.1) + .25 * sin((p.x * .6 + p.y * 1.2) * 2.1 + t * 1.6) + .15 * sin((p.x * 1.4 - p.y * .8) * 3.7 - t * 2.3)
       + .5 * noise(p * 1.1 + vec2(t * .3, -t * .5)) + .25 * noise(p * 2.6 - vec2(t * .5, t * .2));
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float day = uA, t = uT;
  tw = 1. - abs(day * 2. - 1.);
  float sunUp = smoothstep(.5, 1., day), moonK = 1. - smoothstep(0., .1, day);
  sunL = normalize(mix(vec3(.35, .015 + .75 * sunUp, 1.), vec3(-.6, .5, .8), moonK));
  sunC = mix(mix(vec3(1., .5, .25), vec3(1., .96, .88), sunUp), vec3(.55, .65, .9) * .5, moonK);
  vec3 rd = normalize(vec3(uv.x, uv.y + .05, 1.));
  vec3 col;
  if (rd.y >= 0.) {
    col = skyAt(rd, day, t);
    col += stars(uv * 150., t, day) * vec3(.9, .95, 1.);
  } else {
    float d = 1.6 / -rd.y;                         // the ground is 1.6 below the eye
    vec3 p = rd * d;
    float amp = exp(-d * .012) * (1. + .2 * uBass);
    float e = .02 + d * .004;
    float w0 = wave(p.xz, t), wx = wave(p.xz + vec2(e, 0.), t), wz = wave(p.xz + vec2(0., e), t);
    vec3 n = normalize(vec3(-(wx - w0) / e * .11 * amp, 1., -(wz - w0) / e * .11 * amp));
    vec3 rr = reflect(rd, n); rr.y = abs(rr.y);
    vec3 refl = skyAt(rr, day, t);
    float fres = .04 + .96 * pow(1. - max(dot(-rd, n), 0.), 5.);
    vec3 deep = dmix(vec3(.01, .02, .035), vec3(.09, .08, .12), vec3(.08, .22, .3), day);
    deep = mix(deep, deep * vec3(.8, .95, 1.1) + .015, WINTER);                  // a colder, greyer sea in winter
    vec3 sea = mix(deep, refl, clamp(fres * 1.6, 0., 1.));
    sea += sunC * pow(max(dot(rr, sunL), 0.), 300.) * .8 * (1. - moonK * .6);     // glitter
    // Sand in the foreground, wet where the water last reached; a foam line at the edge.
    float shore = 7. + 1.2 * sin(p.x * .35 + 1.) + .6 * noise(vec2(p.x * .7, 3.)) + .35 * sin(t * .5) ;
    float k = smoothstep(shore - .25, shore + .25, d);
    vec3 sandC = dmix(vec3(.03, .035, .045), vec3(.32, .22, .2), vec3(.62, .55, .45), day);
    float grain = noise(p.xz * 9.) * .12 + noise(p.xz * vec2(.8, 6.)) * .08;
    vec3 sand = sandC * (.85 + grain);
    float wet = smoothstep(shore - 4.5, shore - .5, d);
    sand = mix(sand, vec3(.86, .89, .94) * (.12 + .88 * day), WINTER * smoothstep(.5, .62, noise(p.xz * .5)) * (1. - wet));   // snow on the dry sand in winter
    sand = mix(sand, skyAt(vec3(rd.x, -rd.y * .7, rd.z), day, t) * .85, wet * .55);
    float foam = smoothstep(.35, 0., abs(d - shore) - .1) * (.5 + .5 * noise(vec2(p.x * 3., t * .7)));
    col = mix(sand, sea, k);
    col = mix(col, vec3(.9, .92, .95) * (.25 + .75 * day), foam * .8);
    col = mix(col, mix(deep, refl, .4), smoothstep(40., 140., d));      // the far sea fades into the sky
  }
  col = 1. - exp(-col * 1.5);
  col += (h21(gl_FragCoord.xy + fract(uT)) - .5) / 160.;        // a little dither keeps the gradients smooth
  gl_FragColor = vec4(col, 1.);
}`,_=()=>u(`const float WINTER = ${+(i()===3)}.;\nconst float SUMMER = ${+(i()===1)}.;\n`+g,d({res:.8})),v=`
vec2 SUN;
// Leaf clusters: soft round tufts on a jittered grid at scale sc, each a little different in size; the gaps between
// them are what makes the canopy lacy rather than solid.
float clusters(vec2 p, float sc, float k){
  vec2 g = p * sc, c = floor(g); float v = 0.;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    vec2 cc = c + vec2(float(i), float(j)); float h = h21(cc + k * 7.1);
    vec2 o = cc + .5 + (vec2(h21(cc + 1.3 + k), h21(cc + 4.7 + k)) - .5) * .8;
    float r = .3 + .4 * h, d = length((g - o) * vec2(1., 1.25)) / r;
    v = max(v, (1. - smoothstep(.55, 1., d)) * step(.3, h));
  }
  return v;
}
// Foliage of one depth layer: clusters hanging from the top, thinning out lower down, with finer leaves at their edges.
float foliage(vec2 p, float k){
  float big = fbm(p * (1.6 + k * .5) + k * 7.3);
  float hang = smoothstep(-.32 + k * .06, .45, p.y + (big - .5) * .6);
  float cl = max(clusters(p, 5.5 + k * 1.5, k), .85 * clusters(p + 3.1, 10. + k * 2.5, k + 1.));
  float fine = noise(p * (24. + k * 6.) + k * 3.);
  return smoothstep(.4, .62, cl * hang * (.55 + .9 * big) + fine * .08);
}
// Trunks of one depth layer: where across the trunk this point is (-1..1), or 2 outside one.
float trunkX(vec2 p, float k){
  float nx = p.x * (2.6 + k * 1.4) + k * 5.3;
  float cell = floor(nx), h = h21(vec2(cell, k));
  float w = (.03 + .07 * pow(h21(vec2(cell, k + 9.)), 2.)) * (1. - (p.y + .5) * .35) * (1. + k * .5);
  float x = fract(nx) - .5 + (h - .5) * .6 + (.03 + .03 * h) * sin(p.y * (2. + h * 2.) + h * 9.);
  return h21(vec2(cell, k + 3.)) < .45 ? 2. : x / w;
}
float open_(vec2 q){ return (1. - max(foliage(q, 0.), foliage(q, 1.) * .8)) * smoothstep(1., 1.1, abs(trunkX(q, 1.))); }
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT;
  SUN = vec2(min(.36, uRes.x / uRes.y * .5 - .1), .66);
  vec3 light = vec3(1., .9, .6);
  // The air behind everything: a green haze, brightest around the sun.
  vec3 col = mix(vec3(.16, .22, .11), vec3(.55, .62, .36), smoothstep(-.4, .6, uv.y));
  col += light * exp(-length(uv - SUN) * 2.) * .9;
  float sway = sin(t * .3) * .003;
  vec3 lc[4]; lc[0] = vec3(.42, .52, .3); lc[1] = vec3(.2, .3, .14); lc[2] = vec3(.07, .12, .055); lc[3] = vec3(.015, .028, .015);
  // Shafts: how open the sky is on the way toward the sun from here, through the far layers.
  float ray = 0., wsum = 0.;
  for (int j = 0; j < 22; j++) {
    float f = float(j) / 22.;
    float wgt = exp(-f * 1.2);
    ray += open_(mix(uv, SUN, f * .92)) * wgt; wsum += wgt;
  }
  ray = pow(ray / wsum, 1.4);
  vec2 dir = uv - SUN; float ang = atan(dir.y, dir.x), dist = length(dir);
  float bands = pow(noise(vec2(ang * 9. + t * .015, 1.)), 2.) * .7 + pow(noise(vec2(ang * 30. - t * .01, 2.)), 3.) * .6;   // rays fanning out from the sun
  float dense = .4 + .6 * smoothstep(.5, -.4, uv.y);                       // the haze is thicker low down
  float shafts = ray * bands * dense * smoothstep(.0, .35, dist) * (1. + .15 * uLevel) * 1.6;
  float nearCover = 0.;
  for (int i = 0; i < 4; i++) {
    float k = float(i);
    vec2 p = uv + vec2(sway * (1. + k), 0.);
    float fol = foliage(p, k), tx = trunkX(p, k);
    float trunk = smoothstep(1., .93, abs(tx));
    vec3 c = lc[i] * (1. + k * .45);   // the near layers lighter than silhouettes, so their leaves read
    float round_ = sqrt(max(0., 1. - tx * tx));
    vec3 bark = c * (.35 + .65 * round_) * (.8 + .4 * noise(vec2(p.x * 90., p.y * 14.) + k)) + light * .07 * smoothstep(.2, .9, tx) * round_ * (1. - k * .25);
    c = mix(c, bark, trunk);
    float rim = fol * smoothstep(.5, .0, foliage(p + vec2(.025, .035), k)) * (1. - k * .2);
    c = mix(c, c * 1.5 + light * (.12 + .08 * k), rim);                                                              // leaves on the sun side glow through
    c = mix(c, c * (.7 + .6 * noise(p * (40. + k * 20.) + k) * noise(p * (90. + k * 30.) + k * 3.)), fol * (1. - trunk));   // leaf texture, two scales
    float m = max(fol, trunk);
    col = mix(col, c, m);
    if (i == 1) {
      col += light * shafts * .9;                                             // the shafts hang between the far and near trees
      // Floor: moss and leaf litter, with pools of light where the shafts land; the near trees stand on it.
      float floorY = -.3 + .03 * noise(vec2(uv.x * 5., 2.));
      vec3 moss = mix(vec3(.05, .08, .03), vec3(.18, .22, .09), noise(uv * 40.) * .5 + noise(uv * 9.) * .5);
      moss += light * shafts * .8 * smoothstep(floorY, floorY - .12, uv.y);
      col = mix(col, moss, smoothstep(floorY, floorY - .015, uv.y));
    }
    if (i >= 2) nearCover = max(nearCover, m);
  }
  col += light * shafts * .3 * (1. - nearCover * .8);
  // Dust in the air, brightest inside the shafts.
  for (int g = 0; g < 2; g++) {
    float s = 26. + float(g) * 19.;
    vec2 gp = uv * s + vec2(t * (.1 + float(g) * .07), -t * .05);
    vec2 c = floor(gp), f = fract(gp) - .5; float h = h21(c + float(g) * 5.);
    vec2 o = (vec2(h21(c + 1.3), h21(c + 2.9)) - .5) * .7 + .06 * vec2(sin(t * 1.3 + h * 30.), cos(t * 1.1 + h * 20.));
    float dot_ = smoothstep(.07, .0, length(f - o)) * step(.72, h) * (.5 + .5 * sin(t * 1.5 + h * 60.));
    col += light * dot_ * (.08 + .8 * shafts);
  }
  col = 1. - exp(-col * 1.4);
  col += (h21(gl_FragCoord.xy + fract(uT)) - .5) / 160.;        // a little dither keeps the gradients smooth
  gl_FragColor = vec4(col, 1.);
}`;function y(e){let t=n();return e=e.replace(`lc[0] = vec3(.42, .52, .3); lc[1] = vec3(.2, .3, .14); lc[2] = vec3(.07, .12, .055); lc[3] = vec3(.015, .028, .015);`,{spring:`lc[0] = vec3(.5, .62, .32); lc[1] = vec3(.26, .4, .16); lc[2] = vec3(.09, .16, .06); lc[3] = vec3(.02, .035, .015);`,summer:`lc[0] = vec3(.42, .52, .3); lc[1] = vec3(.2, .3, .14); lc[2] = vec3(.07, .12, .055); lc[3] = vec3(.015, .028, .015);`,autumn:`lc[0] = vec3(.62, .5, .26); lc[1] = vec3(.42, .26, .1); lc[2] = vec3(.14, .09, .04); lc[3] = vec3(.03, .02, .012);`,winter:`lc[0] = vec3(.5, .52, .54); lc[1] = vec3(.3, .3, .3); lc[2] = vec3(.12, .11, .1); lc[3] = vec3(.03, .03, .03);`}[t]),t===`winter`&&(e=e.replace(`return smoothstep(.46, .6, big * .55 + hang * .5 + fine * .08);`,`return smoothstep(.6, .72, big * .55 + hang * .5 + fine * .08);`)),e}var b=()=>u(y(v),{res:.8,speed:1}),x=`
vec3 LAMP; vec3 beamDir; float TX, TY;
float fogAt(vec3 p, float t){ return exp(-max(p.y + 1., 0.) * .55) * (.6 + .4 * n3(p * vec3(.35, .5, .35) + vec3(t * .06, 0., t * .03))); }
float beamAt(vec3 p){
  vec3 v = p - LAMP; float d = length(v); v /= d;
  float c = dot(v, beamDir);
  float cone = smoothstep(.986, .999, c) + .3 * smoothstep(.95, .99, c);
  return cone * 14. / (3. + d * d * .025) * smoothstep(.8, 2.6, d);
}
float headland(float x){ return mix(-.7, TY - .03, smoothstep(TX - .38, TX, x)) + .07 * smoothstep(TX, TX + .5, x) + .02 * noise(vec2(x * 8., 1.)) + .008 * noise(vec2(x * 30., 2.)); }
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float day = uA, t = uT, fog = .3 + .6 * uB, asp = uRes.x / uRes.y;
  LAMP = vec3(min(.255, asp * .5 - .1) * 9., 1.35, 9.);
  TX = LAMP.x / LAMP.z; TY = LAMP.y / LAMP.z - .08;
  float th = t * .785;
  beamDir = normalize(vec3(cos(th), -.04, sin(th)));
  vec3 rd = normalize(vec3(uv.x, uv.y + .08, 1.));
  float night = 1. - day;
  // Sky and sea.
  vec3 zen = dmix(vec3(.01, .02, .06), vec3(.12, .12, .3), vec3(.3, .52, .85), day);
  vec3 hor = dmix(vec3(.05, .07, .13), vec3(.75, .45, .42), vec3(.75, .84, .9), day);
  vec3 sky = mix(hor, zen, smoothstep(-.02, .5, rd.y));
  float sunUp = smoothstep(.5, 1., day), moonK = 1. - smoothstep(0., .1, day);
  vec3 L = normalize(mix(vec3(-.45, .02 + .7 * sunUp, 1.), vec3(-.55, .45, .75), moonK));
  vec3 LC = mix(mix(vec3(1., .55, .3), vec3(1., .96, .9), sunUp), vec3(.6, .7, .95) * .6, moonK);
  float sd = max(dot(rd, L), 0.);
  sky += LC * (pow(sd, 1500.) * 1.2 + pow(sd, 30.) * .2 + pow(sd, 3.) * .06);
  sky += stars(uv * 150., t, day) * vec3(.9, .95, 1.);
  if (rd.y > .01) { float cd = 3. / rd.y; float cl = smoothstep(.5, .75, fbm3o(rd.xz * cd * .05 + vec2(t * .006, 0.))) * exp(-cd * .025) * smoothstep(.01, .1, rd.y);
    sky = mix(sky, mix(hor, zen, .3) * 1.1, cl * .6); }
  vec3 col = sky;
  float tmax = 60.;
  bool land = uv.y < headland(uv.x) - .08;
    if (rd.y < -.005) {
    float d = 1. / -rd.y; vec3 p = rd * d; tmax = min(tmax, d);
    float e = .03 + d * .004;
    float w0 = .5 * sin(p.z * 1.6 - t * 1.2) + .4 * noise(p.xz * 1.3 + vec2(t * .3, -t * .4)) + .2 * noise(p.xz * 3.1 - t * .5);
    float wx = .5 * sin(p.z * 1.6 - t * 1.2) + .4 * noise((p.xz + vec2(e, 0.)) * 1.3 + vec2(t * .3, -t * .4)) + .2 * noise((p.xz + vec2(e, 0.)) * 3.1 - t * .5);
    float wz = .5 * sin((p.z + e) * 1.6 - t * 1.2) + .4 * noise((p.xz + vec2(0., e)) * 1.3 + vec2(t * .3, -t * .4)) + .2 * noise((p.xz + vec2(0., e)) * 3.1 - t * .5);
    vec3 n = normalize(vec3(-(wx - w0) / e * .22, 1., -(wz - w0) / e * .22) * vec3(exp(-d * .03), 1., exp(-d * .03)));
    vec3 rr = reflect(rd, n); rr.y = abs(rr.y);
    vec3 refl = mix(hor, zen, smoothstep(-.02, .5, rr.y));
    float fres = .05 + .95 * pow(1. - max(dot(-rd, n), 0.), 5.);
    vec3 deep = dmix(vec3(.008, .015, .03), vec3(.06, .05, .09), vec3(.06, .18, .26), day);
    col = mix(deep, refl, fres);
    col += LC * pow(max(dot(rr, L), 0.), 400.) * .6;                                        // glitter
    col += vec3(1., .9, .65) * beamAt(p) * .35 * max(dot(n, normalize(LAMP - p)), 0.);   // the beam on the water
    col = mix(col, hor, smoothstep(15., 60., d));
  }
  // The headland, its cliff and the tower, in front of the sea and the far sky.
  if (land) {
    float h = headland(uv.x) - .08, depthK = smoothstep(-.04, .5, uv.x);
    vec3 rock = dmix(vec3(.012, .014, .02), vec3(.09, .07, .09), vec3(.22, .22, .2), day);
    vec3 grass = dmix(vec3(.02, .03, .02), vec3(.14, .16, .09), vec3(.3, .4, .2), day);
    if (SEASON == 0.) grass = dmix(vec3(.02, .03, .02), vec3(.14, .18, .09), vec3(.32, .48, .2), day);
    if (SEASON == 2.) grass = dmix(vec3(.03, .025, .015), vec3(.2, .14, .08), vec3(.42, .36, .18), day);
    if (SEASON == 3.) grass = dmix(vec3(.05, .06, .09), vec3(.42, .38, .46), vec3(.82, .85, .9), day);   // snow on the headland
    float strata = .6 + .4 * fbm3o(uv * vec2(9., 28.)) + .15 * sin(uv.y * 90. + fbm3o(uv * 6.) * 6.) + .2 * noise(uv * 120.);
    col = mix(rock * strata * (.6 + .4 * smoothstep(-.5, .2, uv.y)), grass * (.8 + .2 * noise(uv * 60.)), smoothstep(h - .04, h - .005, uv.y));
    col = mix(col, hor, (1. - depthK) * .35 * (.5 + fog));
    tmax = min(tmax, 7. + depthK * 4.);
  }
  // Tower: a tapering shaft up to the lantern room, red bands, a gallery rail.
  float tx = TX, ty = TY - .003, base = headland(tx) - .08;
  if (uv.x > tx - .04 && uv.x < tx + .04 && uv.y > base - .02 && uv.y < ty + .035) {
    float k = (uv.y - base) / (ty - base);
    float w = mix(.02, .013, k);
    float shaft = step(abs(uv.x - tx), w) * step(uv.y, ty);
    float lantern = step(abs(uv.x - tx), .016) * step(ty, uv.y) * step(uv.y, ty + .022);
    float roof = step(abs(uv.x - tx), .018 * (1. - (uv.y - ty - .022) / .013)) * step(ty + .022, uv.y);
    float rail = step(abs(uv.x - tx), .019) * step(ty - .006, uv.y) * step(uv.y, ty - .002);
    vec3 wall = dmix(vec3(.1, .1, .12), vec3(.5, .42, .45), vec3(.9, .9, .86), day) * (.6 + .4 * smoothstep(-w, w, uv.x - tx) * .8);
    float band = step(.9, sin(k * 12.6 + 1.5) * .5 + .5) * step(.08, k) * step(k, .9);
    wall = mix(wall, dmix(vec3(.12, .03, .03), vec3(.5, .12, .1), vec3(.75, .18, .16), day), band);
    vec3 glass = vec3(1., .9, .65) * (.4 + .6 * night) * (.5 + .5 * max(-beamDir.z, 0.)) * (.55 + .45 * step(.4, abs(sin((uv.x - tx) * 500.))));
    col = mix(col, wall, shaft); col = mix(col, glass, lantern); col = mix(col, vec3(.02), max(roof, rail));
    if (max(max(shaft, lantern), roof) > 0.) tmax = min(tmax, 8.5);
  }
  // March the fog along the ray up to whatever it hit, lighting it with the beam.
  int N = \${STEPS};
  float T = 1.; vec3 acc = vec3(0.);
  float tt = .2;
  vec3 fogC = dmix(vec3(.05, .07, .11), vec3(.28, .22, .28), vec3(.6, .66, .72), day) * .5;
  vec3 beamC = vec3(1., .92, .7) * (1. + .2 * uBass);
  for (int i = 0; i < 40; i++) {
    if (i >= N || tt > tmax || T < .02) break;
    float step_ = .18 + tt * .045;
    vec3 p = rd * tt;
    float rho = .025 + fogAt(p, t) * fog * .2;
    vec3 c = fogC + beamC * beamAt(p) * (.6 + .4 * night);
    float a = 1. - exp(-rho * step_);
    acc += T * a * c; T *= 1. - a;
    tt += step_;
  }
  col = col * T + acc;
  // The lamp itself: a glow that swells as the beam faces us; a buoy blinking out on the water.
  float toward = max(-beamDir.z, 0.);
  float dl = length(uv - vec2(tx, ty + .011));
  col += vec3(1., .92, .7) * (exp(-dl * 160.) * .8 + exp(-dl * 14.) * (.1 + .5 * toward * toward) * (.3 + .7 * night) * (.5 + fog));
  vec2 buoy = vec2(max(-.42, -asp * .5 + .08), -.1); float bl = length(uv - buoy);
  float blink = step(fract(t / 3.), .1);
  col += vec3(1., .2, .15) * blink * exp(-bl * 120.) * (.4 + .6 * night);
  col = mix(col, vec3(.02), step(bl, .006) * step(uv.y, buoy.y + .004));
  col = 1. - exp(-col * 1.5);
  col += (h21(gl_FragCoord.xy + fract(uT)) - .5) / 160.;        // a little dither keeps the gradients smooth
  gl_FragColor = vec4(col, 1.);
}`;function S(){return u(`const float SEASON = ${i()}.;\n`+x.replace("${STEPS}",String(e?18:30)),d({res:.75,heavy:!0}))}export{p as auroraScene,b as canopyScene,h as cloudsScene,S as lighthouseScene,_ as tideScene};