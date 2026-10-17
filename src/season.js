// Seasons and what is falling from the sky, for every scene that follows them.
// The season comes from the month, turned round by six months south of the equator (when "Use my location" has given a
// latitude). What falls (snow or rain) is the real thing when the location's weather is known: snow when it is snowing
// or freezing, rain otherwise; without it, snow in the winter months.
import { state } from './state.js';

// Pure, for tests: the season for a month (0 = January) and hemisphere. 0 spring, 1 summer, 2 autumn, 3 winter.
export function seasonFor(month, south = false) {
  const m = (month + (south ? 6 : 0)) % 12;
  return m <= 1 || m === 11 ? 3 : m <= 4 ? 0 : m <= 7 ? 1 : 2;
}
export const south = () => !!(state.local && typeof state.local.lat === 'number' && state.local.lat < 0);
// The month as it feels here: the northern month with the same season (so a southern January is a northern July).
export const monthHere = (d = new Date()) => (d.getMonth() + (south() ? 6 : 0)) % 12;
export const season = (d = new Date()) => seasonFor(d.getMonth(), south());
export const isWinter = () => season() === 3;
export const seasonName = () => ['spring', 'summer', 'autumn', 'winter'][season()];

// Pure, for tests: is it snow (true), rain (false) or unknown (null), from Open-Meteo's current readings.
export function snowFrom({ temp, snowfall = 0, code = 0, wet = false }) {
  if (snowfall > 0 || [71, 73, 75, 77, 85, 86].includes(code)) return true;
  if (typeof temp !== 'number') return null;
  if (temp <= .5) return true;
  if (wet || temp >= 3) return false;
  return null;
}
let realSnow = null;
export const setRealSnow = v => { realSnow = v; };
// Should what falls be snow? The real weather when known, else the winter months.
export const snowing = () => realSnow !== null ? realSnow : isWinter();
