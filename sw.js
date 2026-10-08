// Slow Windows service worker: the page and code come network-first (so a new build is picked up on the next load,
// with the cache as the offline fallback); scene art, video and music are cache-first once seen.
// Audio is requested in byte ranges, which the cache cannot answer directly, so ranges are cut from a cached whole file.
const CACHE = 'slow-windows-v1';
const SHELL = ['./', './index.html', './app.js', './index.css', './manifest.webmanifest', './icon.svg', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function rangeFromCache(req) {
  const c = await caches.open(CACHE);
  const full = await c.match(req.url, { ignoreVary: true });
  if (!full) return fetch(req);
  const buf = await full.arrayBuffer();
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get('range') || '');
  if (!m) return new Response(buf, { headers: full.headers });
  const start = Number(m[1]), end = m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': full.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok && r.status === 200) c.put(req, r.clone());
  return r;
}
async function networkFirst(req) {
  try {
    const r = await fetch(req);
    if (r.ok) { const c = await caches.open(CACHE); c.put(req, r.clone()); }
    return r;
  } catch (e) {
    const hit = await caches.match(req, { ignoreSearch: true });
    return hit || Response.error();
  }
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (e.request.headers.has('range')) { e.respondWith(rangeFromCache(e.request)); return; }
  if (url.pathname.includes('/assets/')) e.respondWith(cacheFirst(e.request));
  else e.respondWith(networkFirst(e.request));
});
