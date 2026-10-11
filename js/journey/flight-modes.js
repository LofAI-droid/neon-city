import * as THREE from '../../lib/three/three.module.js';
import { createJourney } from './journey.js?v=wp4';

export function createFlightModes(camera, controls, { visibility = document, onChange = () => {} } = {}) {
  let journey, mode = 'free', disposed = false, uiTime = 0, notice = '';
  const velocity = new THREE.Vector3();
  const events = new AbortController();
  const state = () => ({ mode, available: Boolean(journey), notice, ...journey?.getState(), hidden: visibility.hidden });
  const emit = () => onChange(state());
  const api = {
    setOnChange(callback) { onChange = callback; emit(); },
    setRoute(route) {
      const next = route ? createJourney(route) : null; // Validate before replacing an active route.
      api.stop(); journey?.dispose(); journey = next; emit();
    },
    start() {
      if (disposed || mode !== 'free' || !journey) return false;
      controls.getVelocity(velocity);
      if (!journey.start(camera, velocity)) { notice = journey.getState().startError || 'unsafe-entry'; emit(); return false; }
      notice = journey.getState().entryFallback ? 'velocity-fallback' : '';
      controls.setEnabled(false); mode = 'guided'; emit(); return true;
    },
    stop() {
      if (mode === 'guided') { journey.getVelocity(velocity); journey.cancel(); controls.setEnabled(true, velocity); }
      notice = ''; mode = 'free'; emit();
    },
    update(dt) {
      if (disposed || visibility.hidden) return;
      if (mode === 'free') controls.update(Math.min(dt, 0.05));
      else {
        journey.update(dt, camera);
        if (notice === 'velocity-fallback' && journey.getState().phase !== 'entry') notice = '';
        if (journey.getState().phase === 'complete') api.stop();
      }
      uiTime += dt; if (uiTime >= 0.2) { uiTime = 0; emit(); }
    },
    getState: state,
    dispose() { if (disposed) return; api.stop(); disposed = true; events.abort(); journey?.dispose(); journey = null; onChange = () => {}; }
  };
  visibility.addEventListener('visibilitychange', emit, { signal: events.signal });
  emit(); return api;
}
