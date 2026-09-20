// Geometrie photo : identique a l'ecran (CSS) et a l'export (canvas).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function coverScale(w, h, deg) {
  const a = Math.abs(deg % 180) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  return Math.max((w * c + h * s) / w, (w * s + h * c) / h);
}
export function parsePos(pos) {
  const a = String(pos || '50% 50%').split(' ').map(v => parseFloat(v));
  return { px: isNaN(a[0]) ? 50 : a[0], py: isNaN(a[1]) ? 50 : a[1] };
}
// l'image est posee a sa taille de couverture complete dans la zone
export function placement(zw, zh, inw, inh, px, py) {
  const base = Math.max(zw / inw, zh / inh), rw = inw * base, rh = inh * base;
  return { rw, rh, dx: (zw - rw) * px / 100, dy: (zh - rh) * py / 100 };
}
// bornes du deplacement (fraction de la zone) : l'image doit continuer a couvrir le cadre
export function panLimitsFrac(zw, zh, inw, inh, px, py, s) {
  const { rw, rh, dx, dy } = placement(zw, zh, inw, inh, px, py);
  const maxX = -(dx - zw / 2) * s - zw / 2, minX = zw - (dx + rw - zw / 2) * s - zw / 2;
  const maxY = -(dy - zh / 2) * s - zh / 2, minY = zh - (dy + rh - zh / 2) * s - zh / 2;
  return { minX: Math.min(minX, maxX) / zw, maxX: Math.max(minX, maxX) / zw,
           minY: Math.min(minY, maxY) / zh, maxY: Math.max(minY, maxY) / zh };
}
export function clampOff(zw, zh, inw, inh, px, py, s, rot, ox, oy) {
  const L = panLimitsFrac(zw, zh, inw, inh, px, py, s);
  const k = rot ? 1 / coverScale(zw, zh, rot) : 1;   // rotation : marge reduite
  return [clamp(ox, L.minX * k, L.maxX * k), clamp(oy, L.minY * k, L.maxY * k)];
}
