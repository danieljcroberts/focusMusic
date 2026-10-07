// three.js ocean (MIT): the Water and Sky example objects. three.js is resolved through the import map in index.html
// and loaded from the CDN only when this scene is opened, so it stays out of the bundle.
import { W, H, DPR, glc, gctxFallback } from '../view.js';
import { A } from '../assets.js';

/* three.js ocean (MIT): Water + Sky example objects, loaded only when the scene is opened */
export function oceanScene() {
  let renderer, scene, camera, water, loading = null, failed = false;
  async function boot() {
    try {
      // The specifiers are kept out of literal form so Vite leaves them to the browser's import map.
      const cdn = s => import(/* @vite-ignore */ s);
      const THREE = await cdn('three');
      const { Water } = await cdn('three/addons/objects/Water.js');
      const { Sky } = await cdn('three/addons/objects/Sky.js');
      renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true });
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .42;
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(52, 1, 1, 20000);
      camera.position.set(0, 14, 100);
      const normals = new THREE.TextureLoader().load(A + 'waternormals.jpg', tx => { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; });
      water = new Water(new THREE.PlaneGeometry(10000, 10000), {
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
      size();
    } catch (e) { failed = true; }
  }
  function size() { if (!renderer) return; renderer.setPixelRatio(DPR); renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
  return {
    kind: 'webgl',
    init() { if (!loading) loading = boot(); size(); },
    draw(t) {
      if (!renderer) {
        if (failed) { gctxFallback('The ocean scene needs WebGL and a connection to the three.js CDN.'); }
        return;
      }
      water.material.uniforms.time.value = t * .6;
      camera.position.y = 14 + Math.sin(t * .35) * .8;
      camera.lookAt(0, 8 + Math.sin(t * .27) * .4, -200);
      renderer.render(scene, camera);
    }
  };
}
