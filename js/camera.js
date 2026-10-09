import * as THREE from '../lib/three/three.module.js';

export function createCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(66, aspect, 0.15, 650);
  resetCamera(camera);
  return camera;
}

export function resetCamera(camera) {
  camera.position.set(0, 7, 62);
  camera.rotation.order = 'YXZ';
  camera.rotation.set(0.018, 0, 0);
}
