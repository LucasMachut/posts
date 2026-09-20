// Voile : la zone sombre posee sous le texte pour le contraste.
export const vyOf = p => (p.vlink === false && p.vy !== undefined) ? p.vy : (p.ty === undefined ? 86 : p.ty);
export const vxOf = p => (p.vlink === false && p.vx !== undefined) ? p.vx : (p.tx === undefined ? 50 : p.tx);
export const vmodeOf = p => p.vmode || 'halo';
export const vwdOf = p => p.vwd === undefined ? 56 : p.vwd;
export const vspOf = p => p.vsp === undefined ? 24 : p.vsp;
export const vopOf = p => p.vop === undefined ? 0.70 : p.vop;

export function veilStops(p) {
  const op = vopOf(p), sp = p.vsp === undefined ? 44 : p.vsp;
  const y = vyOf(p), m = vmodeOf(p), h = sp / 2;
  const cl = v => Math.max(0, Math.min(100, v));
  if (m === 'bas')  return [[cl(y - h), 0], [cl(y - h * 0.35), op * 0.5], [cl(y), op], [100, op]];
  if (m === 'haut') return [[0, op], [cl(y), op], [cl(y + h * 0.35), op * 0.5], [cl(y + h), 0]];
  return [[cl(y - h), 0], [cl(y), op], [cl(y + h), 0]];
}
export const HALO = [[0, 1], [0.42, 0.92], [0.70, 0.48], [1, 0]];
export function veilCSS(p) {
  if (vmodeOf(p) === 'halo') {
    const op = vopOf(p), rw = Math.max(4, vwdOf(p)) / 2, rh = Math.max(3, vspOf(p)) / 2;
    return `radial-gradient(ellipse ${rw.toFixed(1)}% ${rh.toFixed(1)}% at ${vxOf(p).toFixed(1)}% ${vyOf(p).toFixed(1)}%,` +
      HALO.map(([t, k]) => `rgba(0,0,0,${(op * k).toFixed(3)}) ${(t * 100).toFixed(0)}%`).join(',') + ')';
  }
  return 'linear-gradient(180deg,' + veilStops(p)
    .map(([s, a]) => `rgba(0,0,0,${a.toFixed(3)}) ${s.toFixed(1)}%`).join(',') + ')';
}
