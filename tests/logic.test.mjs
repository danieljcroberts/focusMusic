// Fast checks of the app's pure logic (npm run unit, part of npm test): the moon, the seasons, snow or rain, the
// aurora, the shuffle's weights, per-scene loves, the weekly look-back and the Android update offer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moonPhase } from '../src/moon.js';
import { seasonFor, snowFrom } from '../src/season.js';
import { strengthFor } from '../src/aurora.js';
import { trackWeight, pickWeighted, withSceneLove } from '../src/shuffle.js';
import { shouldOffer } from '../src/update.js';
import { state } from '../src/state.js';
import { lookback } from '../src/lookback.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} is not near ${b}`);

test('moon phase matches known new and full moons', () => {
  near(moonPhase(new Date('2024-01-11T11:57Z')), 0, .02, 'new moon, 11 January 2024');
  near(moonPhase(new Date('2024-01-25T17:54Z')), .5, .02, 'full moon, 25 January 2024');
  near(moonPhase(new Date('2025-10-07T03:47Z')), .5, .02, 'full moon, 7 October 2025');
  for (const d of ['1990-05-01', '2026-10-17', '2040-02-29']) { const p = moonPhase(new Date(d)); assert.ok(p >= 0 && p < 1, `phase in range on ${d}`); }
});

test('seasons by month, turned round in the south', () => {
  assert.deepEqual([0, 3, 6, 9].map(m => seasonFor(m)), [3, 0, 1, 2]);   // January winter, April spring, July summer, October autumn
  assert.deepEqual([0, 3, 6, 9].map(m => seasonFor(m, true)), [1, 2, 3, 0]);
  assert.equal(seasonFor(11), 3); assert.equal(seasonFor(2), 0); assert.equal(seasonFor(8), 2);
});

test('snow or rain from the weather', () => {
  assert.equal(snowFrom({ temp: 4, snowfall: .2 }), true);
  assert.equal(snowFrom({ temp: 8, code: 73 }), true);
  assert.equal(snowFrom({ temp: -2 }), true);
  assert.equal(snowFrom({ temp: 6, wet: true }), false);
  assert.equal(snowFrom({ temp: 1.5, wet: true }), false);
  assert.equal(snowFrom({ temp: 1.5 }), null);
  assert.equal(snowFrom({}), null);
});

test('aurora strength rises with the K-index and stays in range', () => {
  assert.equal(strengthFor(0), .15);
  assert.ok(strengthFor(2) < strengthFor(4) && strengthFor(4) < strengthFor(6));
  assert.equal(strengthFor(9), 1);
});

test('shuffle weights', () => {
  assert.equal(trackWeight(), 1);
  assert.ok(trackWeight({ p: 0, s: 4 }) < .5, 'often skipped comes up less');
  assert.ok(trackWeight({ p: 0, s: 20 }) >= .15, 'never below 15%');
  assert.ok(trackWeight({ p: 3 }) > 1, 'played through comes up more');
  assert.equal(trackWeight({}, true), 1.8);
  assert.equal(trackWeight({}, true, true), 4.5);
  assert.equal(pickWeighted(['a', 'b', 'c'], [1, 0, 1], .2), 'a');
  assert.equal(pickWeighted(['a', 'b', 'c'], [1, 0, 1], .7), 'c');
  assert.equal(pickWeighted(['a'], [1], .9999), 'a');
});

test('loves are kept per scene', () => {
  let m = withSceneLove({}, 'aurora', 'A|1', true);
  m = withSceneLove(m, 'aurora', 'B|2', true);
  m = withSceneLove(m, 'pond', 'A|1', true);
  assert.deepEqual(m, { aurora: ['A|1', 'B|2'], pond: ['A|1'] });
  m = withSceneLove(m, 'pond', 'A|1', false);
  assert.deepEqual(m, { aurora: ['A|1', 'B|2'] });
  let big = {}; for (let i = 0; i < 40; i++) big = withSceneLove(big, 's', 'T|' + i, true);
  assert.equal(big.s.length, 30); assert.equal(big.s[29], 'T|39');
});

test('weekly look-back', () => {
  const D = 86400000, monday = new Date('2026-10-12T09:00:00').getTime();   // a Monday
  Object.assign(state, {
    lookback: { at: new Date('2026-10-05T00:00:00').getTime(), watch: { Aurora: 100 }, plays: { 'Sable|Benthal': 1 }, loved: [] },
    watch: { Aurora: 100 + 3600, Pond: 900 }, trackStats: { 'Sable|Benthal': { p: 5 } }, loved: ['Sable|Benthal'],
    sessions: [{ at: monday - 2 * D, min: 50 }, { at: monday - 3 * D, min: 25 }, { at: monday + D, min: 99 }],
  });
  const w = lookback(monday);
  assert.equal(w.head, 'Last week');
  assert.match(w.body, /1 h 15 min of focus over 2 days/);
  assert.match(w.body, /1 newly loved track/);
  assert.deepEqual(w.items.slice(0, 2), ['Aurora · 1 h', 'Pond · 15 min']);
  assert.equal(w.items[2], 'Benthal — Sable · played 4 times');
  assert.equal(lookback(monday + D), null, 'shown once a week');
});

test('the Android app offers only newer versions not put off', () => {
  assert.equal(shouldOffer({ code: 4 }, 3), true);
  assert.equal(shouldOffer({ code: 3 }, 3), false);
  assert.equal(shouldOffer({ code: 2 }, 3), false);
  assert.equal(shouldOffer({ code: 4 }, 3, 4), false);
  assert.equal(shouldOffer({ code: 5 }, 3, 4), true);
  assert.equal(shouldOffer(null, 3), false);
});
