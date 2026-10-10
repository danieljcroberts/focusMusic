// Space: Saturn's rings, a brass orrery, a black hole, a comet, a deep field and a Martian dust storm.
import { W, H, DPR, ctx, lowPower, lively } from '../view.js';
import { rand, hash, mix, rgb, layer, plain, glow } from '../util.js';
import { img, ok } from '../assets.js';
import { weather } from '../weather.js';
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
      const yaw = THREE.MathUtils.degToRad(62) - hf * .3 + Math.sin(t * .021) * .02;
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

/* Comet Pass: a comet crossing the stars over twenty minutes, its tails growing as it nears an unseen sun */
export function cometScene() {
  const LOOP = 1200;
  let sky, dust, ion, bright, sun;
  return {
    init() {
      let g; [sky, g] = layer(W + 60, H + 40);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#03040a'); gr.addColorStop(1, '#080a14'); g.fillStyle = gr; g.fillRect(0, 0, W + 60, H + 40);
      // A faint band of the Milky Way across the sky.
      g.save(); g.translate((W + 60) / 2, (H + 40) / 2); g.rotate(-.5); g.scale(1, .16);
      glow(g, 0, 0, Math.max(W, H) * .9, [150, 150, 190], .1); g.restore();
      const n = Math.round((W + 60) * (H + 40) / 900);
      for (let i = 0; i < n; i++) {
        g.fillStyle = `rgba(${Math.random() < .2 ? '255,226,200' : Math.random() < .3 ? '200,214,255' : '236,238,255'},${rand(.12, .6)})`;
        g.beginPath(); g.arc(rand(0, W + 60), rand(0, H + 40), rand(.25, .85), 0, TAU); g.fill();
      }
      bright = Array.from({ length: 34 }, () => ({ x: rand(-30, W + 30), y: rand(-20, H + 20), r: rand(.8, 1.7), ph: rand(0, TAU), sp: rand(.25, .6), c: Math.random() < .3 ? [255, 222, 190] : [220, 230, 255] }));
      // The unseen sun's glow at the bottom edge.
      [sun, g] = layer(W, H);
      glow(g, W * .8, H * 1.3, Math.max(W, H) * .8, [255, 214, 160], .2);
      // Tail sprites along +x, scaled to length each frame.
      let tg; [dust, tg] = layer(900, 320);
      tg.globalCompositeOperation = 'lighter';
      // A fan of synchrones: dust released at different times curves back by different amounts.
      for (let k = 0; k < 60; k++) {
        const c = k / 59, ln = tg.createLinearGradient(0, 0, 900, 0), a = .035 + .03 * Math.random();
        ln.addColorStop(0, `rgba(255,240,214,${a * 2})`); ln.addColorStop(.3, `rgba(255,226,180,${a})`); ln.addColorStop(1, 'rgba(255,210,160,0)');
        tg.strokeStyle = ln; tg.lineWidth = rand(3, 9);
        tg.beginPath(); tg.moveTo(0, 30);
        for (let x = 0; x <= 900; x += 30) tg.lineTo(x, 30 + c * 270 * Math.pow(x / 900, 1.7) + x * .02);
        tg.stroke();
      }
      [ion, tg] = layer(900, 80);
      tg.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 9; k++) {
        const off = rand(-1, 1), ln = tg.createLinearGradient(0, 0, 900, 0);
        const a = k === 0 ? .55 : rand(.1, .3);
        ln.addColorStop(0, `rgba(150,196,255,${a})`); ln.addColorStop(.5, `rgba(110,160,255,${a * .5})`); ln.addColorStop(1, 'rgba(90,130,255,0)');
        tg.strokeStyle = ln; tg.lineWidth = k === 0 ? 3 : rand(.6, 1.6);
        tg.beginPath(); tg.moveTo(0, 40); tg.quadraticCurveTo(450, 40 + off * 6, 900, 40 + off * 22); tg.stroke();
      }
      const blur = tg.createLinearGradient(0, 0, 900, 0);
      blur.addColorStop(0, 'rgba(120,170,255,.18)'); blur.addColorStop(1, 'rgba(120,170,255,0)');
      tg.fillStyle = blur; tg.beginPath(); tg.moveTo(0, 36); tg.lineTo(900, 10); tg.lineTo(900, 70); tg.lineTo(0, 44); tg.fill();
    },
    draw(t) {
      const m = Math.min(W, H), M = Math.max(W, H);
      const p = ((t + LOOP * .42) % LOOP) / LOOP, sw = Math.sin(TAU * (t / LOOP + .42));
      const ox = -30 + sw * 22, oy = -20 + sw * 8;
      ctx.drawImage(sky, ox, oy, W + 60, H + 40);
      ctx.drawImage(sun, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const s of bright) {
        const a = .55 + .35 * Math.sin(t * s.sp + s.ph) * Math.sin(t * s.sp * .37 + s.ph * 2);
        const x = s.x + sw * 50, y = s.y + sw * 16;
        glow(ctx, x, y, s.r * 5, s.c, a * .25);
        ctx.fillStyle = rgb(s.c, a); ctx.beginPath(); ctx.arc(x, y, s.r, 0, TAU); ctx.fill();
      }
      // The comet's path: a shallow arc, closest to the sun in the middle of the loop.
      const cx = W * (-.35 + 1.7 * p), cy = H * (.36 + .12 * Math.sin(p * Math.PI)) + 0;
      const sx = W * .8, sy = H * 1.3;
      const ang = Math.atan2(cy - sy, cx - sx);
      const near = 1 - Math.min(1, Math.abs(p - .5) * 2.1);
      const L = M * (.18 + .5 * Math.pow(near, 1.4)) * (W < H ? 1.1 : 1);
      // Dust tail: curved, lagging behind the motion (the comet moves +x, so the curve bends back toward -x).
      const side = Math.sin(ang) >= 0 ? 1 : -1;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
      ctx.scale(1, side);
      ctx.globalAlpha = .6 + .4 * near;
      ctx.drawImage(dust, 0, -30 * (L / 900), L, 320 * (L / 900));
      ctx.scale(1, side);
      ctx.globalAlpha = .3 + .45 * near;
      const IL = L * 1.15;
      ctx.drawImage(ion, 0, -40 * (IL / 900) * 1.3, IL, 80 * (IL / 900) * 1.3);
      ctx.restore(); ctx.globalAlpha = 1;
      // Coma and nucleus.
      const cr = m * (.025 + .02 * near);
      glow(ctx, cx, cy, cr * 2.4, [150, 220, 200], .14);
      glow(ctx, cx, cy, cr, [220, 255, 240], .55);
      glow(ctx, cx, cy, cr * .3, [255, 255, 255], .9);
      ctx.globalCompositeOperation = 'source-over';
    }
  };
}

