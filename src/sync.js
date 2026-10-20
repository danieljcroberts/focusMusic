// Moving your settings to another device without an account or a server: everything is packed, compressed, into a
// link (and a QR code of it). The link carries the settings after the "#", which browsers never send to a website, so
// they travel only from this screen to the other device. Opening the link there offers to take them.
import { state, saveState } from './state.js';
import { SITE, NATIVE } from './native.js';
import { setStatus } from './status.js';

const el = id => document.getElementById(id);
// Kept to this device: what's playing, measurements of this device and its music, your location, and the things that
// only make sense on the device that set them (the wallpaper, picture-in-picture, storage choices).
const LOCAL = new Set(['np', 'loudness', 'bench', 'costs', 'found', 'kp', 'local', 'seenHint', 'sheetOpen', 'skipVersion', 'stMigrated', 'stScene', 'watch', 'lowPower', 'pip', 'fsAuto', 'wallpaper', 'keepStreams']);
const LIMIT = 2200;   // characters of packed settings a phone camera still reads reliably as a QR code

const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
const pack = async obj => b64u(await pipe(new TextEncoder().encode(JSON.stringify(obj)), new CompressionStream('deflate-raw')));
const unpack = async s => JSON.parse(new TextDecoder().decode(await pipe(unb64u(s), new DecompressionStream('deflate-raw'))));

// The settings to send, trimmed until they fit: first the per-track play counts, then focus history older than 90 days.
async function code() {
  const keep = Object.fromEntries(Object.entries(state).filter(([k]) => !LOCAL.has(k)));
  let c = await pack({ v: 1, s: keep }), left = '';
  if (c.length > LIMIT) { delete keep.trackStats; c = await pack({ v: 1, s: keep }); left = 'play counts'; }
  if (c.length > LIMIT && Array.isArray(keep.sessions)) {
    const since = Date.now() - 90 * 864e5;
    keep.sessions = keep.sessions.filter(x => (x.at || x.t || x.start || 0) > since);
    c = await pack({ v: 1, s: keep }); left = 'play counts and focus history older than 90 days';
  }
  return { c, left };
}
const base = () => NATIVE ? SITE : location.origin + location.pathname;

const dlg = el('syncDlg'), body = el('syncBody');
const close = () => { dlg.hidden = true; body.replaceChildren(); };
el('syncClose').addEventListener('click', close);
dlg.addEventListener('click', e => { if (e.target === dlg) close(); });

async function openSend() {
  const { c, left } = await code(), link = `${base()}#sync=${c}`;
  const { default: qrcode } = await import('qrcode-generator');
  const qr = qrcode(0, 'L'); qr.addData(link); qr.make();
  const n = qr.getModuleCount(), cell = 1, svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `-4 -4 ${n + 8} ${n + 8}`); svg.setAttribute('class', 'qr'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'QR code of the link');
  let d = '';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) d += `M${k} ${r}h${cell}v${cell}h-${cell}z`;
  svg.innerHTML = `<rect x="-4" y="-4" width="${n + 8}" height="${n + 8}" fill="#fff"/><path d="${d}" fill="#000"/>`;
  const p = document.createElement('p');
  p.textContent = 'Scan this with the other device\'s camera, or send it the link. It carries your scenes, soundtracks, hearts, sets, timer and sounds; your own music and photos stay here.' + (left ? ` To fit, it leaves out ${left}.` : '');
  const row = document.createElement('div'); row.className = 'row wrap';
  const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'pbtn'; copy.textContent = 'Copy link';
  copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(link); copy.textContent = 'Copied'; } catch (e) { setStatus("Couldn't copy the link."); } });
  row.append(copy);
  if (navigator.share) {
    const share = document.createElement('button'); share.type = 'button'; share.className = 'pbtn'; share.textContent = 'Share…';
    share.addEventListener('click', () => navigator.share({ title: 'Slow Windows settings', url: link }).catch(() => {}));
    row.append(share);
  }
  const note = document.createElement('p'); note.className = 'muted';
  note.textContent = 'In the Android app, paste the link under App, Receive settings. Anyone with the link can see these settings, so send it only to yourself.';
  body.replaceChildren(svg, p, row, note);
}

function openReceive() {
  const p = document.createElement('p'); p.textContent = 'Paste the link from your other device.';
  const f = document.createElement('form'); f.className = 'row';
  const inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = 'Link or code'; inp.setAttribute('aria-label', 'Settings link'); inp.style.flex = '1';
  const go = document.createElement('button'); go.className = 'pbtn'; go.textContent = 'Take';
  f.append(inp, go);
  f.addEventListener('submit', e => { e.preventDefault(); const v = inp.value.trim(); offer(v.includes('#sync=') ? v.split('#sync=')[1] : v); });
  body.replaceChildren(p, f); inp.focus();
}

async function offer(c) {
  let d;
  try { d = await unpack(c); if (d.v !== 1 || !d.s) throw new Error('not settings'); } catch (e) { setStatus("That link doesn't hold Slow Windows settings."); return; }
  dlg.hidden = false; el('syncTitle').textContent = 'Settings from another device';
  const p = document.createElement('p');
  const n = [d.s.favs?.length && `${d.s.favs.length} favourites`, d.s.soundtracks && 'your soundtracks', d.s.sets?.length && `${d.s.sets.length} scene sets`, d.s.sessions?.length && `${d.s.sessions.length} focus sessions`].filter(Boolean);
  p.textContent = `Use the settings from the other device here${n.length ? ` (${n.join(', ')})` : ''}? They replace this device's settings; music and photos added here stay.`;
  const row = document.createElement('div'); row.className = 'row';
  const yes = document.createElement('button'); yes.type = 'button'; yes.className = 'pbtn tog'; yes.setAttribute('aria-pressed', 'true'); yes.textContent = 'Use them';
  const no = document.createElement('button'); no.type = 'button'; no.className = 'pbtn'; no.textContent = 'Not now';
  yes.addEventListener('click', () => {
    const mine = Object.fromEntries(Object.entries(state).filter(([k]) => LOCAL.has(k)));
    saveState({ ...d.s, ...mine }); history.replaceState(null, '', location.pathname);
    setStatus('Settings taken. Reloading…'); setTimeout(() => location.reload(), 700);
  });
  no.addEventListener('click', () => { history.replaceState(null, '', location.pathname); close(); });
  row.append(yes, no); body.replaceChildren(p, row);
}

el('syncSendBtn').addEventListener('click', () => { el('syncTitle').textContent = 'Send settings to another device'; dlg.hidden = false; body.textContent = 'Packing…'; openSend().catch(() => { close(); setStatus("Couldn't pack the settings on this browser."); }); });
el('syncGetBtn').addEventListener('click', () => { el('syncTitle').textContent = 'Receive settings'; dlg.hidden = false; openReceive(); });
if (location.hash.startsWith('#sync=')) offer(location.hash.slice(6));
