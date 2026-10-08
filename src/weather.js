import { rand } from './util.js';

// A slow weather cycle shared by the glass scenes: drizzle, steady rain, a downpour, then easing off, over several minutes.
export let weather = .6;
let wTarget = .6, wNext = 40, override = null;
// A fixed value from the settings panel, or null to let the cycle run.
export function setWeatherOverride(v) { override = v; if (v !== null) weather = v; }
export function tickWeather(dt) {
  if (override !== null) { weather = override; return; }
  wNext -= dt;
  if (wNext <= 0) { const r = Math.random(); wTarget = r < .3 ? rand(.2, .4) : r < .75 ? rand(.5, .75) : rand(.85, 1); wNext = rand(60, 150); }
  weather += (wTarget - weather) * Math.min(1, dt / 25);
}
