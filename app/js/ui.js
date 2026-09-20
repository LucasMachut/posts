// Interface : barre du bas, panneaux, menu, generateur, export.
import { S, save, clear, snapshot, applyState } from './state.js';
import * as P from './photos.js';
import * as R from './render.js';
import { TYPES, FONTS, TRACKS, FORMATS, pageVide, needFor, VERSION } from './model.js';
import { vmodeOf, vopOf, vwdOf, vspOf, vxOf, vyOf } from './veil.js';
import * as X from './export.js';
import * as G from './generator.js';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const pct = v => Math.round(v * 100) + '%';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let SEL = { pi: 0, i: 0 };
let SHEET = null;

/* ---------- petits utilitaires d'interface ---------- */
export function toast(msg, ms) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t.__t); t.__t = setTimeout(() => t.classList.remove('show'), ms || 4000);
}
const row   = (label, inner) => `<div class="row"><span>${label}</span>${inner}</div>`;
const range = (id, min, max, step, val, txt) => `<input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><b id="${id}V">${txt}</b>`;
const chips = (name, opts, cur, style) => `<div class="chips" data-chips="${name}">${opts.map(([v, l]) =>
  `<button data-v="${esc(v)}" class="${String(v) === String(cur) ? 'on' : ''}" ${style ? `style="${style(v)}"` : ''}>${l}</button>`).join('')}</div>`;
const btns  = list => `<div class="btns">${list.map(([id, l, cls]) => `<button id="${id}" class="${cls || ''}">${l}</button>`).join('')}</div>`;
const on    = (root, id, ev, fn) => { const el = $('#' + id, root); if (el) el.addEventListener(ev, e => fn(el, e)); };
const setV  = (root, id, txt) => { const b = $('#' + id + 'V', root); if (b) b.textContent = txt; };
function bindRange(root, id, fn) { on(root, id, 'input', el => fn(+el.value, el)); }
function bindChips(root, name, fn) {
  $$(`[data-chips="${name}"] button`, root).forEach(b => b.addEventListener('click', () => {
    $$(`[data-chips="${name}"] button`, root).forEach(x => x.classList.toggle('on', x === b));
    fn(b.dataset.v);
  }));
}
function pageInfo() {
  const n = S.pages.length;
  $('#pageInfo').textContent = n ? `planche ${R.getActive() + 1} / ${n}` : '';
}
const imgOf = (pi, i) => { const pg = R.pageEl(pi); const ph = pg && pg.querySelectorAll('.ph')[i]; return ph && ph.querySelector('img'); };
function markSel() {
  $$('.ph.sel').forEach(e => e.classList.remove('sel'));
  if (SHEET !== 'photo') return;
  const pg = R.pageEl(SEL.pi); const ph = pg && pg.querySelectorAll('.ph')[SEL.i];
  if (ph) ph.classList.add('sel');
}

/* ---------- panneau du bas ---------- */
const TITLES = { photo: 'Photo', texte: 'Texte', voile: 'Voile', page: 'Planche', style: 'Style', export: 'Exporter' };
export function openSheet(kind) {
  if (!S.pages.length && kind !== 'style' && kind !== 'export') { toast("Ajoute d'abord une planche : menu ⋯ ou « nouvelle proposition »."); return; }
  SHEET = kind;
  document.body.classList.add('sheet-open');
  $('#sheet').classList.add('open');
  $('#shTitle').textContent = TITLES[kind];
  $$('#bar button').forEach(b => b.classList.toggle('on', b.dataset.sheet === kind));
  renderSheet();
  if (kind !== 'style' && kind !== 'export') requestAnimationFrame(() => reveal(kind));
}
// fait remonter la partie utile de la planche dans l'espace laisse libre au-dessus du panneau
function reveal(kind) {
  const pg = R.pageEl(R.getActive()); if (!pg) return;
  let target = pg;
  if (kind === 'texte' || kind === 'voile') target = pg.querySelector('.over') || pg;
  if (kind === 'photo') target = pg.querySelectorAll('.ph')[SEL.i] || pg;
  const top = $('#top').offsetHeight + 8, sheetTop = window.innerHeight - $('#sheet').offsetHeight;
  const free = sheetTop - top; if (free < 80) return;
  const r = target.getBoundingClientRect(), pr = pg.getBoundingClientRect();
  let want;                                   // ou l'on veut le centre de la cible
  if (target === pg) want = pr.height <= free ? top + free / 2 : top + Math.min(pr.height, free) / 2;
  else want = top + free / 2;
  let delta = (r.top + r.height / 2) - want;
  // sans sortir la planche de la zone libre quand elle y tient
  if (pr.height <= free) delta = Math.max(pr.bottom - sheetTop + 8, Math.min(pr.top - top, delta));
  if (Math.abs(delta) > 6) window.scrollBy({ top: delta, behavior: 'smooth' });
}
export function closeSheet() {
  SHEET = null;
  document.body.classList.remove('sheet-open');
  $('#sheet').classList.remove('open');
  $$('#bar button').forEach(b => b.classList.remove('on'));
  markSel();
}
function renderSheet() {
  const b = $('#shBody'); b.innerHTML = ''; b.scrollTop = 0;
  if (!SHEET) return;
  ({ photo: sheetPhoto, texte: sheetText, voile: sheetVeil, page: sheetPage, style: sheetStyle, export: sheetExport })[SHEET](b);
  markSel();
}

