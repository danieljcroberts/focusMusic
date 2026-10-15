// The week in look-back: the first time the app opens in a new week (weeks start on Monday), a card shows the focus time
// and the days it came on, the scenes watched most, the tracks played most and how many were newly loved. It compares
// against a snapshot of the running totals taken at the start of each week, so nothing new is recorded to make it.
import { state, saveState } from './state.js';

const DAY = 86400000;
const mondayOf = d => { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - (m.getDay() + 6) % 7); return m.getTime(); };
const snapshot = at => ({ at, watch: { ...(state.watch || {}) }, plays: Object.fromEntries(Object.entries(state.trackStats || {}).map(([k, v]) => [k, v.p || 0])), loved: [...(state.loved || [])] });
const hm = min => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`; };

// What happened between the snapshot and the start of this week, or null when there is too little to be worth a card.
export function lookback(now = Date.now()) {
  const ws = mondayOf(now), lb = state.lookback;
  if (!lb) { saveState({ lookback: snapshot(ws) }); return null; }
  if (lb.at >= ws) return null;
  const from = lb.at, sessions = (state.sessions || []).filter(s => s.at >= from && s.at < ws);
  const focus = sessions.reduce((a, s) => a + s.min, 0), days = new Set(sessions.map(s => new Date(s.at).toDateString())).size;
  const watched = Object.entries(state.watch || {}).map(([n, sec]) => [n, sec - (lb.watch[n] || 0)]).filter(x => x[1] > 60).sort((a, b) => b[1] - a[1]);
  const played = Object.entries(state.trackStats || {}).filter(([k]) => !k.startsWith('own:')).map(([k, v]) => [k, (v.p || 0) - (lb.plays[k] || 0)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  const newLoves = (state.loved || []).filter(k => !lb.loved.includes(k)).length;
  saveState({ lookback: snapshot(ws) });
  const watchMin = watched.reduce((a, x) => a + x[1], 0) / 60;
  if (focus < 1 && watchMin < 5) return null;
  const head = ws - from > 8 * DAY ? `Since ${new Date(from).toLocaleDateString([], { day: 'numeric', month: 'long' })}` : 'Last week';
  const parts = [];
  if (focus >= 1) parts.push(`${hm(focus)} of focus over ${days} day${days === 1 ? '' : 's'}`);
  if (watchMin >= 5) parts.push(`${hm(watchMin)} with the scenes`);
  if (newLoves) parts.push(`${newLoves} newly loved track${newLoves === 1 ? '' : 's'}`);
  const items = [
    ...watched.slice(0, 3).map(([n, sec]) => `${n} · ${hm(sec / 60)}`),
    ...played.slice(0, 3).map(([k, n]) => { const [a, t] = k.split('|'); return `${t} — ${a} · played ${n} time${n === 1 ? '' : 's'}`; }),
  ];
  return { head, body: parts.join(' · '), items };
}
