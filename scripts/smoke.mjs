// Opens the built app in headless Chromium, steps through every scene (including the rain lab)
// and fails on any page error or console error. Run `npm run build` first; `npm test` does both.
// Set SMOKE_SHOTS=<dir> to also save a screenshot of each scene.
/* global document */ // inside page.evaluate callbacks, which run in the browser
import { preview } from 'vite';
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Use a Chromium that Playwright has already downloaded, whatever its version, before fetching a new one.
function cachedChromium() {
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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => problems.push(`page error: ${e.message}`));
page.on('console', m => { if (m.type() === 'error' && !/three|jsdelivr|archive\.org|fonts\.g|net::ERR/.test(m.text())) problems.push(`console error: ${m.text()}`); });

await page.goto(url + '#lab', { waitUntil: 'load' });
await page.waitForTimeout(600);
const total = await page.evaluate(() => document.querySelectorAll('#nav button').length);
const names = [];
for (let i = 0; i < total; i++) {
  await page.evaluate(i => document.getElementById('scene-' + i).click(), i);
  await page.waitForTimeout(700);
  const title = await page.textContent('#title');
  const expected = await page.evaluate(i => document.getElementById('scene-' + i).textContent, i);
  if (title !== expected) problems.push(`scene ${i}: title shows "${title}", nav says "${expected}"`);
  names.push(title);
  if (shots) await page.screenshot({ path: join(shots, `${String(i).padStart(2, '0')}-${title.replace(/[^\w]+/g, '-')}.png`) });
}
// Controls that should not throw.
await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft');
await page.click('#lowBtn'); await page.waitForTimeout(300); await page.click('#lowBtn');
await page.click('#libBtn'); await page.keyboard.press('Escape');
await page.click('#tStart'); await page.click('#tStart');
await page.waitForTimeout(300);

await browser.close(); await server.close();
console.log(`${total} scenes opened: ${names.join(', ')}`);
if (problems.length) { for (const p of problems) console.error(p); process.exit(1); }
console.log('smoke test passed');
