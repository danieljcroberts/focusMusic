// Tonight's aurora: the planetary K-index from NOAA's Space Weather Prediction Center (free, no key), fetched when an
// aurora scene opens and every three hours after, and turned into a strength from 0 (quiet) to 1 (a storm). The aurora
// scenes brighten and spread with it. Until the first answer, or offline, it sits at a middling .45.
import { state, saveState } from './state.js';

// Pure, for tests: K-index 0 to 9 into a strength. Kp 1 is faint, 3 to 4 a good show, 6 and up a storm.
export const strengthFor = kp => Math.max(.15, Math.min(1, .1 + kp / 6.5));
const cached = state.kp && Date.now() - state.kp.at < 6 * 3600000 ? state.kp.v : null;
export let auroraStrength = cached !== null ? strengthFor(cached) : .45;
let started = false;
async function refresh() {
  const r = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { cache: 'no-store' });
  const rows = await r.json(), last = rows[rows.length - 1];
  const kp = Number(Array.isArray(last) ? last[1] : last.Kp);   // older feeds were rows of strings with a header row
  if (!isFinite(kp)) return;
  auroraStrength = strengthFor(kp); saveState({ kp: { v: kp, at: Date.now() } });
}
export function watchAurora() {
  if (started) return; started = true;
  refresh().catch(() => {});
  setInterval(() => refresh().catch(() => {}), 3 * 3600000);
}
