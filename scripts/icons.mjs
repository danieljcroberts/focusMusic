// Draws the app icon, a window at night with one pane lit (the same window as the status-bar icon), and renders it
// to every size the web app and the Android launcher need: node scripts/icons.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// The window, drawn in a 100×100 box centred on (50, 50), `k` times its natural size.
const windowArt = k => `
  <g transform="translate(50 50) scale(${k}) translate(-50 -50)">
    <rect x="45" y="16" width="39" height="39" rx="6" fill="url(#lit)" opacity=".45" filter="url(#blur)"/>
    <rect x="18" y="18" width="64" height="64" rx="7" fill="#d9cfbd"/>
    <rect x="23" y="23" width="25" height="25" rx="2.5" fill="url(#sky)"/>
    <rect x="23" y="52" width="25" height="25" rx="2.5" fill="url(#sky2)"/>
    <rect x="52" y="52" width="25" height="25" rx="2.5" fill="url(#sky2)"/>
    <rect x="52" y="23" width="25" height="25" rx="2.5" fill="url(#lit)"/>
    <circle cx="30" cy="30" r=".9" fill="#fff" opacity=".85"/><circle cx="40" cy="27" r=".6" fill="#fff" opacity=".6"/>
    <circle cx="36" cy="40" r=".7" fill="#fff" opacity=".5"/><circle cx="61" cy="60" r=".6" fill="#fff" opacity=".45"/>
    <path d="M23 70 q8 -5 13 -2 t12 -3 v12 h-25z M52 66 q9 -4 14 -1 t11 -2 v14 h-25z" fill="#05070d" opacity=".9"/>
  </g>`;
const defs = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0e1a"/><stop offset="1" stop-color="#151a30"/></linearGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1530"/><stop offset="1" stop-color="#22305a"/></linearGradient>
  <linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22305a"/><stop offset="1" stop-color="#3a4470"/></linearGradient>
  <radialGradient id="lit" cx=".4" cy=".45" r=".75"><stop offset="0" stop-color="#ffe2a8"/><stop offset=".6" stop-color="#f2b866"/><stop offset="1" stop-color="#d98a3a"/></radialGradient>
  <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
</defs>`;
const svg = (body, rx = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${defs}${body}</svg>`;
const full = svg(`<rect width="100" height="100" fill="url(#bg)"/>${windowArt(.8)}`);              // full bleed, safe for maskable
const rounded = svg(`<rect x="2" y="2" width="96" height="96" rx="20" fill="url(#bg)"/>${windowArt(.9)}`);   // the favicon
const round = svg(`<circle cx="50" cy="50" r="50" fill="url(#bg)"/>${windowArt(.72)}`);
const fg = svg(windowArt(.62));                                                                       // adaptive foreground: inside the 66/108 safe zone

writeFileSync(join(root, 'public/icon.svg'), rounded.replace('<svg ', '<svg width="512" height="512" ') + '\n');

const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM });
const page = await browser.newPage();
async function png(art, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${art.replace('<svg ', `<svg width="${size}" height="${size}" `)}`);
  await page.screenshot({ path: join(root, file), omitBackground: true });
}
await png(full, 192, 'public/icon-192.png');
await png(full, 512, 'public/icon-512.png');
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, m] of Object.entries(dens)) {
  const dir = `android/app/src/main/res/mipmap-${d}`;
  await png(rounded, 48 * m, `${dir}/ic_launcher.png`);
  await png(round, 48 * m, `${dir}/ic_launcher_round.png`);
  await png(fg, 108 * m, `${dir}/ic_launcher_foreground.png`);
}
await browser.close();
console.log('icons written');
