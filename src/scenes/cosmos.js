// Space: Saturn's rings, a brass orrery, a black hole and a deep field. Comet Pass and Mars Dust Storm are in shaded3.js.
import { W, H, DPR, ctx, lowPower, lively } from '../view.js';
import { rand, hash, mix, rgb, layer, plain, glow } from '../util.js';
import { img, ok } from '../assets.js';
import { bands } from '../music.js';
import { shaderScene } from './trip.js';
import { threeScene, dotTexture } from './three-scenes.js';

const TAU = Math.PI * 2;

/* Saturn's Rings: drifting just above the ring plane, Saturn's banded curve filling one side */
export const saturnScene = () => threeScene(THREE => {
  const R = 60, RC = 2.15 * R;                     // Saturn's radius; the camera rides in the A ring
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, .05, 3000);
  const C = new THREE.Vector3(-RC, 0, 0);          // Saturn's centre; the camera sits at the origin, radial is +x, orbit is -z
  const sun = new THREE.Vector3(-.3, .1, -1).normalize();
  // Ring optical depth by radius (in Saturn radii): C ring, B ring, the Cassini division, A ring, Encke gap, F ring.
  const ringAt = r => {
    if (r < 1.24 || r > 2.34) return 0;
    if (r < 1.53) return .22 + .08 * Math.sin(r * 140);
    if (r < 1.95) return .75 + .2 * Math.sin(r * 90) * Math.sin(r * 23);
    if (r < 2.03) return .04;
    if (r < 2.27) return (Math.abs(r - 2.214) < .006 ? .05 : .55 + .12 * Math.sin(r * 120)) * (r > 2.2 ? .85 : 1);
    if (r > 2.32) return .5;
    return 0;
  };
  // Saturn: bands painted once on a canvas.
  const sc = document.createElement('canvas'); sc.width = 64; sc.height = 1024;
  const sg = sc.getContext('2d');
  for (let y = 0; y < 1024; y++) {
    const lat = (y / 1024 - .5) * 2, a = Math.abs(lat);
    const base = mix([214, 186, 140], [150, 140, 120], Math.pow(a, 1.6));
    const band = Math.sin(lat * 38 + Math.sin(lat * 9) * 1.5) * .5 + Math.sin(lat * 97) * .2 + (hash(Math.floor(lat * 60), 3) - .5) * .5;
    const c = mix(base, band > 0 ? [240, 220, 176] : [160, 112, 70], Math.min(1, Math.abs(band) * .7));
    sg.fillStyle = rgb(a > .8 ? mix(c, [120, 140, 150], (a - .8) * 3) : c); sg.fillRect(0, y, 64, 1);
  }
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
  const saturn = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 64), new THREE.MeshLambertMaterial({ map: stex }));
  saturn.position.copy(C); saturn.scale.y = .9; scene.add(saturn);
  const light = new THREE.DirectionalLight(0xfff4e6, 3.2); light.position.copy(sun); scene.add(light);
  scene.add(new THREE.AmbientLight(0x404858, .12));
  // The far ring: one disc with the bands as a 1D texture, faded out near the camera where the particles take over,
  // and darkened inside Saturn's shadow.
  const rc = document.createElement('canvas'); rc.width = 1024; rc.height = 1;
  const rg = rc.getContext('2d');
  for (let x = 0; x < 1024; x++) {
    const r = 1.2 + x / 1024 * 1.2, d = ringAt(r);
    const c = mix([196, 176, 150], [232, 214, 186], Math.min(1, d + .2 * Math.sin(r * 31)));
    rg.fillStyle = rgb(c, Math.min(1, d * 1.1)); rg.fillRect(x, 0, 1, 1);
  }
  const rtex = new THREE.CanvasTexture(rc); rtex.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(new THREE.RingGeometry(1.2 * R, 2.4 * R, 512, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { tex: { value: rtex }, cen: { value: C }, sun: { value: sun }, R: { value: R }, glow: { value: 1 } },
    vertexShader: `varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D tex; uniform vec3 cen, sun; uniform float R, glow; varying vec3 vP;
      void main(){
        vec3 q = vP - cen; float r = length(q.xz) / R;
        vec4 c = texture2D(tex, vec2((r - 1.2) / 1.2, .5));
        float along = dot(q, sun); vec3 perp = q - along * sun;
        float shadow = along < 0. ? smoothstep(R * .97, R * 1.03, length(perp)) : 1.;
        float near = smoothstep(3., 16., length(vP - cameraPosition));
        gl_FragColor = vec4(c.rgb * (.08 + .92 * shadow) * glow, c.a * near * .95);
      }`
  }));
  disc.rotation.x = -Math.PI / 2; disc.position.copy(C); scene.add(disc);
  // Near ring particles: three sizes, kept in a box around the camera and sheared by their orbits.
  const dot = dotTexture(THREE), groups = [];
  const box = { r0: -40, r1: 14, s0: -75, s1: 25 };
  for (const [n, size, thick] of [[lowPower ? 6000 : 16000, .09, .5], [lowPower ? 1200 : 3200, .17, .7], [lowPower ? 40 : 110, .36, .9]]) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let x, d;
      do { x = rand(box.r0, box.r1); d = ringAt((RC + x) / R); } while (Math.random() > d);
      pos[i * 3] = x; pos[i * 3 + 1] = rand(-thick, thick) * .5; pos[i * 3 + 2] = rand(box.s0, box.s1);
      const k = rand(.6, 1.05), warm = Math.random();
      col.set([k * (.95 + .05 * warm), k * (.86 + .04 * warm), k * (.74 - .06 * warm)], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size, map: dot, vertexColors: true, transparent: true, opacity: .9, depthWrite: false, sizeAttenuation: true });
    scene.add(new THREE.Points(geo, mat)); groups.push({ pos, geo, mat, n });
  }
  // Sparse stars on a far shell.
  const sn = 900, spos = new Float32Array(sn * 3);
  for (let i = 0; i < sn; i++) {
    const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(2000);
    spos.set([v.x, v.y, v.z], i * 3);
  }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  scene.add(new THREE.Points(sgeo, new THREE.PointsMaterial({ size: 1.3, map: dot, transparent: true, opacity: .7, depthWrite: false, sizeAttenuation: false, color: 0xdfe6ff })));
  const look = new THREE.Vector3();
  return {
    scene, camera,
    update(t, dt) {
      const drift = 1.1 * (lively ? 2 : 1);
      for (const gr of groups) {
        for (let i = 0; i < gr.n; i++) {
          const x = gr.pos[i * 3];
          let z = gr.pos[i * 3 + 2] + (drift + x * .045) * dt;   // inner particles orbit faster
          if (z > box.s1) z -= box.s1 - box.s0; else if (z < box.s0) z += box.s1 - box.s0;
          gr.pos[i * 3 + 2] = z;
        }
        gr.geo.attributes.position.needsUpdate = true;
        gr.mat.opacity = .82 + .15 * bands.bass;
      }
      disc.material.uniforms.glow.value = 1 + .08 * bands.bass;
      // Turn toward Saturn just enough to keep its limb in the left part of the frame at any aspect.
      const hf = Math.atan(Math.tan(THREE.MathUtils.degToRad(25)) * camera.aspect);
      const yaw = THREE.MathUtils.degToRad(62 + Math.max(0, 1 - camera.aspect) * 14) - hf * .3 + Math.sin(t * .021) * .02;   // a narrow frame turns further toward the planet
      camera.position.set(0, 1.4 + Math.sin(t * .05) * .25, 0);
      look.set(-Math.sin(yaw), -.06 + Math.sin(t * .033) * .01, -Math.cos(yaw)).add(camera.position);
      camera.lookAt(look);
      camera.rotateZ(Math.sin(t * .017) * .015);
    }
  };
});

