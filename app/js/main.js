// Demarrage de l'application.
import { load, current } from './state.js';
import * as P from './photos.js';
import * as R from './render.js';
import { initUI, toast } from './ui.js';

(async () => {
  load();
  { const p = current(); P.setProject(p.id, p.legacy); }
  R.applyTypo();
  R.applyFormat();
  initUI();
  R.renderAll();

  // demande au navigateur de ne pas purger nos photos
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  const n = await P.restore();
  if (n) R.renderAll();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    let done = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (done || !had) return; done = true;
      toast('Nouvelle version installée.'); setTimeout(() => location.reload(), 600);
    });
  }
})();
