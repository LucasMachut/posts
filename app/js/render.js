// Rendu des planches dans le DOM, planche par planche, et gestes dessus.
import { S, save } from './state.js';
import * as P from './photos.js';
import { isVert, normalize } from './model.js';
import { coverScale, placement, parsePos, clampOff } from './geometry.js';
import { veilCSS, vmodeOf } from './veil.js';
import { tileFor, TUILE } from './grain.js';
import { gestures } from './gestures.js';

export const bus = new EventTarget();
const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
const stage = () => document.getElementById('stage');
const root = document.documentElement;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export const SCREEN_MAX = 760;
export let PW = 760;
let active = 0;

export function getActive() {
  if (!S.pages.length) return -1;
  active = clamp(active, 0, S.pages.length - 1);
  return active;
}
export function setActive(i, opts = {}) {
  if (!S.pages.length) { active = 0; emit('active', { pi: -1 }); return; }
  i = clamp(i, 0, S.pages.length - 1);
  const changed = i !== active; active = i;
  document.querySelectorAll('.page.active').forEach(e => e.classList.remove('active'));
  const el = pageEl(i);
  if (el) {
    el.classList.add('active');
    if (opts.scroll) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  emit('active', { pi: i, changed });
}
export const pageEl = i => stage().querySelector(`.page[data-p="${i}"]`);

export function usedPhotos(except) {
  const s = new Set();
  S.pages.forEach(q => { if (q !== except) (q.photos || []).forEach(n => s.add(String(n))); });
  return s;
}
export function freePhoto() {
  const used = usedPhotos(null), pool = P.names();
  return pool.find(n => !used.has(n)) || pool[0] || '';
}
export function neededPhotos() {
  const s = new Set();
  S.pages.forEach(p => (p.photos || []).forEach(n => { if (n !== '' && n != null) s.add(String(n)); }));
  return [...s];
}

/* ---------- construction d'une planche ---------- */
function photoHTML(name, i, p) {
  const pos = (p.pos && p.pos[i]) || '50% 50%';
  const zoom = (p.zoom && p.zoom[i]) || 1, rot = (p.rot && p.rot[i]) || 0, off = (p.off && p.off[i]) || [0, 0];
  const src = P.urlFor(name);
  return `<div class="ph${src ? '' : ' empty'}" data-i="${i}" data-num="${esc(name)}">` +
    (src ? `<img src="${src}" data-rot="${rot}" data-zoom="${zoom}" data-offx="${off[0] || 0}" data-offy="${off[1] || 0}" style="object-position:${esc(pos)}" alt="" draggable="false">`
         : `<span class="lab">${name ? esc(name) + '<br>photo manquante' : 'toucher pour choisir une photo'}</span>`) +
    `</div>`;
}
function buildPage(p, pi) {
  const el = document.createElement('div');
  el.className = 'page' + (pi === active ? ' active' : '');
  el.dataset.p = pi;
  el.style.setProperty('--fs', (p.fs || 1) * S.gfs);
  const layout = 'l-' + (p.type || 'full');
  const g = p.grain === undefined ? 1 : p.grain;
  el.innerHTML = `<div class="${layout}">${p.photos.map((n, i) => photoHTML(n, i, p)).join('')}</div>` +
    (p.veil ? `<div class="veil" style="background:${veilCSS(p)}"></div>` : '') +
    `<div class="grain" style="opacity:${(S.grain * g).toFixed(3)}"></div>` +
    (p.text && p.text.trim() ? `<div class="over${p.col === 'dark' ? ' dark' : ''}" style="left:${p.tx ?? 50}%;top:${p.ty ?? 86}%;width:${p.wd || 78}%;text-align:${p.al || 'center'}"></div>` : '') +
    `<div class="num">${pi + 1}</div>`;
  const o = el.querySelector('.over');
  if (o) { o.textContent = p.text; attachText(o, pi); }
  el.querySelectorAll('.ph').forEach(ph => {
    const img = ph.querySelector('img');
    if (img) { img.addEventListener('load', () => fit(img)); if (img.complete && img.naturalWidth) fit(img); }
    attachPhoto(ph, pi);
  });
  el.querySelector('.num').addEventListener('click', () => setActive(pi));
  return el;
}

/* ---------- gestes ---------- */
function attachPhoto(ph, pi) {
  const i = +ph.dataset.i;
  let st = null;
  const img = () => ph.querySelector('img');
  gestures(ph, {
    onTap: () => emit('tapPhoto', { pi, i }),
    onPanStart: () => {
      const im = img(); if (!im || !im.naturalWidth) { st = null; return; }
      st = { img: im, ox: +im.dataset.offx || 0, oy: +im.dataset.offy || 0, W: ph.clientWidth, H: ph.clientHeight };
      ph.classList.add('grabbing');
    },
    onPan: (dx, dy) => {
      if (!st) return;
      st.img.dataset.offx = (st.ox + dx / st.W).toFixed(5);
      st.img.dataset.offy = (st.oy + dy / st.H).toFixed(5);
      fit(st.img);
    },
    onPanEnd: () => { ph.classList.remove('grabbing'); if (st) { storeOff(pi, i, st.img); st = null; } },
    onPinchStart: () => {
      const im = img(); if (!im || !im.naturalWidth) { st = null; return; }
      const p = S.pages[pi];
      st = { img: im, z0: (p.zoom && p.zoom[i]) || 1, ox: +im.dataset.offx || 0, oy: +im.dataset.offy || 0, r: ph.getBoundingClientRect() };
    },
    onPinch: ({ scale, cx, cy, start }) => {
      if (!st) return;
      zoomAround(pi, i, st, st.z0 * scale, start.cx, start.cy, cx - start.cx, cy - start.cy);
    },
    onPinchEnd: () => { if (st) { storeOff(pi, i, st.img); st = null; } },
    onWheel: e => {
      const im = img(); if (!im || !im.naturalWidth) return;
      const p = S.pages[pi], z0 = (p.zoom && p.zoom[i]) || 1;
      const s = { img: im, z0, ox: +im.dataset.offx || 0, oy: +im.dataset.offy || 0, r: ph.getBoundingClientRect() };
      zoomAround(pi, i, s, z0 * (e.deltaY < 0 ? 1.06 : 1 / 1.06), e.clientX, e.clientY, 0, 0);
      storeOff(pi, i, im);
    },
  });
}
// le point sous les doigts reste sous les doigts
function zoomAround(pi, i, st, z, px, py, mx, my) {
  z = clamp(z, 1, 6);
  const r = st.r, cx = px - r.left - r.width / 2, cy = py - r.top - r.height / 2;
  const ox = st.ox * r.width, oy = st.oy * r.height, k = z / st.z0;
  st.img.dataset.offx = ((cx - (cx - ox) * k + mx) / r.width).toFixed(5);
  st.img.dataset.offy = ((cy - (cy - oy) * k + my) / r.height).toFixed(5);
  st.img.dataset.zoom = z; fit(st.img);
  const p = S.pages[pi]; p.zoom = p.zoom || []; p.zoom[i] = +z.toFixed(4);
  emit('zoom', { pi, i, z });
}
function storeOff(pi, i, img) {
  const p = S.pages[pi]; p.off = p.off || [];
  p.off[i] = [+img.dataset.offx, +img.dataset.offy]; save();
}
function attachText(o, pi) {
  let st = null;
  gestures(o, {
    onTap: () => emit('tapText', { pi }),
    onPanStart: () => { const p = S.pages[pi]; st = { r: pageEl(pi).getBoundingClientRect(), x0: p.tx ?? 50, y0: p.ty ?? 86 }; },
    onPan: (dx, dy) => {
      if (!st) return;
      const p = S.pages[pi];
      p.tx = +clamp(st.x0 + dx / st.r.width * 100, 4, 96).toFixed(1);
      p.ty = +clamp(st.y0 + dy / st.r.height * 100, 4, 96).toFixed(1);
      o.style.left = p.tx + '%'; o.style.top = p.ty + '%';
      if (p.vlink !== false) repaintVeil(pi);
    },
    onPanEnd: () => { st = null; save(); emit('textMoved', { pi }); },
  });
}

/* ---------- placement des photos (meme geometrie que l'export) ---------- */
export function fit(img) {
  const box = img.parentNode, W = box.clientWidth, H = box.clientHeight;
  if (!W || !H || !img.naturalWidth) return;
  const rot = +img.dataset.rot || 0, z = +img.dataset.zoom || 1, s = coverScale(W, H, rot) * z;
  const { px, py } = parsePos(img.style.objectPosition);
  const inw = img.naturalWidth, inh = img.naturalHeight;
  const [ox, oy] = clampOff(W, H, inw, inh, px, py, s, rot, +img.dataset.offx || 0, +img.dataset.offy || 0);
  img.dataset.offx = ox.toFixed(5); img.dataset.offy = oy.toFixed(5);
  const { rw, rh, dx, dy } = placement(W, H, inw, inh, px, py);
  img.style.left = dx.toFixed(2) + 'px'; img.style.top = dy.toFixed(2) + 'px';
  img.style.width = rw.toFixed(2) + 'px'; img.style.height = rh.toFixed(2) + 'px';
  img.style.transformOrigin = (W / 2 - dx).toFixed(2) + 'px ' + (H / 2 - dy).toFixed(2) + 'px';
  img.style.transform = `translate(${(ox * W).toFixed(2)}px,${(oy * H).toFixed(2)}px) rotate(${rot}deg) scale(${s.toFixed(4)})`;
}
export const fitAll = () => document.querySelectorAll('.ph img').forEach(fit);

/* ---------- texte ---------- */
// wrap : les vers trop longs passent a la ligne, la taille est celle demandee.
// sinon : un vers = une ligne, la planche reduit son texte pour que tout tienne.
export function fitText(pg) {
  const o = pg.querySelector('.over'); if (!o) return;
  const p = S.pages[+pg.dataset.p]; if (!p) return;
  o.style.fontSize = ''; delete o.dataset.k;
  if (p.wrap !== false) { o.style.whiteSpace = 'pre-wrap'; return; }
  o.style.whiteSpace = 'pre';
  const cs = getComputedStyle(o);
  const test = document.createElement('div');
  test.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0';
  test.style.font = cs.font; test.style.letterSpacing = cs.letterSpacing;
  document.body.appendChild(test);
  const maxw = Math.max(...p.text.split('\n').map(v => { test.textContent = v; return test.offsetWidth; }));
  test.remove();
  const target = o.clientWidth;
  if (!maxw || !target) return;
  const k = clamp(target / maxw, 0.3, 1);
  if (k < 1) { o.style.fontSize = (parseFloat(cs.fontSize) * k).toFixed(2) + 'px'; o.dataset.k = k.toFixed(4); }
  if (maxw * k > target + 0.5) o.style.whiteSpace = 'pre-wrap';   // plancher atteint : on coupe quand meme
}
export const fitTextAll = () => document.querySelectorAll('.page').forEach(fitText);

// le halo reprend la taille des lignes de texte
export function autoVeil(pi) {
  const p = S.pages[pi];
  if (!p || !p.veil || p.vauto === false || vmodeOf(p) !== 'halo') return;
  const pg = pageEl(pi); if (!pg) return;
  const o = pg.querySelector('.over'); if (!o) return;
  const R = pg.getBoundingClientRect();
  const rng = document.createRange(); rng.selectNodeContents(o);
  const rects = [...rng.getClientRects()].filter(x => x.width > 1 && x.height > 1);
  if (!R.width || !R.height || !rects.length) return;
  const L = Math.min(...rects.map(x => x.left)), Rg = Math.max(...rects.map(x => x.right));
  const T = Math.min(...rects.map(x => x.top)), B = Math.max(...rects.map(x => x.bottom));
  p.vwd = Math.min(100, (Rg - L) / R.width * 100 + 10);
  p.vsp = Math.min(100, (B - T) / R.height * 100 + 7);
  repaintVeil(pi);
}
export const autoVeilAll = () => S.pages.forEach((q, i) => autoVeil(i));

export function repaintVeil(pi) {
  const pg = pageEl(pi); if (!pg) return;
  const p = S.pages[pi], el = pg.querySelector('.veil');
  if (!p.veil) { if (el) el.remove(); return; }
  if (!el) { updatePage(pi); return; }
  el.style.background = veilCSS(p);
}
export function setGrainOpacity(pi) {
  const pg = pageEl(pi), p = S.pages[pi];
  const el = pg && pg.querySelector('.grain');
  if (el) el.style.opacity = (S.grain * (p.grain === undefined ? 1 : p.grain)).toFixed(3);
}
export function setPageFS(pi, fs) {
  const p = S.pages[pi]; p.fs = +clamp(fs, 0.3, 5).toFixed(3);
  const pg = pageEl(pi);
  if (pg) { pg.style.setProperty('--fs', p.fs * S.gfs); fitText(pg); autoVeil(pi); }
  save();
}
export function setText(pi, text) {
  const p = S.pages[pi]; p.text = text;
  const pg = pageEl(pi); if (!pg) return;
  const o = pg.querySelector('.over');
  if (!text.trim()) { if (o) o.remove(); repaintVeil(pi); save(); return; }
  if (!o) { updatePage(pi); save(); return; }
  o.textContent = text; fitText(pg); autoVeil(pi); save();
}
export function setTextStyle(pi) {
  const p = S.pages[pi], pg = pageEl(pi), o = pg && pg.querySelector('.over');
  if (!o) return;
  o.classList.toggle('dark', p.col === 'dark');
  o.style.textAlign = p.al || 'center'; o.style.width = (p.wd || 78) + '%';
  o.style.left = (p.tx ?? 50) + '%'; o.style.top = (p.ty ?? 86) + '%';
  fitText(pg); autoVeil(pi); if (p.vlink !== false) repaintVeil(pi);
}
// toutes les planches reprennent la taille de la plus contrainte
export function uniformiser() {
  let m = Infinity;
  document.querySelectorAll('.page').forEach(pg => {
    const p = S.pages[+pg.dataset.p]; if (!p || !p.text.trim()) return;
    const o = pg.querySelector('.over'), k = o && o.dataset.k ? +o.dataset.k : 1;
    m = Math.min(m, (p.fs || 1) * k);
  });
  if (!isFinite(m)) return 0;
  S.pages.forEach(p => { if (p.text.trim()) p.fs = +m.toFixed(3); });
  applyGlobalFS(); save();
  return m;
}

/* ---------- global ---------- */
export function applyFormat() {
  const r = S.fmt.h / S.fmt.w;
  PW = Math.min(SCREEN_MAX, window.innerWidth - 24);
  root.style.setProperty('--pw', PW + 'px');
  root.style.setProperty('--ph', Math.round(PW * r) + 'px');
  refreshGrainTexture();
  requestAnimationFrame(() => { fitAll(); fitTextAll(); autoVeilAll(); });
}
export function refreshGrainTexture() {
  const t = tileFor(S.grainsize);
  root.style.setProperty('--grainimg', `url(${t.toDataURL('image/png')})`);
  root.style.setProperty('--grainpx', (TUILE * PW / S.fmt.w).toFixed(2) + 'px');
}
export function applyTypo() {
  root.style.setProperty('--fonte', `'${S.font}'`);
  root.style.setProperty('--track', S.track);
  requestAnimationFrame(() => { fitTextAll(); autoVeilAll(); });
}
export function applyGlobalFS() {
  document.querySelectorAll('.page').forEach(pg => {
    const p = S.pages[+pg.dataset.p]; if (p) pg.style.setProperty('--fs', (p.fs || 1) * S.gfs);
  });
  fitTextAll(); autoVeilAll();
}
export const applyGrain = () => S.pages.forEach((p, i) => setGrainOpacity(i));

/* ---------- rendu ---------- */
const EMPTY = `<div id="empty">
  <h1>Aucune planche pour l'instant</h1>
  <p><b>Nouvelle proposition</b> : tu choisis tes photos, tu colles ton texte, tu dis où il se coupe,
  et les planches sont montées d'un coup. Tout reste modifiable après.</p>
  <p><b>+ page</b> : une planche vide à remplir à la main.</p>
  <p class="sm">Les photos restent sur cet appareil, rien ne part sur un serveur. Le travail en cours
  est gardé ici même si tu fermes l'application.</p>
  <div class="acts"><button data-act="gen">nouvelle proposition</button><button class="sec" data-act="addPage">+ page</button></div>
</div>`;

export function renderAll() {
  const st = stage(); st.innerHTML = '';
  if (!S.pages.length) { st.innerHTML = EMPTY; setActive(0); emit('rendered'); return; }
  S.pages.forEach(p => normalize(p, freePhoto));
  const frag = document.createDocumentFragment();
  S.pages.forEach((p, pi) => frag.appendChild(buildPage(p, pi)));
  st.appendChild(frag);
  requestAnimationFrame(() => { fitAll(); fitTextAll(); autoVeilAll(); });
  setActive(getActive()); emit('rendered');
}
export function updatePage(pi) {
  const p = S.pages[pi]; if (!p) return;
  normalize(p, freePhoto);
  const old = pageEl(pi), el = buildPage(p, pi);
  if (old) old.replaceWith(el); else stage().appendChild(el);
  requestAnimationFrame(() => { el.querySelectorAll('.ph img').forEach(fit); fitText(el); autoVeil(pi); });
}
let rt = null;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(applyFormat, 80); });
