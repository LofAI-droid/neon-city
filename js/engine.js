import * as THREE from '../lib/three/three.module.js';
import { createCamera } from './camera.js';
import { createControls } from './controls.js';

export function createEngine(container) {
  const scene = new THREE.Scene();
  const camera = createCamera(window.innerWidth / window.innerHeight);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '3D-stad. Gebruik de toetsenlegenda om vrij te vliegen.');
  container.appendChild(renderer.domElement);
  const controls = createControls(camera, renderer.domElement);
  const status = document.querySelector('#status');
  const performanceLabel = document.querySelector('#performance');
  const events = new AbortController();
  let world = null;
  let previous = null;
  let frames = 0;
  let elapsed = 0;
  let running = false;
  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize, { signal: events.signal });
  document.addEventListener('visibilitychange', () => { previous = null; frames = 0; elapsed = 0; }, { signal: events.signal });
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
    controls.update(dt);
    world?.update(dt);
    renderer.render(scene, camera);
    if (rawDelta > 0) { frames++; elapsed += rawDelta; }
    if (elapsed >= 1) {
      performanceLabel.textContent = `${Math.round(frames / elapsed)} FPS · ${renderer.info.render.calls} draws`;
      frames = 0; elapsed = 0;
    }
  }
  return {
    setWorld(next) { world?.dispose(); world = next; world.init(scene); },
    start() { if (running) return; running = true; previous = null; renderer.setAnimationLoop(frame); status.hidden = true; },
    dispose() {
      renderer.setAnimationLoop(null); running = false;
      events.abort(); controls.dispose(); world?.dispose(); world = null;
      renderer.dispose(); renderer.domElement.remove();
    }
  };
}
