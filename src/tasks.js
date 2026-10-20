// Today's tasks: up to three short things, ticked off as they get done. They show under the timer, and the card at the
// end of each focus block lists the open ones to tick. A new day starts a fresh list (the old one is let go).
import { state, saveState } from './state.js';

const el = id => document.getElementById(id);
const today = () => new Date().toDateString();
const list = () => (state.tasks && state.tasks.day === today()) ? state.tasks.items : [];
const save = items => saveState({ tasks: { day: today(), items } });
export function drawTasks() {
  const box = el('taskList'); box.textContent = '';
  const items = list();
  items.forEach((t, i) => box.append(row(t, i, items)));
  el('taskAdd').hidden = items.length >= 3;
  el('taskNote').textContent = items.length ? `${items.filter(t => t.done).length} of ${items.length} done today` : 'Up to three things for today.';
}
function row(t, i, items) {
  const li = document.createElement('li'); li.className = t.done ? 'done' : '';
  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!t.done; cb.id = 'task' + i;
  cb.addEventListener('change', () => { items[i].done = cb.checked; save(items); drawTasks(); drawCardTasks(); });
  const lb = document.createElement('label'); lb.htmlFor = cb.id; lb.textContent = t.text;
  const x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', `Remove ${t.text}`);
  x.addEventListener('click', () => { items.splice(i, 1); save(items); drawTasks(); });
  li.append(cb, lb, x); return li;
}
// The open tasks on the end-of-block card, to tick there and then.
export function drawCardTasks() {
  const box = el('sumTasks'); if (!box) return; box.textContent = '';
  const items = list(); box.hidden = !items.length;
  items.forEach((t, i) => box.append(row(t, i, items)));
}
el('taskAdd').addEventListener('submit', e => {
  e.preventDefault();
  const v = el('taskIn').value.trim(); if (!v) return;
  const items = list(); if (items.length >= 3) return;
  items.push({ text: v.slice(0, 60), done: false }); save(items); el('taskIn').value = ''; drawTasks();
});
drawTasks();
window.addEventListener('sw-block-done', () => setTimeout(drawCardTasks, 50));
