// Scene sets: named groups of scenes (made from your favourites), and the one Drift moves within.
import { state, saveState } from './state.js';
import { setStatus } from './status.js';

const el = id => document.getElementById(id);
export const sets = () => state.sets || [];
export const activeSet = () => sets().find(s => s.name === state.activeSet) || null;
function draw() {
  const box = el('setList'); box.textContent = '';
  if (!sets().length) { const n = document.createElement('span'); n.className = 'note'; n.textContent = 'No sets yet.'; box.append(n); return; }
  for (const s of sets()) {
    const wrap = document.createElement('span'); wrap.className = 'set';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tog'; b.textContent = `${s.name} (${s.scenes.length})`;
    b.setAttribute('aria-pressed', String(state.activeSet === s.name));
    b.addEventListener('click', () => { saveState({ activeSet: state.activeSet === s.name ? null : s.name }); draw(); setStatus(state.activeSet ? `Drift moves within "${s.name}".` : 'Drift moves between your favourites again.'); });
    const x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', `Delete the set ${s.name}`);
    x.addEventListener('click', () => { saveState({ sets: sets().filter(z => z !== s), activeSet: state.activeSet === s.name ? null : state.activeSet }); draw(); });
    wrap.append(b, x); box.append(wrap);
  }
}
el('setSave').addEventListener('click', () => {
  const favs = state.favs || [], name = el('setName').value.trim() || `Set ${sets().length + 1}`;
  if (!favs.length) { setStatus('Star some scenes with Favourite first; a set is made from them.'); return; }
  saveState({ sets: [...sets().filter(s => s.name !== name), { name, scenes: [...favs] }], activeSet: name });
  el('setName').value = ''; draw(); setStatus(`Saved "${name}" with ${favs.length} scenes. Drift moves within it.`);
});
draw();
