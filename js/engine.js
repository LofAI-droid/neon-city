import * as THREE from '../lib/three/three.module.js';
import { createCamera, configureCamera } from './camera.js?v=wp1';
import { validateWorldContract, applyWorldEnvironment } from './world-contract.js';
import { createControls } from './controls.js?v=wp1';
import { createFlightModes } from './journey/flight-modes.js?v=wp1';

export function createEngine(container, { onUpdate } = {}) {
  const scene = new THREE.Scene();
  const camera = createCamera(window.innerWidth / window.innerHeight);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
  let qualityIndex = 1;
  const qualities = [{ name: 'licht', ratio: 1 }, { name: 'balans', ratio: 1.25 }, { name: 'scherp', ratio: 1.5 }];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualities[qualityIndex].ratio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '3D-stad. Gebruik de toetsenlegenda om vrij te vliegen.');
  container.appendChild(renderer.domElement);
  let flightModes;
  const controls = createControls(camera, renderer.domElement, { onReset: () => flightModes?.stop() });
  flightModes = createFlightModes(camera, controls);
  const status = document.querySelector('#status');
  const performanceLabel = document.querySelector('#performance');
  const events = new AbortController();
  let world = null;
  let previous = null;
  let frames = 0;
  let elapsed = 0;
  let running = false;
  const frameTimes = new Float32Array(240);
  let sampleCount = 0;
  let sampleIndex = 0;
  const qualityButton = document.querySelector('#quality-toggle');
  qualityButton.addEventListener('click', () => {
    qualityIndex = (qualityIndex + 1) % qualities.length;
    qualityButton.textContent = `Beeld: ${qualities[qualityIndex].name}`;
    resize();
    previous = null; frames = 0; elapsed = 0; sampleCount = 0; sampleIndex = 0;
    qualityButton.blur(); renderer.domElement.focus({ preventScroll: true });
  }, { signal: events.signal });
  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualities[qualityIndex].ratio));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize, { signal: events.signal });
  document.addEventListener('visibilitychange', () => { previous = null; frames = 0; elapsed = 0; sampleCount = 0; sampleIndex = 0; }, { signal: events.signal });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    running = false;
    status.hidden = false;
    status.textContent = 'De grafische verbinding is onderbroken. Herlaad de pagina om de stad opnieuw te openen.';
  }, { signal: events.signal });
  function frame(now) {
    if (document.hidden) { previous = null; return; }
    const dt = previous === null ? 0 : Math.min((now - previous) / 1000, 0.05);
    const rawDelta = previous === null ? 0 : (now - previous) / 1000;
    previous = now;
    flightModes.update(rawDelta);
    world?.update(dt, camera);
    onUpdate?.(dt, world);
    renderer.render(scene, camera);
    if (rawDelta > 0) {
      frames++; elapsed += rawDelta;
      frameTimes[sampleIndex] = rawDelta * 1000;
      sampleIndex = (sampleIndex + 1) % frameTimes.length;
      sampleCount = Math.min(sampleCount + 1, frameTimes.length);
    }
    if (elapsed >= 1) {
      performanceLabel.textContent = `${Math.round(frames / elapsed)} FPS · ${renderer.info.render.calls} draws`;
      const samples = Array.from(frameTimes.subarray(0, sampleCount)).sort((a, b) => a - b);
      performanceLabel.title = `P95 frametijd: ${samples[Math.max(0, Math.ceil(samples.length * 0.95) - 1)].toFixed(1)} ms · renderfactor ${renderer.getPixelRatio()} · ${renderer.info.render.lines} lijnsegmenten`;
      frames = 0; elapsed = 0;
    }
  }
  return {
    setWorld(next) {
      validateWorldContract(next); // Reject bad config before touching the active world.
      flightModes.stop();
      world?.dispose(); world = next;
      configureCamera(camera, world.config.camera);
      controls.setEnabled(true);
      applyWorldEnvironment(scene, world.config);
      world.init(scene);
      flightModes.setRoute(world.config.guidedJourney ? world.getJourneyRoute() : null);
      previous = null;
    },
    start() { if (running) return; running = true; previous = null; renderer.setAnimationLoop(frame); status.hidden = true; },
    dispose() {
      renderer.setAnimationLoop(null); running = false;
      events.abort(); flightModes.dispose(); controls.dispose(); world?.dispose(); world = null;
      renderer.dispose(); renderer.domElement.remove();
    }
  };
}
