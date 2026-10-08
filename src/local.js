// Local weather and sun, opt in. One location prompt, then Open-Meteo (free, no key) every hour:
// rain outside sets the weather, and the clock-following scenes use today's sunrise and sunset.
// Coordinates are rounded to about a kilometre and kept only in this browser.
import { setWeatherOverride } from './weather.js';
import { setSunTimes } from './daylight.js';
import { state, saveState } from './state.js';

export let localOn = !!(state.local && state.local.lat !== undefined);
let timer = null;

async function refresh() {
  const { lat, lon } = state.local;
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=rain,showers,snowfall,cloud_cover&daily=sunrise,sunset&timezone=auto&forecast_days=1`);
  if (!r.ok) throw new Error('weather ' + r.status);
  const d = await r.json();
  const mm = (d.current.rain || 0) + (d.current.showers || 0) + (d.current.snowfall || 0) * 10, cloud = Math.round(d.current.cloud_cover || 0);
  // Dry: a little mist with the cloud. Wet: 0.35 at a drizzle up to 1 at 3 mm/h or more.
  setWeatherOverride(mm > 0 ? Math.min(1, .35 + mm / 3 * .65) : Math.max(.08, cloud / 100 * .3));
  const hours = iso => { const [h, m] = iso.slice(11, 16).split(':'); return +h + m / 60; };
  setSunTimes(hours(d.daily.sunrise[0]), hours(d.daily.sunset[0]));
  return { mm, cloud, sunrise: d.daily.sunrise[0].slice(11, 16), sunset: d.daily.sunset[0].slice(11, 16) };
}
function start() { clearInterval(timer); timer = setInterval(() => refresh().catch(() => {}), 3600000); }

export async function enableLocal() {
  const pos = await new Promise((res, rej) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(res, rej, { timeout: 15000, maximumAge: 3600000 }) : rej(new Error('no geolocation')));
  saveState({ local: { lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2) } });
  localOn = true; start();
  return refresh();
}
export function disableLocal() {
  localOn = false; saveState({ local: null }); clearInterval(timer);
  setWeatherOverride(null); setSunTimes(null, null);
}
if (localOn) { start(); refresh().catch(() => {}); }
