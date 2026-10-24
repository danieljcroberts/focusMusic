// The Android app (Capacitor). NATIVE is fixed at build time (vite --mode native), so none of this is in the web app.
// What the Android app adds over the web app, through a small plugin of its own (android/.../SlowWindowsPlugin.java):
//  - music keeps playing with the screen off: a foreground media service runs while anything plays;
//  - the screen stays on while the app is in front;
//  - the sunrise alarm is a real alarm clock: Android opens the app over the lock screen ten minutes early;
//  - timer notifications come through Android's own notifications.
import { note } from './diag.js';
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
// The first time music plays, ask to show notifications, so the playback notification (which shows the service is
// keeping the music going) is visible on Android 13 and later.
let askedForPlayback = false;
export async function nativePlaying(on, title, artist) {
  if (!NATIVE) return; await ready;
  if (on && !askedForPlayback) { askedForPlayback = true; try { await notes.requestPermissions(); } catch (e) {} }
  try { await plugin.startPlayback({ title: title || 'Slow Windows', artist: artist || '', playing: on }); } catch (e) { note('playback service: ' + (e && e.message)); }
}
// Presses on the notification, the lock screen and headphone buttons: f('play' | 'pause' | 'next' | 'prev').
export async function onNativeMedia(f) {
  if (!NATIVE) return; await ready;
  try { await plugin.addListener('media', e => f(e.action)); } catch (e) {}
}
export async function nativeKeepAwake(on) { if (!NATIVE) return; await ready; try { await plugin.keepAwake({ on }); } catch (e) {} }
// The sunrise alarm: at (ms since 1970) Android opens the app; null cancels it.
export async function nativeAlarm(at) { if (!NATIVE) return; await ready; try { await (at ? plugin.setAlarm({ at }) : plugin.cancelAlarm()); } catch (e) {} }
// Why Android opened the app: 'sunrise' (the alarm), 'focus' or 'bedtime' (the Quick Settings tiles). Handlers are
// registered as modules load; the reason the app started with is handed out once to all of them, then any later ones.
const launchers = [];
export const onNativeLaunch = f => { if (NATIVE) launchers.push(f); };
export const onNativeSunrise = f => onNativeLaunch(r => { if (r === 'sunrise') f(); });
if (NATIVE) ready.then(async () => {
  const fire = r => { if (r) launchers.forEach(f => { try { f(r); } catch (e) {} }); };
  try { await plugin.addListener('launch', e => fire(e.reason)); fire((await plugin.launchReason()).reason); } catch (e) {}
});
// Saves a picture (a Blob) to the phone's photos, in a Slow Windows album. True when it worked.
export async function nativeSavePicture(blob, name) {
  if (!NATIVE) return false; await ready;
  try {
    const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
    await plugin.savePicture({ data, name }); return true;
  } catch (e) { note('save picture: ' + (e && e.message)); return false; }
}
const b64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
// Sets a picture (a Blob) as the wallpaper: which is 'home', 'lock' or 'both'. True when it worked.
export async function nativeSetWallpaper(blob, which = 'both') {
  if (!NATIVE) return false; await ready;
  try { await plugin.setWallpaper({ data: await b64(blob), which }); return true; } catch (e) { note('wallpaper: ' + (e && e.message)); return false; }
}
// Today's focus minutes, the streak and whether a block runs, for the home-screen widget.
export async function nativeWidget(d) { if (!NATIVE) return; await ready; try { await plugin.setWidgetData(d); } catch (e) {} }
// Picture-in-picture when the app is left, on or off; onNativePip(f) hears f(true) entering it and f(false) leaving.
export async function nativePip(on) { if (!NATIVE) return; await ready; try { await plugin.setPip({ on: !!on }); } catch (e) {} }
export async function onNativePip(f) { if (!NATIVE) return; await ready; try { await plugin.addListener('pip', e => f(!!e.in)); } catch (e) {} }

// The app's own update: downloaded by Android and handed to its package installer. Events: progress (pct), ready,
// permission, install, installed, cancelled, denied, failed (msg). Falls back to the phone's browser.
export async function nativeDownloadUpdate(url, name) { await ready; await plugin.downloadUpdate({ url, name }); }
export async function onNativeUpdate(f) { if (!NATIVE) return; await ready; try { await plugin.addListener('update', e => f(e.state, e.pct, e.msg)); } catch (e) {} }
export async function nativeInstallUpdate() { await ready; await plugin.installUpdate(); }
export async function nativeOpenExternal(url) { await ready; await plugin.openExternal({ url }); }
