// Maps each scene's metadata key to the code that draws it.
import { SCENES as META } from '../data/scenes.js';
import { W, H, ctx } from '../view.js';
import { glow } from '../util.js';
import { img, ok } from '../assets.js';
import { parallaxScene, driftScene, skyExtras } from './parallax.js';
import { videoScene } from './video.js';
import { photosScene } from './photos.js';
import { lavaScene, kaleidoScene, marbleScene, mandelScene, tunnelScene, spectrumScene, mandalaScene, plasmaScene, nebulaScene } from './trip.js';
import { rainImprovedScene, snowScene } from './glass.js';

import { report } from '../diag.js';
// Scene code is loaded the first time a scene is opened, so the app starts with only the few scenes it needs at once.
// While a scene's code loads, its stand-in draws nothing; the app is told when it arrives (sw-scene-loaded).
const MODS = {
  three_scenes: () => import('./three-scenes.js'),
  shaded2: () => import('./shaded2.js'),
  shaded: () => import('./shaded.js'),
  power: () => import('./power.js'),
  storm: () => import('./storm.js'),
  power2: () => import('./power2.js'),
  holmestrand: () => import('./holmestrand.js'),
  eighties: () => import('./eighties.js'),
  visualisers: () => import('./visualisers.js'),
  interiors: () => import('./interiors.js'),
  outdoors: () => import('./outdoors.js'),
  cosmos: () => import('./cosmos.js'),
  abstract: () => import('./abstract.js'),
  cozy: () => import('./cozy.js'),
  shaded3: () => import('./shaded3.js'),
  shaded4: () => import('./shaded4.js'),
};
const L = (mod, make) => ({ mod, make });

const FACTORIES = {
  rain: () => rainImprovedScene({ bg: 'tokyo' }),
  snow: () => snowScene({ bg: 'toronto' }),
  cafe: () => rainImprovedScene({ mode: 'cafe', bg: 'street' }),
  windscreen: () => rainImprovedScene({ mode: 'car', bg: 'traffic' }),
  greenhouse: () => rainImprovedScene({ mode: 'greenhouse', bg: 'foliage' }),

  canopy: L('shaded', m => m.canopyScene()),
  drive: L('shaded2', m => m.driveScene()),
  hearth: L('shaded2', m => m.hearthScene()),
  tide: L('shaded', m => m.tideScene()),
  aurora: L('shaded', m => m.auroraScene()),
  lighthouse: L('shaded', m => m.lighthouseScene()),
  train: L('shaded2', m => m.trainScene()),
  storm: L('shaded2', m => m.stormScene()),
  clouds: L('shaded', m => m.cloudsScene()),
  pond: L('shaded2', m => m.pondScene()),
  aquarium: L('shaded3', m => m.aquariumScene()),
  cleanPower: L('power', m => m.cleanPowerScene()),
  supercell: L('storm', m => m.supercellScene()),
  offshore: L('power2', m => m.offshoreScene()),
  blueprint: L('power2', m => m.blueprintScene()),
  paperValley: L('power2', m => m.paperValleyScene()),
  solarNoon: L('power2', m => m.solarNoonScene()),
  holmestrand: L('holmestrand', m => m.holmestrandScene()),
  photos: photosScene,
  synthwave: L('eighties', m => m.synthwaveScene()),
  neonhighway: L('eighties', m => m.neonHighwayScene()),
  vector: L('eighties', m => m.vectorScene()),
  lasers: L('eighties', m => m.laserShowScene()),
  memphis: L('eighties', m => m.memphisScene()),
  spectrumBars: L('visualisers', m => m.spectrumBarsScene()),
  feedback: L('visualisers', m => m.feedbackScene()),
  superscope: L('visualisers', m => m.superscopeScene()),
  beatstars: L('visualisers', m => m.beatStarsScene()),
  dancingscope: L('visualisers', m => m.dancingScopeScene()),
  tram: L('interiors', m => m.tramScene()),
  library: L('interiors', m => m.libraryScene()),
  lamproom: L('interiors', m => m.lamproomScene()),
  porthole: L('interiors', m => m.portholeScene()),
  greenhouseNight: L('interiors', m => m.greenhouseNightScene()),
  cabin: L('interiors', m => m.cabinScene()),
  koi: L('shaded3', m => m.koiScene()),
  zen: L('shaded3', m => m.zenScene()),
  desert: L('shaded3', m => m.desertScene()),
  bamboo: L('outdoors', m => m.bambooScene()),
  lanterns: L('outdoors', m => m.lanternsScene()),
  rooftops: L('outdoors', m => m.rooftopsScene()),
  harbour: L('outdoors', m => m.harbourScene()),
  fireflies: L('outdoors', m => m.firefliesScene()),
  volcano: L('shaded3', m => m.volcanoScene()),
  saturn: L('cosmos', m => m.saturnScene()),
  orrery: L('cosmos', m => m.orreryScene()),
  blackhole: L('cosmos', m => m.blackholeScene()),
  comet: L('shaded3', m => m.cometScene()),
  deepfield: L('cosmos', m => m.deepfieldScene()),
  mars: L('shaded3', m => m.marsScene()),
  ink: L('abstract', m => m.inkScene()),
  inkBeat: L('abstract', m => m.inkScene({ beat: true })),
  reaction: L('abstract', m => m.reactionScene()),
  flow: L('abstract', m => m.flowScene()),
  voronoi: L('abstract', m => m.voronoiScene()),
  scope: L('abstract', m => m.scopeScene()),
  murmuration: L('abstract', m => m.murmurationScene()),
  ferrofluid: L('abstract', m => m.ferrofluidScene()),
  pixeltrain: L('cozy', m => m.pixelTrainScene()),
  pier: L('cozy', m => m.pierScene()),
  arcade: L('cozy', m => m.arcadeScene()),
  crtrain: L('cozy', m => m.crtRainScene()),
  cat: L('cozy', m => m.catScene()),
  record: L('cozy', m => m.recordScene()),
  typewriter: L('cozy', m => m.typewriterScene()),
  jellyfish: L('cozy', m => m.jellyfishScene()),

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
  cityNight: () => driftScene({ src: 'city-night.jpg', bg: '#05070f', fx: .53 }),
  nightSky: () => { const fx = skyExtras(); return driftScene({ src: 'night-sky.jpg', bg: '#03040c', setup: fx.setup, extra: fx.extra }); },
  forestDusk: L('shaded3', m => m.forestDuskScene()),
  kelp: L('shaded3', m => m.kelpScene()),
  polarNight: L('shaded3', m => m.polarNightScene()),
  midnightSun: L('shaded3', m => m.midnightSunScene()),
  dayTrain: L('shaded3', m => m.dayTrainScene()),
  tent: L('shaded3', m => m.tentScene()),
  hut: L('shaded4', m => m.hutScene()),
  onsen: L('shaded4', m => m.onsenScene()),
  noonDesert: L('shaded4', m => m.noonDesertScene()),
  shelter: L('shaded4', m => m.shelterScene()),
  observatory: L('shaded4', m => m.observatoryScene()),
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

  ocean: L('three_scenes', m => m.oceanScene()),
  snowfall: L('three_scenes', m => m.snowfallScene()),
  starfield: L('three_scenes', m => m.starfieldScene()),

  earth: () => videoScene({ src: 'earth-night.mp4' }),
  blackMarble: () => videoScene({ src: 'black-marble.mp4' }),
  sun: () => videoScene({ src: 'sdo-sun.mp4' }),
  issAurora: () => videoScene({ src: 'iss-aurora.mp4' }),
  cliffs: () => driftScene({ src: 'cosmic-cliffs.jpg', bg: '#05070f' }),
  nebula: nebulaScene,

  lava: lavaScene,
  kaleido: kaleidoScene,
  marble: marbleScene,
  mandel: mandelScene,
  tunnel: tunnelScene,
  spectrum: spectrumScene,
  mandala: mandalaScene,
  plasma: plasmaScene,

  rainFilm: () => videoScene({ src: 'rain-window.mp4', poster: 'rain-window-poster.jpg' }),
};