/* Orrery: a brass orrery under a lamp, planets turning at their true relative speeds */
export function orreryScene() {
  // Orbital periods in years, enamel colours, sizes, moons.
  const PL = [
    [.2408, [150, 146, 140], .26], [.6152, [226, 206, 160], .38], [1, [58, 112, 178], .4, 1], [1.881, [178, 78, 52], .32],
    [11.86, [204, 170, 128], .78, 4], [29.46, [222, 196, 132], .66, 1, true], [84.01, [150, 206, 214], .5], [164.8, [64, 98, 190], .5]
  ];
  let bg, sprites, sunS, g0, start;
  return {
    init() {
      const portrait = H > W * 1.1, tilt = portrait ? .8 : .44;
      const R = Math.min(W * .41, H * .4 / tilt), cx = W / 2, cy = H * .48;
      g0 = { R, cx, cy, tilt, unit: R / 30 };
      start = rand(0, 5000);
      let g; [bg, g] = layer(W, H);
      // Velvet: deep wine-black with a soft nap, lamp light from the upper left.
      g.fillStyle = '#0a0507'; g.fillRect(0, 0, W, H);
      const [nap, ng] = plain(160, 160 * H / W);
      const id = ng.createImageData(nap.width, nap.height);
      for (let i = 0; i < id.data.length; i += 4) { const v = rand(0, 1); id.data[i] = 40 + v * 30; id.data[i + 1] = 14 + v * 10; id.data[i + 2] = 22 + v * 14; id.data[i + 3] = 255; }
      ng.putImageData(id, 0, 0); g.globalAlpha = .4; g.drawImage(nap, 0, 0, W, H); g.globalAlpha = 1;
      glow(g, W * .28, H * .18, Math.max(W, H) * .9, [255, 196, 140], .22);
      glow(g, cx, cy, R * 1.3, [255, 210, 160], .1);
      const vig = g.createRadialGradient(cx, cy, Math.min(W, H) * .3, cx, cy, Math.max(W, H) * .8);
      vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.65)'); g.fillStyle = vig; g.fillRect(0, 0, W, H);
      // The plinth: a dark wooden disc with a brass rim, below the works.
      const drop = g0.unit * 3; g0.drop = drop;
      g.save(); g.translate(cx, cy + drop); g.scale(1, tilt);
      glow(g, 0, 0, R * 1.3, [0, 0, 0], .6);
      const PR = R * 1.16, wood = g.createRadialGradient(-R * .3, -R * .3, 0, 0, 0, PR);
      wood.addColorStop(0, '#3a2016'); wood.addColorStop(1, '#170b07');
      g.fillStyle = wood; g.beginPath(); g.arc(0, 0, PR, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(214,170,96,.7)'; g.lineWidth = g0.unit * .5; g.stroke();
      // A printed scale around the rim, like a clock face.
      g.strokeStyle = 'rgba(214,174,104,.55)';
      for (let k = 0; k < 120; k++) {
        const a = k / 120 * TAU, l = k % 10 === 0 ? 1.6 : k % 5 === 0 ? 1 : .55;
        g.lineWidth = g0.unit * (k % 10 === 0 ? .22 : .12);
        g.beginPath(); g.moveTo(Math.cos(a) * PR * .985, Math.sin(a) * PR * .985); g.lineTo(Math.cos(a) * (PR * .985 - g0.unit * l), Math.sin(a) * (PR * .985 - g0.unit * l)); g.stroke();
      }
      g.restore();
      // Thin brass orbit rings at the planets' height.
      for (let i = 0; i < PL.length; i++) {
        const r = R * (.2 + i * .1);
        g.strokeStyle = `rgba(222,180,108,${.32 - i * .015})`; g.lineWidth = Math.max(.6, g0.unit * .12);
        g.beginPath(); g.ellipse(cx, cy, r, r * tilt, 0, 0, TAU); g.stroke();
      }
      // Planet sprites: enamel balls lit from the lamp.
      const ball = (c, rad, banded) => {
        const pad = 4, s = Math.ceil(rad * 2 + pad * 2);
        const [cv, bg2] = layer(s, s), o = s / 2;
        const gr = bg2.createRadialGradient(o - rad * .4, o - rad * .45, rad * .05, o, o, rad);
        gr.addColorStop(0, rgb(mix(c, [255, 250, 236], .65))); gr.addColorStop(.35, rgb(c)); gr.addColorStop(1, rgb(mix(c, [0, 0, 0], .72)));
        bg2.fillStyle = gr; bg2.beginPath(); bg2.arc(o, o, rad, 0, TAU); bg2.fill();
        if (banded) {
          bg2.save(); bg2.beginPath(); bg2.arc(o, o, rad, 0, TAU); bg2.clip();
          for (const [y, w, a] of [[-.35, .12, .25], [-.1, .16, .3], [.18, .12, .25], [.42, .1, .2]]) {
            bg2.fillStyle = `rgba(120,70,40,${a})`; bg2.fillRect(o - rad, o + y * rad, rad * 2, w * rad);
          }
          bg2.restore();
        }
        bg2.fillStyle = 'rgba(255,255,250,.75)'; bg2.beginPath(); bg2.arc(o - rad * .38, o - rad * .42, rad * .16, 0, TAU); bg2.fill();
        return cv;
      };
      sprites = PL.map(p => ball(p[1], g0.unit * p[2] * 2.2, p[2] > .6));
      sprites.moon = ball([214, 206, 190], g0.unit * .22, false);
      // The sun: a polished brass sphere.
      const sr = R * .085, ss = Math.ceil(sr * 2 + 8);
      let sgx; [sunS, sgx] = layer(ss, ss);
      const so = ss / 2, sgr = sgx.createRadialGradient(so - sr * .35, so - sr * .4, sr * .05, so, so, sr);
      sgr.addColorStop(0, '#fff6d8'); sgr.addColorStop(.25, '#f1c66a'); sgr.addColorStop(.7, '#a8752c'); sgr.addColorStop(1, '#4a2c10');
      sgx.fillStyle = sgr; sgx.beginPath(); sgx.arc(so, so, sr, 0, TAU); sgx.fill();
      sgx.strokeStyle = 'rgba(80,46,14,.5)'; sgx.lineWidth = 1;
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; sgx.beginPath(); sgx.moveTo(so + Math.cos(a) * sr * .55, so + Math.sin(a) * sr * .55); sgx.lineTo(so + Math.cos(a) * sr * .95, so + Math.sin(a) * sr * .95); sgx.stroke(); }
    },
    draw(t) {
      const { R, cx, cy, tilt, unit } = g0, T = start + t;
      ctx.drawImage(bg, 0, 0, W, H);
      const items = PL.map((p, i) => {
        const a = (i * 2.3 + T * TAU / (20 * p[0] / .2408)) % TAU, r = R * (.2 + i * .1);
        return { i, p, a, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * tilt, h: unit * (1.2 + i * .55) };
      });
      const brass = 'rgba(206,160,84,.9)', lw = Math.max(1, unit * .22);
      // Central column and its collars.
      const colH = unit * 6;
      const cg = ctx.createLinearGradient(cx - unit, 0, cx + unit, 0);
      cg.addColorStop(0, '#5a3a16'); cg.addColorStop(.35, '#e8c27a'); cg.addColorStop(1, '#4a2c10');
      ctx.fillStyle = cg; ctx.fillRect(cx - unit * .6, cy, unit * 1.2, colH);
      const drawPlanet = it => {
        const { p, x, y, h } = it, sp = sprites[it.i];
        glow(ctx, x - unit * .6, y + g0.drop + unit * .2, unit * 2.2, [0, 0, 0], .45);
        // Arm from the column collar to the post, then the post up to the planet.
        ctx.strokeStyle = brass; ctx.lineWidth = lw; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, cy + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,236,190,.35)'; ctx.lineWidth = lw * .4;
        ctx.beginPath(); ctx.moveTo(cx, cy + h - lw * .3); ctx.lineTo(x, y + h - lw * .3); ctx.stroke();
        if (p[4]) { ctx.strokeStyle = 'rgba(232,196,120,.8)'; ctx.lineWidth = lw * .8; ctx.beginPath(); ctx.ellipse(x, y, sp.width / 2 / DPR * 1.0 + unit * .9, (unit * .9 + sp.width / 2 / DPR) * .32, -.25, Math.PI, TAU); ctx.stroke(); }
        const moons = p[3] || 0, mr = [unit * 1.4, unit * 1.9, unit * 2.4, unit * 2.9];
        const pos = [];
        for (let m = 0; m < moons; m++) {
          const ma = T * TAU / (5 + m * 4.5) + m * 1.7;
          pos.push({ x: x + Math.cos(ma) * mr[m], y: y + Math.sin(ma) * mr[m] * tilt, back: Math.sin(ma) < 0, m });
        }
        const moon = q => {
          ctx.strokeStyle = 'rgba(206,160,84,.55)'; ctx.lineWidth = lw * .5;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(q.x, q.y); ctx.stroke();
          const ms = sprites.moon.width / DPR; ctx.drawImage(sprites.moon, q.x - ms / 2, q.y - ms / 2, ms, ms);
        };
        pos.filter(q => q.back).forEach(moon);
        const s = sp.width / DPR; ctx.drawImage(sp, x - s / 2, y - s / 2, s, s);
        if (p[4]) { ctx.strokeStyle = 'rgba(240,210,140,.9)'; ctx.lineWidth = lw * .8; ctx.beginPath(); ctx.ellipse(x, y, s / 2 + unit * .9, (s / 2 + unit * .9) * .32, -.25, 0, Math.PI); ctx.stroke(); }
        pos.filter(q => !q.back).forEach(moon);
      };
      items.filter(it => it.y < cy).sort((a, b) => a.y - b.y).forEach(drawPlanet);
      const sw = sunS.width / DPR;
      glow(ctx, cx, cy, R * .22, [255, 210, 130], .18 + bands.bass * .08);
      ctx.drawImage(sunS, cx - sw / 2, cy - sw / 2, sw, sw);
      items.filter(it => it.y >= cy).sort((a, b) => a.y - b.y).forEach(drawPlanet);
    }
  };
}

