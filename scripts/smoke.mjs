// Opens the built app in headless Chromium, steps through every scene
// and fails on any page error or console error. Run `npm run build` first; `npm test` does both.
// Set SMOKE_SHOTS=<dir> to also save a screenshot of each scene, SMOKE_CHROMIUM=<path> to use a particular Chromium,
// SMOKE_SCENES=<name,name> to open only those scenes (a quick pass after a change; the full run is the nightly check).
/* global document, window */ // inside page.evaluate callbacks, which run in the browser
import { preview } from 'vite';
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Use a Chromium that Playwright has already downloaded, whatever its version, before fetching a new one.
function cachedChromium() {
  if (process.env.SMOKE_CHROMIUM) return process.env.SMOKE_CHROMIUM;   // e.g. a headless shell with LD_LIBRARY_PATH pointing at unpacked libs
  const dir = join(homedir(), '.cache/ms-playwright');
  if (!existsSync(dir)) return undefined;
  for (const d of readdirSync(dir).filter(n => n.startsWith('chromium-')).sort().reverse()) {
    for (const p of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe']) {
      const exe = join(dir, d, p); if (existsSync(exe)) return exe;
    }
  }
  return undefined;
}

const server = await preview({ preview: { port: 0, open: false, host: '127.0.0.1' }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const shots = process.env.SMOKE_SHOTS; if (shots) mkdirSync(shots, { recursive: true });

const problems = [];
let browser;
try {
  browser = await chromium.launch({ executablePath: cachedChromium(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
} catch (e) {
  console.error(`Could not launch Chromium: ${e.message}\nInstall one with: npx playwright install chromium`);
  await server.close(); process.exit(2);
}
// The two passes run side by side, each in its own page; SMOKE_WORKERS=<n> also splits each pass across n pages.
const workers = Math.max(1, Number(process.env.SMOKE_WORKERS || 1));
const quiet = /three|jsdelivr|archive\.org|fonts\.g|net::ERR|open-meteo/;
async function openPage(opts, tag) {
  const page = await browser.newPage(opts);
  page.on('pageerror', e => problems.push(`page error${tag}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) problems.push(`console error${tag}: ${m.text()}`); });
  return page;
}
const probe = await openPage({ viewport: { width: 640, height: 360 }, reducedMotion: 'reduce' }, '');
await probe.goto(url, { waitUntil: 'load' }); await probe.waitForTimeout(600);
const total = await probe.evaluate(() => document.querySelectorAll('#nav button').length);
const labels = await probe.evaluate(() => [...document.querySelectorAll('#nav button .lbl')].map(l => l.textContent));
await probe.close();
const only = process.env.SMOKE_SCENES ? new Set(process.env.SMOKE_SCENES.split(',').map(x => x.trim().toLowerCase())) : null;
const wanted = [...Array(total).keys()].filter(i => !only || only.has(labels[i].toLowerCase()));
const split = list => Array.from({ length: workers }, (_, w) => list.filter((_, k) => k % workers === w)).filter(x => x.length);

// First pass: reduced motion makes each scene draw exactly once per visit, so it is quick and the screenshots are clean.
// Each scene must open without breaking and show its own title.
async function stillPass(list) {
  const page = await openPage({ viewport: { width: shots ? 960 : 480, height: shots ? 540 : 270 }, reducedMotion: 'reduce' }, '');
  const t1 = Date.now();
  await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(600);
  for (const i of list) {
    await page.evaluate(i => document.getElementById('scene-' + i).click(), i);
    await page.waitForTimeout(900);
    const broken = await page.evaluate(() => window.slowWindows.broken());
    if (broken.length) problems.push(`broken after scene ${i}: ${broken.join(', ')}`);
    const title = await page.textContent('#title');
    if (title !== labels[i]) problems.push(`scene ${i}: title shows "${title}", nav says "${labels[i]}"`);
    // Software GL can be slow on the heavier shaders; a missed screenshot is noted, not fatal.
    if (shots) {
      try { await page.screenshot({ path: join(shots, `${String(i).padStart(2, '0')}-${title.replace(/[^\w]+/g, '-')}.png`), timeout: 20000 }); }
      catch (e) { console.log(`screenshot of "${title}" timed out`); }
    }
  }
  console.log(`still pass: ${list.length} scenes in ${Math.round((Date.now() - t1) / 1000)} s`);
  return page;
}
// Controls that should not throw, on a page from the first pass.
async function controls(page) {
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft');
  await page.mouse.move(200, 200); await page.mouse.move(220, 210);   // arrows leave the controls hidden; a mouse move shows them
  if (await page.isVisible('#hint1')) await page.click('#hint1Ok');   // the first-visit hint, dismissed as a person would
  await page.click('#menuBtn'); await page.evaluate(() => { for (const d of document.querySelectorAll('#sheet details')) d.open = true; });   // the sheet, every section open
  await page.click('#lowBtn'); await page.waitForTimeout(300); await page.click('#lowBtn');
  await page.keyboard.press('g'); await page.waitForTimeout(200); await page.keyboard.press('Escape');   // scene picker opens and closes
  await page.click('#libBtn'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');   // the library, then the sheet
  // The focus timer starts from the Timer section of the sheet.
  await page.click('#menuBtn'); await page.evaluate(() => { document.getElementById('secTimer').open = true; });
  await page.click('#tStart'); await page.click('#tStart'); await page.click('#sheetClose');
  await page.waitForTimeout(300);
}
// Second pass with real motion: the animation loop runs, and every scene must yield a thumbnail (so it drew something).
const noThumb = [];
async function motionPass(list) {
  const page = await openPage({ viewport: { width: 320, height: 180 } }, ' (motion)');
  const t1 = Date.now();
  page.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
  await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(800);
  for (const i of list) {
    await page.evaluate(i => document.getElementById('scene-' + i).click(), i);
    await page.waitForTimeout(1500);
    if (!await page.evaluate(() => window.slowWindows.captureThumb())) noThumb.push(labels[i]);
  }
  const broken = await page.evaluate(() => window.slowWindows.broken());
  if (broken.length) problems.push(`broken in motion: ${broken.join(', ')}`);
  console.log(`motion pass: ${list.length} scenes in ${Math.round((Date.now() - t1) / 1000)} s`);
}
const t0 = Date.now();
const [stillPages] = await Promise.all([Promise.all(split(wanted).map(stillPass)), Promise.all(split(wanted).map(motionPass))]);
await controls(stillPages[0]);
if (noThumb.length > 3) problems.push(`no thumbnail from: ${noThumb.join(', ')}`);   // a few may miss on a slow image load; many means scenes are blank
else if (noThumb.length) console.log(`no thumbnail yet from: ${noThumb.join(', ')}`);
const names = wanted.map(i => labels[i]);
console.log(`both passes took ${Math.round((Date.now() - t0) / 1000)} s with ${workers} page${workers === 1 ? '' : 's'} each`);

await browser.close(); await server.close();
console.log(`${names.length} scenes opened: ${names.join(', ')}`);
if (problems.length) { for (const p of problems) console.error(p); process.exit(1); }
console.log('smoke test passed');
