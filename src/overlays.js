// Overlays for scenes that can't follow the clock, the season or the weather themselves.
import { SCENES } from './scenes/index.js';
import { W, H, DPR, lowPower } from './view.js';
import { weather } from './weather.js';
import { skyMix } from './daylight.js';
import { season as seasonNow, snowing } from './season.js';

const el = id => document.getElementById(id);
/* Time of day and season for the pixel-art landscapes (and Bamboo and Canopy), which were drawn for one hour and one time of year: a multiplied
   tint follows the clock (cool and dark at night, warm at dusk, clear by day), and a light colour grade follows the
   month (fresher in spring, richer in summer, turning gold in autumn, paler in winter). Recomputed once a second. */
const CLOCKED = new Set(['woods', 'ridge', 'peaks', 'seaview', 'summits', 'pier', 'bamboo', 'canopy']);
const SEASONED = new Set(['woods', 'ridge', 'peaks', 'seaview', 'pier', 'campfire', 'pixeltrain']);
const SEASON_GRADE = ['saturate(1.05) hue-rotate(-4deg)', 'saturate(1.15)', 'sepia(.22) saturate(1.2) hue-rotate(-14deg)', 'saturate(.68) brightness(1.04)'];
const todEl = el('tod');
let gradeAt = -1, gradeKey = '';
export function tickGrade(now, key) {
  if (now - gradeAt < 1000 && gradeKey === key) return;
  gradeAt = now; gradeKey = key;
  const season = seasonNow();
  const sg = SEASONED.has(gradeKey) && !(season === 3 && gradeKey === 'summits') ? SEASON_GRADE[season] : '';
  document.body.classList.toggle('season', !!sg);
  if (sg) document.body.style.setProperty('--season', sg); else document.body.style.removeProperty('--season');
  todEl.hidden = !CLOCKED.has(gradeKey);
  if (!todEl.hidden) { const [r, g, b] = skyMix([62, 78, 132], [255, 186, 150], [255, 255, 255]); todEl.style.backgroundColor = `rgb(${r}, ${g}, ${b})`; }
}
/* Weather over the pixel-art and photo scenes, which can't paint it themselves: rain streaks or, in the winter months,
   snow, when the weather is wet enough. Drawn on its own canvas above the scene. */
const WX = new Set(SCENES.filter(s => s.group === 'Pixel art' || ['cityNight', 'nightSky', 'forestDusk', 'photos'].includes(s.key)).map(s => s.key));
const wxCv = el('wxfx'), wxG = wxCv.getContext('2d');
let wxDrops = null;
// key: the scene on screen; t: the scene clock, for the snow's sway.
export function drawWx(dt, key, t) {
  const amount = WX.has(key) ? Math.max(0, (weather - .5) / .5) : 0;
  if (amount <= 0) { if (!wxCv.hidden) { wxCv.hidden = true; wxDrops = null; } return; }
  if (wxCv.hidden) { wxCv.hidden = false; wxCv.width = Math.round(W * DPR); wxCv.height = Math.round(H * DPR); }
  const snow = snowing(), n = Math.round((snow ? 140 : 220) * amount * (lowPower ? .5 : 1));
  if (!wxDrops || wxDrops.length !== n) wxDrops = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, v: snow ? 30 + Math.random() * 40 : 500 + Math.random() * 400, l: snow ? 1.5 + Math.random() * 2 : 10 + Math.random() * 18, w: Math.random() * 6.28 }));
  wxG.setTransform(DPR, 0, 0, DPR, 0, 0); wxG.clearRect(0, 0, W, H);
  wxG.strokeStyle = `rgba(214, 226, 240, ${.35 * amount})`; wxG.fillStyle = `rgba(255, 255, 255, ${.8 * amount})`; wxG.lineWidth = 1;
  wxG.beginPath();
  for (const d of wxDrops) {
    d.y += d.v * dt; if (snow) d.x += Math.sin(t * .8 + d.w) * 12 * dt; else d.x -= 60 * dt;
    if (d.y > H + 20) { d.y = -20; d.x = Math.random() * W; } if (d.x < -20) d.x = W + 20;
    if (snow) { wxG.moveTo(d.x + d.l, d.y); wxG.arc(d.x, d.y, d.l, 0, 6.283); } else { wxG.moveTo(d.x, d.y); wxG.lineTo(d.x - 2, d.y + d.l); }
  }
  if (snow) wxG.fill(); else wxG.stroke();
}