/* Black Hole: a lensed accretion disk seen almost edge-on, after Interstellar's Gargantua */
export const blackholeScene = () => shaderScene(`
vec3 diskCol(vec3 p, vec3 v, float t){
  float r = length(p.xz);
  float ang = t * .9 / pow(r, 1.5);
  float c = cos(ang), s = sin(ang);
  vec2 q = mat2(c, -s, s, c) * p.xz;
  float a = atan(q.y, q.x);
  float n = fbm(vec2(a * 3.0, log(r) * 9.)) * .7 + fbm(q * 1.3) * .5;
  float rad = smoothstep(2.4, 3.2, r) * smoothstep(14., 7., r) * pow(3.2 / r, 1.15);
  float I = rad * (.45 + .9 * n * n);
  vec3 orbit = normalize(vec3(-p.z, 0., p.x));
  float beta = sqrt(.5 / r);
  float dop = 1. / (1. - beta * dot(orbit, -normalize(v)));
  dop = pow(dop, 2.6);
  vec3 hot = mix(vec3(1., .38, .08), vec3(1., .8, .5), clamp(rad * 1.1, 0., 1.));
  hot = mix(hot, vec3(.9, .95, 1.), clamp((dop - 1.4) * .4, 0., .5));
  return hot * I * dop * 2.2;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / min(uRes.x, uRes.y);
  float t = uT;
  float el = .1 + .015 * sin(t * .01);
  vec3 ro = vec3(0., sin(el), -cos(el)) * 24.;
  vec3 fw = normalize(-ro), rt = normalize(cross(vec3(0., 1., 0.), fw)), up = cross(fw, rt);
  float zoom = uRes.x < uRes.y ? .95 : .82;
  vec3 v = normalize(fw + (uv.x * rt + uv.y * up) * zoom);
  vec3 p = ro;
  vec3 col = vec3(0.); float al = 0.;
  float h2 = dot(cross(p, v), cross(p, v));
  float minR = 100.; bool hole = false;
  for (int i = 0; i < 260; i++) {
    float r = length(p);
    float dt = clamp(.06 * r, .03, 1.2);
    vec3 acc = -1.5 * h2 * p / pow(r, 5.);
    vec3 np = p + v * dt; v += acc * dt; np = p + v * dt;
    if (p.y * np.y < 0.) {
      vec3 x = mix(p, np, p.y / (p.y - np.y));
      float rr = length(x.xz);
      if (rr > 2.3 && rr < 14.5) {
        vec3 c = diskCol(x, v, t);
        float a = clamp(length(c) * .9, 0., .95);
        col += (1. - al) * c; al += (1. - al) * a;
      }
    }
    p = np; minR = min(minR, length(p));
    if (length(p) < 1.) { hole = true; break; }
    if (length(p) > 40. && dot(p, v) > 0.) break;
    if (al > .99) break;
  }
  if (!hole && al < .99) {
    vec3 d = normalize(v);
    vec3 sp = d * 90., cell = floor(sp);
    float hs = h21(cell.xy + cell.z * 7.31);
    float st = step(.985, hs) * fract(hs * 91.) * smoothstep(.4, .05, length(fract(sp) - .5));
    col += (1. - al) * vec3(.85, .9, 1.) * st * 1.6;
  }
  if (!hole) col += vec3(1., .72, .45) * exp(-max(minR - 1.5, 0.) * 7.) * .35 * (1. - al);
  float ex = 1.15 * (1. + uBass * .18);
  col = 1. - exp(-col * ex);
  col = pow(col, vec3(.95, 1., 1.08));
  gl_FragColor = vec4(col, 1.);
}`, { speed: 1, res: .8 });

