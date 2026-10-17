// The Android app's side of the page (none of this runs on the web): the playback notification and lock screen follow
// the player and drive it, the bundled music can be kept on the phone, the Quick Settings tiles start a focus block or
// Bedtime, the screen is held on while a scene shows, the web's offline buttons (a service-worker matter) are hidden,
// and newer versions of the app are offered.
import { TRACKS, currentTrack, playingNow, togglePlay, nextTrack, prevTrack } from './music.js';
import { NATIVE, SITE, nativePlaying, nativeKeepAwake, onNativeMedia, onNativeLaunch } from './native.js';
import { loadDownloads, downloadAll, removeDownloads, downloadedCount } from './downloads.js';
import { shouldOffer } from './update.js';
import { timerRunning, toggleTimer } from './timer.js';
import { setStatus } from './status.js';
import { state, saveState } from './state.js';

const el = id => document.getElementById(id);
// caption: shows a word over the scene (from main.js).
export function initNativeUi({ caption }) {
  if (!NATIVE) return;
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
  const checkUpdate = async () => {
    try {
      const v = await (await fetch(SITE + 'app-version.json', { cache: 'no-store' })).json();
      if (!shouldOffer(v, mine, state.skipVersion)) return;
      el('updateText').textContent = `A new version of the app is ready (${v.name}).${v.notes ? ' ' + v.notes : ''}`;
      el('updateGet').href = SITE + v.apk; el('updateBar').hidden = false;
    } catch (e) { /* offline, or nothing published yet */ }
  };
  el('updateGet').addEventListener('click', () => { el('updateBar').hidden = true; setStatus('Downloading the update. Open it when it finishes to install.'); });
  el('updateLater').addEventListener('click', async () => {
    el('updateBar').hidden = true;
    try { const v = await (await fetch(SITE + 'app-version.json', { cache: 'no-store' })).json(); saveState({ skipVersion: v.code }); } catch (e) {}
  });
  setTimeout(checkUpdate, 8000); setInterval(checkUpdate, 6 * 3600 * 1000);
}
