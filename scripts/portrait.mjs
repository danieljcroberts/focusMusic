/* global document, window, localStorage */ // inside page.evaluate callbacks, which run in the browser
// Portrait check: screenshots every scene (or some) at phone size in headless Chromium against a running dev server,
// then lays them out as contact sheets, so framing problems on a tall screen show up before a deploy.
// Usage: SMOKE_CHROMIUM=<path> node scripts/portrait.mjs [out dir] [url]   (defaults /tmp/sw-portrait, http://127.0.0.1:5173)
// Optional: SCENES=key1,key2  TOD=night|dusk|day (dusk)  SIZE=430x900  MONTH=0-11 (pretend it is that month)  WX=0-1 (weather)
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { SCENES } from '../src/data/scenes.js';

const out = process.argv[2] || '/tmp/sw-portrait', url = process.argv[3] || 'http://127.0.0.1:5173';
const tod = process.env.TOD || 'dusk', [w, h] = (process.env.SIZE || '430x900').split('x').map(Number);
const keys = process.env.SCENES ? process.env.SCENES.split(',') : SCENES.map(s => s.key);
const shots = join(out, 'shots'); rmSync(shots, { recursive: true, force: true }); mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const wx = process.env.WX !== undefined ? Number(process.env.WX) : undefined;
await page.addInitScript(([t, wx]) => localStorage.setItem('sw-state', JSON.stringify({ seenHint: true, tod: t, finish: false, tourDone: true, weather: wx })), [tod, wx]);
if (process.env.MONTH) {
  await page.addInitScript(m => {
    const R = Date, off = new R(new R().getFullYear(), m, 15, 12).getTime() - R.now();
    class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } }
    window.Date = D;
  }, Number(process.env.MONTH));
}
await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector('#scene-0', { state: 'attached', timeout: 60000 }); await page.waitForTimeout(800);
const missed = [];
for (const k of keys) {
  const i = SCENES.findIndex(s => s.key === k); if (i < 0) { console.log(`no scene "${k}"`); continue; }
  await page.evaluate(i => { document.getElementById('scene-' + i).click(); document.body.classList.add('idle'); }, i);
  await page.waitForTimeout(Number(process.env.WAIT || 2500));
  await page.evaluate(() => document.getElementById('toast').classList.remove('on'));
  // Software GL is slow on the heaviest scenes; a missed shot is listed, not fatal.
  try { await page.screenshot({ path: join(shots, `${String(i).padStart(3, '0')}-${k}.png`), timeout: 25000 }); } catch (e) { missed.push(k); }
}
// Contact sheets of 24, eight across, each frame labelled with its scene.
const files = readdirSync(shots).sort(), per = 24, tw = 150;
for (let p = 0; p * per < files.length; p++) {
  const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(8,${tw}px);gap:4px;font:11px sans-serif;color:#ddd">` +
    files.slice(p * per, (p + 1) * per).map(f => `<div><img style="width:${tw}px;display:block" src="data:image/png;base64,${readFileSync(join(shots, f)).toString('base64')}">${f.replace(/^\d+-|\.png$/g, '')}</div>`).join('') + '</body>';
  const sheet = await browser.newPage({ viewport: { width: 8 * (tw + 4), height: 100 } });
  await sheet.setContent(html); await sheet.waitForTimeout(300);
  await sheet.screenshot({ path: join(out, `sheet-${p + 1}.png`), fullPage: true }); await sheet.close();
}
await browser.close();
console.log(`${files.length} scenes at ${w}×${h} (${tod}) in ${out}: sheet-1.png onward`);
if (missed.length) console.log(`no screenshot (too slow in software GL): ${missed.join(', ')}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
