// A short guided tour: six steps, each pointing at one control, offered on the first visit and under App.
const el = id => document.getElementById(id);
const STEPS = [
  ['#play', 'Play and pause, with the previous and next track either side. A double-tap in the middle of the scene does the same.'],
  ['#stBtn', 'The cover of the playing track. Tap it to switch soundtrack (Ambient, Lo-fi, Loved, your own music and more) or open the library. The heart on the right loves the track.'],
  ['#sceneBtn', "The scene's name. Tap it for the scene's story and all the others. Swipe sideways on the scene to change it."],
  ['#menuBtn', 'Everything else lives here: moods to start with, the timer and alarm, sounds, scene sets, your photos, backups. There is a search at the top.'],
  ['#tStart', 'The focus timer. Tap to start a block; the controls stay out of the way while it runs, and a card sums it up at the end.'],
  [null, 'Gestures: tap near the bottom for a mini player, slide the right edge for volume and the left for ambience, long-press for all scenes. That is all. Enjoy the view.'],
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
