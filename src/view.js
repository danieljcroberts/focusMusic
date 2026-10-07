// The shared drawing surface. Scenes import W, H, DPR and lowPower as live bindings,
// so a resize or a low-power toggle here is seen by every module on its next frame.
export const cv = document.getElementById('scene');
export const ctx = cv.getContext('2d');
export const glc = document.getElementById('gl');
export const stillImg = document.getElementById('still');
export const fadeCv = document.getElementById('fade');
export const fctx = fadeCv.getContext('2d');
export const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export let W = 0, H = 0, DPR = 1;
export let lowPower = false;

export function setSize(w, h, dpr) { W = w; H = h; DPR = dpr; }
export function setLowPowerFlag(v) { lowPower = v; }

export function gctxFallback(msg) {
  glc.hidden = true; cv.hidden = false;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#0b1420'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ece6da'; ctx.font = '14px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
  ctx.fillText(msg, W / 2, H * .4); ctx.textAlign = 'start';
}
