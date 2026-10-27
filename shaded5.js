import{x as e}from"./util.js";import{_ as t,i as n,r}from"./music.js";import{c as i}from"./app.js";var a=`
float fbm3o(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.07 + 11.3; a *= .5; } return v; }
float dither(float t){ return (h21(gl_FragCoord.xy + fract(t)) - .5) / 160.; }
float px(){ return 1.5 / uRes.y; }
// The route: gentle bends either way, x as a function of distance along it.
float route(float z){ return 3. * sin(z * .045) + 1.2 * sin(z * .11 + 1.); }
`;function o(i,a,o={},s=1){let c=0,l=0,u=140;return{res:.8,...o,before(d,f,p,m){let h=n();u+=(h.bpm-u)*Math.min(1,f*.8);let g=typeof s==`function`?s(u):s;l+=f*h.bpm/60/g;let _=(h.beats-h.one)/g-l;l+=(_-Math.round(_))*Math.min(1,f*4),c+=f*i*(u/140)*(1+a*(r.bass*.7+t*.6)*.5)*(e?1.4:1),p.uniform1f(m.uC,c),p.uniform1f(m.uB,l),o.before&&o.before(d,f,p,m)}}}var s=(e,t)=>i(a+e,t),c=`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, cz = uC;
  float stride = uB;                                                    // one stride per beat of the music
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
}`,l=()=>s(c,o(3.2,.6,{res:.75})),u=`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, cz = uC;
  float sway = sin(uB * 3.1416) * .006;                                  // a pedal stroke on every beat
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
    col = mix(col, mix(vec3(.3, .48, .25) * (.75 + .5 * noise(vec2(wx, wz) * .15)), vec3(.6, .7, .8), 1. - exp(-tg * .06)), step(3.6, wx));      // beyond the rail, the valley far below
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
}`,d=()=>s(u,o(7,.5,{res:.8})),f=`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, cz = uC;
  float ph = fract(uB), drive = smoothstep(.0, .35, ph) * smoothstep(1., .45, ph);   // the stroke: catch, drive, recovery
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
      float k = float(i), rel = (fract(uB) + k) * 4.5 + 1.5;   // one swirl pair per stroke, falling behind at the boat's pace
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
}`,p=()=>s(f,o(1.6,.5,{res:.8},e=>e>150?6:4)),m=`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, cz = uC;
  float stride = uB, bob = abs(sin(stride * 3.1416)) * .03 * (1. + uBass * .5);   // a footfall on every beat
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
}`,h=`
vec3 hsl2(vec3 c){ vec3 rgb = clamp(abs(mod(c.x * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); return c.z + c.y * (rgb - .5) * (1. - abs(2. * c.z - 1.)); }
`,g=()=>s(h+m,o(6.5,.6,{res:.8})),_=`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, cz = uC;
  float st = uB, roll = sin(st * 3.1416) * .05;                                          // the body rolls with each stroke
  vec2 q = vec2(uv.x * cos(roll) - uv.y * sin(roll), uv.x * sin(roll) + uv.y * cos(roll));
  vec3 rd = normalize(vec3(q.x, q.y - .2, 1.));                                           // looking ahead and down the lane
  vec3 col = vec3(.05, .35, .5);
  float camY = 1.1;
  if (rd.y < 0.) {
    float tg = camY / -rd.y; vec3 p = rd * tg; float wz = cz + p.z, wx = p.x;
    vec2 tile = fract(vec2(wx, wz) * 4.) - .5;
    float grout = smoothstep(.46, .5, max(abs(tile.x), abs(tile.y)));
    vec3 floorC = mix(vec3(.75, .9, .95), vec3(.5, .7, .8), grout);
    floorC = mix(floorC, vec3(.05, .07, .12), smoothstep(.11, .09, abs(wx)) * (1. - step(.5, fract(wz / 25.)) * step(fract(wz / 25.), .52)));   // the black line, with the T at each end
    floorC = mix(floorC, vec3(.05, .07, .12), smoothstep(.62, .6, abs(wx)) * step(fract(wz / 25.), .03) );
    float ca = pow(abs(sin(noise(vec2(wx, wz) * 1.5 + t * .3) * 6.28 + noise(vec2(wx, wz) * 2.3 - t * .2) * 5.)), 8.);
    floorC += vec3(.6, .85, .9) * ca * .5;
    col = mix(floorC * .9, vec3(.05, .3, .45), 1. - exp(-tg * .09));
  }
  // The lane ropes: chains of floats along the surface either side, coloured in bands.
  for (int s2 = 0; s2 < 2; s2++) {
    float side = s2 == 0 ? -1. : 1.;
    for (int i = 0; i < 26; i++) {
      float wz = floor(cz / .45) * .45 + float(i) * .45 + .45, rel = wz - cz;
      vec3 c = vec3(side * 1.1, .12, rel);
      vec2 sp = vec2(c.x, c.y + .2 * c.z) / c.z;
      float r = .07 / c.z, band = step(.5, fract(wz / 4.5));
      float d = length((q - sp) * vec2(1., 1.6));
      col = mix(col, mix(vec3(.9, .2, .15), vec3(.95, .95, .9), band) * (.6 + .4 * smoothstep(r, -r, q.y - sp.y)), smoothstep(r, r * .7, d) * exp(-rel * .03));
    }
  }
  // The surface above: bright and broken, light through it.
  float surf = smoothstep(.3, .5, q.y);
  col = mix(col, vec3(.6, .85, .95) * (.8 + .4 * noise(vec2(q.x * 6. + t * .4, q.y * 10.))), surf * .8);
  // Bubbles streaming past from each stroke.
  for (int i = 0; i < 14; i++) {
    float fi = float(i), life = fract(st * .5 + fi * .13), side = mod(fi, 2.) * 2. - 1.;
    vec2 bp = vec2(side * (.25 + .4 * life) + (h21(vec2(fi, 2.)) - .5) * .2, -.1 + life * .5 + (h21(vec2(fi, 4.)) - .5) * .2);
    float r = .01 + .015 * h21(vec2(fi, 6.));
    col += vec3(.85, .95, 1.) * smoothstep(px() * 2., 0., abs(length(q - bp) - r)) * (1. - life) * .8;
  }
  col *= 1. - .35 * smoothstep(.5, 1.2, length(uv));
  col = 1. - exp(-col * 1.4);
  gl_FragColor = vec4(col + dither(t), 1.);
}`,v=()=>s(_,o(1.6,.4,{res:.8},2)),y=`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, cz = uC;
  float turn = sin(uB * 3.1416), roll = turn * .07, camX = turn * .9;
  vec2 q = vec2(uv.x * cos(roll) - uv.y * sin(roll), uv.x * sin(roll) + uv.y * cos(roll));
  vec3 rd = normalize(vec3(q.x, q.y - .12, 1.3));
  vec3 sky = mix(vec3(.75, .85, .95), vec3(.25, .5, .9), smoothstep(-.05, .45, rd.y));
  vec3 col = sky;
  // Peaks far ahead.
  float pk = .03 + .14 * pow(abs(sin(rd.x * 2.2 + 1.)), 2.) + .04 * noise(vec2(rd.x * 8., 1.));
  if (rd.y > 0. && rd.y < pk) col = mix(vec3(.92, .95, 1.), vec3(.55, .6, .72), smoothstep(.5, .9, noise(vec2(rd.x * 60., rd.y * 8.))) * .6 * smoothstep(pk, pk - .08, rd.y)) * mix(.75, 1., smoothstep(-.2, .3, rd.x));
  float camY = 1.5;
  if (rd.y < 0.) {
    float tg = camY / -rd.y; vec3 p = rd * tg; float wz = cz + p.z, wx = camX + p.x;
    vec3 snow = vec3(.9, .93, .98) * (.9 + .1 * noise(vec2(wx * 3., wz * 3.)));
    snow *= .9 + .1 * sin(wx * 18.);                                                   // corduroy from the groomer
    snow = mix(snow, snow * .8, smoothstep(.0, .1, sin(wx * .9 + wz * .2)) * .3);     // shadows of the rollers
    snow *= 1. - .3 * smoothstep(6., 9., abs(wx));
    col = mix(snow, sky, 1. - exp(-tg * .02));
  }
  // Pines along both edges, and gates (red, then blue) flicking past.
  for (int i = 15; i >= 0; i--) {
    float row = floor(cz / 5.) + float(i) + 1., wz = row * 5.;
    for (int s2 = 0; s2 < 3; s2++) {
      float side = s2 == 0 ? -1. : 1., h = h21(vec2(row, float(s2)));
      bool gate = s2 == 2;
      float wx = gate ? (mod(row, 2.) * 2. - 1.) * 2.2 : side * (8. + h * 6.);
      vec2 rel = vec2(wx - camX, wz - cz);
      float vis = step(.6, rel.y); rel.y = max(rel.y, .6);
      float f = 1.3 / rel.y, sx = rel.x * f, by = -camY * f + .12, yq = q.y - by;
      if (gate) {
        float pole = step(abs(q.x - sx), max(px(), .04 * f)) * step(0., yq) * step(yq, 1.6 * f);
        float flag = step(0., q.x - sx) * step(q.x - sx, .6 * f) * step(1.1 * f, yq) * step(yq, 1.55 * f);
        vec3 fc = mod(row, 2.) < .5 ? vec3(.85, .15, .1) : vec3(.1, .3, .85);
        col = mix(col, fc, max(pole, flag) * vis * step(mod(row, 3.), 1.5));
      } else {
        float th = (6. + 4. * h) * f, cw = th * .3 * (1. - clamp(yq / th, 0., 1.)) * (1. + .25 * abs(fract(yq / th * 5.) - .5));
        float tree = step(abs(q.x - sx), cw) * step(th * .1, yq) * step(yq, th) * vis;
        vec3 tc = mix(vec3(.04, .13, .07), vec3(.8, .86, .92), .45 * smoothstep(.62, .72, noise(vec2(q.x * 260., q.y * 90.))) * step(.5, fract(yq / th * 5.)));   // snow on the boughs
        col = mix(col, mix(tc, sky, 1. - exp(-rel.y * .006)), tree);
      }
    }
  }
  // Snow spray at the turn, from the downhill edge of the skis.
  float spray = smoothstep(.6, 1., abs(turn)) * fbm3o(vec2(uv.x * 8. - sign(turn) * t * 4., uv.y * 8. + t * 3.));
  col = mix(col, vec3(1.), spray * smoothstep(-.1, -.5, uv.y) * step(abs(uv.x + sign(turn) * .3), .5) * .6);
  // Ski tips at the bottom.
  for (int s2 = 0; s2 < 2; s2++) {
    float side = s2 == 0 ? -1. : 1., x = side * .12 + turn * .03;
    col = mix(col, vec3(.85, .2, .15), step(abs(uv.x - x - (uv.y + .5) * turn * .1), .025) * step(uv.y, -.4));
  }
  col *= 1. - .25 * smoothstep(.5, 1.2, length(uv));
  col = 1. - exp(-col * 1.25);
  gl_FragColor = vec4(col + dither(t), 1.);
}`,b=()=>s(y,o(9,.5,{res:.8},2)),x=`
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT;
  float beat = uB, n = floor(beat), ph = fract(beat), side = mod(n, 2.) * 2. - 1.;
  float hit = exp(-ph * 5.) , swing = side * .05 * sin(ph * 6.) * exp(-ph * 2.5);
  // The gym: a brick wall lit by a high window, a strip light, a rope and a ring post in the gloom.
  vec2 b = uv * vec2(9., 18.); b.x += step(1., mod(floor(b.y), 2.)) * .5;
  float mortar = max(smoothstep(.44, .47, abs(fract(b.x) - .5)), smoothstep(.4, .45, abs(fract(b.y) - .5)));
  vec3 wall = mix(vec3(.32, .16, .1), vec3(.45, .24, .15), noise(floor(b) * .7)) * mix(1., .55, mortar);
  wall *= .35 + .9 * exp(-length((uv - vec2(-.45, .35)) * vec2(1., 1.4)) * 1.6);          // light from the window
  vec3 col = wall;
  col = mix(col, vec3(.95, .9, .75), step(abs(uv.y - .46), .012) * step(abs(uv.x + .1), .35));   // the strip light
  float floorY = -.38;
  if (uv.y < floorY) col = vec3(.12, .1, .09) * (.8 + .3 * noise(uv * 30.)) * (1. - (floorY - uv.y) * .8);
  col = mix(col, vec3(.1, .1, .12), step(abs(uv.x - .62), .02) * step(floorY, uv.y) * step(uv.y, .1));   // ring post
  for (int i = 0; i < 3; i++) col = mix(col, vec3(.7, .15, .12), smoothstep(.006, .002, abs(uv.y - (-.02 - float(i) * .06) - (uv.x - .62) * .05)) * step(.62, uv.x));
  // The bag: a long cylinder on a chain, swinging from a point above, shaded round, dented where it's hit.
  vec2 pivot = vec2(0., .56); float ang = swing;
  vec2 bq = uv - pivot; bq = vec2(bq.x * cos(ang) + bq.y * sin(ang), -bq.x * sin(ang) + bq.y * cos(ang));
  float chain = step(abs(bq.x), .006) * step(-.12, bq.y) * step(bq.y, 0.) * step(.3, fract(bq.y * 60.));
  col = mix(col, vec3(.55, .55, .58), chain);
  float top = -.12, bot = -.78, w = .12;
  float body = step(abs(bq.x), w) * step(bot, bq.y) * step(bq.y, top);
  float round_ = sqrt(max(0., 1. - pow(bq.x / w, 2.)));
  float dent = exp(-pow((bq.x - side * w * .6) / (w * .4), 2.) - pow((bq.y + .52) / .1, 2.)) * hit;
  vec3 bagC = vec3(.55, .08, .06) * (.25 + .9 * round_ * (1. - dent * .6)) + vec3(.4) * pow(round_, 12.) * .15;
  bagC = mix(bagC, vec3(.05), step(abs(bq.y - top + .03), .02) + step(abs(bq.y - bot - .03), .02));   // the end caps' bands
  col = mix(col, bagC, body);
  col = mix(col, vec3(.1), step(abs(bq.x), w * 1.05) * step(top, bq.y) * step(bq.y, top + .025));
  // The glove: coming in from the side of the punch, at the bag on the beat, then back.
  // The glove that just landed pulls back; in the last quarter of the beat the other one comes in, landing on the beat.
  bool next = ph > .62; float gs = next ? -side : side;
  float reach = next ? smoothstep(.62, 1., ph) * smoothstep(.62, 1., ph) : 1. - smoothstep(0., .3, ph);
  vec2 gp = vec2(gs * (.4 - .26 * reach), .04 + .02 * sin(ph * 3.)); float gr = .1 + .02 * reach;
  vec2 gq = (uv - gp) / gr;
  float glove = smoothstep(1., .95, length(gq * vec2(.85, 1.)));
  float cuff = step(abs(gq.y + .2), .5) * step(.6, gs * gq.x) * step(gs * gq.x, 1.6);
  vec3 gc = mix(vec3(.08, .1, .3), vec3(.2, .3, .7), smoothstep(-1., 1., gq.y)) + vec3(.4) * pow(max(0., 1. - length(gq - vec2(-.3, .4))), 4.);
  col = mix(col, vec3(.9, .9, .85), cuff * .9);
  col = mix(col, gc, glove);
  col += vec3(1., .9, .7) * hit * exp(-length(uv - vec2(side * w * .9, .04)) * 14.) * .25 * step(ph, .2);   // a little dust off the bag
  col *= 1. - .4 * smoothstep(.45, 1.2, length(uv));
  col = 1. - exp(-col * 1.4);
  gl_FragColor = vec4(col + dither(t), 1.);
}`,S=()=>s(x,o(1,0,{res:.85},1)),C=`
float ridge(float x, float k){ return .5 * abs(sin(x * 1.3 + k)) + .3 * noise(vec2(x * 3., k)) + .15 * noise(vec2(x * 9., k)); }
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float t = uT, cz = uC;
  float rock = sin(uB * 3.1416) * .01;                                                  // the bike rocks with each stroke
  vec2 q = uv + vec2(rock, abs(rock) * .5);
  vec3 col = mix(vec3(.7, .82, .95), vec3(.25, .48, .85), smoothstep(-.1, .5, q.y));
  // Mountains: far snowy peaks and a nearer green flank on the right with the valley below.
  float far = .16 + .28 * ridge(q.x * 1.5 + 2., 1.);
  float cap = far - .015 - .035 * noise(vec2(q.x * 14., 3.));
  col = mix(col, mix(vec3(.95, .97, 1.), vec3(.4, .45, .55) * (.8 + .3 * noise(q * vec2(40., 8.))), smoothstep(cap, cap - .01, q.y)), smoothstep(far + .003, far - .003, q.y));
  float near = .1 + .3 * ridge(q.x * 2. - 1., 4.) * smoothstep(-.4, .4, q.x);
  col = mix(col, vec3(.3, .45, .2) * (.8 + .3 * noise(q * 30.)), smoothstep(near + .003, near - .003, q.y) * step(-.05, q.x));
  // The road: climbing at 8%, so the horizon of the road sits high; a stone wall on the left, a low rail on the right.
  float grade = .08, camY = 1.3;
  vec3 rd = normalize(vec3(q.x, q.y - .05, 1.3));
  float den = grade * rd.z - rd.y;
  if (den > 0.) {
    float tg = camY / den; vec3 p = rd * tg; float wz = cz + p.z, wx = p.x - .8 * sin(wz * .03);
    float road = step(abs(wx), 3.);
    vec3 asph = vec3(.22, .22, .24) * (.85 + .3 * noise(vec2(wx * 6., wz * 6.)));
    vec3 verge = vec3(.35, .5, .2) * (.8 + .3 * noise(vec2(wx * 3., wz * 3.)));
    col = mix(verge, asph, road);
    col = mix(col, mix(vec3(.3, .48, .25) * (.75 + .5 * noise(vec2(wx, wz) * .15)), vec3(.6, .7, .8), 1. - exp(-tg * .06)), step(3.6, wx));      // beyond the rail, the valley far below
    col = mix(col, vec3(.95), step(abs(wx), .06) * step(.5, fract(wz * .15)) * road);
    col = mix(col, vec3(.95), step(abs(abs(wx) - 2.8), .05) * road);
    // Painted names on the tarmac now and then, as on the famous climbs.
    col = mix(col, vec3(.95, .95, .9), step(abs(wx - 1.), .5) * step(abs(fract(wz / 60.) - .5), .01) * road * .8);
    col = mix(col, vec3(.6, .6, .65), step(wx, -3.) * step(-3.6, wx) * .8);        // the wall's foot
  }
  // The stone wall on the left, rising off the road.
  float wx0 = -.42 * min(uRes.x / uRes.y, 1.2);
  float wallTop = .0 - (q.x - wx0) * .3;
  float wall = step(q.x, wx0 - q.y * .3) * step(q.y, wallTop) * step(-.6, q.y);
  vec2 sq = vec2(q.x * 30. / (1. - q.x), q.y * 26.); sq.x += step(1., mod(floor(sq.y), 2.)) * .5;
  col = mix(col, vec3(.55, .5, .45) * (.75 + .3 * noise(floor(sq))) * (1. - .3 * smoothstep(.0, .06, min(abs(fract(sq.x) - .5) - .45, abs(fract(sq.y) - .5) - .42) + .06)), wall);
  // Handlebars and hands, as on the night ride but in daylight.
  float bar = smoothstep(.012, .006, abs(uv.y + .44 + uv.x * uv.x * .25)) * step(abs(uv.x), .55);
  float stem = step(abs(uv.x), .025) * step(uv.y, -.43);
  col = mix(col, vec3(.08, .08, .1), max(bar, stem));
  for (int s2 = 0; s2 < 2; s2++) { float side = s2 == 0 ? -1. : 1.; col = mix(col, vec3(.15, .14, .16), smoothstep(.07, .06, length((uv - vec2(side * .5, -.47 - .005 * sin(uB * 3.1416 + float(s2) * 3.14))) * vec2(1., 1.4)))); }
  col *= 1. - .2 * smoothstep(.5, 1.2, length(uv));
  col = 1. - exp(-col * 1.3);
  gl_FragColor = vec4(col + dither(t), 1.);
}`,w=()=>s(C,o(3.5,.4,{res:.8},2));export{S as bagScene,w as climbScene,d as nightRideScene,v as poolScene,p as rowingScene,b as skiScene,g as trackScene,l as trailRunScene};