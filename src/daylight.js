// How much daylight there is right now, 0 (night) to 1 (full day), from the viewer's clock.
// Without a location the sun's times are fixed: light from about 06:00, full by 07:30, fading from 18:00, dark by 19:30.
// Scenes that follow the clock rebuild their sky when this moves by more than a few percent.
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function daylight(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  return smooth(6, 7.5, h) * (1 - smooth(18, 19.5, h));
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
