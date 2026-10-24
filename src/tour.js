// A short guided tour: five steps, each pointing at one control, offered on the first visit and under Settings.
const el = id => document.getElementById(id);
const STEPS = [
  ['#play', 'Play and pause, and next beside it. Double-tap the left of the scene for the previous track, the middle to pause, the right for the next.'],
  ['#stBtn', 'The cover of the playing track. Tap it to choose a genre; the cog there has your own music, the library and the music settings. Hold it for the track\'s card, with its heart.'],
  ['#strip', 'Scenes. Scroll the strip to look through them, or tap one; the button at its end opens them all, with a search. Swiping sideways on the scene changes it too.'],
  ['#menuBtn', 'Everything else, in three parts: Music, Timer (focus blocks, tasks, the sleep timer) and Settings. There is a search at the top.'],
  [null, 'A tap, a swipe or a hold anywhere brings these controls back. Slide the right edge for volume and the left for ambience. That is all. Enjoy the view.'],
];
let i = 0, hi = null;
function step() {
  if (hi) hi.classList.remove('tourhi');
  if (i >= STEPS.length) return end();
  const [sel, text] = STEPS[i], card = el('tour');
  el('tourText').textContent = text; el('tourStep').textContent = `${i + 1} of ${STEPS.length}`;
  el('tourNext').textContent = i === STEPS.length - 1 ? 'Done' : 'Next';
  hi = sel ? document.querySelector(sel) : null;
  if (hi) hi.classList.add('tourhi');
  // Above the bar for the bar's controls, below the top for the timer, in the middle otherwise.
  card.dataset.at = sel === '#tStart' ? 'top' : sel ? 'bottom' : 'middle';
  card.hidden = false; el('tourNext').focus();
}
function end() { if (hi) hi.classList.remove('tourhi'); hi = null; el('tour').hidden = true; document.body.classList.remove('touring'); }
export function startTour() {
  for (const id of ['sheetClose', 'pickerClose', 'tiClose']) { const b = el(id); if (b && !b.closest('[hidden]')) b.click(); }
  document.body.classList.remove('idle'); document.body.classList.add('touring'); i = 0; step();
}
el('tourNext').addEventListener('click', () => { i++; step(); });
el('tourSkip').addEventListener('click', end);
el('tourBtn').addEventListener('click', startTour);
el('hint1Tour').addEventListener('click', () => { el('hint1Ok').click(); startTour(); });
