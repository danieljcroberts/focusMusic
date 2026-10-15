// The sunrise alarm and the bedtime routine.
// Sunrise: at the alarm time, minus ten minutes, a dawn scene brightens from dark, the time of day climbs from night to
// day, and soft music fades up from silence to your usual volume, so you wake to light rather than a noise. It needs the
// app left open (on the charger); a browser may want one tap first if the page was reloaded since the last touch.
// Bedtime: calm music, a dark scene, the sleep timer at 30 minutes and the screen dimmed, in one tap.
import { state, saveState } from './state.js';
import { setStatus } from './status.js';
import { setDaylightOverride } from './daylight.js';
import { musicPlaying, togglePlay, nextTrack, volume, setVolume } from './music.js';
import * as ST from './soundtracks.js';
import { setSleep } from './sleep.js';
import { note } from './diag.js';

const el = id => document.getElementById(id);
const TOD = { auto: null, night: 0, dusk: .5, day: 1 };
let go = () => {}, find = () => -1, rising = null;
const timeIn = el('alarmTime'), alarmBtn = el('alarmBtn'), dim = document.getElementById('dim');
let alarm = state.alarm || { on: false, at: '07:00', last: '' };
timeIn.value = alarm.at;
const drawAlarm = () => { alarmBtn.setAttribute('aria-pressed', String(alarm.on)); alarmBtn.textContent = alarm.on ? `Waking at ${alarm.at}` : 'Wake me'; };
const saveAlarm = () => { saveState({ alarm }); drawAlarm(); };
alarmBtn.addEventListener('click', () => { alarm.on = !alarm.on; alarm.at = timeIn.value || '07:00'; saveAlarm(); if (alarm.on) setStatus(`Sunrise alarm at ${alarm.at}. Leave the app open on the charger.`); });
timeIn.addEventListener('change', () => { alarm.at = timeIn.value || '07:00'; saveAlarm(); });
drawAlarm();

const RAMP = 600;   // ten minutes of sunrise
function startSunrise() {
  const day = new Date().toDateString(); if (alarm.last === day) return;
  alarm.last = day; saveAlarm();
  const i = find('holmestrand') >= 0 ? find('holmestrand') : find('tide'); if (i >= 0) go(i);
  const target = Math.max(.35, volume());
  if (ST.byId('ambient')) ST.setCurrent('ambient');
  setVolume(.02); if (!musicPlaying) togglePlay(); else nextTrack();
  rising = { t0: performance.now(), target };
  document.body.classList.remove('sleep');
  note('sunrise alarm started'); setStatus('Good morning.');
}
function tickSunrise() {
  if (!rising) return;
  const k = Math.min(1, (performance.now() - rising.t0) / 1000 / RAMP), e = k * k * (3 - 2 * k);
  setDaylightOverride(e); dim.style.opacity = String(.85 * (1 - e));
  setVolume(.02 + (rising.target - .02) * e);
  if (k >= 1) { rising = null; dim.style.opacity = ''; setDaylightOverride(TOD[state.tod || 'auto'] ?? null); }
}
setInterval(() => {
  if (alarm.on && !rising) {
    const [h, m] = (alarm.at || '07:00').split(':').map(Number), now = new Date(), at = new Date(); at.setHours(h, m, 0, 0);
    const lead = (at - now) / 1000;
    if (lead <= RAMP && lead > RAMP - 120) startSunrise();     // ten minutes before, within a two-minute window
  }
  tickSunrise();
}, 1000);
// Any touch during the sunrise leaves it as it is; the alarm is turned off by its button.

// Bedtime.
el('bedBtn').addEventListener('click', () => {
  if (ST.byId('ambient')) ST.setCurrent('ambient');
  const i = find('nightSky'); if (i >= 0) go(i);
  if (!musicPlaying) togglePlay(); else nextTrack();
  setSleep(30); document.body.classList.add('bedtime');
  setStatus('Bedtime: calm music, the screen dimmed, stopping in 30 minutes.');
});
window.addEventListener('pointerdown', () => { if (document.body.classList.contains('bedtime') && !document.body.classList.contains('sleep')) return; document.body.classList.remove('bedtime'); }, { passive: true });

export function initWake(o) { go = o.go; find = o.find; }
