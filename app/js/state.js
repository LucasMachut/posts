// Etat global + sauvegarde locale (localStorage), avec migration des anciennes maquettes.
import { VERSION, migratePage } from './model.js';

export const S = {
  pages: [], fmt: { w: 1080, h: 1350 }, gfs: 1, grain: 0, grainsize: 'moyen',
  font: 'Special Elite', track: '.12em',
};
const KEY = 'postgen-v3', OLDKEY = 'postgen-template';

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
let t = null;
export function save() {
  clearTimeout(t);
  t = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch (e) {} }, 120);
}
export function load() {
  try {
    const s = localStorage.getItem(KEY) || localStorage.getItem(OLDKEY);
    if (!s) return false;
    applyState(JSON.parse(s));
    return true;
  } catch (e) { return false; }
}
export function clear() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(OLDKEY); } catch (e) {}
}
