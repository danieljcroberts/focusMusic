import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BeatClock } from '../src/beat.js';

// Made-up music at 60 frames a second: a kick on every beat (stronger on the one), hats between, a little noise.
function run(clock, { bpm, offset, measured, secs, fps = 60, accent = 1, seed = 1, jitter = 0, offbass = 0 }) {
  let r = seed; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const period = 60 / bpm;
  let shown = 0, t = 0;
  while (t < secs) {
    // Each frame hears what happened since the last one: a kick in (t - dt, t].
    const dt = (1 + jitter * (rnd() * 2 - 1)) / fps; t += dt;
    const b = (t - offset) / period, k = Math.floor(b), f = b - k;
    let flux = .01 * rnd();
    if (t >= offset && f * period < dt) flux += .3 * (((k % 4) + 4) % 4 === 0 ? accent : 1);
    if (t >= offset && f >= .5 && (f - .5) * period < dt) flux += .07 + offbass;   // hats, and an off-beat bass in some trance
    shown = clock.update(flux, dt, measured);
  }
  const truth = (t - offset) / period, e = shown - truth;
  if (process.env.BEAT_DEBUG) console.log(bpm, measured, fps, (Math.abs(e - Math.round(e))).toFixed(3), clock.bpm.toFixed(2), clock.lock.toFixed(2));
  return { err: Math.abs(e - Math.round(e)), clock, truth };
}

test('locks onto kicks at the measured tempo, from any starting phase', () => {
  for (const offset of [.05, .23, .41]) {
    const { err, clock } = run(new BeatClock(), { bpm: 128, offset, measured: 128, secs: 12 });
    assert.ok(err < .06, `phase error ${err.toFixed(3)} at offset ${offset}`);
    assert.ok(clock.lock > .6, `lock ${clock.lock.toFixed(2)}`);
  }
});

test('stays on the beat when the measured tempo is slightly off', () => {
  const { err, clock } = run(new BeatClock(), { bpm: 128, offset: .3, measured: 126.5, secs: 30 });
  assert.ok(err < .07, `phase error ${err.toFixed(3)}`);
  assert.ok(Math.abs(clock.bpm - 128) < 1, `tempo ${clock.bpm.toFixed(2)}`);
});

test('finds the tempo and the beat with no measurement', () => {
  const { err, clock } = run(new BeatClock(), { bpm: 140, offset: .1, measured: 0, secs: 20 });
  assert.ok(Math.abs(clock.bpm - 140) < 3, `tempo ${clock.bpm.toFixed(1)}`);
  assert.ok(err < .08, `phase error ${err.toFixed(3)}`);
});

test('works at a low, uneven frame rate', () => {
  const { err } = run(new BeatClock(), { bpm: 174, offset: .2, measured: 174, secs: 15, fps: 30, jitter: .4 });
  assert.ok(err < .1, `phase error ${err.toFixed(3)}`);
});

test('learns which beat is the one', () => {
  const { clock, truth } = run(new BeatClock(), { bpm: 120, offset: .15, measured: 120, secs: 30, accent: 2 });
  const fromOne = clock.fromOne(), barTruth = truth % 4;
  const d = ((fromOne - barTruth) % 4 + 4) % 4;
  assert.ok(Math.min(d, 4 - d) < .1, `bar position off by ${d.toFixed(2)} beats`);
});

test('keeps to the kick when a rolling bass hits the off-beats', () => {
  for (const offset of [.1, .3]) {
    const { err, clock } = run(new BeatClock(), { bpm: 140, offset, measured: 140, secs: 15, offbass: .18 });
    assert.ok(err < .08, `phase error ${err.toFixed(3)} at offset ${offset}`);
    assert.ok(clock.lock > .8, `lock ${clock.lock.toFixed(2)}`);
  }
});

test('does not claim a lock on music without a beat', () => {
  const clock = new BeatClock(); let r = 3; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 60 * 30; i++) clock.update(rnd() < .02 ? .1 + .3 * rnd() : .01 * rnd(), 1 / 60, 90);   // swells and the odd bump, at random
  assert.ok(clock.lock < .35, `lock ${clock.lock.toFixed(2)}`);
});
