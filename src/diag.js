// Diagnostics overlay: frame rate, render scale, what is drawing, the music bands, the ambience and the last errors.
// Toggled with the backquote key or from Settings. Meant for reporting "this scene feels slow" with numbers attached.
const box = document.getElementById('diag');
const errors = [];
export function report(e) {
  const msg = String((e && e.message) || e).replace(/\s+/g, ' ').slice(0, 200);
  if (errors[0] !== msg) errors.unshift(msg);
  errors.length = Math.min(errors.length, 4);
  console.warn(e);
}
window.addEventListener('error', e => report(e.message));
window.addEventListener('unhandledrejection', e => report(e.reason));
let gpu = null;
export function gpuName() {
  if (gpu !== null) return gpu;
  try {
    const c = document.createElement('canvas').getContext('webgl');
    const x = c && c.getExtension('WEBGL_debug_renderer_info');
    gpu = x ? c.getParameter(x.UNMASKED_RENDERER_WEBGL) : c ? 'WebGL (renderer name hidden)' : 'no WebGL';
  } catch (e) { gpu = 'no WebGL'; }
  return gpu;
}
export const diagOn = () => !box.hidden;
export function toggleDiag(on = box.hidden) { box.hidden = !on; }
export function setDiag(lines) {
  if (box.hidden) return;
  box.textContent = [...lines, ...(errors.length ? ['', 'last errors:', ...errors] : [])].join('\n');
}
