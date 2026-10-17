// The summary card: the end of a focus block (minutes, scene, what played), and on the first open of a new week, last
// week's look-back on the same card.
import { playedSince } from './music.js';
import { lookback } from './lookback.js';

const el = id => document.getElementById(id);
// The end of a focus block: a small card with the minutes, the scene and what played, gone after a while.
const summary = el('summary'); let summaryTimer;
window.addEventListener('sw-block-done', e => {
  const { min, scene, count, break: br } = e.detail, tracks = playedSince(Date.now() - min * 60000);
  el('sumHead').textContent = e.detail.intent ? `${min} minutes on ${e.detail.intent}` : `${min} minutes of focus`;
  el('sumBody').textContent = `Block ${count} today · ${scene}${tracks.length ? ` · ${tracks.length} track${tracks.length === 1 ? '' : 's'}` : ''} · ${br} minute break`;
  el('sumBody').textContent += e.detail.away ? ` · left the app ${e.detail.away} time${e.detail.away === 1 ? '' : 's'}` : ' · stayed with it';
  const ol = el('sumTracks'); ol.textContent = '';
  for (const t of tracks.slice(-5)) { const li = document.createElement('li'); li.textContent = `${t.t} — ${t.a}`; ol.append(li); }
  summary.hidden = false; clearTimeout(summaryTimer); summaryTimer = setTimeout(() => { summary.hidden = true; }, 20000);
});
el('sumClose').addEventListener('click', () => { summary.hidden = true; });
// The first open in a new week: last week's look-back on the same card, staying up a little longer.
setTimeout(() => {
  if (!el('hint1').hidden || !summary.hidden) return;
  const w = lookback(); if (!w) return;
  el('sumHead').textContent = w.head; el('sumBody').textContent = w.body;
  const ol = el('sumTracks'); ol.textContent = '';
  for (const x of w.items) { const li = document.createElement('li'); li.textContent = x; ol.append(li); }
  summary.hidden = false; clearTimeout(summaryTimer); summaryTimer = setTimeout(() => { summary.hidden = true; }, 45000);
}, 5000);