/* ---------- PHOTO ---------- */
function sheetPhoto(b) {
  const pi = R.getActive(), p = S.pages[pi];
  if (SEL.pi !== pi) SEL = { pi, i: 0 };
  const n = p.photos.length, i = clamp(SEL.i, 0, n - 1); SEL.i = i;
  const rot = (p.rot && p.rot[i]) || 0, zm = (p.zoom && p.zoom[i]) || 1;
  b.innerHTML =
    (n > 1 ? chips('slot', p.photos.map((_, k) => [k, 'photo ' + (k + 1)]), i) : '') +
    `<div class="hint">Sur la planche : glisse la photo pour la recadrer, pince à deux doigts pour zoomer.</div>` +
    row('rotation', range('rot', -180, 180, 0.5, rot, rot + '°')) +
    btns([['r-90', '−90°'], ['r0', '0°'], ['r90', '+90°'], ['rm', '−0,5°'], ['rp', '+0,5°']]) +
    row('zoom', range('zoom', 1, 6, 0.02, zm, (+zm).toFixed(2) + '×')) +
    btns([['recenter', 'recentrer la photo']]) +
    `<h4>Banque de photos</h4>
     <div class="hint">Touche une photo de la banque pour la mettre à la place de celle qui est sélectionnée.</div>
     <div class="bankctl"><input type="text" id="filtre" placeholder="filtrer par nom">
       <label class="btn file">+ ajouter<input type="file" id="addPhotos" accept="image/*" multiple></label></div>
     <div id="grid"></div>
     <div class="btns"><button id="vider" class="sec">vider la banque</button></div>`;
  const cur = () => (S.pages[pi].rot && S.pages[pi].rot[i]) || 0;
  bindChips(b, 'slot', v => { SEL.i = +v; renderSheet(); });
  bindRange(b, 'rot', v => setRot(pi, i, v, b));
  on(b, 'r-90', 'click', () => { setRot(pi, i, cur() - 90, b); renderSheet(); });
  on(b, 'r0', 'click', () => { setRot(pi, i, 0, b); renderSheet(); });
  on(b, 'r90', 'click', () => { setRot(pi, i, cur() + 90, b); renderSheet(); });
  on(b, 'rm', 'click', () => { setRot(pi, i, cur() - 0.5, b); renderSheet(); });
  on(b, 'rp', 'click', () => { setRot(pi, i, cur() + 0.5, b); renderSheet(); });
  bindRange(b, 'zoom', v => setZoom(pi, i, v, b));
  on(b, 'recenter', 'click', () => {
    const q = S.pages[pi]; q.off = q.off || []; q.off[i] = [0, 0];
    const im = imgOf(pi, i); if (im) { im.dataset.offx = 0; im.dataset.offy = 0; R.fit(im); } save();
  });
  on(b, 'filtre', 'input', () => drawGrid(b));
  on(b, 'addPhotos', 'change', async el => {
    const fs = [...el.files]; el.value = ''; if (!fs.length) return;
    await addPhotos(fs);
    drawGrid(b);
  });
  on(b, 'vider', 'click', async () => {
    if (!confirm('Vider la banque de photos gardée sur cet appareil ?\n\nLes planches et les textes restent, il faudra juste remettre les photos.')) return;
    await P.clearAll(); R.renderAll(); drawGrid(b);
  });
  drawGrid(b);
}
async function addPhotos(fs) {
  const prog = $('#prog'), txt = $('#progTxt'), bar = $('#progBar');
  prog.classList.add('open'); txt.textContent = 'Lecture des photos…'; bar.style.width = '0%';
  const added = await P.addFiles(fs, (k, done, total) => {
    txt.textContent = `Photo ${done} sur ${total}`; bar.style.width = Math.round(done / total * 100) + '%';
  });
  prog.classList.remove('open');
  if (added.length) { R.renderAll(); toast(`${added.length} photo(s) ajoutée(s).`); }
  else toast('Aucune image lisible dans ce choix.');
  return added;
}
function drawGrid(root) {
  const fEl = $('#filtre', root), f = (fEl ? fEl.value : '').trim().toLowerCase();
  const used = R.usedPhotos(null);
  const names = P.names().filter(n => !f || n.toLowerCase().includes(f));
  const g = $('#grid', root); if (!g) return;
  g.innerHTML = names.length ? names.map(n =>
    `<figure data-n="${esc(n)}" class="${used.has(n) ? 'used' : ''}"><img src="${P.urlFor(n)}" loading="lazy" alt=""><figcaption>${esc(n)}${used.has(n) ? ' •' : ''}</figcaption></figure>`).join('')
    : `<div class="hint">${P.count() ? 'Aucune photo ne correspond au filtre.' : 'La banque est vide. Ajoute des photos avec le bouton ci-dessus.'}</div>`;
  $$('figure', g).forEach(fg => fg.addEventListener('click', () => { swap(fg.dataset.n); drawGrid(root); }));
}
function swap(name) {
  const p = S.pages[SEL.pi]; if (!p) return;
  const cur = String(p.photos[SEL.i] ?? ''), nn = String(name);
  const touched = new Set([SEL.pi]);
  if (nn !== cur) {
    for (let k = 0; k < S.pages.length; k++) {           // deja placee ailleurs : on echange
      const q = S.pages[k], j = (q.photos || []).indexOf(nn);
      if (j >= 0 && !(q === p && j === SEL.i)) { q.photos[j] = cur; touched.add(k); break; }
    }
  }
  p.photos[SEL.i] = nn;
  touched.forEach(k => R.updatePage(k)); save(); markSel();
}
function setRot(pi, i, v, root) {
  const p = S.pages[pi]; let r = parseFloat(v); r = ((r + 180) % 360 + 360) % 360 - 180;
  p.rot = p.rot || []; p.rot[i] = +r.toFixed(1);
  const im = imgOf(pi, i); if (im) { im.dataset.rot = p.rot[i]; R.fit(im); }
  setV(root, 'rot', p.rot[i] + '°'); save();
}
function setZoom(pi, i, v, root) {
  const p = S.pages[pi]; p.zoom = p.zoom || []; p.off = p.off || [];
  const z0 = p.zoom[i] || 1, z = clamp(parseFloat(v), 1, 6), k = z / z0;
  const im = imgOf(pi, i);
  if (im) {
    im.dataset.offx = ((+im.dataset.offx || 0) * k).toFixed(5);
    im.dataset.offy = ((+im.dataset.offy || 0) * k).toFixed(5);
    im.dataset.zoom = z; R.fit(im);
    p.off[i] = [+im.dataset.offx, +im.dataset.offy];
  }
  p.zoom[i] = z; setV(root, 'zoom', z.toFixed(2) + '×'); save();
}

