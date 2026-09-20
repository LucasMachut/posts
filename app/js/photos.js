// Banque de photos : apercus (blobs 1800 px) + fichiers d'origine, gardes dans IndexedDB.
// Sur l'iPhone, la photo choisie dans la pellicule EST l'original.
const DB = 'postgen-photos', VER = 3;
let dbp = null;
const PREV = {};   // nom -> objectURL de l'apercu
const ORIG = {};   // nom -> Blob d'origine
const NAT  = {};   // nom -> {w,h} de l'apercu

function open() {
  if (dbp) return dbp;
  dbp = new Promise(res => {
    let r;
    try { r = indexedDB.open(DB, VER); } catch (e) { res(null); return; }
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('fotos'))     db.createObjectStore('fotos');
      if (!db.objectStoreNames.contains('originais')) db.createObjectStore('originais');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
    r.onblocked = () => res(null);
  });
  return dbp;
}
async function put(store, k, v) {
  const db = await open(); if (!db) return;
  try { db.transaction(store, 'readwrite').objectStore(store).put(v, k); } catch (e) {}
}
async function del(store, k) {
  const db = await open(); if (!db) return;
  try { db.transaction(store, 'readwrite').objectStore(store).delete(k); } catch (e) {}
}
async function all(store) {
  const db = await open(); if (!db) return {};
  return new Promise(res => {
    try {
      const out = {}, c = db.transaction(store, 'readonly').objectStore(store).openCursor();
      c.onsuccess = e => { const cur = e.target.result; if (!cur) { res(out); return; } out[cur.key] = cur.value; cur.continue(); };
      c.onerror = () => res({});
    } catch (e) { res({}); }
  });
}
async function clearStores() {
  const db = await open(); if (!db) return;
  await new Promise(res => {
    try {
      const t = db.transaction(['fotos', 'originais'], 'readwrite');
      t.objectStore('fotos').clear(); t.objectStore('originais').clear();
      t.oncomplete = res; t.onerror = res; t.onabort = res;
    } catch (e) { res(); }
  });
}

export const names   = () => Object.keys(PREV).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
export const urlFor  = n => PREV[n] || '';
export const hasPrev = n => !!PREV[n];
export const hasOrig = n => !!ORIG[n];
export const origFor = n => ORIG[n];
export const natOf   = n => NAT[n];
export const count   = () => Object.keys(PREV).length;

export function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('image illisible'));
    im.src = src;
  });
}
function dataURLtoBlob(s) {
  const [head, b64] = String(s).split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin = atob(b64); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}
async function makePreview(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const im = await loadImage(url);
    const max = 1800, sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(im, 0, 0, c.width, c.height);
    const out = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    return { blob: out, w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}
function setPreview(name, blob, w, h) {
  if (PREV[name]) { try { URL.revokeObjectURL(PREV[name]); } catch (e) {} }
  PREV[name] = URL.createObjectURL(blob);
  if (w && h) NAT[name] = { w, h };
}
export const keyOf = f => f.name.replace(/\.[^.]+$/, '');

// ajoute des fichiers un par un (un seul gros decodage a la fois : l'iPhone n'aime pas plus)
export async function addFiles(files, onEach) {
  const list = [...files].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|tiff?)$/i.test(f.name));
  const added = [];
  for (const f of list) {
    const key = keyOf(f);
    try {
      const { blob, w, h } = await makePreview(f);
      setPreview(key, blob, w, h);
      ORIG[key] = f;
      put('fotos', key, blob); put('originais', key, f);
      added.push(key);
      if (onEach) onEach(key, added.length, list.length);
    } catch (e) { console.warn('photo ignoree', f.name, e); }
  }
  return added;
}
export async function remove(name) {
  if (PREV[name]) { try { URL.revokeObjectURL(PREV[name]); } catch (e) {} }
  delete PREV[name]; delete ORIG[name]; delete NAT[name];
  await del('fotos', name); await del('originais', name);
}
export async function clearAll() {
  Object.keys(PREV).forEach(k => { try { URL.revokeObjectURL(PREV[k]); } catch (e) {} delete PREV[k]; });
  Object.keys(ORIG).forEach(k => delete ORIG[k]);
  Object.keys(NAT).forEach(k => delete NAT[k]);
  await clearStores();
}
// au demarrage : les photos gardees reviennent
export async function restore() {
  const prev = await all('fotos');
  for (const k of Object.keys(prev)) {
    const v = prev[k];
    try {
      const blob = v instanceof Blob ? v : dataURLtoBlob(v);
      setPreview(k, blob);
      if (!(v instanceof Blob)) put('fotos', k, blob);     // ancienne banque en dataURL : on convertit
    } catch (e) {}
  }
  const org = await all('originais');
  for (const k of Object.keys(org)) if (org[k] instanceof Blob) ORIG[k] = org[k];
  // un original sans apercu : on refabrique l'apercu
  for (const k of Object.keys(ORIG)) {
    if (PREV[k]) continue;
    try { const { blob, w, h } = await makePreview(ORIG[k]); setPreview(k, blob, w, h); put('fotos', k, blob); } catch (e) {}
  }
  return Object.keys(PREV).length;
}
