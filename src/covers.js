// Covers for tracks that come without one: a small abstract picture for each track, the same every time (seeded by the
// artist and title), in a style that belongs to its genre, with the title set small in a corner like a record sleeve.
//   ambient: a soft horizon with a sun or moon       downtempo: stacked waves      lo-fi: a window at night, grainy
//   post-rock: mountain ridges in mist               modern classical: staves on warm paper, a circle
//   synth: a striped sun over a grid                 minimalist: one shape on a flat field
//   jazz: overlapping blobs                          high energy: diagonal bands     the rest: bauhaus shapes
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgbHsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${Math.round(s * 100)}%,${Math.round(l * 100)}%,${a})`;

export function drawCover(c, { title = '', artist = '', genre = 'misc', color = '#8fa0a8' } = {}) {
  const S = c.width, x = c.getContext('2d'), R = rng(hashStr(artist + '|' + title + '|' + genre));
  const [h0, s0] = rgbHsl(hexRgb(color)), hue = h0 + (R() - .5) * 50, sat = Math.max(.35, Math.min(.8, s0 + .1));
  const pick = (dh, l, a = 1, ds = 0) => hsl(hue + dh, Math.max(0, Math.min(1, sat + ds)), l, a);
  const lin = (y0, y1, stops) => { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(([p, c2]) => g.addColorStop(p, c2)); return g; };
  const circle = (cx, cy, r, f) => { x.fillStyle = f; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); };
  const ridge = (y, amp, f, rough) => {
    x.fillStyle = f; x.beginPath(); x.moveTo(0, S);
    let yy = y; const ph = R() * 9;
    for (let i = 0; i <= 24; i++) { const px = i / 24 * S; yy = y + Math.sin(i * .5 + ph) * amp * .5 + (R() - .5) * amp * rough; x.lineTo(px, yy); }
    x.lineTo(S, S); x.fill();
  };
  x.save();
  switch (genre) {
    case 'ambient': {
      const night = R() < .4;
      x.fillStyle = lin(0, S, night ? [[0, pick(0, .1)], [.65, pick(20, .28)], [1, pick(30, .4)]] : [[0, pick(0, .55, 1, -.2)], [.6, pick(-30, .78, 1, -.1)], [1, pick(-50, .88, 1, -.2)]]);
      x.fillRect(0, 0, S, S);
      const sy = S * (.35 + R() * .2), sx = S * (.25 + R() * .5);
      circle(sx, sy, S * .3, pick(-40, .9, .12)); circle(sx, sy, S * (.07 + R() * .05), night ? 'rgba(245,240,225,.95)' : pick(-50, .96, .95));
      for (let i = 0; i < 3; i++) ridge(S * (.62 + i * .1), S * .05, pick(10 * i, night ? .08 + i * .04 : .55 - i * .12, .9), .4);
      break;
    }
    case 'downtempo': {
      x.fillStyle = pick(0, .14); x.fillRect(0, 0, S, S);
      const n = 7 + Math.floor(R() * 5), f = 1.5 + R() * 2, ph = R() * 6;
      for (let i = 0; i < n; i++) {
        const y = S * (.18 + i / n * .8);
        x.strokeStyle = pick(i * 8, .45 + i / n * .35, .9); x.lineWidth = S * .018; x.beginPath();
        for (let px = 0; px <= S; px += S / 40) x.lineTo(px, y + Math.sin(px / S * Math.PI * f + ph + i * .5) * S * .05);
        x.stroke();
      }
      break;
    }
    case 'lofi': {
      x.fillStyle = lin(0, S, [[0, pick(0, .2)], [1, pick(-20, .32)]]); x.fillRect(0, 0, S, S);
      const ww = S * (.45 + R() * .2), wh = S * (.42 + R() * .14), wx = (S - ww) * (.2 + R() * .6), wy = S * (.1 + R() * .08);   // a window, with the night through it
      x.fillStyle = lin(wy, wy + wh, [[0, pick(40, .14, 1, -.2)], [1, pick(20, .32, 1, -.1)]]); x.fillRect(wx, wy, ww, wh);
      circle(wx + ww * (.25 + R() * .5), wy + wh * (.25 + R() * .25), S * .045, 'rgba(250,235,200,.95)');
      for (let i = 0; i < 18; i++) { x.fillStyle = 'rgba(255,240,210,.7)'; x.fillRect(wx + R() * ww, wy + R() * wh * .6, 1.5, 1.5); }
      x.fillStyle = 'rgba(20,14,12,.9)'; x.fillRect(wx + ww / 2 - S * .008, wy, S * .016, wh); x.fillRect(wx, wy + wh / 2 - S * .008, ww, S * .016);
      x.lineWidth = S * .025; x.strokeStyle = 'rgba(20,14,12,.95)'; x.strokeRect(wx, wy, ww, wh);
      x.fillStyle = pick(-10, .22); x.fillRect(0, wy + wh, S, S);   // the desk
      x.fillStyle = 'rgba(30,20,16,.9)'; const mx = S * (.15 + R() * .65); x.fillRect(mx, wy + wh + S * .04, S * .1, S * .09);   // a mug or a lamp on the desk
      if (R() < .5) { x.fillRect(mx + S * .2, wy + wh + S * .03, S * .02, S * .1); circle(mx + S * .21, wy + wh + S * .03, S * .05, 'rgba(255,200,120,.5)'); }
      break;
    }
    case 'postrock': {
      x.fillStyle = lin(0, S, [[0, pick(0, .7, 1, -.3)], [1, pick(-20, .45, 1, -.2)]]); x.fillRect(0, 0, S, S);
      for (let i = 0; i < 5; i++) ridge(S * (.32 + i * .13), S * (.22 - i * .02), pick(-10 + i * 5, .55 - i * .1, 1, -.15), .9);
      x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, S * .5, S, S * .08);   // mist
      break;
    }
    case 'classical': {
      x.fillStyle = hsl(40, .35, .88); x.fillRect(0, 0, S, S);
      for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(120,90,50,${R() * .06})`; x.fillRect(R() * S, R() * S, 2, 2); }   // paper
      x.strokeStyle = 'rgba(60,45,30,.55)'; x.lineWidth = 1;
      const top = S * (.18 + R() * .2);
      for (let st = 0; st < 2; st++) for (let i = 0; i < 5; i++) { const y = top + st * S * .32 + i * S * .03; x.beginPath(); x.moveTo(S * .1, y); x.lineTo(S * .9, y); x.stroke(); }
      circle(S * (.3 + R() * .4), S * (.4 + R() * .2), S * (.12 + R() * .1), pick((R() - .5) * 160, .5, .85, -.1));
      if (R() < .5) { x.strokeStyle = 'rgba(60,45,30,.7)'; x.lineWidth = S * .012; x.beginPath(); x.arc(S * (.25 + R() * .5), S * (.35 + R() * .3), S * (.05 + R() * .08), 0, Math.PI * 2); x.stroke(); }
      break;
    }
    case 'synth': {
      const sh = (R() - .5) * 70, hz = .5 + (R() - .5) * .14;   // each track its own sky hue and horizon
      x.fillStyle = lin(0, S, [[0, hsl(260 + sh, .6, .1)], [hz - .01, hsl(300 + sh, .6, .25)], [hz, hsl(250 + sh, .5, .06)], [1, hsl(250 + sh, .5, .1)]]); x.fillRect(0, 0, S, S);
      for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(255,240,255,.6)'; x.fillRect(R() * S, R() * S * hz * .7, 1.2, 1.2); }
      const cy = S * hz, r = S * (.18 + R() * .12), sx = S * (.3 + R() * .4);
      x.save(); x.beginPath(); x.arc(sx, cy, r, Math.PI, 0); x.clip();
      x.fillStyle = lin(cy - r, cy, [[0, hsl(50 + sh * .3, .95, .6)], [1, hsl(330 + sh, .9, .55)]]); x.fillRect(0, cy - r, S, r);
      x.fillStyle = hsl(290 + sh, .6, .18); for (let i = 0; i < 5; i++) x.fillRect(0, cy - r * (.1 + i * .16), S, r * (.03 + i * .012));
      x.restore();
      x.strokeStyle = hsl(310 + sh, .9, .6, .8); x.lineWidth = 1.2;
      for (let i = 0; i < 9; i++) { const y = S * (hz + .01) + Math.pow(i / 8, 2) * S * (1 - hz); x.beginPath(); x.moveTo(0, y); x.lineTo(S, y); x.stroke(); }
      for (let i = -8; i <= 8; i++) { x.beginPath(); x.moveTo(sx + i * S * .03, S * (hz + .01)); x.lineTo(sx + i * S * .2, S); x.stroke(); }
      break;
    }
    case 'minimalist': {
      x.fillStyle = pick(0, .82, 1, -.35); x.fillRect(0, 0, S, S);
      const k = Math.floor(R() * 3), cx = S * (.3 + R() * .4), cy = S * (.3 + R() * .4);
      x.fillStyle = pick(180, .25, 1, -.1);
      if (k === 0) circle(cx, cy, S * .14, x.fillStyle);
      else if (k === 1) x.fillRect(cx - S * .12, cy - S * .12, S * .24, S * .24);
      else { x.fillRect(S * .12, cy, S * .76, S * .02); circle(cx, cy - S * .06, S * .035, x.fillStyle); }
      break;
    }
    case 'jazz': {
      x.fillStyle = pick(0, .14); x.fillRect(0, 0, S, S);
      for (let i = 0; i < 6; i++) { x.globalCompositeOperation = 'screen'; circle(S * R(), S * R(), S * (.12 + R() * .2), pick(i * 40, .45, .75)); }
      x.globalCompositeOperation = 'source-over';
      x.strokeStyle = 'rgba(255,245,225,.85)'; x.lineWidth = S * .012; x.beginPath();
      for (let i = 0; i <= 30; i++) { const px = S * (.1 + i / 30 * .8); x.lineTo(px, S * (.5 + Math.sin(i * .9 + R()) * .12)); }
      x.stroke();
      break;
    }
    case 'energy': {
      x.fillStyle = pick(0, .14); x.fillRect(0, 0, S, S);
      x.save(); x.translate(S / 2, S / 2); x.rotate(-.6 + R() * .3);
      for (let i = -6; i <= 6; i++) { x.fillStyle = pick(i * 12, .35 + (i & 1) * .25, .9); x.fillRect(-S, i * S * .09, S * 2, S * (.03 + R() * .05)); }
      x.restore();
      break;
    }
    default: {   // misc, french, loved, your own: bauhaus shapes
      x.fillStyle = pick(0, .86, 1, -.4); x.fillRect(0, 0, S, S);
      const cols = [pick(0, .5), pick(140, .45), pick(220, .35), 'rgba(30,30,34,.9)'];
      for (let i = 0; i < 4; i++) {
        const k = Math.floor(R() * 3), cx = S * R(), cy = S * R(), r = S * (.12 + R() * .2);
        x.fillStyle = cols[i];
        if (k === 0) circle(cx, cy, r, cols[i]);
        else if (k === 1) x.fillRect(cx - r, cy - r * .5, r * 2, r);
        else { x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx + r, cy + r); x.lineTo(cx - r, cy + r); x.fill(); }
      }
    }
  }
  x.restore();
  // Grain and a soft vignette, so it reads as printed rather than flat.
  const im = x.getImageData(0, 0, S, S), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - .5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(im, 0, 0);
  const vg = x.createRadialGradient(S / 2, S / 2, S * .35, S / 2, S / 2, S * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
  x.fillStyle = vg; x.fillRect(0, 0, S, S);
  // The title, small in the lower left, over a faint band so it reads on any picture.
  if (title) {
    const fs = Math.round(S * .068), pad = S * .07;
    x.font = `500 ${fs}px "Bricolage Grotesque", "Avenir Next", system-ui, sans-serif`; x.textBaseline = 'alphabetic';
    let tt = title; while (x.measureText(tt).width > S - pad * 2 && tt.length > 3) tt = tt.slice(0, -2) + '…';
    const band = x.createLinearGradient(0, S * .7, 0, S); band.addColorStop(0, 'rgba(0,0,0,0)'); band.addColorStop(1, 'rgba(0,0,0,.45)');
    x.fillStyle = band; x.fillRect(0, S * .7, S, S * .3);
    x.fillStyle = 'rgba(255,255,255,.94)'; x.fillText(tt, pad, S - pad - fs * .9);
    x.font = `400 ${Math.round(fs * .72)}px "Bricolage Grotesque", "Avenir Next", system-ui, sans-serif`; x.fillStyle = 'rgba(255,255,255,.7)';
    let aa = artist; while (x.measureText(aa).width > S - pad * 2 && aa.length > 3) aa = aa.slice(0, -2) + '…';
    x.fillText(aa, pad, S - pad);
  }
}
