import * as THREE from '../lib/three/three.module.js';
import { validateCameraConfig } from './world-contract.js';

// Neutral defaults for a camera before a world is selected; no Neon City data.
const DEFAULT_CAMERA = { position: [0, 0, 0], rotation: [0, 0, 0], fov: 60, near: 0.1, far: 1000 };

export function createCamera(aspect, settings = DEFAULT_CAMERA) {
  const camera = new THREE.PerspectiveCamera();
  camera.aspect = aspect;
  configureCamera(camera, settings);
  return camera;
}

export function configureCamera(camera, settings) {
  validateCameraConfig(settings);
  // Copy the pose so edits to a config array cannot silently change R's target.
  camera.userData.worldCamera = { ...settings, position: [...settings.position], rotation: [...settings.rotation] };
  camera.fov = settings.fov; camera.near = settings.near; camera.far = settings.far;
  camera.updateProjectionMatrix();
  resetCamera(camera);
}

export function resetCamera(camera) {
  const settings = camera.userData.worldCamera;
  if (!settings) throw new Error('Camera heeft nog geen wereldconfiguratie voor reset.');
  camera.position.fromArray(settings.position);
  camera.rotation.set(...settings.rotation, 'YXZ');
}
