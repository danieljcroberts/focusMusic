/* global document, localStorage */ // inside page.evaluate callbacks, which run in the browser
// Pictures for the Google Play listing, from the running app (dev server): phone screenshots at 1080×1920 and the
// 1024×500 feature graphic, into docs/play-store/. Re-run when the scenes change.
// Usage: SMOKE_CHROMIUM=<path> node scripts/store-art.mjs [url]   (default http://127.0.0.1:5173)
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES } from '../src/data/scenes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = join(root, 'docs/play-store');
const url = process.argv[2] || 'http://127.0.0.1:5173';
mkdirSync(out, { recursive: true });
// The scenes shown, each at a time of day that suits it.
const SHOTS = [['harbour', 'dusk'], ['polarNight', 'night'], ['library', 'night'], ['koi', 'day'], ['tent', 'night'], ['aurora', 'night'], ['midnightSun', 'day'], ['zen', 'day']];
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function shot(key, tod, viewport, scale, path) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  await page.addInitScript(t => localStorage.setItem('sw-state', JSON.stringify({ seenHint: true, tourDone: true, tod: t })), tod);
  await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('#scene-0', { state: 'attached', timeout: 60000 });
  const i = SCENES.findIndex(s => s.key === key);
  await page.evaluate(i => { document.getElementById('scene-' + i).click(); document.body.classList.add('idle'); }, i);
  await page.waitForTimeout(5000);
  await page.evaluate(() => document.getElementById('toast').classList.remove('on'));
  await page.screenshot({ path, type: path.endsWith('.jpg') ? 'jpeg' : 'png', quality: path.endsWith('.jpg') ? 90 : undefined, timeout: 60000 });
  await page.close();
}
for (let n = 0; n < SHOTS.length; n++) {
  const [key, tod] = SHOTS[n];
  try { await shot(key, tod, { width: 540, height: 960 }, 2, join(out, `phone-${n + 1}-${key}.jpg`)); console.log(`phone-${n + 1}-${key}.jpg`); }
  catch (e) { console.log(`no screenshot of ${key}: ${e.message.split('\n')[0]}`); }
}
// The feature graphic: a wide scene with the name over it.
const bgPath = join(out, 'feature-bg.png');
await shot('harbour', 'dusk', { width: 1024, height: 500 }, 1, bgPath);
const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await page.setContent(`<body style="margin:0;width:1024px;height:500px;background:url(data:image/png;base64,${readFileSync(bgPath).toString('base64')}) center/cover;font-family:system-ui,sans-serif">
  <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,8,12,.78),rgba(7,8,12,.15) 70%)"></div>
  <div style="position:absolute;left:64px;top:50%;transform:translateY(-50%);color:#ece6da">
    <div style="font-size:64px;font-weight:300;letter-spacing:.01em">Slow Windows</div>
    <div style="font-size:24px;color:#d8cfbf;margin-top:10px">Calm scenes, free music, a focus timer</div>
  </div></body>`);
await page.screenshot({ path: join(out, 'feature-graphic.png') });
await browser.close();
console.log(`written to ${out}`);
