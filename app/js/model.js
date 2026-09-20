// Modele de donnees d'une planche, migration des anciennes versions.
export const VERSION = 3;

export const TYPES = {
  full : { n: 1, lab: '1 photo' },
  duo  : { n: 2, lab: '2 bandes' },
  trio : { n: 3, lab: '3 bandes' },
  duoV : { n: 2, lab: '2 colonnes' },
  trioV: { n: 3, lab: '3 colonnes' },
};
export const needFor = t => (TYPES[t] || TYPES.full).n;
export const isVert  = t => t === 'duoV' || t === 'trioV';

export const FONTS = ['Special Elite', 'Jost', 'Josefin Sans', 'Questrial', 'Newsreader'];
export const TRACKS = [['.05em', 'serré'], ['.12em', 'normal'], ['.2em', 'large'], ['.28em', 'très large']];
export const FORMATS = [['1080x1350', 'Instagram portrait 4:5'], ['1080x1080', 'Instagram carré 1:1'], ['1080x1920', 'story / reel 9:16']];

// taille de reference du texte : fraction de la largeur de la planche a 100 %
export const TEXT_UNIT = 0.032;
export const LINE_H = 2.15;

export function pageVide() {
  return { type: 'full', photos: [], pos: ['50% 50%'], veil: 1, text: '', tx: 50, ty: 86,
    vmode: 'halo', vlink: true, vauto: true, vop: 0.7, wd: 78, fs: 1, al: 'center', col: 'light', wrap: true };
}

export function stripHTML(h) {
  return String(h || '').replace(/<span class="grip"[^>]*><\/span>/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(?:div|p)[^>]*>/gi, '\n').replace(/<\/(?:div|p)>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/^\n+/, '').replace(/\n{2,}/g, '\n');
}

// l'ancien generateur mesurait le texte en 12.5pt sur une planche de 760 px :
// 12.5 * 96/72 / 760 = 0.0219 de la largeur. La nouvelle unite vaut 0.032.
const OLD_FS = 0.0219 / TEXT_UNIT;

export function migratePage(p, from) {
  if (p.over !== undefined) { if (p.text === undefined) p.text = stripHTML(p.over); delete p.over; }
  if (typeof p.text !== 'string') p.text = '';
  if (p.wrap === undefined) p.wrap = true;
  delete p.nowrap; delete p.v2;
  if (from < 3) p.fs = +(((p.fs || 1) * OLD_FS).toFixed(3));
  if (p.fs === undefined) p.fs = 1;
  if (p.vlink === undefined) p.vlink = true;
  if (p.vmode === undefined) p.vmode = 'halo';
  if (p.vauto === undefined) p.vauto = true;
  if (!p.al) p.al = 'center';
  if (!p.col) p.col = 'light';
  if (!TYPES[p.type]) p.type = 'full';
  return p;
}

// complete ou tronque les listes de photos pour coller a la mise en page
export function normalize(p, freePhoto) {
  const need = needFor(p.type);
  p.photos = (p.photos || []).filter(n => n !== '' && n !== undefined && n !== null).map(String);
  while (p.photos.length < need) p.photos.push(freePhoto());
  if (p.photos.length > need) p.photos = p.photos.slice(0, need);
  ['pos', 'zoom', 'rot', 'off'].forEach(k => { if (p[k] && p[k].length > need) p[k] = p[k].slice(0, need); });
  return p;
}
