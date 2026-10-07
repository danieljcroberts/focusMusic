// Maps each scene's metadata key to the code that draws it.
import { SCENES as META } from '../data/scenes.js';
import { W, H, ctx } from '../view.js';
import { glow } from '../util.js';
import { img, ok } from '../assets.js';
import { canopyScene, driveScene, hearthScene, tideScene, auroraScene } from './drawn.js';
import { parallaxScene, driftScene, skyExtras } from './parallax.js';
import { oceanScene } from './ocean.js';
import { rainImprovedScene, snowScene } from './glass.js';
import { rainPlusScene, rainGLScene, rainShaderScene, rainFilmScene } from './lab.js';

const FACTORIES = {
  rain: () => rainImprovedScene({ bg: 'tokyo' }),
  snow: () => snowScene({ bg: 'toronto' }),
  cafe: () => rainImprovedScene({ mode: 'cafe', bg: 'tokyo' }),

  canopy: canopyScene,
  drive: driveScene,
  hearth: hearthScene,
  tide: tideScene,
  aurora: auroraScene,

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

  ocean: oceanScene,

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
