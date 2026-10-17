import{At as e,Nt as t,Pt as n,cn as r,ln as i,p as a,r as o,un as s}from"./music.js";import{c,l,s as u,t as d,u as f}from"./app.js";var p=[11,31,58],m=[0,160,222],h=[168,216,240],g=[232,244,250],_=[122,193,67],v=`
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
}`,y=(e,t)=>u(v+e,{res:.8,...t}),b=(e={})=>({before(e,t,n,r){n.uniform1f(r.uA,c()),n.uniform1f(r.uB,f+o.bass*.3)},...e}),x=`
vec3 sunL, sunC; float tw, hazeK;
vec3 skyAt(vec3 rd, float day, float t, float wx){
  vec3 zen = dmix(vec3(.012, .022, .07), vec3(.1, .14, .36), vec3(.2, .48, .9), day);
  vec3 hor = dmix(vec3(.05, .07, .14), vec3(.95, .6, .4), vec3(.72, .85, .95), day);
  zen = mix(zen, vec3(.32, .36, .42) * (.1 + .9 * day), wx * .6); hor = mix(hor, vec3(.55, .58, .62) * (.1 + .9 * day), wx * .6);
  vec3 sky = mix(hor, zen, smoothstep(-.02, .45, rd.y));
  sky += vec3(1., .5, .25) * tw * exp(-abs(rd.y) * 10.) * .5 * (1. - wx * .7);
  float sd = max(dot(rd, sunL), 0.);
  sky += sunC * (pow(sd, 1200.) * 1.5 + pow(sd, 24.) * .3 + pow(sd, 2.) * .1) * (1. - wx * .5);
  if (rd.y > .005) {
    float cd = 2.8 / rd.y; vec2 q = mat2(.82, .57, -.57, .82) * (rd.xz * cd * .06) + vec2(t * .006, 0.);
    float n = fbm3o(q), nl = fbm3o(q + sunL.xz * .06);
    float cov = smoothstep(.5 - wx * .3, .68 - wx * .2, n) * (1. - smoothstep(20., 60., cd)) * smoothstep(.005, .08, rd.y);
    vec3 lit = mix(vec3(1.), sunC, .5) * (.4 + .6 * day + .4 * tw), dark = mix(zen, hor, .4) * (1. - wx * .3);
    sky = mix(sky, mix(dark, lit, smoothstep(-.1, .2, nl - n) * .6 + .3), cov);
  }
  return sky;
}
float chop(float s){ float c = s * .5 + .5; return 1. - (1. - c) * (1. - c); }   // sharper crests, flatter troughs
float wave(vec2 p, float t, float wx){
  float k = .6 + .8 * wx;
  float h = .5 * sin(dot(p, vec2(.35, .95)) * .9 - t * .8) + .28 * sin(dot(p, vec2(-.6, .8)) * 1.4 + t * 1.1);      // long swell
  h += k * (.24 * chop(sin(dot(p, vec2(.8, .6)) * 2.6 - t * 2.)) + .14 * chop(sin(dot(p, vec2(-.3, .95)) * 4.1 - t * 2.6)));   // wind waves
  h += .16 * noise(p * 1.7 + vec2(t * .4, -t * .6)) + .1 * noise(p * 4.2 - vec2(t * .6, t * .3)) + .07 * noise(p * 9. + t * .8) * (.5 + wx);
  return h;
}
// The crew boat in its own units: the waterline at y = 0, the bow at +x. Colour and coverage.
vec4 boat(vec2 q, float day, float t){
  float deck = .13 + .07 * smoothstep(0., .62, q.x) + .02 * smoothstep(-.55, -.35, q.x);
  float bowX = .38 + .26 * clamp(q.y / .2, 0., 1.);
  float hull = step(-.55, q.x) * step(q.x, bowX) * step(-.05, q.y) * step(q.y, deck);
  float boot = hull * step(q.y, .025);
  float house = step(-.32, q.x) * step(q.x, .14 - .06 * smoothstep(deck, deck + .2, q.y)) * step(deck - .001, q.y) * step(q.y, deck + .2);
  float win = house * step(deck + .1, q.y) * step(q.y, deck + .16) * step(.25, fract(q.x * 14.)) * step(q.x, .08) * step(-.28, q.x);
  float mast = step(abs(q.x + .08), .008) * step(deck + .2, q.y) * step(q.y, deck + .42) + step(abs(q.x + .08), .06) * step(abs(q.y - deck - .36), .008);
  float lit = .3 + .7 * day;
  vec3 col = vec3(.95, .47, .1) * (.75 + .35 * smoothstep(-.05, deck, q.y)) * lit;
  col = mix(col, vec3(.12, .1, .1) * lit, boot);
  col = mix(col, vec3(.9, .92, .94) * lit * (.8 + .2 * smoothstep(deck, deck + .2, q.y)), house);
  col = mix(col, vec3(.1, .15, .22) * lit + vec3(1., .85, .5) * (1. - day) * .5, win);
  col = mix(col, vec3(.25, .27, .3) * lit, mast);
  return vec4(col, clamp(hull + house + mast, 0., 1.));
}
// One turbine as seen from an eye at o: tower, nacelle and three blades, tapering, each a segment in the view plane of
// that eye. Returns coverage in .a and colour in .rgb. Everything is in world units: the sea is at y = -E.
const float E = 1.2;
vec4 turbine(vec2 uv, vec3 o, vec3 base, float Ht, float yaw, float rot, float day, float wx, float t){
  float zb = base.z - o.z; if (zb < .3) return vec4(0.);
  vec2 bs = (base.xy - o.xy) / zb, hs = (base.xy + vec2(0., Ht) - o.xy) / zb;
  float R = Ht * .62;
  if (abs(uv.x - hs.x) > (R * 1.15 + .2) / zb) return vec4(0.);             // nowhere near this one
  float haze = 1. - exp(-zb * hazeK);
  vec3 white = vec3(.95, .96, .98) * (.25 + .75 * day) * (1. - wx * .25);
  float px = 1.1 / uRes.y;
  float wB = .04 * Ht / zb, wT = .022 * Ht / zb;
  float d = seg(uv, bs, hs); float wTow = mix(wB, wT, hh);
  float side = clamp((uv.x - mix(bs.x, hs.x, hh)) / max(wTow, 1e-5), -1., 1.);
  float lit = .55 + .45 * smoothstep(-1., 1., side * sign(sunL.x) * -1.) * (.4 + .6 * day);
  float thin = min(1., wTow / px); wTow = max(wTow, px);
  float m = smoothstep(wTow, wTow * .5, d) * thin;
  vec3 col = white * (lit * .9 + .1);
  // The nacelle sits behind the hub along the rotor's axis; the hub is a cap on its front.
  vec3 n = vec3(sin(yaw), 0., cos(yaw)), h = vec3(cos(yaw), 0., -sin(yaw)), hub = base + vec3(0., Ht, 0.);
  vec3 nb = hub - n * R * .16;
  vec2 nbs = (nb.xy - o.xy) / (nb.z - o.z);
  float dn = seg(uv, hs, nbs); float wN = .045 * Ht / zb;
  float thinN = min(1., wN / px); wN = max(wN, px);
  float mn = smoothstep(wN, wN * .5, dn) * thinN;
  col = mix(col, white * (.7 + .3 * smoothstep(1., -1., (uv.y - hs.y) / wN)), mn); m = max(m, mn);
  for (int k = 0; k < 3; k++) {
    float a = rot + float(k) * 2.0944;
    vec3 tip = hub + (cos(a) * h + sin(a) * vec3(0., 1., 0.)) * R;
    float zt = tip.z - o.z; if (zt < .2) continue;
    vec2 ts = (tip.xy - o.xy) / zt;
    float db = seg(uv, hs, ts);
    float wb = mix(.016, .005, smoothstep(.05, 1., hh)) * Ht / zb;      // broad at the root, slim to the tip
    float thinB = min(1., wb / px); wb = max(wb, px);
    float mb = smoothstep(wb, wb * .4, db) * thinB;
    float facing = .7 + .3 * cos(a + yaw);                                 // blades catch the light on the way round
    col = mix(col, white * facing, mb); m = max(m, mb);
  }
  col = mix(col, white * .6, smoothstep(hs.y, bs.y, uv.y) * .25);          // darker toward the water
  return vec4(col, m * (1. - smoothstep(60., 140., zb)) * (1. - haze * .5));
}
// The farm: one close, four in the next row, then rows to the horizon. The same geometry seen from any eye.
vec4 farm(vec2 uv, vec3 o, float rot, float day, float wx, float t, float maxZ){
  vec4 acc = vec4(0.);
  vec3 hazeC = skyAt(normalize(vec3(uv.x, .01, 1.)), day, t, wx);
  for (int i = 0; i < 28; i++) {
    float fi = float(i);
    vec3 base; float Ht = 1.8, yaw = .22 + .1 * sin(fi * 1.7), ph = fi * 2.1;
    if (i == 0) base = vec3(-1.3, -E, 3.2);
    else if (i < 5) base = vec3(-6. + float(i - 1) * 4., -E, 8.5 + .5 * sin(fi * 3.));
    else if (i < 11) base = vec3(-12.5 + float(i - 5) * 5., -E, 17. + .8 * sin(fi * 2.));
    else if (i < 18) base = vec3(-21. + float(i - 11) * 7., -E, 30. + 1.2 * sin(fi * 1.3));
    else base = vec3(-36. + float(i - 18) * 8., -E, 52. + 2. * sin(fi));
    if (base.z - o.z > maxZ) continue;
    vec4 tb = turbine(uv, o, base, Ht, yaw, rot * (.95 + .1 * fract(fi * .37)) + ph, day, wx, t);
    if (tb.a > 0.) {
      float zb = base.z - o.z;
      vec3 c = mix(tb.rgb, hazeC, (1. - exp(-zb * hazeK)) * .85);
      acc.rgb += c * tb.a * (1. - acc.a); acc.a += tb.a * (1. - acc.a);   // nearer ones were drawn first
    }
  }
  acc.rgb /= max(acc.a, 1e-4);
  return acc;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT, day = uA, wx = clamp(uB, 0., 1.);
  tw = 1. - abs(day * 2. - 1.);
  hazeK = .018 + .03 * wx;
  float sunUp = smoothstep(.5, 1., day), moonK = 1. - smoothstep(0., .1, day);
  sunL = normalize(mix(vec3(.5, .02 + .7 * sunUp, 1.), vec3(-.6, .5, .8), moonK));
  sunC = mix(mix(vec3(1., .5, .25), vec3(1., .96, .88), sunUp), vec3(.55, .65, .9) * .5, moonK);
  // Aboard: the deck rolls and pitches a little with the swell, more in weather.
  float roll = (.012 + .02 * wx) * sin(t * .43), pitch = (.008 + .015 * wx) * sin(t * .37 + 1.);
  float cr = cos(roll), sr = sin(roll); uv = vec2(cr * uv.x - sr * uv.y, sr * uv.x + cr * uv.y);
  vec3 rd = normalize(vec3(uv.x, uv.y + .04 + pitch, 1.));
  vec3 eye = vec3(0., .05 * sin(t * .5), 0.);
  float rot = t * (.9 + 1.6 * wx);
  vec3 col;
  float wet = 0.;
  if (rd.y >= 0.) {
    col = skyAt(rd, day, t, wx);
    col += stars(uv * 150., t, day) * vec3(.9, .95, 1.) * (1. - wx);
    vec4 f = farm(rd.xy / rd.z, eye, rot, day, wx, t, 200.);
    col = mix(col, f.rgb, f.a);
  } else {
    float d = min((E + eye.y) / -rd.y, 400.);                              // the horizon rows would otherwise run off to infinity
    vec3 p = eye + rd * d;
    float amp = exp(-d * .012);
    float e = .015 + d * .005;
    float w0 = wave(p.xz, t, wx), wxx = wave(p.xz + vec2(e, 0.), t, wx), wz = wave(p.xz + vec2(0., e), t, wx);
    vec3 n = normalize(vec3(-(wxx - w0) / e * .13 * amp, 1., -(wz - w0) / e * .13 * amp));
    vec3 rr = reflect(rd, n); rr.y = abs(rr.y);
    vec3 refl = skyAt(rr, day, t, wx);
    // The turbines in the water: the same farm seen from this point on the sea along the reflected ray.
    if (rr.z > .15 && d < 40.) { vec4 f = farm(rr.xy / rr.z, p, rot, day, wx, t, 22.); refl = mix(refl, f.rgb * .9, f.a * .6); }
    // The water itself: deep teal, lifting to a greener crest colour where a wave stands up against the light.
    vec3 deep = dmix(vec3(.008, .018, .035), vec3(.07, .07, .12), vec3(.02, .15, .25), day);
    vec3 shallow = dmix(vec3(.02, .05, .07), vec3(.16, .15, .2), vec3(.1, .4, .42), day);
    deep = mix(deep, vec3(.07, .1, .12) * (.2 + .8 * day), wx * .5); shallow = mix(shallow, vec3(.2, .26, .28) * (.2 + .8 * day), wx * .5);
    float crest = smoothstep(.1, 1.1, w0);
    float sss = crest * pow(max(dot(rd, sunL), 0.), 2.) * .8 * (1. - moonK);
    vec3 water = mix(deep, shallow, clamp(crest * .45 + sss, 0., 1.));
    float fres = .03 + .97 * pow(1. - max(dot(-rd, n), 0.), 5.);
    col = mix(water, refl, clamp(fres * 1.5, 0., 1.));
    float sd = max(dot(rr, sunL), 0.);
    col += sunC * (pow(sd, 700.) * 2.2 + pow(sd, 40.) * .12) * (1. - moonK * .5) * (1. - wx * .4);   // glitter
    // Foam: on the sharpest crests, with a lace texture; more as it blows.
    float lace = .45 + .55 * smoothstep(.3, .7, fbm3o(p.xz * 5. + vec2(t * .5, 0.)));
    float foam = smoothstep(1. - wx * .5, 1.45 - wx * .4, w0) * lace * exp(-d * .025);
    // The boat: its bow wave and wake on the water, then its reflection.
    float bz = 6.5, bx = 5.5 - mod(t * .2, 16.), bobB = .035 * sin(t * 1.1);
    float behind = p.x - bx - .3, along = p.z - bz;
    float wake = smoothstep(0., 1.5, behind) * exp(-behind * .22) * exp(-pow(along / (.2 + behind * .14), 2.)) * (.5 + .5 * noise(p.xz * 4. + vec2(t, 0.)));
    float bow = exp(-pow(length((p.xz - vec2(bx - .7, bz)) * vec2(1., 1.8)) / .3, 2.)) * (.6 + .4 * noise(p.xz * 9. + t * 2.));
    foam = max(foam, max(wake * .8, bow));
    float foot = exp(-pow(length(p.xz - vec2(-1.3, 3.2)) / .22, 2.)) * (.6 + .4 * noise(p.xz * 8. + t * 2.));
    foam = max(foam, foot * .7);
    col = mix(col, vec3(.88, .92, .95) * (.3 + .7 * day), foam * .85);
    vec2 bb = vec2(bx, -E + bobB - eye.y) / bz; float sc = 1. / bz;
    vec2 qm = vec2(-(uv.x - bb.x), -(uv.y - bb.y)) / sc + n.xz * vec2(.6, 2.5);   // mirrored, bent by the wave slope
    vec4 bm = boat(qm, day, t);
    col = mix(col, bm.rgb * .55, bm.a * .55 * step(uv.y, bb.y) * (1. - foam));
    col = mix(col, skyAt(normalize(vec3(uv.x, .004, 1.)), day, t, wx), smoothstep(25., 200., d) * .92);
    wet = 1.;
  }
  // The crew boat, heading left across the field, bobbing and rolling a little.
  { float bz = 6.5, bx = 5.5 - mod(t * .2, 16.), bobB = .035 * sin(t * 1.1), rl = .03 * sin(t * .9);
    vec2 bb = vec2(bx, -E + bobB - eye.y) / bz; float sc = 1. / bz;
    vec2 q = vec2(-(uv.x - bb.x), uv.y - bb.y) / sc;
    q = vec2(cos(rl) * q.x - sin(rl) * q.y, sin(rl) * q.x + cos(rl) * q.y);
    vec4 bt = boat(q, day, t);
    col = mix(col, bt.rgb, bt.a);
    col += vec3(1., .9, .6) * exp(-length(uv - bb - vec2(.08, .34) * sc) * 400.) * (1. - day) * .9;   // a masthead light at night
  }
  // Aviation lights, blinking together at night; gulls wheeling round the near tower; the deck rail.
  float blink = step(.6, fract(t * .7)) * (1. - smoothstep(0., .3, day));
  for (int i = 0; i < 11; i++) {
    float fi = float(i); vec3 base = i == 0 ? vec3(-1.3, -E, 3.2) : i < 5 ? vec3(-6. + float(i - 1) * 4., -E, 8.5 + .5 * sin(fi * 3.)) : vec3(-12.5 + float(i - 5) * 5., -E, 17. + .8 * sin(fi * 2.));
    vec2 hs = (base.xy + vec2(0., 1.8) - eye.xy) / base.z;
    col += vec3(1., .2, .15) * blink * exp(-length(uv - hs) * 220. * base.z / 3.) * 1.2;
  }
  for (int g = 0; g < 4; g++) {
    float fg = float(g), ph = t * (.35 + .07 * fg) + fg * 1.7;
    vec2 gp = vec2(-1.3 / 3.2, (1.8 - E) / 3.2 + .1) + vec2(cos(ph) * (.14 + .04 * fg), sin(ph) * (.05 + .02 * fg) + .03 * sin(ph * 2.));
    vec2 gv = (uv - gp) * (110. + 20. * fg); float flap = .35 + .3 * sin(t * 6. + fg * 2.);
    float gull = smoothstep(.12, .04, abs(gv.y - flap * abs(gv.x))) * step(abs(gv.x), 1.) * step(0., rd.y);
    col = mix(col, vec3(.25, .25, .28) * (.3 + .7 * day), gull * .9);
  }
  float railY = -.4; float rail = smoothstep(.006, .003, abs(uv.y - railY)) + step(abs(fract(uv.x * 3. + .5) - .5), .012) * step(uv.y, railY) * step(-.5, uv.y);
  vec3 railC = mix(vec3(.3, .32, .35), vec3(.75, .78, .8), .5 + .5 * smoothstep(-.004, .004, uv.y - railY + .002)) * (.3 + .7 * day);
  col = mix(col, railC, clamp(rail, 0., 1.));
  col = mix(col, railC * .6, step(uv.y, railY - .006) * .0);
  col = 1. - exp(-col * 1.5);
  col += dither(t);
  gl_FragColor = vec4(col, 1.);
}`,S=()=>y(x,b({res:.8,heavy:!0})),C=`
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
}`,w=()=>y(C,{res:1,speed:1,before(e,t,n,r){n.uniform1f(r.uB,f)}});function T(){let u,v=-1,y,b,x,S,C,w=()=>Math.abs(c()-v)>.04,T=(e,t)=>{e.shadowColor=t?`rgba(5,15,35,.35)`:`transparent`,e.shadowBlur=t?14*y:0,e.shadowOffsetY=t?5*y:0},E=(e,t,n)=>{e.fillStyle=n,e.beginPath(),t.forEach((t,n)=>n?e.lineTo(t[0],t[1]):e.moveTo(t[0],t[1])),e.closePath(),e.fill()},D=(e,t,n,a=24)=>{let o=[[-30,r+30]];for(let r=-30;r<=i+30;r+=a)o.push([r,e-t*(.5+.5*Math.sin(r*.005+n)*Math.sin(r*.0021+n*2.1))-t*.15*Math.abs(Math.sin(r*.02+n))]);return o.push([i+30,r+30]),o};function O(){let a=c();v=a,y=Math.min(i,r)/800,b=r*(i>r?.5:.46);let o;[u,o]=e(i,r),o.fillStyle=n(l([8,20,44],[60,90,140],h,a)),o.fillRect(0,0,i,r);let s=i*.76,f=b*(.3+.3*(1-a)),w=Math.min(i,r)*.06;o.fillStyle=n(l([30,44,80],[120,140,190],[200,230,245],a)),o.beginPath(),o.arc(s,f,w*2.2,0,Math.PI*2),o.fill(),T(o,!0),o.fillStyle=n(l([220,225,240],[255,210,150],[255,250,225],a)),o.beginPath(),o.arc(s,f,w,0,Math.PI*2),o.fill(),T(o,!1),T(o,!0),E(o,D(b-r*.02,r*.2,1.7),n(l([24,44,80],[80,110,160],[150,190,220],a))),T(o,!1),o.save(),o.beginPath();let O=D(b-r*.02,r*.2,1.7);O.forEach((e,t)=>t?o.lineTo(e[0],e[1]):o.moveTo(e[0],e[1])),o.clip(),E(o,[[-30,0],...O.slice(1,-1).map(e=>[e[0],e[1]+r*.045+Math.sin(e[0]*.04)*4*y]),[i+30,0]].reverse(),n(l([70,90,120],[200,215,235],g,a))),o.restore(),T(o,!0),E(o,D(b+r*.01,r*.12,4.2),n(l([14,32,60],[40,75,120],[90,140,185],a)));let k=b+r*.02,A=l([10,28,56],[20,80,140],[40,150,210],a),j=[];for(let e=-30;e<=i+30;e+=20)j.push([e,k+r*.07+Math.sin(e*.03)*4*y]);E(o,[[-30,k],[i+30,k],...j.reverse()],n(A)),o.fillStyle=n(g,.25);for(let e=0;e<14;e++){let e=t(0,i),n=k+r*t(.015,.055);o.beginPath(),o.roundRect(e,n,t(20,60)*y,3*y,2),o.fill()}let M=i*(i>r?.22:.26),N=Math.min(i*.3,300*y*1.6),P=b+r*.06,F=b+r*.2,I=d()?l([40,50,70],[190,196,210],[236,240,246],a):l([10,24,36],[30,70,60],_,a);E(o,[[-30,r+30],[-30,P-r*.04],[M-N*.6,P-r*.05],[M-N*.5,P],[M-N*.5,r+30]],n(I.map(e=>e*.85))),E(o,[[M+N*.5,r+30],[M+N*.5,P],[M+N*.8,P-r*.05],[M+N*1.4,P-r*.01],[i+30,P+r*.02],[i+30,r+30]],n(I.map(e=>e*.85))),o.fillStyle=n(l([90,100,120],[180,190,205],[236,240,244],a)),o.beginPath(),o.moveTo(M-N/2,P),o.quadraticCurveTo(M,P+r*.015,M+N/2,P),o.lineTo(M+N*.42,F),o.quadraticCurveTo(M,F+r*.03,M-N*.42,F),o.fill(),o.fillStyle=n(l([60,70,90],[140,150,170],[200,210,220],a)),o.fillRect(M-N*.16,F+r*.01,N*.32,r*.035),o.fillStyle=n(g,.9),o.beginPath(),o.moveTo(M-N*.05,P+r*.012),o.lineTo(M+N*.05,P+r*.012),o.lineTo(M+N*.07,F),o.lineTo(M-N*.07,F),o.fill();let L=r*(i>r?.72:.7);E(o,[[-30,r+30],[-30,L-r*.02],[i*.5,L-r*.1],[i+30,L-r*.03],[i+30,r+30]],n(I)),T(o,!1);let R=40*y,z=15*y;for(let e=0;e<(i>r?5:6);e++){let t=L+e*z*1.9+z,r=1+e*.18;for(let s=i*.1-e%2*R*.5;s<i*.95;s+=R*r*1.12)o.fillStyle=n(l([8,16,34],p,[18,46,90],a)),o.beginPath(),o.moveTo(s+R*r*.12,t),o.lineTo(s+R*r,t),o.lineTo(s+R*r*.88,t+z*r),o.lineTo(s,t+z*r),o.fill(),o.fillStyle=n(m,.8),o.fillRect(s+R*r*.12,t,R*r*.88,1.5*y)}let B=[[M+N*.3,F-r*.02],[i*.52,L-r*.09],[i*.82,L-r*.075],[i+40,L-r*.1]];o.strokeStyle=n(l([30,40,60],[60,80,110],[60,80,100],a)),o.lineWidth=Math.max(1.5,2*y),o.lineCap=`round`;for(let[e,t]of B)o.beginPath(),o.moveTo(e-8*y,t+60*y),o.lineTo(e,t),o.lineTo(e+8*y,t+60*y),o.moveTo(e-12*y,t+8*y),o.lineTo(e+12*y,t+8*y),o.stroke();o.lineWidth=Math.max(1,1.2*y);for(let e=0;e<B.length-1;e++){let[t,n]=B[e],[r,i]=B[e+1];o.beginPath(),o.moveTo(t,n+8*y),o.quadraticCurveTo((t+r)/2,(n+i)/2+30*y,r,i+8*y),o.stroke()}x=[];let V=i>r?5:3;for(let e=0;e<V;e++){let n=i*(.48+.48/V*e);x.push({x:n,y:b+r*.01-r*.12*(.5+.5*Math.sin(n*.005+4.2)*Math.sin(n*.0021+8.8))+2,h:(64+18*Math.sin(e*2.3))*y,ph:t(0,6.28),sp:t(.85,1.15)})}for(let e=0;e<(i>r?2:1);e++)x.push({x:i*(.64+e*.16),y:k+r*.045,h:42*y,ph:t(0,6.28),sp:t(.9,1.1)});if(S||=Array.from({length:5},(e,n)=>({x:t(0,i),y:b*(.12+n/5*.5),w:t(110,220)*y,v:t(4,9)*y})),!C){let t;[C,t]=e(256,256);let n=t.createImageData(256,256);for(let e=0;e<n.data.length;e+=4){let t=118+Math.random()*20;n.data[e]=n.data[e+1]=n.data[e+2]=t,n.data[e+3]=255}t.putImageData(n,0,0)}}function k(e,t){let r=n(l([40,56,96],[170,160,200],[255,255,255],t));T(s,!0),s.fillStyle=r,s.beginPath(),s.roundRect(e.x,e.y,e.w,e.w*.22,e.w*.11),s.fill(),s.beginPath(),s.arc(e.x+e.w*.35,e.y,e.w*.17,0,Math.PI*2),s.arc(e.x+e.w*.6,e.y+e.w*.02,e.w*.13,0,Math.PI*2),s.fill(),T(s,!1)}function A(e,t,r,i){let{x:a,y:o,h:c}=e,u=t*i*e.sp+e.ph,d=n(l([170,180,200],[225,230,240],[255,255,255],r));T(s,!0),s.fillStyle=d,s.beginPath(),s.moveTo(a-c*.04,o),s.lineTo(a-c*.018,o-c),s.lineTo(a+c*.018,o-c),s.lineTo(a+c*.04,o),s.fill();for(let e=0;e<3;e++){let t=u+e*Math.PI*2/3,n=Math.cos(t),r=Math.sin(t),i=-r,l=n,d=c*.6;s.beginPath(),s.moveTo(a+i*c*.03,o-c+l*c*.03),s.lineTo(a+n*d,o-c+r*d),s.lineTo(a-i*c*.03,o-c-l*c*.03),s.fill()}T(s,!1),s.fillStyle=n(m),s.beginPath(),s.arc(a,o-c,c*.035,0,Math.PI*2),s.fill()}return{init(){v=-1},draw(e,t){(v<0||w())&&O();let l=c();s.drawImage(u,0,0,i,r),s.save(),s.beginPath(),s.rect(0,0,i,b),s.clip();for(let e of S)e.x+=e.v*t*(.5+f),e.x>i+20&&(e.x=-e.w-20),k(e,l);s.restore();let d=.5+1.6*f+.4*o.bass;for(let t of x)A(t,e,l,d);s.fillStyle=n(m,.5+.5*a);for(let t=0;t<4;t++){let n=(e*.06+t/4)%1,a=i*(.2+n*.9),o=r*(i>r?.6:.58)+Math.sin(n*9)*8*y;s.beginPath(),s.arc(a,o,3*y,0,Math.PI*2),s.fill()}s.globalCompositeOperation=`overlay`,s.globalAlpha=.35;for(let e=0;e<r;e+=256)for(let t=0;t<i;t+=256)s.drawImage(C,t,e);s.globalAlpha=1,s.globalCompositeOperation=`source-over`}}}var E=`
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
}`,D=()=>y(E,b({res:.85}));export{w as blueprintScene,S as offshoreScene,T as paperValleyScene,D as solarNoonScene};