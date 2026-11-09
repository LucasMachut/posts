// Etat global + sauvegarde locale (localStorage), par projet, avec migration des anciennes maquettes.
// Chaque projet a ses planches (cle postgen-v3:<id>) et sa banque de photos (voir photos.js).
// Le tout premier projet, cree a la migration, reprend l'ancienne sauvegarde et l'ancienne banque.
import { VERSION, migratePage } from './model.js';

const DEFAULTS = () => ({
  pages: [], fmt: { w: 1080, h: 1350 }, gfs: 1, grain: 0, grainsize: 'moyen',
  font: 'Special Elite', track: '.12em',
});
export const S = DEFAULTS();
const OLD3 = 'postgen-v3', OLDKEY = 'postgen-template', IDX = 'postgen-projets';
const keyOf = id => 'postgen-v3:' + id;

export function snapshot() {
  return { v: VERSION, pages: S.pages, fmt: S.fmt, gfs: S.gfs, grain: S.grain,
    grainsize: S.grainsize, font: S.font, track: S.track };
}
export function applyState(o) {
  const from = typeof o.v === 'number' ? o.v : 2;      // les anciennes versions etaient des dates
  if (Array.isArray(o.pages)) S.pages = o.pages.map(p => migratePage(p, from));
  if (o.fmt && +o.fmt.w >= 200 && +o.fmt.h >= 200) S.fmt = { w: +o.fmt.w, h: +o.fmt.h };
  if (o.gfs) S.gfs = Math.max(0.3, Math.min(4, +o.gfs));
  if (o.grain !== undefined) S.grain = Math.max(0, Math.min(0.65, +o.grain || 0));
  if (['fin', 'moyen', 'gros'].includes(o.grainsize)) S.grainsize = o.grainsize;
  if (o.font) S.font = o.font;
  if (o.track) S.track = o.track;
}
function resetS() { Object.assign(S, DEFAULTS()); }

/* ---------- projets ---------- */
let IX = null;   // { cur, list: [{ id, name, upd, legacy }] }
function readIdx() { try { return JSON.parse(localStorage.getItem(IDX) || 'null'); } catch (e) { return null; } }
function writeIdx() { try { localStorage.setItem(IDX, JSON.stringify(IX)); } catch (e) {} }
const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const projects = () => [...IX.list].sort((a, b) => (b.upd || 0) - (a.upd || 0));
export const current  = () => IX.list.find(p => p.id === IX.cur);
export function pagesCount(id) {
  if (id === IX.cur) return S.pages.length;
  try { const o = JSON.parse(localStorage.getItem(keyOf(id)) || 'null'); return o && Array.isArray(o.pages) ? o.pages.length : 0; }
  catch (e) { return 0; }
}

// premiere ouverture : l'ancienne sauvegarde devient « Projet 1 », sans toucher aux anciennes cles
function migrate() {
  IX = readIdx();
  if (IX && Array.isArray(IX.list) && IX.list.length) {
    if (!IX.list.some(p => p.id === IX.cur)) IX.cur = IX.list[0].id;
    return;
  }
  const id = 'p1';
  IX = { cur: id, list: [{ id, name: 'Projet 1', upd: Date.now(), legacy: true }] };
  try {
    const old = localStorage.getItem(OLD3) || localStorage.getItem(OLDKEY);
    if (old && !localStorage.getItem(keyOf(id))) localStorage.setItem(keyOf(id), old);
  } catch (e) {}
  writeIdx();
}

let t = null;
function writeNow() {
  clearTimeout(t); t = null;
  try { localStorage.setItem(keyOf(IX.cur), JSON.stringify(snapshot())); } catch (e) {}
  const p = current(); if (p) { p.upd = Date.now(); writeIdx(); }
}
export function save() { clearTimeout(t); t = setTimeout(writeNow, 120); }
export function flush() { if (t) writeNow(); }

export function load() {
  migrate();
  resetS();
  try {
    const s = localStorage.getItem(keyOf(IX.cur));
    if (!s) return false;
    applyState(JSON.parse(s));
    return true;
  } catch (e) { return false; }
}
// efface les planches du projet ouvert seulement
export function clear() {
  try { localStorage.removeItem(keyOf(IX.cur)); } catch (e) {}
}

export function openProject(id) {
  flush();
  if (!IX.list.some(p => p.id === id)) return false;
  IX.cur = id; writeIdx();
  return load();
}
export function createProject(name, state) {
  flush();
  const id = newId();
  IX.list.push({ id, name: String(name || 'Sans nom').trim() || 'Sans nom', upd: Date.now() });
  IX.cur = id; writeIdx();
  resetS();
  if (state) applyState(state);
  writeNow();
  return id;
}
export function renameProject(id, name) {
  const p = IX.list.find(q => q.id === id); if (!p) return;
  p.name = String(name || '').trim() || p.name; writeIdx();
}
// retire le projet de la liste et ses planches ; la banque est videe par l'appelant (photos.js)
export function deleteProject(id) {
  IX.list = IX.list.filter(p => p.id !== id);
  try { localStorage.removeItem(keyOf(id)); } catch (e) {}
  if (!IX.list.length) IX.list.push({ id: newId(), name: 'Projet 1', upd: Date.now() });
  if (IX.cur === id) IX.cur = projects()[0].id;
  writeIdx();
}
