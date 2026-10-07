// Remembered per viewer: last scene, each scene's background, low power, music following, the timer and the volume.
// Storage can be missing or throw (private windows, blocked site data), so every access is guarded.
const STATE_KEY = 'sw-state';
export let state = {};
try { state = JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {}; } catch (e) { state = {}; }

export function saveState(patch) {
  Object.assign(state, patch);
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {}
}
