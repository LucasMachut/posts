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
/* ---------- une banque par projet ----------
   Les cles sont « <projet>/<nom> ». Le projet issu de la migration (legacy) garde les
   anciennes cles sans prefixe : rien n'est recopie, l'ancienne banque devient la sienne. */
let PROJ = { id: '', legacy: true };
export function setProject(id, legacy) { PROJ = { id: String(id), legacy: !!legacy }; }
const belongs = (k, pr) => pr.legacy ? !String(k).includes('/') : String(k).startsWith(pr.id + '/');
const fk = (n, pr = PROJ) => pr.legacy ? String(n) : pr.id + '/' + n;
const short = (k, pr = PROJ) => pr.legacy ? String(k) : String(k).slice(pr.id.length + 1);

async function put(store, k, v) {
  const db = await open(); if (!db) return;
  try { db.transaction(store, 'readwrite').objectStore(store).put(v, fk(k)); } catch (e) {}
}
async function del(store, k) {
  const db = await open(); if (!db) return;
  try { db.transaction(store, 'readwrite').objectStore(store).delete(fk(k)); } catch (e) {}
}
// cles completes d'un projet dans un magasin
async function keysOf(store, pr) {
  const db = await open(); if (!db) return [];
  return new Promise(res => {
    try {
      const out = [], c = db.transaction(store, 'readonly').objectStore(store).openKeyCursor();
      c.onsuccess = e => { const cur = e.target.result; if (!cur) { res(out); return; } if (belongs(cur.key, pr)) out.push(cur.key); cur.continue(); };
      c.onerror = () => res([]);
    } catch (e) { res([]); }
  });
}
async function getMany(store, keys) {
  const db = await open(); if (!db || !keys.length) return {};
  return new Promise(res => {
    const out = {};
    try {
      const os = db.transaction(store, 'readonly').objectStore(store);
      let left = keys.length;
      keys.forEach(k => { const r = os.get(k); r.onsuccess = () => { out[k] = r.result; if (!--left) res(out); }; r.onerror = () => { if (!--left) res(out); }; });
    } catch (e) { res(out); }
  });
}
async function dropKeys(pr) {
  const db = await open(); if (!db) return;
  const kf = await keysOf('fotos', pr), ko = await keysOf('originais', pr);
  await new Promise(res => {
    try {
      const t = db.transaction(['fotos', 'originais'], 'readwrite');
      kf.forEach(k => t.objectStore('fotos').delete(k)); ko.forEach(k => t.objectStore('originais').delete(k));
      t.oncomplete = res; t.onerror = res; t.onabort = res;
    } catch (e) { res(); }
  });
}
// nombre de photos d'un projet, pour la liste des projets
export async function countFor(id, legacy) {
  const pr = { id: String(id), legacy: !!legacy };
  const a = await keysOf('fotos', pr), b = await keysOf('originais', pr);
  return new Set([...a, ...b]).size;
}
// efface la banque d'un projet (jamais les fichiers de l'appareil)
export async function dropProject(id, legacy) { await dropKeys({ id: String(id), legacy: !!legacy }); }

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
function forget() {
  Object.keys(PREV).forEach(k => { try { URL.revokeObjectURL(PREV[k]); } catch (e) {} delete PREV[k]; });
  Object.keys(ORIG).forEach(k => delete ORIG[k]);
  Object.keys(NAT).forEach(k => delete NAT[k]);
}
// vide la banque du projet ouvert seulement
export async function clearAll() {
  forget();
  await dropKeys(PROJ);
}
// au demarrage ou en changeant de projet : les photos du projet ouvert reviennent, et elles seules
export async function restore() {
  forget();
  const pr = PROJ;
  const kf = await keysOf('fotos', pr);
  const prevFull = await getMany('fotos', kf);
  if (pr !== PROJ) return 0;                                // projet change entre-temps
  const prev = {};
  Object.keys(prevFull).forEach(k => { prev[short(k, pr)] = prevFull[k]; });
  for (const k of Object.keys(prev)) {
    const v = prev[k];
    try {
      const blob = v instanceof Blob ? v : dataURLtoBlob(v);
      setPreview(k, blob);
      if (!(v instanceof Blob)) put('fotos', k, blob);     // ancienne banque en dataURL : on convertit
    } catch (e) {}
  }
  const ko = await keysOf('originais', pr);
  const orgFull = await getMany('originais', ko);
  if (pr !== PROJ) return 0;
  for (const k of Object.keys(orgFull)) if (orgFull[k] instanceof Blob) ORIG[short(k, pr)] = orgFull[k];
  // un original sans apercu : on refabrique l'apercu
  for (const k of Object.keys(ORIG)) {
    if (PREV[k]) continue;
    try { const { blob, w, h } = await makePreview(ORIG[k]); setPreview(k, blob, w, h); put('fotos', k, blob); } catch (e) {}
  }
  return Object.keys(PREV).length;
}