/* ---------- TEXTE ---------- */
function sheetText(b) {
  const pi = R.getActive(), p = S.pages[pi];
  if (!p.text.trim()) {
    b.innerHTML = `<div class="hint">Cette planche n'a pas de texte.</div>` + btns([['addTxt', 'ajouter un texte', 'go']]);
    on(b, 'addTxt', 'click', () => {
      p.text = 'Texte'; if (!p.veil) p.veil = 1; R.updatePage(pi); save(); renderSheet();
      const t = $('#txt', b); if (t) { t.focus(); t.select(); }
    });
    return;
  }
  b.innerHTML =
    `<textarea id="txt" rows="4" placeholder="Un retour à la ligne = un vers">${esc(p.text)}</textarea>` +
    row('taille', `<button id="fsm" class="sq">A−</button>` + range('fs', 0.4, 4, 0.02, p.fs || 1, pct(p.fs || 1)) + `<button id="fsp" class="sq">A+</button>`) +
    `<h4>Alignement</h4>` + chips('al', [['left', 'gauche'], ['center', 'centre'], ['right', 'droite']], p.al || 'center') +
    `<h4>Couleur</h4>` + chips('col', [['light', 'clair'], ['dark', 'sombre']], p.col || 'light') +
    `<h4>Vers trop longs</h4>` + chips('wrap', [['1', 'passent à la ligne'], ['0', 'réduits pour tenir sur une ligne']], p.wrap !== false ? '1' : '0') +
    row('largeur', range('wd', 28, 100, 1, p.wd || 78, (p.wd || 78) + '%')) +
    `<h4>Position</h4><div class="hint">Ou glisse directement le texte sur la planche.</div>` +
    row('horizontal', range('tx', 4, 96, 0.5, p.tx ?? 50, Math.round(p.tx ?? 50) + '%')) +
    row('vertical', range('ty', 4, 96, 0.5, p.ty ?? 86, Math.round(p.ty ?? 86) + '%')) +
    btns([['unif', 'même taille sur toutes les planches'], ['delTxt', 'supprimer le texte', 'sec']]);
  on(b, 'txt', 'input', el => R.setText(pi, el.value));
  bindRange(b, 'fs', v => { R.setPageFS(pi, v); setV(b, 'fs', pct(v)); });
  const bump = d => { R.setPageFS(pi, (S.pages[pi].fs || 1) + d); const r = $('#fs', b); r.value = S.pages[pi].fs; setV(b, 'fs', pct(S.pages[pi].fs)); };
  on(b, 'fsm', 'click', () => bump(-0.08));
  on(b, 'fsp', 'click', () => bump(0.08));
  bindChips(b, 'al', v => { p.al = v; R.setTextStyle(pi); save(); });
  bindChips(b, 'col', v => { p.col = v; R.setTextStyle(pi); save(); });
  bindChips(b, 'wrap', v => { p.wrap = v === '1'; R.setTextStyle(pi); save(); });
  bindRange(b, 'wd', v => { p.wd = v; R.setTextStyle(pi); setV(b, 'wd', v + '%'); save(); });
  bindRange(b, 'tx', v => { p.tx = v; R.setTextStyle(pi); setV(b, 'tx', Math.round(v) + '%'); save(); });
  bindRange(b, 'ty', v => { p.ty = v; R.setTextStyle(pi); setV(b, 'ty', Math.round(v) + '%'); save(); });
  on(b, 'unif', 'click', () => { const m = R.uniformiser(); if (m) toast(`Toutes les planches passent à ${pct(m)}.`); renderSheet(); });
  on(b, 'delTxt', 'click', () => { R.setText(pi, ''); renderSheet(); });
}