/* Deep Field: a journey through Webb's first deep field. The photograph is the far layer; two fields of nearer stars
   slide across it with parallax, so the view has depth. The camera travels between the field's landmarks (the bright star,
   the lensing arcs round the cluster, the spirals) and lingers, with a slow roll. The brightest points bloom and twinkle,
   breathing with the bass. */
const DEEP_FS = `
uniform sampler2D uImg; uniform float uZoom, uReady, uRoll;
const float AR = .98;                                                // the photograph's width over its height
float lum(vec3 c){ return dot(c, vec3(.3, .55, .15)); }
// A field of faint stars in a plane nearer than the photograph; d is how much nearer.
vec3 nearStars(vec2 uv, vec2 c, float z, float d, float seed, float t){
  float zz = pow(z, 1. + d);
  vec2 q = (c - .5) * (1. + d) * 2. + uv / zz * 1.4;                 // moves and grows faster than the far layer
  float N = 26. + seed * 6.;
  vec2 g = q * N;
  vec2 cell = floor(g), f = fract(g) - .5;
  float h = h21(cell + seed);
  vec2 o = (vec2(h21(cell + 1.3 + seed), h21(cell + 7.1 + seed)) - .5) * .6;
  float r = length(f - o) / N * zz / 1.4;                              // back to screen units
  float px = 1. / uRes.y;
  float size = (.5 + 1.1 * pow(h21(cell + 3.3 + seed), 4.)) * px * (1. + .5 * d);
  float star = smoothstep(size * 1.8, size * .3, r) * step(.975 - d * .01, h);
  float tw = .7 + .3 * sin(t * (1.5 + h * 3.) + h * 40.);
  vec3 col = mix(vec3(.85, .9, 1.), vec3(1., .9, .75), step(.5, h21(cell + 9.9 + seed)));
  return col * star * tw * (.3 + .4 * d);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float cr = cos(uRoll), sr = sin(uRoll); uv = vec2(cr * uv.x - sr * uv.y, sr * uv.x + cr * uv.y);
  float t = uT, asp = uRes.x / uRes.y;
  float s = max(asp / AR, 1.);                                        // cover the screen at zoom 1
  vec2 c = vec2(uA, uB);
  vec2 tc = c + uv / (uZoom * s) * vec2(1. / AR, 1.);
  vec3 col = vec3(0.);
  if (uReady > .5) {
    vec3 im = texture2D(uImg, tc).rgb;
    // Bloom: the brightest points get a soft halo from a ring of samples, pulsing with the bass and twinkling.
    float px = 1. / (uRes.y * uZoom * s);
    vec3 halo = vec3(0.);
    for (int i = 0; i < 12; i++) {
      float a = float(i) * .5236;
      vec2 o = vec2(cos(a) / AR, sin(a)) * px * 3.5;
      vec3 sm = texture2D(uImg, tc + o).rgb;
      halo += max(sm - .5, 0.) * .5;
      sm = texture2D(uImg, tc + o * 2.4).rgb;
      halo += max(sm - .62, 0.) * .3;
    }
    halo /= 12.;
    vec2 cell = floor(tc * vec2(AR, 1.) * 900.);
    float h = h21(cell);
    float tw = .8 + .2 * sin(t * (2. + 2. * h) + h * 60.) * (.5 + .5 * uTreble);
    col = im + halo * (1.3 + 2.2 * uBass) * tw * vec3(1., .95, .88);
    col += im * max(lum(im) - .75, 0.) * .5 * (.6 + .8 * uBass);        // cores and spikes brighten with the beat
    float inside = step(0., tc.x) * step(tc.x, 1.) * step(0., tc.y) * step(tc.y, 1.);
    col *= inside;
  }
  // Nearer stars, two planes, and a few motes close by.
  col += nearStars(uv, c, uZoom, .35, 0., t);
  col += nearStars(uv, c, uZoom, .8, 5., t) * .8;
  col = mix(col, col * .55, smoothstep(.55, 1.2, length(uv)) * .8);    // vignette
  col += dither(t);
  gl_FragColor = vec4(col, 1.);
}`;
export function deepfieldScene() {
  const src = 'deep-field.jpg';
  // Landmarks as fractions of the photograph from its top left, with how close to go.
  const SPOTS = [[.43, .39, 2.6], [.52, .52, 2.3], [.64, .43, 3.2], [.86, .38, 3.4], [.57, .07, 3.], [.71, .57, 3.2], [.44, .68, 3.], [.17, .74, 2.6], [.5, .5, 1.12]];
  let leg = null, legs = 0, tex = null, uZoom, uReady, uImgLoc, uRoll, prog;
  const sm = x => x * x * x * (x * (x * 6 - 15) + 10);
  const pick = from => { let i; do { i = legs % 3 === 2 ? SPOTS.length - 1 : Math.floor(Math.random() * (SPOTS.length - 1)); } while (SPOTS[i] === from); return SPOTS[i]; };
  return shaderScene('float dither(float t){ return (h21(gl_FragCoord.xy + fract(t)) - .5) / 160.; }\n' + DEEP_FS, {
    res: 1.25, speed: 1,
    before(t, dt, gl, u) {
      if (!prog) { prog = gl.getParameter(gl.CURRENT_PROGRAM); uZoom = gl.getUniformLocation(prog, 'uZoom'); uReady = gl.getUniformLocation(prog, 'uReady'); uImgLoc = gl.getUniformLocation(prog, 'uImg'); uRoll = gl.getUniformLocation(prog, 'uRoll'); }
      const im = img(src);
      if (!tex && ok(im)) {
        tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tex);
        for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
        gl.uniform1i(uImgLoc, 2);
      }
      if (tex) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tex); }
      gl.uniform1f(uReady, tex ? 1 : 0);
      // The journey: ease from one landmark to the next over a minute or so, linger, move on. Every third stop is the wide view.
      const speed = (lively ? 1.7 : 1) * (lowPower ? .8 : 1);
      if (!leg) leg = { from: SPOTS[SPOTS.length - 1], to: SPOTS[0], t0: t, dur: 75, hold: 22 };
      let k = (t - leg.t0) * speed / leg.dur;
      if (k >= 1 + leg.hold / leg.dur) { legs++; leg = { from: leg.to, to: pick(leg.to), t0: t, dur: 60 + Math.random() * 40, hold: 15 + Math.random() * 20 }; k = 0; }
      const e = sm(Math.max(0, Math.min(1, k)));
      let cx = leg.from[0] + (leg.to[0] - leg.from[0]) * e, cy = leg.from[1] + (leg.to[1] - leg.from[1]) * e;
      const z = Math.exp(Math.log(leg.from[2]) + (Math.log(leg.to[2]) - Math.log(leg.from[2])) * e);
      // A slow drift round the landmark while lingering, and a slow roll of the whole view.
      cx += Math.sin(t * .05) * .012 / z; cy += Math.cos(t * .041) * .012 / z;
      const s = Math.max(W / H / .98, 1), hx = .5 / (z * s * .98) + .002, hy = .5 / (z * s) + .002;
      cx = Math.max(hx, Math.min(1 - hx, cx)); cy = Math.max(hy, Math.min(1 - hy, cy));
      gl.uniform1f(u.uA, cx); gl.uniform1f(u.uB, 1 - cy); gl.uniform1f(uZoom, z); gl.uniform1f(uRoll, Math.sin(t * .023) * .035);
    }
  });
}
