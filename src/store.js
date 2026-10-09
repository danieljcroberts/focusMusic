// A small key-value store on IndexedDB for things too big for localStorage, like the scene thumbnails.
// Every call tolerates a missing or refused database (private windows, blocked site data) by doing nothing.
const DB = 'slow-windows', STORE = 'kv';
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
  return dbp;
}
export async function kvSet(key, value) {
  try { const db = await open(); await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(value, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); } catch (e) {}
}
// Every entry whose key starts with the prefix, as {key: value}.
export async function kvAll(prefix) {
  const out = {};
  try {
    const db = await open();
    await new Promise((res, rej) => {
      const req = db.transaction(STORE).objectStore(STORE).openCursor(IDBKeyRange.bound(prefix, prefix + '￿'));
      req.onsuccess = () => { const c = req.result; if (!c) return res(); out[c.key] = c.value; c.continue(); };
      req.onerror = () => rej(req.error);
    });
  } catch (e) {}
  return out;
}