/* ---------- VOILE ---------- */
function sheetVeil(b) {
  const pi = R.getActive(), p = S.pages[pi], halo = vmodeOf(p) === 'halo';
  b.innerHTML = chips('veil', [['1', 'voile activé'], ['0', 'sans voile']], p.veil ? '1' : '0') + (p.veil ?
    `<h4>Forme</h4>` + chips('vmode', [['halo', 'halo'], ['bande', 'bande'], ['bas', 'vers le bas'], ['haut', 'vers le haut']], vmodeOf(p)) +
    btns([['vlink', p.vlink === false ? 'suivre le texte' : 'suit le texte ✓', p.vlink === false ? '' : 'on']]) +
    row('vertical', range('vy', 0, 100, 1, vyOf(p), Math.round(vyOf(p)) + '%')) +
    (halo ? row('horizontal', range('vx', 0, 100, 1, vxOf(p), Math.round(vxOf(p)) + '%')) +
      btns([['vauto', p.vauto === false ? 'ajuster au texte' : 'ajusté au texte ✓', p.vauto === false ? '' : 'on']]) +
      row('largeur', range('vwd', 6, 100, 1, vwdOf(p), Math.round(vwdOf(p)) + '%')) : '') +
    row('hauteur', range('vsp', 4, 100, 1, vspOf(p), Math.round(vspOf(p)) + '%')) +
    row('intensité', range('vop', 0, 1, 0.02, vopOf(p), pct(vopOf(p)))) : '');
  bindChips(b, 'veil', v => { p.veil = +v; R.updatePage(pi); save(); renderSheet(); });
  bindChips(b, 'vmode', v => { p.vmode = v; R.repaintVeil(pi); R.autoVeil(pi); save(); renderSheet(); });
  on(b, 'vlink', 'click', () => { p.vlink = p.vlink === false; if (p.vlink) { delete p.vy; delete p.vx; } R.repaintVeil(pi); save(); renderSheet(); });
  const detach = () => { p.vlink = false; const l = $('#vlink', b); if (l) { l.textContent = 'suivre le texte'; l.classList.remove('on'); } };
  bindRange(b, 'vy', v => { p.vy = v; detach(); R.repaintVeil(pi); setV(b, 'vy', Math.round(v) + '%'); save(); });
  bindRange(b, 'vx', v => { p.vx = v; detach(); R.repaintVeil(pi); setV(b, 'vx', Math.round(v) + '%'); save(); });
  on(b, 'vauto', 'click', () => { p.vauto = true; R.autoVeil(pi); save(); renderSheet(); });
  const manual = () => { p.vauto = false; const a = $('#vauto', b); if (a) { a.textContent = 'ajuster au texte'; a.classList.remove('on'); } };
  bindRange(b, 'vwd', v => { p.vwd = v; manual(); R.repaintVeil(pi); setV(b, 'vwd', Math.round(v) + '%'); save(); });
  bindRange(b, 'vsp', v => { p.vsp = v; manual(); R.repaintVeil(pi); setV(b, 'vsp', Math.round(v) + '%'); save(); });
  bindRange(b, 'vop', v => { p.vop = v; R.repaintVeil(pi); setV(b, 'vop', pct(v)); save(); });
}

