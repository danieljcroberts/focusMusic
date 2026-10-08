// Maps each scene's metadata key to the code that draws it.
import { SCENES as META } from '../data/scenes.js';
import { W, H, ctx } from '../view.js';
import { glow } from '../util.js';
import { img, ok } from '../assets.js';
import { canopyScene, driveScene, hearthScene, tideScene, auroraScene } from './drawn.js';
import { parallaxScene, driftScene, skyExtras } from './parallax.js';
import { oceanScene, snowfallScene, starfieldScene } from './three-scenes.js';
import { lighthouseScene, trainScene, stormScene, cloudsScene, pondScene, aquariumScene } from './places.js';
import { videoScene } from './video.js';
import { lavaScene, kaleidoScene, marbleScene, mandelScene, tunnelScene, spectrumScene, mandalaScene, plasmaScene } from './trip.js';
import { rainImprovedScene, snowScene } from './glass.js';
import { rainPlusScene, rainGLScene, rainShaderScene, rainFilmScene } from './lab.js';

const FACTORIES = {
  rain: () => rainImprovedScene({ bg: 'tokyo' }),
  snow: () => snowScene({ bg: 'toronto' }),
  cafe: () => rainImprovedScene({ mode: 'cafe', bg: 'tokyo' }),
  windscreen: () => rainImprovedScene({ mode: 'car', bg: 'traffic' }),
  greenhouse: () => rainImprovedScene({ mode: 'greenhouse', bg: 'foliage' }),

  canopy: canopyScene,
  drive: driveScene,
  hearth: hearthScene,
  tide: tideScene,
  aurora: auroraScene,
  lighthouse: lighthouseScene,
  train: trainScene,
  storm: stormScene,
  clouds: cloudsScene,
  pond: pondScene,
  aquarium: aquariumScene,

  woods: () => parallaxScene({ bw: 272, bh: 160, bg: '#2a170c', layers: [
    { src: 'woods-back.png', v: 2 }, { src: 'woods-lights.png', v: 4, alpha: t => .65 + .35 * Math.sin(t * 1.3) },
    { src: 'woods-middle.png', v: 6 }, { src: 'woods-front.png', v: 10 }] }),
  campfire: () => parallaxScene({ bw: 272, bh: 160, bg: '#1a0e08', preload: ['campfire.png'], layers: [
    { src: 'woods-back.png' }, { src: 'woods-lights.png', alpha: t => .4 + .2 * Math.sin(t * .9) }, { src: 'woods-middle.png' }, { src: 'woods-front.png' }],
    extra(t, dt, b) {
      ctx.fillStyle = 'rgba(8,6,28,.5)'; ctx.fillRect(0, 0, W, H);
      const im = img('campfire.png'); if (!ok(im)) return;
      const f = Math.floor(t * 8) % 4, size = 32 * b.s, x = Math.round(W / 2 - size / 2), y = Math.round(b.y + b.lh - size - 6 * b.s);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, W / 2, y + size * .6, 70 * b.s * (1 + .06 * Math.sin(t * 9)), [255, 120, 40], .28);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(im, f * 32, 0, 32, 32, x, y, size, size);
    } }),
  ridge: () => parallaxScene({ bw: 1280, bh: 360, bg: '#93deC5', layers: [
    { src: 'ridge-sky.png' }, { src: 'ridge-sun.png' }, { src: 'ridge-clouds.png', v: 3 }, { src: 'ridge-mountains-3.png', v: 2 },
    { src: 'ridge-mountains-2.png', v: 5 }, { src: 'ridge-mountains-1.png', v: 9 }, { src: 'ridge-trees.png', v: 14 }, { src: 'ridge-rocks.png', v: 20 }] }),
  peaks: () => parallaxScene({ bw: 270, bh: 170, bg: '#4e9886', anchor: 'center', layers: [
    { src: 'peaks-sky.png' }, { src: 'peaks-cloud4.png', v: 1.5 }, { src: 'peaks-cloud3.png', v: 3 }, { src: 'peaks-mountain.png', v: .5 },
    { src: 'peaks-cloud1.png', v: 5 }, { src: 'peaks-cloud2.png', v: 8 }] }),
  blocks: () => parallaxScene({ bw: 240, bh: 135, bg: '#251a50', anchor: 'center', layers: [
    { src: 'blocks-bg.png' }, { src: 'blocks-back.png', v: 3 }, { src: 'blocks-middle.png', v: 6 }, { src: 'blocks-front.png', v: 11 }] }),
  seaview: () => parallaxScene({ bw: 1920, bh: 1080, smooth: true, anchor: 'center', bg: '#9ad3e6', layers: [
    { src: 'seaview-sky.png' }, { src: 'seaview-clouds.png', v: 7 }, { src: 'seaview-hills.png' },
    { src: 'seaview-sea.png', bob: t => Math.sin(t * .5) * 3 }, { src: 'seaview-foreground.png' }] }),
  cityNight: () => driftScene({ src: 'city-night.jpg', bg: '#05070f' }),
  nightSky: () => { const fx = skyExtras(); return driftScene({ src: 'night-sky.jpg', bg: '#03040c', setup: fx.setup, extra: fx.extra }); },
  forestDusk: () => ({ kind: 'image', init() {}, draw() {} }),
  reef: () => parallaxScene({ bw: 256, bh: 192, bg: '#2a62d8', layers: [
    { src: 'reef-far.png', v: .6 }, { src: 'reef-sand.png', v: 2 }, { src: 'reef-fore-2.png', v: 5 }, { src: 'reef-fore-1.png', v: 9 }],
    extra(t, dt, b) {
      // Light from the surface and a few bubbles on their way up.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const x0 = W * (.15 + .22 * i) + Math.sin(t * .13 + i * 2) * 50, a = .05 + .035 * Math.sin(t * .5 + i);
        const sg = ctx.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, `rgba(190,230,255,${a})`); sg.addColorStop(.75, 'rgba(190,230,255,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 60, 0); ctx.lineTo(x0 + 190, H); ctx.lineTo(x0 - 10, H); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(220,240,255,.6)'; ctx.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const p = ((t * .12 + i * .37) % 1), x = W * (.1 + .1 * i) + Math.sin(t * 2 + i) * 6 * b.s, y = H - p * H * .9, r = (1 + (i % 3)) * b.s * .6;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      }
    } }),
  summits: () => parallaxScene({ bw: 576, bh: 324, bg: '#9ab0c0', layers: [
    { src: 'summit-5.png' }, { src: 'summit-4.png', v: .8 }, { src: 'summit-3.png', v: 2.5 }, { src: 'summit-2.png', v: 6 }, { src: 'summit-1.png', v: 12 }],
    extra(t, dt, b) {
      // Snow blowing off the ridges.
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i < 60; i++) {
        const p = (t * (.08 + .04 * (i % 5)) + i * .173) % 1, x = (W * (1.1 - p * 1.2) + Math.sin(i) * 40) % (W + 20), y = H * (.1 + .8 * ((i * .618) % 1)) + Math.sin(t * 1.5 + i) * 8 * b.s;
        ctx.fillRect(Math.round(x), Math.round(y), b.s, b.s);
      }
    } }),

  ocean: oceanScene,
  snowfall: snowfallScene,
  starfield: starfieldScene,

  earth: () => videoScene({ src: 'earth-night.mp4' }),

  lava: lavaScene,
  kaleido: kaleidoScene,
  marble: marbleScene,
  mandel: mandelScene,
  tunnel: tunnelScene,
  spectrum: spectrumScene,
  mandala: mandalaScene,
  plasma: plasmaScene,

  labCanvas: () => rainPlusScene({ bg: 'drawn' }),
  labGL: () => rainGLScene({ bg: 'drawn' }),
  labShader: () => rainShaderScene({ bg: 'drawn' }),
  labFilm: rainFilmScene,
  labPhotoGL: () => rainGLScene({ bg: 'waterfront' }),
  labPhotoShader: () => rainShaderScene({ bg: 'tokyo' }),
  labPhotoGL2: () => rainGLScene({ bg: 'toronto', v2: true }),
};

// Open the page with #lab to compare the rain renderers.
export const LAB = location.hash === '#lab';
export const SCENES = META.filter(s => LAB || !s.lab);

export function makeScene(s) {
  const inst = FACTORIES[s.key]();
  inst.kind = inst.kind || s.kind || 'canvas';
  return inst;
}
