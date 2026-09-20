// Export JPEG pleine resolution : dessin canvas, partage natif (iPhone) ou ZIP (PC).
import { S } from './state.js';
import * as P from './photos.js';
import { isVert, TEXT_UNIT, LINE_H } from './model.js';
import { coverScale, placement, parsePos, clampOff } from './geometry.js';
import { vmodeOf, vopOf, vwdOf, vspOf, vxOf, vyOf, HALO, veilStops } from './veil.js';
import { tileFor } from './grain.js';

const HAS_LS = (() => { try { return 'letterSpacing' in document.createElement('canvas').getContext('2d'); } catch (e) { return false; } })();

async function loadFull(name) {
  const f = P.origFor(name);
  if (!f) throw new Error('photo absente : ' + name);
  const url = URL.createObjectURL(f);
  try { return await P.loadImage(url); } finally { URL.revokeObjectURL(url); }
}
// interlettre : Safari ancien n'a pas ctx.letterSpacing, on pose alors les lettres une a une
function measure(x, str, sp) {
  if (HAS_LS) return x.measureText(str).width;
  let w = 0; for (const ch of str) w += x.measureText(ch).width + sp; return w;
}
function drawLine(x, str, ax, y, al, sp) {
  if (HAS_LS) { x.textAlign = al; x.fillText(str, ax, y); return; }
  const w = measure(x, str, sp);
  let cx = al === 'left' ? ax : (al === 'right' ? ax - w : ax - w / 2);
  x.textAlign = 'left';
  for (const ch of str) { x.fillText(ch, cx, y); cx += x.measureText(ch).width + sp; }
}
function wrapLines(meas, text, maxw) {
  const out = [];
  text.split('\n').forEach(par => {
    if (par.trim() === '') { out.push(''); return; }
    let line = '';
    par.split(' ').forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (meas(t) > maxw && line) { out.push(line); line = w; } else line = t;
    });
    out.push(line);
  });
  return out;
}

export async function drawPage(p, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#F2ECE3'; x.fillRect(0, 0, W, H);

  const n = (p.photos || []).length, vert = isVert(p.type);
  for (let i = 0; i < n; i++) {
    const z = vert ? { x: W * i / n, y: 0, w: W / n, h: H } : { x: 0, y: H * i / n, w: W, h: H / n };
    const name = String(p.photos[i] || '');
    if (!name) continue;
    const im = await loadFull(name);
    const { px, py } = parsePos(p.pos && p.pos[i]);
    const rot = (p.rot && p.rot[i]) || 0, zm = (p.zoom && p.zoom[i]) || 1;
    const { rw, rh, dx, dy } = placement(z.w, z.h, im.naturalWidth, im.naturalHeight, px, py);
    const sc = coverScale(z.w, z.h, rot) * zm;
    const off = (p.off && p.off[i]) || [0, 0];
    const [offX, offY] = clampOff(z.w, z.h, im.naturalWidth, im.naturalHeight, px, py, sc, rot, off[0] || 0, off[1] || 0);
    x.save();
    x.beginPath(); x.rect(z.x, z.y, z.w, z.h); x.clip();
    x.translate(z.x + z.w / 2 + offX * z.w, z.y + z.h / 2 + offY * z.h);
    x.rotate(rot * Math.PI / 180); x.scale(sc, sc);
    x.translate(-z.w / 2, -z.h / 2);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(im, dx, dy, rw, rh);
    x.restore();
  }

  if (p.veil) {
    if (vmodeOf(p) === 'halo') {
      const op = vopOf(p), rw = Math.max(4, vwdOf(p)) / 200 * W, rh = Math.max(3, vspOf(p)) / 200 * H;
      x.save();
      x.translate(W * vxOf(p) / 100, H * vyOf(p) / 100); x.scale(rw, rh);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
      HALO.forEach(([t, k]) => g.addColorStop(t, `rgba(0,0,0,${(op * k).toFixed(3)})`));
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, Math.PI * 2); x.fill();
      x.restore();
    } else {
      const g = x.createLinearGradient(0, 0, 0, H);
      veilStops(p).forEach(([s, a]) => g.addColorStop(Math.max(0, Math.min(1, s / 100)), `rgba(0,0,0,${a})`));
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
  }

  const gm = S.grain * (p.grain === undefined ? 1 : p.grain);
  if (gm > 0.001) {
    x.save(); x.globalAlpha = gm; x.globalCompositeOperation = 'soft-light';
    x.fillStyle = x.createPattern(tileFor(S.grainsize), 'repeat'); x.fillRect(0, 0, W, H);
    x.restore();
  }

  const raw = String(p.text || '');
  if (raw.trim() !== '') {
    const fs = W * TEXT_UNIT * (p.fs || 1) * S.gfs;
    const trk = parseFloat(S.track) || 0, wd = (p.wd || 78) / 100 * W;
    let fsz = fs;
    const setF = v => { fsz = v; x.font = `200 ${v}px "${S.font}", sans-serif`; if (HAS_LS) x.letterSpacing = (trk * v) + 'px'; };
    const meas = s => measure(x, s, trk * fsz);
    setF(fs);
    const vers = raw.split('\n');
    let lines;
    if (p.wrap !== false) lines = wrapLines(meas, raw, wd);
    else {
      const maxw = Math.max(...vers.map(meas));
      const k = Math.max(0.3, Math.min(1, wd / maxw));
      setF(fs * k);
      lines = (Math.max(...vers.map(meas)) > wd + 0.5) ? wrapLines(meas, raw, wd) : vers;
    }
    x.textBaseline = 'middle';
    const lh = fsz * LINE_H, total = lines.length * lh;
    const cx = (p.tx ?? 50) / 100 * W, cy = (p.ty ?? 86) / 100 * H;
    const al = p.al || 'center';
    const ax = al === 'left' ? cx - wd / 2 : (al === 'right' ? cx + wd / 2 : cx);
    x.fillStyle = p.col === 'dark' ? '#161113' : '#ffffff';
    x.shadowColor = p.col === 'dark' ? 'rgba(242,236,227,.8)' : 'rgba(0,0,0,.75)';
    x.shadowBlur = fsz * 0.7; x.shadowOffsetY = fsz * 0.04;
    lines.forEach((ln, i) => drawLine(x, ln, ax, cy - total / 2 + lh * (i + 0.5), al, trk * fsz));
    x.shadowBlur = 0; x.shadowOffsetY = 0;
  }
  return c;
}

