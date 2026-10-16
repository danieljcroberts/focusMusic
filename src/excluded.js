// Scenes you have left out: they are skipped when swiping or using the arrow keys, by Drift and by break scenes, and
// they are hidden from the scene strip and the picker (except in its Choose mode, where they can be brought back).
// A scene opened directly (a link, or Choose mode) still shows. At least one scene always stays in.
import { state, saveState } from './state.js';

export const excluded = new Set(state.excluded || []);
const listeners = new Set();
export const onExcludedChange = f => listeners.add(f);
export const included = name => !excluded.has(name);
// Include (on) or exclude (!on) the named scenes. Returns false, changing nothing, if it would leave no scene in.
export function setIncluded(names, on, all) {
  const next = new Set(excluded);
  for (const n of names) if (on) next.delete(n); else next.add(n);
  if (all && all.every(n => next.has(n))) return false;
  excluded.clear(); next.forEach(n => excluded.add(n));
  saveState({ excluded: [...excluded] });
  listeners.forEach(f => f());
  return true;
}
