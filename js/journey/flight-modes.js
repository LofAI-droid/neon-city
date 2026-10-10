import * as THREE from '../../lib/three/three.module.js';
import { createJourney } from './journey.js';

export function createFlightModes(camera, controls, { visibility = document, button = document.querySelector('#journey-toggle'), progress = document.querySelector('#journey-progress'), status = document.querySelector('#journey-status') } = {}) {
  let journey, mode = 'free', disposed = false, uiTime = 0, notice = '';
  const velocity = new THREE.Vector3();
  const events = new AbortController();
  function render(message) {
    const state = journey?.getState();
    const label = mode === 'free' ? 'Guided Journey' : 'Terug naar Free Flight';
    if (button && button.textContent !== label) button.textContent = label;
    if (progress) { progress.hidden = mode === 'free'; progress.value = state?.elapsed ?? 0; progress.max = state?.duration ?? 90; }
    if (message) notice = message;
    const text = notice || (mode === 'free' ? 'Vrij vliegen' : visibility.hidden ? 'Journey gepauzeerd — tab verborgen' : state?.phase === 'entry' ? 'Vloeiend naar het starttraject…' : `Guided Journey · ${Math.floor(state?.elapsed ?? 0)} / 90 s`);
    if (status && status.textContent !== text) status.textContent = text;
  }
  const api = {
    setRoute(route) { api.stop(); journey?.dispose(); journey = route ? createJourney(route) : null; },
    start() {
      if (disposed || mode !== 'free' || !journey) return false;
      controls.getVelocity(velocity);
      if (!journey.start(camera, velocity)) { render('Geen veilige aanloop. Vlieg eerst naar de vrije straat.'); return false; }
      notice = ''; controls.setEnabled(false); mode = 'guided'; render(); return true;
    },
    stop() {
      if (mode === 'guided') { journey.getVelocity(velocity); journey.cancel(); controls.setEnabled(true, velocity); }
      notice = ''; mode = 'free'; render();
    },
    update(dt) {
      if (disposed || visibility.hidden) return;
      if (mode === 'free') controls.update(Math.min(dt, 0.05));
      else {
        journey.update(dt, camera);
        if (journey.getState().phase === 'complete') api.stop();
      }
      uiTime += dt; if (uiTime >= 0.2) { uiTime = 0; render(); }
    },
    getState() { return { mode, ...journey?.getState(), hidden: visibility.hidden }; },
    dispose() { if (disposed) return; api.stop(); disposed = true; events.abort(); journey?.dispose(); journey = null; }
  };
  button?.addEventListener('click', () => { if (mode === 'free') api.start(); else api.stop(); button.blur(); document.querySelector('#world canvas')?.focus({ preventScroll: true }); }, { signal: events.signal });
  visibility.addEventListener('visibilitychange', () => render(), { signal: events.signal });
  render(); return api;
}
