// How likely each track is to come up next, from what you have done with it. Pure, so it can be tested.
// Tracks you skip quickly and often come up less (never below 15%), tracks you let play a little more, hearted tracks
// nearly twice as often, and tracks you hearted while watching the current scene more again when that scene is on.
export function trackWeight({ p = 0, s = 0 } = {}, loved = false, lovedHere = false) {
  const skip = s >= 2 && s > p ? Math.max(.15, .6 - .15 * (s - p)) : 1;
  return (loved ? 1.8 : 1) * (lovedHere ? 2.5 : 1) * skip * (1 + Math.min(p, 6) * .05);
}
// One item from list, each as likely as its weight; r is a random number from 0 to 1.
export function pickWeighted(list, weights, r = Math.random()) {
  let x = r * weights.reduce((a, v) => a + v, 0);
  for (let i = 0; i < list.length; i++) if ((x -= weights[i]) < 0) return list[i];
  return list[list.length - 1];
}
// Pure: the scene-to-hearted-tracks map after hearting (on) or un-hearting track k on scene; at most 30 per scene.
export function withSceneLove(map, scene, k, on) {
  const out = { ...map }, list = (out[scene] || []).filter(x => x !== k);
  if (on) list.push(k);
  out[scene] = list.slice(-30);
  if (!out[scene].length) delete out[scene];
  return out;
}
