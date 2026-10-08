// three.js scenes (MIT). three.js is bundled as its own chunk (src/scenes/three-lib.js) and loaded the first time one of
// these scenes is opened. All of them share one renderer on the #gl canvas.
import { W, H, DPR, glc, gctxFallback, requestRender } from '../view.js';
import { A } from '../assets.js';
import { rand } from '../util.js';
import { bands, musicLevel } from '../music.js';

let THREE = null, ADDONS = null, renderer = null, loading = null, failed = false;
async function load() {
  try {
    const m = await import('./three-lib.js');
    THREE = m.THREE; ADDONS = { Water: m.Water, Sky: m.Sky };
    renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true });
  } catch (e) { failed = true; }
  requestRender();
}

// build(THREE, ADDONS) returns { scene, camera, update(t, dt), tone?, exposure? }.
function threeScene(build) {
  let st = null;
  function size() {
    if (!renderer || !st) return;
    renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
    st.camera.aspect = W / H; st.camera.updateProjectionMatrix();
    if (st.resize) st.resize();
  }
  return {
    kind: 'webgl',
    init() { if (!loading) loading = load(); size(); },
    draw(t, dt) {
      if (!renderer) { if (failed) gctxFallback('This scene needs WebGL, which this browser has turned off.'); return; }
      if (!st) { st = build(THREE, ADDONS); size(); }
      renderer.toneMapping = st.tone ?? THREE.NoToneMapping; renderer.toneMappingExposure = st.exposure ?? 1;
      st.update(t, dt);
      renderer.render(st.scene, st.camera);
    }
  };
}

// A soft round dot for point sprites.
function dotTexture(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/* Open Water: the Water and Sky example objects, sun low, a slow swell */
export const oceanScene = () => threeScene((THREE, { Water, Sky }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 1, 20000);
  camera.position.set(0, 14, 100);
  const normals = new THREE.TextureLoader().load(A + 'waternormals.jpg', tx => { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; });
  const water = new Water(new THREE.PlaneGeometry(10000, 10000), {
    textureWidth: 512, textureHeight: 512, waterNormals: normals,
    sunDirection: new THREE.Vector3(), sunColor: 0xffe2c4, waterColor: 0x0b1f2e, distortionScale: 3.2, fog: false
  });
  water.rotation.x = -Math.PI / 2; scene.add(water);
  const sky = new Sky(); sky.scale.setScalar(10000);
  const u = sky.material.uniforms;
  u.turbidity.value = 8; u.rayleigh.value = 2.2; u.mieCoefficient.value = .005; u.mieDirectionalG.value = .82;
  const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(88.6), THREE.MathUtils.degToRad(180));
  u.sunPosition.value.copy(sun); water.material.uniforms.sunDirection.value.copy(sun).normalize();
  const pmrem = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
  env.add(sky); scene.environment = pmrem.fromScene(env).texture; scene.add(sky);
  return {
    scene, camera, tone: THREE.ACESFilmicToneMapping, exposure: .42,
    update(t) {
      water.material.uniforms.time.value = t * .6;
      water.material.uniforms.distortionScale.value = 3.2 + bands.bass * 2.5;   // the swell picks up with the music
      camera.position.y = 14 + Math.sin(t * .35) * (.8 + musicLevel * .6);
      camera.lookAt(0, 8 + Math.sin(t * .27) * .4, -200);
    }
  };
});

