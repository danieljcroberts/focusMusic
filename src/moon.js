// Tonight's moon: the phase from the date (0 new, .25 first quarter, .5 full, .75 last quarter), and a way to draw it.
// Counted from a known new moon in synodic months, which is good to within a day or so; more than enough for a scene.
const SYNODIC = 29.530589, NEW = Date.UTC(2000, 0, 6, 18, 14);
export const moonPhase = (d = new Date()) => (((d.getTime() - NEW) / 86400000 / SYNODIC) % 1 + 1) % 1;

// Draws the moon at (x, y) with radius r: the lit part in `lit`, the dark part faintly in `dark` (earthshine).
// Seen from the north, the waxing moon is lit on the right and the waning moon on the left.
export function drawMoon(g, x, y, r, lit, dark = 'rgba(120,130,160,.12)', p = moonPhase()) {
  g.save(); g.fillStyle = dark; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  const waxing = p < .5, c = Math.cos(2 * Math.PI * (waxing ? p : p - .5));   // 1 at the edge of the lit half, -1 at full
  g.translate(x, y); if (!waxing) g.scale(-1, 1);
  // Waxing: the right half, then the terminator back as half an ellipse (bulging right for a crescent, left for gibbous).
  const k = waxing ? c : -c;
  g.fillStyle = lit; g.beginPath(); g.moveTo(0, -r); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  g.ellipse(0, 0, Math.max(.001, Math.abs(k) * r), r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
  g.fill(); g.restore();
}
// The same shape in GLSL: is the point q (in the moon's own units, the disc is |q| < 1) lit, for the phase p?
export const MOON_GLSL = p => `
const float MOONP = ${p.toFixed(4)};
float moonLit(vec2 q){
  float sx = sqrt(max(0., 1. - q.y * q.y)), aa = .04;
  if (MOONP < .5) return smoothstep(sx * cos(6.2832 * MOONP) - aa, sx * cos(6.2832 * MOONP) + aa, q.x);
  return smoothstep(sx * cos(6.2832 * (MOONP - .5)) + aa, sx * cos(6.2832 * (MOONP - .5)) - aa, q.x);
}`;
