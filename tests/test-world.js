import * as THREE from '../lib/three/three.module.js';

// WP3 fixture only. This is intentionally absent from the production registry.
export const TEST_WORLD_CONFIG = {
  id: 'test-world', name: 'Test World',
  camera: { position: [6, 4, 18], rotation: [0.08, 0.25, 0], fov: 72, near: 0.2, far: 200 },
  environment: { background: 0x10243a, fog: null },
  guidedJourney: false, audio: { sources: [] }, settings: {}
};

export function createTestWorld({ config = TEST_WORLD_CONFIG, failInit = false, tracker } = {}) {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry(4, 4, 4);
  const material = new THREE.MeshBasicMaterial({ color: 0x79d5dc, wireframe: true });
  if (tracker) {
    geometry.addEventListener('dispose', () => { tracker.resources = (tracker.resources ?? 0) + 1; });
    material.addEventListener('dispose', () => { tracker.resources = (tracker.resources ?? 0) + 1; });
  }
  root.add(new THREE.Mesh(geometry, material));
  let disposed = false;
  return {
    config,
    init(scene) { tracker && (tracker.inits = (tracker.inits ?? 0) + 1); scene.add(root); if (failInit) throw new Error('Testfout tijdens init'); },
    update(dt) { root.rotation.y += dt * 0.2; tracker && (tracker.updates = (tracker.updates ?? 0) + 1); },
    getAudioState() { return { distances: {} }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent(); geometry.dispose(); material.dispose(); root.clear();
      tracker && (tracker.disposes = (tracker.disposes ?? 0) + 1);
    }
  };
}
