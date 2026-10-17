// Testing every scene on this device: each one runs for a few seconds while its frame rate is measured, then the slow
// ones are listed, with the option to leave them out. Takes about seven minutes; the scenes' governors also settle and
// remember their render scale on the way (see costs in main.js). Results are kept with the date.
import { state, saveState } from './state.js';
import { setIncluded } from './excluded.js';

const el = id => document.getElementById(id);
const box = el('bench'), text = el('benchText'), list = el('benchList');
const WARM = 1500, MEASURE = 2500, SLOW = 30;   // frames per second below which a scene counts as slow here
let running = false;
const wait = ms => new Promise(r => setTimeout(r, ms));
// Frames per second over ms, from requestAnimationFrame (which the app's own drawing shares).
const measure = ms => new Promise(res => {
  let n = 0, t0 = 0;
  const f = t => { if (!t0) t0 = t; n++; if (t - t0 < ms && running) requestAnimationFrame(f); else res(n / Math.max(.001, (t - t0) / 1000)); };
  requestAnimationFrame(f);
});
export function initBench({ scenes, go, current }) {
  const drawResults = results => {
    const slow = Object.entries(results).filter(([, r]) => r.fps < SLOW).sort((a, b) => a[1].fps - b[1].fps);
    list.textContent = '';
    for (const [k, r] of slow) { const li = document.createElement('li'); li.textContent = `${scenes.find(s => s.key === k)?.name || k} · ${Math.round(r.fps)} frames a second`; list.append(li); }
    const n = Object.keys(results).length;
    text.textContent = slow.length ? `${slow.length} of ${n} scenes run slowly on this device (under ${SLOW} frames a second):` : `All ${n} scenes run smoothly on this device.`;
    el('benchOut').hidden = !slow.length; el('benchOut').onclick = () => {
      setIncluded(slow.map(([k]) => scenes.find(s => s.key === k)?.name).filter(Boolean), false, scenes.map(s => s.name));
      text.textContent = `Left out ${slow.length} slow scene${slow.length === 1 ? '' : 's'}. Bring them back from Choose in the scene picker.`; el('benchOut').hidden = true;
    };
  };
  el('benchBtn').addEventListener('click', async () => {
    if (running) return;
    el('sheetClose').click();
    running = true; box.hidden = false; list.textContent = ''; el('benchOut').hidden = true; el('benchStop').textContent = 'Stop';
    const back = current(), results = {};
    document.body.classList.add('idle', 'benching');
    for (let i = 0; i < scenes.length && running; i++) {
      text.textContent = `Testing ${i + 1} of ${scenes.length}: ${scenes[i].name}`;
      go(i); await wait(WARM); if (!running) break;
      results[scenes[i].key] = { fps: Math.round(await measure(MEASURE) * 10) / 10 };
    }
    const done = running; running = false;
    document.body.classList.remove('benching');
    go(back);
    if (Object.keys(results).length) saveState({ bench: { at: Date.now(), complete: done, results } });
    drawResults(results); el('benchStop').textContent = 'Close';
  });
  el('benchStop').addEventListener('click', () => { if (running) running = false; else box.hidden = true; });
  // The last results, shown under the button.
  const last = state.bench;
  if (last) el('benchNote').textContent = `Last tested ${new Date(last.at).toLocaleDateString()}: ${Object.values(last.results).filter(r => r.fps < SLOW).length} slow scenes.`;
}
export const benching = () => running;
