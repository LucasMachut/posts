// Gestes tactiles et souris : tap, glisser, pincer, molette. Pointer events uniquement.
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function gestures(el, h) {
  const pts = new Map();
  let mode = null, start = null, moved = false, pinch = null;

  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) {
      start = { x: e.clientX, y: e.clientY }; moved = false; mode = 'press';
      if (h.onStart) h.onStart(e);
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: dist(a, b), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      mode = 'pinch';
      if (h.onPinchStart) h.onPinchStart(pinch);
    }
    e.preventDefault();
  });
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'pinch' && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      if (h.onPinch) h.onPinch({ scale: dist(a, b) / pinch.d, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, start: pinch });
      return;
    }
    if (mode === 'press' || mode === 'pan') {
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) > 5) { moved = true; mode = 'pan'; if (h.onPanStart) h.onPanStart(e); }
      if (mode === 'pan' && h.onPan) h.onPan(dx, dy, e);
    }
  });
  const end = (e, cancelled) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    if (mode === 'pinch') {
      if (pts.size < 2) { if (h.onPinchEnd) h.onPinchEnd(); mode = pts.size ? 'done' : null; }
      return;
    }
    if (mode === 'done') { if (!pts.size) mode = null; return; }
    if (mode === 'pan') { if (h.onPanEnd) h.onPanEnd(cancelled); }
    else if (mode === 'press' && !moved && !cancelled) { if (h.onTap) h.onTap(e); }
    mode = null;
  };
  el.addEventListener('pointerup', e => end(e, false));
  el.addEventListener('pointercancel', e => end(e, true));
  if (h.onWheel) el.addEventListener('wheel', e => { e.preventDefault(); h.onWheel(e); }, { passive: false });
}