export const SCENES = META;

export function makeScene(s) {
  const f = FACTORIES[s.key];
  if (typeof f === 'function') { const inst = f(); inst.kind = inst.kind || s.kind || 'canvas'; return inst; }
  return lazyScene(s, f);
}
// A stand-in that loads the scene's module on first init, then hands everything to the real scene.
function lazyScene(s, { mod, make }) {
  let real = null, loading = null, failed = null, pendingCost = null;
  const w = {
    kind: s.kind || 'canvas',
    get canvas() { return real ? real.canvas : undefined; },
    get bg() { return real ? real.bg : undefined; },
    get loaded() { return !!real || !!failed; },
    get cost() { return real ? real.cost : undefined; },
    set cost(c) { if (real) { if ('cost' in real) real.cost = c; } else pendingCost = c; },   // the app holds the crossfade until the real scene can draw
    init() {
      if (real) return real.init();
      if (!loading) loading = MODS[mod]().then(m => { real = make(m); real.kind = real.kind || s.kind || 'canvas'; w.kind = real.kind; if (pendingCost && 'cost' in real) real.cost = pendingCost; })
        .catch(e => { failed = new Error(`${s.name} couldn't be loaded (it needs a connection the first time)`); report(e); })
        .then(() => window.dispatchEvent(new CustomEvent('sw-scene-loaded', { detail: s.key })));
    },
    draw(t, dt) {
      if (real) return real.draw(t, dt);
      if (failed) throw failed;
      ctx.fillStyle = '#06070b'; ctx.fillRect(0, 0, W, H);
    },
  };
  return w;
}
// Fetch every scene's code in the background, a little at a time, so later scenes open at once and work offline.
export function prefetchScenes() {
  const list = Object.values(MODS); let i = 0;
  const next = () => { if (i >= list.length) return; list[i++]().catch(() => {}).finally(() => setTimeout(next, 400)); };
  next();
}
