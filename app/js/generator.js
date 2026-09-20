// Nouvelle proposition : un texte, un decoupage, un rythme -> une sequence de planches.
import { needFor, TYPES } from './model.js';

// opts : {text, cut:'lines'|'count'|'blank', per, count, bands:1|2|3, pause:0|2|3|4, ty}
export function cutText(o) {
  const raw = o.text || '';
  if (!raw.trim()) return [];
  if (o.cut === 'blank')
    return raw.split(/\n\s*\n/).map(b => b.trim()).filter((b, i, a) => b !== '' || i < a.length - 1);
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l !== '');
  if (o.cut === 'count') {
    const n = Math.max(1, +o.count || 1), per = lines.length / n, out = [];
    for (let i = 0; i < n; i++) out.push(lines.slice(Math.round(i * per), Math.round((i + 1) * per)).join('\n'));
    return out;
  }
  const per = Math.max(1, +o.per || 2), out = [];
  for (let i = 0; i < lines.length; i += per) out.push(lines.slice(i, i + per).join('\n'));
  return out;
}
export function planPages(o) {
  const blocks = cutText(o), bands = +o.bands || 1, pause = +o.pause || 0, ty = +o.ty || 86;
  const plan = [];
  blocks.forEach((b, idx) => {
    let type = 'full';
    if (bands > 1 && b) {
      const cyc = idx % (bands === 2 ? 4 : 6);
      if (bands === 2 && cyc === 2) type = 'duo';
      if (bands === 3) { if (cyc === 2) type = 'duo'; if (cyc === 5) type = 'trio'; }
    }
    plan.push({ type, text: b, ty });
    if (pause && b && (idx + 1) % pause === 0 && idx < blocks.length - 1) plan.push({ type: 'full', text: '', ty });
  });
  return plan;
}
export const needed = plan => plan.reduce((n, p) => n + needFor(p.type), 0);
export const labOf = t => (TYPES[t] || TYPES.full).lab;

// pool : noms de photos disponibles. Retourne les pages ou une erreur {error}.
export function generate(o, pool) {
  if (!pool.length) return { error: "Choisis d'abord des photos." };
  const plan = planPages(o);
  if (!plan.length) return { error: 'Écris un texte, ou choisis « là où je laisse une ligne vide ».' };
  const order = o.shuffle ? pool.slice().sort(() => Math.random() - 0.5) : pool.slice();
  const besoin = needed(plan);
  if (besoin > order.length)
    return { error: `Cette proposition demande ${besoin} photos et tu n'en as que ${order.length}. Aucune photo n'est utilisée deux fois : ajoute-en ${besoin - order.length}, ou réduis le nombre de planches.` };
  let pi = 0; const take = n => order.slice(pi, pi += n);
  const pages = plan.map(pl => {
    const cnt = needFor(pl.type);
    return { type: pl.type, photos: take(cnt), pos: Array(cnt).fill('50% 45%'),
      veil: pl.text ? 1 : 0, text: pl.text || '', tx: 50, ty: pl.text ? pl.ty : 86,
      vmode: 'bande', vlink: true, vauto: true, vop: +o.vop, vsp: 40, wd: 78,
      fs: 1, al: 'center', col: 'light', wrap: true };
  });
  return { pages };
}
