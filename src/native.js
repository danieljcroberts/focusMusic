// The Android app (Capacitor). NATIVE is fixed at build time (vite --mode native), so none of this is in the web app.
// What the Android app adds over the web app, through a small plugin of its own (android/.../SlowWindowsPlugin.java):
//  - music keeps playing with the screen off: a foreground media service runs while anything plays;
//  - the screen stays on while the app is in front;
//  - the sunrise alarm is a real alarm clock: Android opens the app over the lock screen ten minutes early;
//  - timer notifications come through Android's own notifications.
export const NATIVE = import.meta.env.MODE === 'native';
export const SITE = 'https://danieljcroberts.github.io/focusMusic/';   // the live web app, for share links and streamed music
let plugin = null, notes = null;
const ready = NATIVE ? (async () => {
  const { registerPlugin } = await import('@capacitor/core');
  plugin = registerPlugin('SlowWindows');
  ({ LocalNotifications: notes } = await import('@capacitor/local-notifications'));
})() : Promise.resolve();

export async function nativeNotify(title, body) {
  if (!NATIVE) return false;
  await ready;
  try {
    if ((await notes.checkPermissions()).display !== 'granted' && (await notes.requestPermissions()).display !== 'granted') return true;
    await notes.schedule({ notifications: [{ id: Math.floor(Date.now() / 1000) % 2147483647, title, body }] });
  } catch (e) {}
  return true;
}
export async function nativeAskNotify() { if (!NATIVE) return; await ready; try { await notes.requestPermissions(); } catch (e) {} }
// Playback: the media service runs while music plays (title shown in its notification), and stops when it stops.
export async function nativePlaying(on, title) { if (!NATIVE) return; await ready; try { await (on ? plugin.startPlayback({ title: title || 'Playing' }) : plugin.stopPlayback()); } catch (e) {} }
export async function nativeKeepAwake(on) { if (!NATIVE) return; await ready; try { await plugin.keepAwake({ on }); } catch (e) {} }
// The sunrise alarm: at (ms since 1970) Android opens the app; null cancels it.
export async function nativeAlarm(at) { if (!NATIVE) return; await ready; try { await (at ? plugin.setAlarm({ at }) : plugin.cancelAlarm()); } catch (e) {} }
// Calls f when the app was opened by the alarm, now or later while it is running.
export async function onNativeSunrise(f) {
  if (!NATIVE) return; await ready;
  try {
    await plugin.addListener('sunrise', () => f());
    const { reason } = await plugin.launchReason(); if (reason === 'sunrise') f();
  } catch (e) {}
}