export function missingOriginals() {
  const s = new Set();
  S.pages.forEach(p => (p.photos || []).forEach(n => { if (n && !P.hasOrig(String(n))) s.add(String(n)); }));
  return [...s];
}

// fabrique toutes les planches ; onProgress(i, total)
export async function renderAllPages(onProgress) {
  const W = S.fmt.w, H = S.fmt.h;
  try { await document.fonts.load(`200 20px "${S.font}"`); await document.fonts.ready; } catch (e) {}
  const entries = [];
  for (let i = 0; i < S.pages.length; i++) {
    if (onProgress) onProgress(i, S.pages.length);
    await new Promise(r => setTimeout(r, 15));
    const c = await drawPage(S.pages[i], W, H);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.97));
    c.width = c.height = 1;
    entries.push({ name: `planche-${String(i + 1).padStart(2, '0')}.jpg`, blob });
  }
  if (onProgress) onProgress(S.pages.length, S.pages.length);
  return entries;
}

/* ---------- partage natif ---------- */
export function canShareFiles() {
  try {
    const f = new File([new Blob(['x'])], 'x.jpg', { type: 'image/jpeg' });
    return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [f] }));
  } catch (e) { return false; }
}
export const toFiles = entries => entries.map(e => new File([e.blob], e.name, { type: 'image/jpeg' }));

/* ---------- ZIP (methode « store », sans dependance) ---------- */
const CRC_TABLE = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function dosDT(d) {
  d = d || new Date();
  return { time: ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() >> 1) & 0x1F),
           date: (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0xF) << 5) | (d.getDate() & 0x1F) };
}
export async function buildZip(entries) {
  const { time, date } = dosDT(), enc = new TextEncoder();
  const chunks = [], central = []; let offset = 0;
  for (const { name, blob } of entries) {
    const data = new Uint8Array(await blob.arrayBuffer());
    const crc = crc32(data), nb = enc.encode(name);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0, true);
    lh.setUint16(8, 0, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, nb.length, true); lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), nb, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint16(8, 0, true); ch.setUint16(10, 0, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, nb.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true);
    ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nb);
    offset += 30 + nb.length + data.length;
  }
  const centralStart = offset;
  let centralSize = 0; central.forEach(c => centralSize += c.length);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
  end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, centralStart, true); end.setUint16(20, 0, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function stampName(ext) {
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  return `planches-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
}