/* ---------- PLANCHE ---------- */
function sheetPage(b) {
  const pi = R.getActive(), p = S.pages[pi];
  b.innerHTML = `<h4>Mise en page</h4>` + chips('type', Object.entries(TYPES).map(([k, v]) => [k, v.lab]), p.type) +
    row('grain', `<button id="gm" class="sq">−</button><b id="gv">${Math.round((p.grain ?? 1) * 100)}%</b><button id="gp" class="sq">+</button><span class="hint">de cette planche</span>`) +
    `<h4>Ordre</h4>` +
    btns([['ins', 'insérer une planche après'], ['dup', 'dupliquer']]) +
    btns([['up', '↑ monter'], ['down', '↓ descendre'], ['del', 'supprimer', 'danger']]) +
    btns([['add', '+ page à la fin', 'sec']]);
  bindChips(b, 'type', v => {
    p.type = v; const need = needFor(v); p.photos = p.photos || [];
    R.updatePage(pi); save(); if (SEL.pi === pi) SEL.i = Math.min(SEL.i, need - 1);
  });
  const grain = d => { p.grain = clamp((p.grain ?? 1) + d, 0, 2.5); R.setGrainOpacity(pi); $('#gv', b).textContent = Math.round(p.grain * 100) + '%'; save(); };
  on(b, 'gm', 'click', () => grain(-0.25));
  on(b, 'gp', 'click', () => grain(0.25));
  on(b, 'ins', 'click', () => { S.pages.splice(pi + 1, 0, pageVide()); R.renderAll(); R.setActive(pi + 1, { scroll: true }); save(); });
  on(b, 'dup', 'click', () => {
    const c = JSON.parse(JSON.stringify(p)); S.pages.splice(pi + 1, 0, c);
    c.photos = c.photos.map(() => R.freePhoto());     // la copie reprend la mise en page, pas les photos
    R.renderAll(); R.setActive(pi + 1, { scroll: true }); save();
  });
  const move = d => { const j = pi + d; if (j < 0 || j >= S.pages.length) return; [S.pages[pi], S.pages[j]] = [S.pages[j], S.pages[pi]]; R.renderAll(); R.setActive(j, { scroll: true }); save(); };
  on(b, 'up', 'click', () => move(-1));
  on(b, 'down', 'click', () => move(1));
  on(b, 'del', 'click', () => {
    if (!confirm('Supprimer cette planche ?')) return;
    S.pages.splice(pi, 1); R.renderAll(); save();
    if (!S.pages.length) closeSheet(); else { R.setActive(Math.min(pi, S.pages.length - 1)); renderSheet(); }
  });
  on(b, 'add', 'click', () => addPage());
}
export function addPage() {
  S.pages.push(pageVide()); R.renderAll(); R.setActive(S.pages.length - 1, { scroll: true }); save();
}

/* ---------- STYLE (global) ---------- */
function sheetStyle(b) {
  const f = `${S.fmt.w}x${S.fmt.h}`;
  b.innerHTML = `<h4>Format</h4>` + chips('fmt', FORMATS, f) +
    `<div class="row"><span>pixels</span><input type="number" id="fw" min="200" max="6000" step="10" value="${S.fmt.w}"> <i>×</i> <input type="number" id="fh" min="200" max="6000" step="10" value="${S.fmt.h}"></div>` +
    `<h4>Police</h4>` + chips('font', FONTS.map(x => [x, x]), S.font, v => `font-family:'${v}'`) +
    `<h4>Interlettre</h4>` + chips('track', TRACKS, S.track) +
    row('taille', range('gfs', 0.4, 3, 0.02, S.gfs, pct(S.gfs)) + `<button id="gfs1" class="sq" title="remettre à 100 %">↺</button>`) +
    `<div class="hint">Taille de tout le document. Chaque planche a en plus sa propre taille dans « texte ».</div>` +
    `<h4>Grain</h4>` + row('intensité', range('grain', 0, 0.65, 0.01, S.grain, pct(S.grain))) +
    chips('gsize', [['fin', 'fin'], ['moyen', 'moyen'], ['gros', 'gros']], S.grainsize) +
    btns([['unif', 'même taille de texte sur toutes les planches'], ['clean', 'aperçu propre', 'sec']]);
  const setFmt = (w, h) => { S.fmt = { w, h }; R.applyFormat(); save(); };
  bindChips(b, 'fmt', v => { const [w, h] = v.split('x').map(Number); setFmt(w, h); $('#fw', b).value = w; $('#fh', b).value = h; });
  const custom = () => { const w = +$('#fw', b).value, h = +$('#fh', b).value; if (w >= 200 && h >= 200) { setFmt(w, h); $$('[data-chips="fmt"] button', b).forEach(x => x.classList.toggle('on', x.dataset.v === `${w}x${h}`)); } };
  on(b, 'fw', 'input', custom); on(b, 'fh', 'input', custom);
  bindChips(b, 'font', v => { S.font = v; R.applyTypo(); save(); });
  bindChips(b, 'track', v => { S.track = v; R.applyTypo(); save(); });
  bindRange(b, 'gfs', v => { S.gfs = v; R.applyGlobalFS(); setV(b, 'gfs', pct(v)); save(); });
  on(b, 'gfs1', 'click', () => { S.gfs = 1; $('#gfs', b).value = 1; R.applyGlobalFS(); setV(b, 'gfs', '100%'); save(); });
  bindRange(b, 'grain', v => { S.grain = v; R.applyGrain(); setV(b, 'grain', pct(v)); save(); });
  bindChips(b, 'gsize', v => { S.grainsize = v; R.refreshGrainTexture(); save(); });
  on(b, 'unif', 'click', () => { const m = R.uniformiser(); if (m) toast(`Toutes les planches passent à ${pct(m)}.`); });
  on(b, 'clean', 'click', () => cleanMode(true));
}

