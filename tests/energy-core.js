import * as THREE from '../lib/three/three.module.js';
import { createEnergyCore } from '../js/objects/energy-core.js';
import { resolveEnergySettings } from '../js/objects/energy-core-settings.js';
import { createEnergyResponse } from '../js/objects/energy-response.js';

export function testEnergyCore(check, renderer) {
  const settings = resolveEnergySettings({ hover: { amplitude: 0 } });
  function settle(distance, fps = 60) {
    const response = createEnergyResponse(settings);
    let integral = 0;
    for (let i = 0; i < fps * 8; i++) { response.update(1 / fps, distance); integral += response.state.integratedIntensity; }
    return { ...response.state, integral };
  }
  const rest = settle(120), activation = settle(55), resonance = settle(8);
  check('Kern: rust, activatie en resonantie op afstand', rest.intensity === 0 && activation.intensity > 0.2 && activation.intensity < 0.65 && resonance.intensity > 0.99 && resonance.state === 'resonance');
  const retreat = createEnergyResponse(settings);
  retreat.update(8, 0);
  const before = retreat.state.intensity;
  retreat.update(1 / 30, 150);
  check('Kern: wegvliegen geeft een zachte afname', retreat.state.intensity < before && before - retreat.state.intensity < 0.03);
  retreat.update(10, 150);
  check('Kern: terugkeer naar rust', retreat.state.intensity < 0.001);
  const response = createEnergyResponse(settings);
  response.update(1 / 30, 0);
  check('Kern: naderen of reset veroorzaakt geen abrupte sprong', response.state.intensity > 0 && response.state.intensity < 0.03);
  const slow = settle(8, 30), fast = settle(8, 120);
  check('Kern: interpolatie en rotatie-integratie bij 30/120 FPS gelijk', Math.abs(slow.intensity - fast.intensity) < 1e-10 && Math.abs(slow.integral - fast.integral) < 1e-10);
  const nearThreshold = createEnergyResponse(settings), farThreshold = createEnergyResponse(settings);
  nearThreshold.update(8, 26 - 0.001); farThreshold.update(8, 26 + 0.001);
  check('Kern: afstandsdrempel geeft geen visuele discontinuïteit', Math.abs(nearThreshold.state.intensity - farThreshold.state.intensity) < 1e-6);
  let snapshots = 0, lastSnapshot;
  const object = createEnergyCore({ position: [0, 0, 0], settings, onInteraction(value) { snapshots++; lastSnapshot = value; } });
  const camera = new THREE.PerspectiveCamera(66, 4 / 3, 0.15, 650);
  for (const position of [[40, 0, 0], [0, 40, 0], [0, 0, 40]]) {
    camera.position.fromArray(position); object.update(0.1, camera);
    check(`Kern: echte 3D-afstand langs ${position[0] ? 'X' : position[1] ? 'Y' : 'Z'}`, Math.abs(object.getInteractionState().distance - 40) < 1e-8);
  }
  const parent = new THREE.Group(); parent.position.set(0, 50, 0); parent.add(object.object);
  camera.position.set(0, 90, 0); object.update(0.1, camera);
  check('Kern: wereldtransformatie van hergebruikte kern telt mee', Math.abs(object.getInteractionState().distance - 40) < 1e-8);
  parent.remove(object.object);
  check('Kern: uitbreidingscallback levert nabijheidswaarden', snapshots > 0 && Number.isFinite(lastSnapshot.distance) && 'resonance' in lastSnapshot);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0616); scene.fog = new THREE.FogExp2(0x0b0616, 0.006); scene.add(object.object);
  const originalError = console.error, errors = [];
  console.error = (...args) => { errors.push(args.join(' ')); originalError(...args); };
  let maxDraws = 0, valid = true;
  try {
    for (const z of [144, 55, 18, 8, 0, -8, -18, -55, -144]) {
      camera.position.set(0, 0, z); camera.rotation.set(0, 0, 0);
      for (let i = 0; i < 120; i++) object.update(1 / 30, camera);
      renderer.render(scene, camera); maxDraws = Math.max(maxDraws, renderer.info.render.calls);
      object.object.traverse(child => { if (child.material) valid &&= Number.isFinite(child.material.opacity); valid &&= Number.isFinite(child.scale.x); });
    }
  } finally { console.error = originalError; }
  check('Kern: alle toestanden en passage door centrum renderen zonder fout', errors.length === 0 && valid);
  check('Kern: maximaal vijf drawcalls, ook in resonantie', maxDraws === 5);
  const resources = new Set();
  object.object.traverse(child => { if (child.geometry) resources.add(child.geometry); if (child.material) { resources.add(child.material); if (child.material.map) resources.add(child.material.map); } });
  let disposals = 0;
  resources.forEach(resource => resource.addEventListener('dispose', () => disposals++));
  object.dispose(); object.dispose();
  check('Kern: zelfstandig en eenmalig opruimen van alle resources', disposals === resources.size && scene.children.length === 0);
}
