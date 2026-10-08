// How much daylight there is right now, 0 (night) to 1 (full day), from the viewer's clock.
// Without a location the sun's times are fixed: light from about 06:00, full by 07:30, fading from 18:00, dark by 19:30.
// Scenes that follow the clock rebuild their sky when this moves by more than a few percent.
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

let override = null, sun = null;
// Today's sunrise and sunset as decimal hours (from local.js), or null for the fixed times.
export function setSunTimes(rise, set) { sun = rise != null && set != null ? [rise, set] : null; }
// A fixed amount of daylight from the settings panel (0 night, .5 dusk, 1 day), or null to follow the clock.
export function setDaylightOverride(v) { override = v; }

export function daylight(date = new Date()) {
  if (override !== null) return override;
  const h = date.getHours() + date.getMinutes() / 60, [rise, set] = sun || [6.75, 18.75];
  return smooth(rise - .75, rise + .75, h) * (1 - smooth(set - .75, set + .75, h));
}

// 1 around dawn and dusk, 0 at noon and midnight: the warm band in the sky.
export function twilight(date = new Date()) {
  const d = daylight(date);
  return 1 - Math.abs(d * 2 - 1);
}

// Blends colour triples by the amount of daylight: night at 0, dusk at .5, day at 1.
export function skyMix(night, dusk, day, d = daylight()) {
  const lerp = (a, b, p) => a.map((v, i) => Math.round(v + (b[i] - v) * p));
  return d < .5 ? lerp(night, dusk, d * 2) : lerp(dusk, day, (d - .5) * 2);
}