/* ---------- EXPORT ---------- */
function sheetExport(b) {
  if (!S.pages.length) { b.innerHTML = `<div class="hint">Aucune planche à exporter.</div>`; return; }
  const miss = X.missingOriginals();
  b.innerHTML = `<div class="hint">${S.pages.length} planche(s) · ${S.fmt.w} × ${S.fmt.h} px · JPEG pleine résolution</div>` +
    (miss.length
      ? `<div class="warn">Il manque l'original de ${miss.length} photo(s) : ${esc(miss.slice(0, 8).join(', '))}${miss.length > 8 ? '…' : ''}.
         Ajoute-les depuis la pellicule, elles seront reconnues par leur nom.</div>
         <label class="btn file go">ajouter les photos manquantes<input type="file" id="addMiss" accept="image/*" multiple></label>`
      : btns([['prep', 'préparer les JPEG', 'go']])) +
    `<div id="xres"></div>`;
  on(b, 'addMiss', 'change', async el => { const fs = [...el.files]; el.value = ''; if (fs.length) { await addPhotos(fs); renderSheet(); } });
  on(b, 'prep', 'click', async el => {
    el.disabled = true;
    const prog = $('#prog'), txt = $('#progTxt'), bar = $('#progBar');
    prog.classList.add('open'); bar.style.width = '0%';
    let entries;
    try {
      entries = await X.renderAllPages((i, n) => { txt.textContent = `Planche ${Math.min(i + 1, n)} sur ${n} — ${S.fmt.w} × ${S.fmt.h} px`; bar.style.width = Math.round(i / n * 100) + '%'; });
    } catch (e) { prog.classList.remove('open'); el.disabled = false; toast('Export interrompu : ' + e.message, 7000); return; }
    prog.classList.remove('open'); el.disabled = false;
    const share = X.canShareFiles();
    $('#xres', b).innerHTML = `<div class="hint ok">${entries.length} planche(s) prête(s).</div>` +
      (share ? btns([['share', 'enregistrer dans Photos / partager', 'go']]) : '') +
      btns([['zip', 'télécharger un dossier ZIP', share ? 'sec' : 'go']]) +
      (share ? `<div class="hint">Dans la feuille de partage, choisis « Enregistrer les images » pour les avoir dans Photos, puis publie-les depuis Instagram.</div>` : '');
    on(b, 'share', 'click', async () => {
      try { await navigator.share({ files: X.toFiles(entries), title: 'Planches' }); }
      catch (e) { if (e && e.name !== 'AbortError') toast('Partage impossible ici : ' + e.message + '. Essaie le ZIP.', 7000); }
    });
    on(b, 'zip', 'click', async () => {
      try { X.download(await X.buildZip(entries), X.stampName('zip')); }
      catch (e) { toast('Le ZIP n\'a pas pu être créé : ' + e.message, 7000); }
    });
  });
}

