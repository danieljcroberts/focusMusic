/* global Image, document */
// Builds the thumbnails that ship with the app (public/assets/thumbs/<slug>.jpg, 160×90): it opens every scene with the
// controls hidden, in a headless Chromium against a running dev server, and keeps a small frame of each. A live capture
// replaces each one once the viewer has seen that scene.
// Usage: SMOKE_CHROMIUM=<path> node scripts/thumbs.mjs [url]   (default http://127.0.0.1:5173)
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SCENES } from '../src/data/scenes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.argv[2] || 'http://127.0.0.1:5173';
const out = join(root, 'public/assets/thumbs'); mkdirSync(out, { recursive: true });
const slug = s => s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 }, reducedMotion: 'reduce' });
await page.addInitScript(() => localStorage.setItem('sw-state', JSON.stringify({ seenHint: true, tod: 'dusk', finish: false })));
await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(800);
const scaler = await browser.newPage();
let n = 0;
for (let i = 0; i < SCENES.length; i++) {
  const s = SCENES[i];
  await page.evaluate(i => { document.getElementById('scene-' + i).click(); document.body.classList.add('idle'); }, i);
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.getElementById('toast').classList.remove('on'));   // the scene-name caption
  await page.waitForTimeout(250);
  let png; try { png = await page.screenshot({ timeout: 20000 }); } catch (e) { console.log(`screenshot of "${s.name}" timed out`); continue; }
  const jpg = await scaler.evaluate(async b64 => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = 160; c.height = 90;
    const g = c.getContext('2d'), k = Math.max(160 / im.width, 90 / im.height);
    g.drawImage(im, (160 - im.width * k) / 2, (90 - im.height * k) / 2, im.width * k, im.height * k);
    return c.toDataURL('image/jpeg', .55).split(',')[1];
  }, png.toString('base64'));
  writeFileSync(join(out, slug(s) + '.jpg'), Buffer.from(jpg, 'base64')); n++;
}
await browser.close();
console.log(`${n} thumbnails written to public/assets/thumbs`);
