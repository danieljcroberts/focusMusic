// Holmestrand's geography, shared by the scene's styles (holmestrand-alt.js), so each draws the same place: the view
// from the path on the hill above the town, east over the fjord. The low Hurum hills across the water, the wooded
// island to the right, the waterfront with the marina's masts, the harbour mole with its row of trees, a block of flats
// on the quay, and the town's houses in rows down the slope below, the near ones larger, with the white church among
// them. Everything is in fractions of the screen (x 0 to 1 across, y 0 to 1 down), laid out for its shape: on a phone
// held upright the horizon sits higher and the town takes more of the height.

function seeded(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

export function geography(w, h) {
  const port = h > w, r = seeded(1931);
  const hy = port ? .36 : .43;              // the horizon: where the far hills meet the water
  const shore = port ? .58 : .63;           // the town's waterfront
  // The Hurum hills: long and low, a few soft humps, higher to the left.
  const humps = [[.08, .045, .22], [.3, .03, .18], [.5, .022, .2], [.72, .03, .16], [.95, .02, .2]];
  const hills = u => hy - humps.reduce((a, [c, hgt, wd]) => a + hgt * Math.exp(-Math.pow((u - c) / wd, 2)), .006) * (port ? .9 : 1);
  // The island to the right: a long low back of trees, with a steeper end to the left.
  const island = { x0: .64, x1: 1.04, base: hy + .022, top: u => hy + .022 - .03 * Math.pow(Math.sin(Math.min(1, Math.max(0, (u - .64) / .4)) * Math.PI), .6) * (u < .7 ? (u - .64) / .06 : 1) };
  // The waterfront: the marina's masts at the left, the block of flats, the mole running out with its trees.
  const masts = Array.from({ length: 18 }, (_, i) => ({ x: .04 + i * .012 + r() * .006, h: .025 + r() * .025 }));
  const block = { x: .2, w: .07, h: .045 };
  const mole = { x0: .3, x1: .5, y: shore - .012, trees: Array.from({ length: 12 }, (_, i) => .31 + i * .016) };
  // The houses, row by row down the slope: white, ochre, red, grey and pale yellow wooden houses with dark roofs.
  const COLS = [[236, 232, 222], [232, 228, 216], [214, 168, 92], [178, 62, 46], [150, 154, 158], [226, 204, 140], [110, 128, 150], [240, 236, 228]];
  const ROOFS = [[52, 54, 60], [70, 70, 76], [120, 52, 40], [60, 62, 70]];
  const rows = [], n = port ? 7 : 6;
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1), y = shore + .02 + (1 - shore - .1) * Math.pow(t, 1.15), size = .022 + .05 * t;
    let x = -size * r();
    const houses = [];
    while (x < 1.05) {
      const hw = size * (1.1 + r() * .9), gap = size * (.2 + r() * 1.4);
      if (r() > .12) houses.push({ x, w: hw, h: hw * (.55 + r() * .3), col: COLS[Math.floor(r() * COLS.length)], roof: ROOFS[Math.floor(r() * ROOFS.length)], gable: r() < .65, dormer: r() < .3, win: 2 + Math.floor(r() * 3), lit: r() });
      x += hw + gap;
    }
    rows.push({ y, size, houses, tree: Array.from({ length: Math.round(3 + r() * 4) }, () => ({ x: r(), s: size * (1 + r()) })) });
  }
  const church = { x: .58, row: 1 };
  return { port, hy, shore, hills, island, masts, block, mole, rows, church, sunX: port ? .62 : .7 };
}
