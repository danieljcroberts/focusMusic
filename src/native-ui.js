// The Android app's side of the page (none of this runs on the web): the playback notification and lock screen follow
// the player and drive it, the bundled music can be kept on the phone, the Quick Settings tiles start a focus block or
// Bedtime, the screen is held on while a scene shows, the web's offline buttons (a service-worker matter) are hidden,
// and newer versions of the app are offered.
import { TRACKS, currentTrack, playingNow, togglePlay, nextTrack, prevTrack } from './music.js';
import { NATIVE, SITE, nativePlaying, nativeKeepAwake, onNativeMedia, onNativeLaunch, nativeSetWallpaper, nativeWidget, nativePip, onNativePip } from './native.js';
import { loadDownloads, downloadAll, removeDownloads, downloadedCount } from './downloads.js';
import { shouldOffer } from './update.js';
import { timerRunning, toggleTimer, focusToday } from './timer.js';
import { setStatus } from './status.js';
import { state, saveState } from './state.js';
import { SCENES } from './scenes/index.js';

const el = id => document.getElementById(id);
// caption: shows a word over the scene; frame(): the scene as a PNG blob; go, current, find, sceneName: the scenes (from main.js).
export function initNativeUi({ caption, frame, go, current, find, sceneName }) {
  if (!NATIVE) return;
  // Wallpaper: the scene as it is now, on the home screen, the lock screen or both. With "refresh each morning" on, the
  // first open of each day sets it again, so it follows the season, the weather and the light: if that scene isn't the
  // one on screen, the app shows it for a few seconds to take the picture, then comes back.
  el('wallRow').hidden = false;
  const wp = () => state.wallpaper || null;
  const setWall = async which => {
    el('wallHome').disabled = el('wallLock').disabled = el('wallBoth').disabled = true;
    const ok = await nativeSetWallpaper(await frame(), which);
    el('wallHome').disabled = el('wallLock').disabled = el('wallBoth').disabled = false;
    if (ok) { saveState({ wallpaper: { scene: SCENES[current()].key, which, daily: !!(wp() && wp().daily), day: new Date().toDateString() } }); drawWall(); }
    setStatus(ok ? `Wallpaper set: ${sceneName()}.` : "Couldn't set the wallpaper.");
  };
  const drawWall = () => { const w = wp(); el('wallDaily').hidden = !w; el('wallDaily').setAttribute('aria-pressed', String(!!(w && w.daily))); el('wallNote').textContent = w ? `${SCENES.find(s => s.key === w.scene)?.name || 'A scene'} is the wallpaper.` : ''; };
  el('wallHome').addEventListener('click', () => setWall('home'));
  el('wallLock').addEventListener('click', () => setWall('lock'));
  el('wallBoth').addEventListener('click', () => setWall('both'));
  el('wallDaily').addEventListener('click', () => { const w = wp(); if (!w) return; saveState({ wallpaper: { ...w, daily: !w.daily } }); drawWall(); });
  drawWall();
  setTimeout(async () => {
    const w = wp(); if (!w || !w.daily || w.day === new Date().toDateString()) return;
    const i = find(w.scene); if (i < 0) return;
    const back = current();
    if (i !== back) { caption('Refreshing the wallpaper…'); go(i); await new Promise(r => setTimeout(r, 6000)); }
    else await new Promise(r => setTimeout(r, 2000));
    const ok = await nativeSetWallpaper(await frame(), w.which);
    if (i !== back) go(back);
    if (ok) saveState({ wallpaper: { ...w, day: new Date().toDateString() } });
  }, 12000);
  // The home-screen widget: kept up to date when a block starts or ends, and at start-up.
  const pushWidget = () => nativeWidget(focusToday());
  pushWidget(); window.addEventListener('sw-focus-start', pushWidget); window.addEventListener('sw-block-done', pushWidget); window.addEventListener('sw-timer', pushWidget);
  setInterval(pushWidget, 10 * 60 * 1000);
  // Picture-in-picture: a toggle; while in the small window the controls hide.
  el('pipRow').hidden = false;
  const drawPip = () => el('pipBtn').setAttribute('aria-pressed', String(!!state.pip));
  el('pipBtn').addEventListener('click', () => { saveState({ pip: !state.pip }); drawPip(); nativePip(state.pip); });
  drawPip(); nativePip(!!state.pip);
  onNativePip(inPip => { document.body.classList.toggle('pip', inPip); if (inPip) { el('sheetClose').click(); } });
  // The playback notification and lock screen follow the track and whether it plays (read from the players, since
  // drawing stops with the screen off), and their buttons drive the player.
  let was = null, wasTitle = '';
  setInterval(() => {
    const ct = currentTrack(), on = playingNow(), title = ct ? ct.t : '';
    if (!ct && was === null) return;   // nothing has played yet
    if (on !== was || title !== wasTitle) { was = on; wasTitle = title; nativePlaying(on, title, ct ? ct.a : ''); }
  }, 1000);
  // Music kept on the phone: the bundled tracks, downloaded into the app so they play with no connection.
  const kept = TRACKS.filter(t => t.file), keptMin = Math.round(kept.reduce((a, t) => a + (t.len || 0), 0) / 60);
  const drawDl = () => {
    const n = downloadedCount();
    el('dlRow').hidden = false; el('dlRemove').hidden = !n;
    el('dlBtn').hidden = n >= kept.length;
    el('dlBtn').textContent = n ? `Download the other ${kept.length - n} tracks` : `Download music to this phone (${kept.length} tracks, ${Math.floor(keptMin / 60)} h ${keptMin % 60} min, about 250 MB)`;
    el('dlNote').textContent = n ? `${n} of ${kept.length} tracks kept on this phone; they play with no connection.` : '';
  };
  loadDownloads().then(drawDl);
  el('dlBtn').addEventListener('click', async () => {
    el('dlBtn').disabled = true;
    try {
      await downloadAll(kept.map(t => t.file), SITE + 'assets/music/', (i, n) => { if (n) setStatus(i < n ? `Downloading music: ${i + 1} of ${n}` : 'Music downloaded. It now plays with no connection.'); });
    } catch (e) { setStatus("Couldn't download all the music. Check the connection and try again; what came down is kept."); }
    el('dlBtn').disabled = false; drawDl();
  });
  el('dlRemove').addEventListener('click', async () => { await removeDownloads(); drawDl(); setStatus('Downloaded music removed. Those tracks stream again.'); });
  // The Quick Settings tiles open the app to start a focus block or Bedtime.
  onNativeLaunch(r => {
    if (r === 'focus' && !timerRunning()) { toggleTimer(); caption('Focus block started'); }
    else if (r === 'bedtime') el('bedBtn').click();
  });
  onNativeMedia(a => {
    if (a === 'play' && !playingNow()) togglePlay();
    else if (a === 'pause' && playingNow()) togglePlay();
    else if (a === 'next') nextTrack();
    else if (a === 'prev') prevTrack();
  });
  new MutationObserver(() => nativeKeepAwake(!document.body.classList.contains('sleep') && !document.body.classList.contains('listening'))).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  nativeKeepAwake(true);
  for (const id of ['offlineScenesBtn', 'offlineBtn', 'keepStreamsBtn']) el(id).hidden = true;
  // Updates: the live site publishes app-version.json with each release (scripts/release.sh). When it names a newer
  // version than this one, offer the download; "Later" waits for the release after that. Checked at start and every
  // six hours. The download opens in the phone's browser, which hands the APK to Android's installer.
  const mine = Number(import.meta.env.VITE_APP_VERSION) || 0;
  // manual: from the "Check for updates" button, which also says when there is nothing new, and ignores "Later".
  const checkUpdate = async (manual = false) => {
    try {
      const v = await (await fetch(SITE + 'app-version.json', { cache: 'no-store' })).json();
      if (manual && !(v.code > mine)) { setStatus(`You have the latest version (1.0.${mine}).`); return; }
      if (!shouldOffer(v, mine, manual ? null : state.skipVersion)) return;
      el('updateText').textContent = `A new version of the app is ready (${v.name}).${v.notes ? ' ' + v.notes : ''}`;
      el('updateGet').href = SITE + v.apk; el('updateBar').hidden = false;
    } catch (e) { if (manual) setStatus("Couldn't check for updates. Check the connection and try again."); }
  };
  el('updBtn').addEventListener('click', () => { el('sheetClose').click(); setStatus('Checking for updates…'); checkUpdate(true); });
  el('updateGet').addEventListener('click', () => { el('updateBar').hidden = true; setStatus('Downloading the update. Open it when it finishes to install.'); });
  el('updateLater').addEventListener('click', async () => {
    el('updateBar').hidden = true;
    try { const v = await (await fetch(SITE + 'app-version.json', { cache: 'no-store' })).json(); saveState({ skipVersion: v.code }); } catch (e) {}
  });
  setTimeout(checkUpdate, 8000); setInterval(checkUpdate, 6 * 3600 * 1000);
}