/* Snowfall: snow with depth over a cabin in the trees */
export const snowfallScene = () => threeScene(THREE => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, .1, 200);
  camera.position.set(0, 6, 30);
  // The backdrop is painted once on a canvas and hung far behind the snow.
  const c = document.createElement('canvas'); c.width = 1600; c.height = 900;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 900);
  gr.addColorStop(0, '#070a16'); gr.addColorStop(.6, '#1a2238'); gr.addColorStop(.72, '#2d3550'); gr.addColorStop(1, '#0c1020');
  g.fillStyle = gr; g.fillRect(0, 0, 1600, 900);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(230,236,255,${rand(.2, .8)})`; g.beginPath(); g.arc(rand(0, 1600), rand(0, 560), rand(.4, 1.4), 0, Math.PI * 2); g.fill(); }
  const moon = g.createRadialGradient(1250, 150, 0, 1250, 150, 220); moon.addColorStop(0, 'rgba(220,230,255,.5)'); moon.addColorStop(1, 'rgba(220,230,255,0)');
  g.fillStyle = moon; g.fillRect(0, 0, 1600, 900); g.fillStyle = '#e8ecff'; g.beginPath(); g.arc(1250, 150, 34, 0, Math.PI * 2); g.fill();
  const snowG = g.createLinearGradient(0, 640, 0, 900); snowG.addColorStop(0, '#5a6480'); snowG.addColorStop(1, '#2a3048');
  g.fillStyle = snowG; g.beginPath(); g.moveTo(0, 660); for (let x = 0; x <= 1600; x += 40) g.lineTo(x, 650 + Math.sin(x * .004) * 14 + Math.sin(x * .013) * 6); g.lineTo(1600, 900); g.lineTo(0, 900); g.fill();
  const tree = (x, y, h, col) => { g.fillStyle = col; for (let k = 0; k < 3; k++) { const w = h * (.26 - k * .06), yy = y - h * k * .3; g.beginPath(); g.moveTo(x, yy - h * .5); g.lineTo(x + w, yy); g.lineTo(x - w, yy); g.fill(); } };
  for (let x = -20; x < 1700; x += rand(40, 90)) if (x < 560 || x > 1000) tree(x, 672 + rand(-6, 6), rand(140, 230), '#0b1020');
  g.fillStyle = '#1a1210'; g.fillRect(700, 560, 190, 110); g.fillStyle = '#2a211c'; g.beginPath(); g.moveTo(680, 565); g.lineTo(795, 480); g.lineTo(910, 565); g.fill();
  g.fillStyle = '#e8ecf4'; g.beginPath(); g.moveTo(684, 560); g.lineTo(795, 478); g.lineTo(906, 560); g.lineTo(906, 572); g.lineTo(795, 492); g.lineTo(684, 572); g.fill();
  for (const [wx, wy] of [[725, 590], [825, 590]]) { const wg = g.createRadialGradient(wx + 20, wy + 18, 0, wx + 20, wy + 18, 90); wg.addColorStop(0, 'rgba(255,170,80,.45)'); wg.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = wg; g.fillRect(wx - 80, wy - 80, 200, 200); g.fillStyle = '#ffb860'; g.fillRect(wx, wy, 40, 36); g.fillStyle = '#1a1210'; g.fillRect(wx + 18, wy, 4, 36); g.fillRect(wx, wy + 16, 40, 4); }
  g.fillStyle = '#1a1210'; g.fillRect(860, 500, 18, 50);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: tex }));
  back.position.set(0, 6, -40); scene.add(back);
  const fit = () => { const d = 70, h = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); back.scale.set(Math.max(h * camera.aspect, h * 16 / 9) / 16, Math.max(h, h * camera.aspect * 9 / 16) / 9, 1); };
  // Snow: three sizes at three depths, each flake with its own fall speed and drift.
  const N = 2600, pos = new Float32Array(N * 3), vel = new Float32Array(N), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = rand(-50, 50); pos[i * 3 + 1] = rand(-5, 40); pos[i * 3 + 2] = rand(-38, 24); vel[i] = rand(1.4, 3.2); ph[i] = rand(0, 6.28); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(geo, new THREE.PointsMaterial({ size: .55, map: dotTexture(THREE), transparent: true, opacity: .9, depthWrite: false, sizeAttenuation: true, color: 0xeef2ff }));
  scene.add(snow);
  return {
    scene, camera, resize: fit,
    update(t, dt) {
      const gust = Math.sin(t * .13) * .8;
      for (let i = 0; i < N; i++) {
        pos[i * 3 + 1] -= vel[i] * dt;
        pos[i * 3] += (Math.sin(t * .7 + ph[i]) * .6 + gust) * dt;
        if (pos[i * 3 + 1] < -5) { pos[i * 3 + 1] = 40; pos[i * 3] = rand(-50, 50); }
        if (pos[i * 3] > 50) pos[i * 3] -= 100; else if (pos[i * 3] < -50) pos[i * 3] += 100;
      }
      geo.attributes.position.needsUpdate = true;
      camera.position.x = Math.sin(t * .11) * .6; camera.lookAt(0, 6 + Math.sin(t * .09) * .3, -40);
    }
  };
});

/* Starfield: a slow drift through sparse stars */
export const starfieldScene = () => threeScene(THREE => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 400);
  const groups = [];
  for (const [n, size, speed] of [[5000, .6, 5], [500, 1.6, 7], [60, 3.4, 9]]) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-120, 120); pos[i * 3 + 1] = rand(-70, 70); pos[i * 3 + 2] = rand(-300, 0);
      const k = Math.random(), c = k < .6 ? [1, 1, 1] : k < .85 ? [.75, .85, 1] : [1, .9, .7];
      col.set(c, i * 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: dotTexture(THREE), vertexColors: true, transparent: true, opacity: .95, depthWrite: false, sizeAttenuation: true }));
    scene.add(pts); groups.push({ pos, geo, speed, n });
  }
  return {
    scene, camera,
    update(t, dt) {
      for (const gr of groups) {
        for (let i = 0; i < gr.n; i++) { gr.pos[i * 3 + 2] += gr.speed * dt; if (gr.pos[i * 3 + 2] > 2) { gr.pos[i * 3 + 2] -= 300; gr.pos[i * 3] = rand(-120, 120); gr.pos[i * 3 + 1] = rand(-70, 70); } }
        gr.geo.attributes.position.needsUpdate = true;
      }
      camera.rotation.z = t * .004; camera.rotation.y = Math.sin(t * .05) * .03;
    }
  };
});
