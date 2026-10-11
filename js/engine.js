import * as THREE from '../lib/three/three.module.js';
import { createCamera, configureCamera } from './camera.js?v=wp1';
import { validateWorldContract, applyWorldEnvironment } from './world-contract.js?v=wp2';
import { createControls } from './controls.js?v=wp3';
import { createFlightModes } from './journey/flight-modes.js?v=wp2';

export function createEngine(container, { onUpdate, ui = {} } = {}) {
  const scene = new THREE.Scene();
  const camera = createCamera(window.innerWidth / window.innerHeight);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
  let qualityIndex = 1;
  const qualities = [{ name: 'licht', ratio: 1 }, { name: 'balans', ratio: 1.25 }, { name: 'scherp', ratio: 1.5 }];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualities[qualityIndex].ratio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', ui.canvasLabel ?? '3D-wereld. Gebruik de toetsenlegenda om vrij te vliegen.');
  container.appendChild(renderer.domElement);
  let flightModes;
  const controls = createControls(camera, renderer.domElement, { onReset: () => flightModes?.stop() });
  flightModes = createFlightModes(camera, controls);
  const { status, performance: performanceLabel } = ui;
  const events = new AbortController();
  let world = null;
  let previous = null;
  let frames = 0;
  let elapsed = 0;
  let running = false;
  let suspended = false;
  let disposed = false;
  const frameTimes = new Float32Array(240);
  let sampleCount = 0;
  let sampleIndex = 0;
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
    if (status) { status.hidden = false; status.textContent = 'De grafische verbinding is onderbroken. Herlaad de pagina om de wereld opnieuw te openen.'; }
  }, { signal: events.signal });
  function frame(now) {
    if (document.hidden) { previous = null; return; }
    const dt = previous === null ? 0 : Math.min((now - previous) / 1000, 0.05);
    const rawDelta = previous === null ? 0 : (now - previous) / 1000;
    previous = now;
    if (!suspended) {
      flightModes.update(rawDelta);
      world?.update(dt, camera);
      onUpdate?.(dt, world);
    }
    renderer.render(scene, camera);
    if (rawDelta > 0) {
      frames++; elapsed += rawDelta;
      frameTimes[sampleIndex] = rawDelta * 1000;
      sampleIndex = (sampleIndex + 1) % frameTimes.length;
      sampleCount = Math.min(sampleCount + 1, frameTimes.length);
    }
    if (elapsed >= 1) {
      if (performanceLabel) performanceLabel.textContent = `${Math.round(frames / elapsed)} FPS · ${renderer.info.render.calls} draws`;
      const samples = Array.from(frameTimes.subarray(0, sampleCount)).sort((a, b) => a - b);
      if (performanceLabel) performanceLabel.title = `P95 frametijd: ${samples[Math.max(0, Math.ceil(samples.length * 0.95) - 1)].toFixed(1)} ms · renderfactor ${renderer.getPixelRatio()} · ${renderer.info.render.lines} lijnsegmenten`;
      frames = 0; elapsed = 0;
    }
  }
  return {
    canvas: renderer.domElement,
    camera,
    scene,
    controls,
    flightModes,
    getWorld() { return world; },
    isSuspended() { return suspended; },
    getRenderStats() { return { draws: renderer.info.render.calls, lines: renderer.info.render.lines, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }; },
    getQuality() { return qualities[qualityIndex]; },
    cycleQuality() {
      qualityIndex = (qualityIndex + 1) % qualities.length;
      resize();
      previous = null; frames = 0; elapsed = 0; sampleCount = 0; sampleIndex = 0;
    },
    suspendWorld() {
      if (disposed) throw new Error('De engine is al opgeruimd.');
      if (suspended) return;
      suspended = true;
      flightModes.stop();
      flightModes.setRoute(null);
      controls.setEnabled(false);
      controls.setTransitionLocked(true);
    },
    clearWorld() {
      if (disposed) return;
      this.suspendWorld();
      const old = world; world = null;
      try { old?.dispose(); }
      finally { scene.clear(); scene.background = null; scene.fog = null; previous = null; }
    },
    resumeWorld() {
      if (disposed || !world) return;
      flightModes.setRoute(world.config.guidedJourney ? world.getJourneyRoute() : null);
      controls.setEnabled(true);
      controls.setTransitionLocked(false);
      suspended = false;
      previous = null;
    },
    setWorld(next) {
      if (disposed) throw new Error('De engine is al opgeruimd.');
      validateWorldContract(next); // Reject bad config before touching the active world.
      try {
        this.clearWorld();
        configureCamera(camera, next.config.camera);
        applyWorldEnvironment(scene, next.config);
        next.init(scene);
        flightModes.setRoute(next.config.guidedJourney ? next.getJourneyRoute() : null);
        world = next;
        controls.setEnabled(true);
        controls.setTransitionLocked(false);
        suspended = false;
        previous = null;
      } catch (error) {
        try { next.dispose(); } catch (cleanupError) { console.error('Wereldopruiming na initialisatiefout:', cleanupError); }
        scene.clear();
        scene.background = null; scene.fog = null;
        flightModes.setRoute(null);
        throw error;
      }
    },
    start() { if (running || disposed) return; running = true; previous = null; renderer.setAnimationLoop(frame); if (status) status.hidden = true; },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null); running = false;
      events.abort(); flightModes.dispose(); controls.dispose();
      const old = world; world = null;
      try { old?.dispose(); }
      finally { scene.clear(); renderer.dispose(); renderer.domElement.remove(); }
    }
  };
}