/* Deep Field: a slow pan across Webb's first deep field, thousands of galaxies */
export function deepfieldScene() {
  const src = 'deep-field.jpg';
  return {
    init() { img(src); },
    draw(t) {
      ctx.fillStyle = '#020306'; ctx.fillRect(0, 0, W, H);
      const im = img(src);
      if (!ok(im)) return;
      const iw = im.naturalWidth, ih = im.naturalHeight;
      const z = 1.35 + .3 * Math.sin(t * .0061 + .8);
      const s = Math.max(W / iw, H / ih) * z, w = iw * s, h = ih * s;
      const fx = .5 + .45 * Math.sin(t * .0083 + 1.1), fy = .5 + .45 * Math.sin(t * .0057 + 2.3);
      const x = -(w - W) * fx, y = -(h - H) * fy;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(im, x, y, w, h);
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    }
  };
}

/* Mars Dust Storm: the view from a rover's mast camera as dust veils sweep across the plain */
export function marsScene() {
  let base, deck, veils, g0;
  return {
    init() {
      const m = Math.min(W, H), hy = H * (W > H ? .46 : .5);
      const sunX = W * .7, sunY = hy * .32;
      g0 = { hy, sunX, sunY, m };
      let g; [base, g] = layer(W, H);
      const sky = g.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, '#8a5e3c'); sky.addColorStop(.6, '#c39062'); sky.addColorStop(1, '#ddb487');
      g.fillStyle = sky; g.fillRect(0, 0, W, hy + 2);
      // Far ridges, hazy with distance.
      const ridge = (y0, amp, col, seed) => {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W + 8; x += 8) {
          const u = x / W;
          g.lineTo(x, y0 - amp * (.5 + .35 * Math.sin(u * 5.1 + seed) + .2 * Math.sin(u * 13.7 + seed * 2) + .08 * Math.sin(u * 41 + seed)) * (u > .55 ? 1.4 - (u - .55) : 1));
        }
        g.lineTo(W, H); g.fill();
      };
      ridge(hy, m * .07, '#c0946a', 1.3);
      ridge(hy + m * .01, m * .035, '#a87650', 4.1);
      // The plain.
      const gnd = g.createLinearGradient(0, hy, 0, H);
      gnd.addColorStop(0, '#a8714a'); gnd.addColorStop(.4, '#94603c'); gnd.addColorStop(1, '#6e4228');
      g.fillStyle = gnd; g.fillRect(0, hy + m * .012, W, H);
      g.save(); g.beginPath(); g.rect(0, hy, W, H - hy); g.clip();
      // Soft drifts and pebbles getting larger toward the camera.
      for (let i = 0; i < 40; i++) {
        const y = hy + Math.pow(Math.random(), 1.6) * (H - hy), k = (y - hy) / (H - hy);
        g.fillStyle = `rgba(${Math.random() < .5 ? '200,150,104' : '90,52,30'},${.06 + k * .08})`;
        g.beginPath(); g.ellipse(rand(0, W), y, (20 + 180 * k) * rand(.5, 1.5), (2 + 14 * k) * rand(.5, 1.5), 0, 0, TAU); g.fill();
      }
      const pebbles = Math.round(W * (H - hy) / 220);
      for (let i = 0; i < pebbles; i++) {
        const k = Math.pow(Math.random(), 1.5), y = hy + k * (H - hy), r = (.4 + 3 * k) * rand(.5, 1.4) * m / 800;
        g.fillStyle = `rgba(${Math.round(rand(60, 110))},${Math.round(rand(36, 60))},${Math.round(rand(24, 40))},${.5 + k * .4})`;
        g.beginPath(); g.ellipse(rand(0, W), y, r * 1.4, r * .8, 0, 0, TAU); g.fill();
      }
      // Rocks, lit from the sun's side, with shadows falling away from it.
      const rocks = Array.from({ length: 34 }, () => Math.pow(Math.random(), 1.8)).sort((a, b) => a - b);
      for (const k of rocks) {
        const y = hy + k * (H - hy) * .92 + m * .01, x = rand(-.05, 1.05) * W, r = (2 + 70 * k * k + 10 * k) * rand(.6, 1.3) * m / 800;
        const lit = x < sunX ? 1 : -1;
        g.fillStyle = 'rgba(60,30,16,.35)';
        g.beginPath(); g.ellipse(x - lit * r * .5, y + r * .22, r * 1.15, r * .26, 0, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(x - r, y + r * .2);
        const pts = 7;
        for (let j = 0; j <= pts; j++) { const a = Math.PI + j / pts * Math.PI; g.lineTo(x + Math.cos(a) * r * rand(.85, 1.15), y + Math.sin(a) * r * rand(.55, .9)); }
        g.closePath();
        const rg = g.createLinearGradient(x + lit * r * .6, y - r * .7, x - lit * r * .3, y + r * .2);
        rg.addColorStop(0, '#b47e56'); rg.addColorStop(.3, '#7a4a2e'); rg.addColorStop(1, '#4a2a18');
        g.fillStyle = rg; g.fill();
      }
      g.restore();
      // The rover: a slice of the deck along the bottom and the top of a wheel in the corner.
      let dg; [deck, dg] = layer(W, H);
      const dh = m * .085, wr = m * .2, wx = W * .86, wy = H + wr * .45;
      dg.fillStyle = '#2a2622';
      dg.beginPath(); dg.arc(wx, wy, wr, 0, TAU); dg.fill();
      const wgr = dg.createLinearGradient(wx - wr, 0, wx + wr, 0);
      wgr.addColorStop(0, '#6a6058'); wgr.addColorStop(.4, '#b4aaa0'); wgr.addColorStop(1, '#4a4038');
      dg.fillStyle = wgr; dg.beginPath(); dg.arc(wx, wy, wr * .96, 0, TAU); dg.fill();
      dg.strokeStyle = 'rgba(40,34,30,.7)'; dg.lineWidth = Math.max(1, wr * .04);
      for (let k = 0; k < 24; k++) {
        const a = Math.PI + k / 24 * Math.PI;
        dg.beginPath(); dg.moveTo(wx + Math.cos(a) * wr * .72, wy + Math.sin(a) * wr * .72); dg.lineTo(wx + Math.cos(a + .1) * wr * .96, wy + Math.sin(a + .1) * wr * .96); dg.stroke();
      }
      dg.fillStyle = 'rgba(160,110,70,.35)'; dg.beginPath(); dg.arc(wx, wy, wr * .96, Math.PI * 1.1, Math.PI * 1.45); dg.arc(wx, wy, wr * .7, Math.PI * 1.45, Math.PI * 1.1, true); dg.fill();
      dg.strokeStyle = '#4a4440'; dg.lineWidth = wr * .14; dg.lineCap = 'round';
      dg.beginPath(); dg.moveTo(wx - wr * 1.5, H - dh * .9); dg.lineTo(wx - wr * .15, wy - wr * .1); dg.stroke();
      dg.fillStyle = '#5a544e'; dg.beginPath(); dg.arc(wx, wy, wr * .2, 0, TAU); dg.fill();
      const dk = dg.createLinearGradient(0, H - dh, 0, H);
      dk.addColorStop(0, '#d8d0c4'); dk.addColorStop(.12, '#a89e92'); dk.addColorStop(1, '#4e4640');
      dg.fillStyle = dk;
      dg.beginPath(); dg.moveTo(-10, H - dh * .7); dg.lineTo(W * .58, H - dh); dg.lineTo(W * .66, H + 2); dg.lineTo(-10, H + 2); dg.fill();
      dg.fillStyle = 'rgba(60,54,50,.8)';
      for (let k = 0; k < 6; k++) { const x = W * (.04 + k * .09); dg.fillRect(x, H - dh * (.62 + k * .045) + 4, W * .05, 3); }
      dg.fillStyle = '#c8a24a'; dg.fillRect(W * .44, H - dh * .9 + 3, W * .06, dh * .3);
      dg.fillStyle = 'rgba(176,120,76,.35)'; dg.fillRect(0, H - dh, W * .66, dh * .25);
      // Dust veils: soft tileable bands, each with a column-density profile so the sun dims as they pass.
      veils = [[.05, .5, .55, 14], [.18, .55, .45, 24], [.32, .45, .35, 38], [.5, .35, .5, 60]].map(([top, hh, a, sp], vi) => {
        const bw = 384, bh = 96;
        const [c, vg] = plain(bw, bh);
        for (let k = 0; k < 160; k++) {
          const x = rand(0, bw), y = bh * (.5 + rand(-.25, .25)), r = rand(10, 40), al = rand(.08, .3);
          for (const xx of [x - bw, x, x + bw]) {
            const gr = vg.createRadialGradient(xx, y, 0, xx, y, r);
            gr.addColorStop(0, `rgba(226,176,124,${al})`); gr.addColorStop(1, 'rgba(226,176,124,0)');
            vg.fillStyle = gr; vg.fillRect(xx - r, y - r, r * 2, r * 2);
          }
        }
        const d = vg.getImageData(0, 0, bw, bh).data, col = new Float32Array(bw);
        for (let x = 0; x < bw; x++) { let s = 0; for (let y = 0; y < bh; y++) s += d[(y * bw + x) * 4 + 3]; col[x] = s / (bh * 255); }
        const mx = Math.max(...col);
        for (let x = 0; x < bw; x++) col[x] /= mx || 1;
        return { c, col, top: top * H - (vi === 0 ? H * .1 : 0), h: hh * H, a, sp, w: W * 1.6 };
      });
    },
    draw(t) {
      const { sunX, sunY, m } = g0;
      const wx = Math.max(.15, weather), spd = lively ? 1.8 : 1;
      ctx.drawImage(base, 0, 0, W, H);
      // Dust over the sun from the veils that cross it.
      let cover = 0;
      for (const v of veils) {
        const off = (t * v.sp * spd) % v.w;
        if (sunY > v.top && sunY < v.top + v.h) {
          const u = (((sunX - off) % v.w) + v.w) % v.w / v.w;
          cover += v.col[Math.floor(u * v.col.length) % v.col.length] * v.a;
        }
      }
      const vis = Math.max(.08, 1 - cover * (.4 + wx * 1.1));
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, sunX, sunY, m * .22, [190, 200, 220], .1 * vis);
      glow(ctx, sunX, sunY, m * .07, [230, 236, 245], .28 * vis);
      ctx.fillStyle = `rgba(246,246,240,${.85 * vis})`; ctx.beginPath(); ctx.arc(sunX, sunY, m * .011, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // A general haze, thicker in a storm.
      const hz = ctx.createLinearGradient(0, 0, 0, H);
      hz.addColorStop(0, `rgba(190,138,92,${.08 + wx * .3})`); hz.addColorStop(.5, `rgba(214,164,112,${.12 + wx * .4})`); hz.addColorStop(1, `rgba(190,138,92,${wx * .2})`);
      ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H);
      const n = lowPower ? 2 : veils.length;
      for (let i = 0; i < n; i++) {
        const v = veils[i], off = (t * v.sp * spd) % v.w;
        ctx.globalAlpha = Math.min(1, v.a * (.5 + wx * 1.3) * .7);
        // A repeating pattern wraps cleanly; drawing the tile side by side left a seam at every join.
        if (!v.pat) v.pat = ctx.createPattern(v.c, 'repeat-x');
        const k = v.w / v.c.width;
        ctx.save(); ctx.translate(off, v.top); ctx.scale(k, v.h / v.c.height);
        ctx.fillStyle = v.pat; ctx.fillRect(-v.c.width, 0, (W - off) / k + v.c.width * 2, v.c.height);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(deck, 0, 0, W, H);
      ctx.fillStyle = `rgba(200,150,104,${wx * .12})`; ctx.fillRect(0, 0, W, H);
    }
  };
}
