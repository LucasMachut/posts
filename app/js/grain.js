// Grain : une tuile de bruit definie a la resolution d'export, affichee reduite a l'ecran.
export const TUILE = 512;
let tile = null, key = '';
export const sizePx = name => ({ fin: 2, moyen: 3, gros: 5 })[name] || 3;

function makeTile(px) {
  const n = Math.max(8, Math.round(TUILE / px));
  const small = document.createElement('canvas'); small.width = small.height = n;
  const sx = small.getContext('2d'), d = sx.createImageData(n, n), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const v = 128 + ((Math.random() + Math.random() - 1) * 118);
    a[i] = a[i + 1] = a[i + 2] = v; a[i + 3] = 255;
  }
  sx.putImageData(d, 0, 0);
  const c = document.createElement('canvas'); c.width = c.height = TUILE;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(small, 0, 0, TUILE, TUILE);
  return c;
}
export function tileFor(sizeName) {
  const k = String(sizePx(sizeName));
  if (!tile || key !== k) { tile = makeTile(sizePx(sizeName)); key = k; }
  return tile;
}
