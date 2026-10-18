// Status messages: a short note above the player bar that shows for a few seconds, longer for longer messages.
const status = document.getElementById('status');
let timer;
export function setStatus(msg) {
  clearTimeout(timer);
  status.textContent = msg || '';
  status.classList.toggle('on', !!msg);
  if (msg) timer = setTimeout(() => status.classList.remove('on'), Math.min(9000, 2500 + msg.length * 45));
}