/* ---------- modales : menu, generateur, aide ---------- */
function modal(html) { $('#modalBox').innerHTML = html; $('#modal').classList.add('open'); }
export function closeModal() { $('#modal').classList.remove('open'); }
function openMenu() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  modal(`<h2>Menu</h2><div class="menu">
    <button data-m="gen">nouvelle proposition</button>
    <button data-m="add">+ page vide à la fin</button>
    <button data-m="save">sauver la maquette (.json)</button>
    <label class="mbtn">recharger une maquette<input type="file" id="imp" accept=".json,application/json"></label>
    <button data-m="clean">aperçu propre</button>
    <button data-m="help">comment ça marche</button>
    <button data-m="reset" class="danger">réinitialiser (efface les planches)</button>
    <div class="hint">version ${VERSION} · ${P.count()} photo(s) en banque${standalone ? '' : `<br>Sur iPhone : bouton Partager de Safari → « Sur l'écran d'accueil » pour l'installer comme une application.`}</div>
  </div>`);
  const box = $('#modalBox');
  $$('[data-m]', box).forEach(el => el.addEventListener('click', () => {
    const m = el.dataset.m; closeModal();
    if (m === 'gen') openGen();
    if (m === 'add') addPage();
    if (m === 'save') X.download(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }), 'maquette.json');
    if (m === 'clean') cleanMode(true);
    if (m === 'help') openHelp();
    if (m === 'reset') {
      if (!confirm('Effacer toutes les planches ? Les photos de la banque sont gardées.')) return;
      clear(); S.pages = []; S.gfs = 1; S.grain = 0; R.applyGrain(); R.renderAll(); closeSheet(); save();
    }
  }));
  on(box, 'imp', 'change', el => {
    const f = el.files[0]; el.value = ''; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { applyState(JSON.parse(r.result)); R.applyTypo(); R.applyFormat(); R.renderAll(); save(); closeModal(); toast('Maquette rechargée.'); }
      catch (e) { toast('Fichier illisible.'); }
    };
    r.readAsText(f);
  });
}
function openHelp() {
  modal(`<h2>Comment ça marche</h2>
  <p><b>Planches.</b> Touche une planche pour la sélectionner : les boutons du bas agissent sur elle.
  Le numéro en bas à droite dit laquelle est active.</p>
  <p><b>Photos.</b> Touche une photo pour ouvrir la banque et la remplacer. Sur la planche active, glisse la photo
  pour la recadrer et pince à deux doigts pour zoomer. Rotation et zoom précis sont dans « photo ».</p>
  <p><b>Texte.</b> Touche le texte pour l'éditer, ou glisse-le pour le déplacer. La taille est celle que tu choisis :
  les vers trop longs passent à la ligne. Alignement, couleur et largeur du bloc sont dans « texte ».</p>
  <p><b>Voile.</b> La zone sombre sous le texte, pour le contraste. Elle suit le texte tant que tu ne la détaches pas.</p>
  <p><b>Exporter.</b> Prépare les JPEG en pleine résolution, puis « enregistrer dans Photos » sur l'iPhone,
  ou un ZIP sur l'ordinateur. Ensuite tu publies depuis Instagram.</p>
  <p><b>Sauvegarde.</b> Tout est gardé sur cet appareil, photos comprises. « Sauver la maquette » fait un fichier
  .json des planches, sans les photos.</p>
  <p class="hint">Touche en dehors pour fermer.</p>`);
}
function openGen() {
  modal(`<h2>Nouvelle proposition</h2>
  <span class="lab">1. Les photos</span>
  <div class="row"><label class="btn file">choisir des photos<input type="file" id="genPhotos" accept="image/*" multiple></label>
    <span id="genCount" class="hint">${P.count()} photo(s) en banque</span></div>
  <label class="chk"><input type="checkbox" id="genShuffle"> mélanger l'ordre</label>
  <span class="lab">2. Le texte, et où le couper</span>
  <textarea id="genText" rows="7" placeholder="Colle ton texte ici.

Chaque retour à la ligne est un vers.
Le découpage choisi en dessous décide comment ils se répartissent."></textarea>
  <select id="genCut"><option value="lines">un nombre fixe de vers par planche</option><option value="count">répartir sur un nombre de planches</option><option value="blank">là où je laisse une ligne vide</option></select>
  <div class="row" id="rowLines"><span>vers par planche</span><input type="number" id="genPer" value="2" min="1" max="8"></div>
  <div class="row" id="rowCount" style="display:none"><span>nombre de planches</span><input type="number" id="genCount2" value="8" min="1" max="60"></div>
  <span class="lab">3. Rythme</span>
  <select id="genBands"><option value="1">une photo par planche</option><option value="2" selected>alterner 1 et 2 bandes</option><option value="3">alterner 1, 2 et 3 bandes</option></select>
  <select id="genPause"><option value="0">aucune planche muette</option><option value="3" selected>une planche muette toutes les 3</option><option value="4">une toutes les 4</option><option value="2">une sur deux</option></select>
  <select id="genPos"><option value="86" selected>texte en bas</option><option value="50">texte au centre</option><option value="16">texte en haut</option></select>
  <span class="lab">4. Aperçu du découpage</span>
  <div id="genPrev" class="prev">Colle un texte pour voir comment il sera réparti.</div>
  <span class="lab">5. Format et rendu</span>
  <select id="genFmt"><option value="">garder le format actuel</option>${FORMATS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
  ${row('grain', range('genGrain', 0, 0.65, 0.01, S.grain || 0.25, pct(S.grain || 0.25)))}
  ${row('voile', range('genVop', 0, 1, 0.02, 0.7, '70%'))}
  ${btns([['genGo', 'générer la proposition', 'go'], ['genCancel', 'annuler', 'sec']])}
  <p class="hint">Tout reste modifiable planche par planche ensuite. Générer remplace les planches actuelles.</p>`);
  const box = $('#modalBox');
  const opts = () => ({ text: $('#genText', box).value, cut: $('#genCut', box).value, per: +$('#genPer', box).value,
    count: +$('#genCount2', box).value, bands: +$('#genBands', box).value, pause: +$('#genPause', box).value,
    ty: +$('#genPos', box).value, shuffle: $('#genShuffle', box).checked, vop: +$('#genVop', box).value });
  const preview = () => {
    const o = opts();
    $('#rowLines', box).style.display = o.cut === 'lines' ? '' : 'none';
    $('#rowCount', box).style.display = o.cut === 'count' ? '' : 'none';
    const plan = G.planPages(o), el = $('#genPrev', box);
    if (!plan.length) { el.textContent = 'Colle un texte pour voir comment il sera réparti.'; return; }
    const nb = plan.filter(p => p.text).length, besoin = G.needed(plan), dispo = P.count(), manque = besoin > dispo;
    el.innerHTML = `<div class="${manque ? 'warn' : 'ok'}">${plan.length} planches — ${nb} avec texte, ${plan.length - nb} sans — ${besoin} photos nécessaires, ${dispo} disponible(s)${manque ? ` · il en manque ${besoin - dispo}` : ''}</div>` +
      plan.map((p, i) => `<div class="pl"><b>${String(i + 1).padStart(2, '0')}</b> <i>${G.labOf(p.type)}</i>${p.text ? p.text.split('\n').map(v => `<div>${esc(v)}</div>`).join('') : '<div class="mute">image seule, sans texte</div>'}</div>`).join('');
  };
  ['genText', 'genCut', 'genPer', 'genCount2', 'genBands', 'genPause'].forEach(id => on(box, id, 'input', preview));
  bindRange(box, 'genGrain', v => setV(box, 'genGrain', pct(v)));
  bindRange(box, 'genVop', v => setV(box, 'genVop', pct(v)));
  on(box, 'genPhotos', 'change', async el => {
    const fs = [...el.files]; el.value = ''; if (!fs.length) return;
    await addPhotos(fs); $('#genCount', box).textContent = `${P.count()} photo(s) en banque`; preview();
  });
  on(box, 'genCancel', 'click', closeModal);
  on(box, 'genGo', 'click', () => {
    const o = opts(), res = G.generate(o, P.names());
    if (res.error) { toast(res.error, 8000); return; }
    const f = $('#genFmt', box).value;
    if (f) { const [w, h] = f.split('x').map(Number); S.fmt = { w, h }; }
    S.grain = +$('#genGrain', box).value;
    S.pages = res.pages;
    closeModal(); R.applyFormat(); R.renderAll(); R.applyGrain(); save();
    window.scrollTo(0, 0); R.setActive(0);
  });
  preview();
}

/* ---------- apercu propre ---------- */
export function cleanMode(onOff) {
  document.body.classList.toggle('clean', onOff);
  if (onOff) closeSheet();
}

/* ---------- branchement ---------- */
export function initUI() {
  $$('#bar button').forEach(b => b.addEventListener('click', () => { const k = b.dataset.sheet; SHEET === k ? closeSheet() : openSheet(k); }));
  $('#shClose').addEventListener('click', closeSheet);
  $('#menuBtn').addEventListener('click', openMenu);
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  $('#quitClean').addEventListener('click', () => cleanMode(false));
  $('#stage').addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'gen') openGen();
    if (a.dataset.act === 'addPage') addPage();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.body.classList.contains('clean')) cleanMode(false);
      else if ($('#modal').classList.contains('open')) closeModal();
      else if (SHEET) closeSheet();
    }
  });
  R.bus.addEventListener('tapPhoto', e => {
    const { pi, i } = e.detail; R.setActive(pi); SEL = { pi, i };
    openSheet('photo');
  });
  R.bus.addEventListener('tapText', e => { R.setActive(e.detail.pi); openSheet('texte'); });
  R.bus.addEventListener('active', e => { pageInfo(); if (SHEET && e.detail.changed && SHEET !== 'style' && SHEET !== 'export') renderSheet(); });
  R.bus.addEventListener('rendered', () => { pageInfo(); markSel(); });
  R.bus.addEventListener('zoom', e => {
    if (SHEET !== 'photo' || e.detail.pi !== SEL.pi || e.detail.i !== SEL.i) return;
    const r = $('#zoom'); if (r) { r.value = e.detail.z; setV(document, 'zoom', e.detail.z.toFixed(2) + '×'); }
  });
  R.bus.addEventListener('textMoved', e => {
    if (SHEET !== 'texte') return;
    const p = S.pages[e.detail.pi], tx = $('#tx'), ty = $('#ty');
    if (tx) { tx.value = p.tx; setV(document, 'tx', Math.round(p.tx) + '%'); }
    if (ty) { ty.value = p.ty; setV(document, 'ty', Math.round(p.ty) + '%'); }
  });
}
