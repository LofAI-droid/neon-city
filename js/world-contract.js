import * as THREE from '../lib/three/three.module.js';
import { validateAudioConfig } from './audio/audio-settings.js?v=wp2';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const vector = value => Array.isArray(value) && value.length === 3 && Array.from(value).every(Number.isFinite);
const color = value => Number.isInteger(value) && value >= 0 && value <= 0xffffff;
const requireValue = (condition, field, rule) => { if (!condition) throw new Error(`Ongeldige wereldconfiguratie: ${field} ${rule}.`); };

export function validateCameraConfig(camera) {
  requireValue(object(camera), 'camera', 'moet een object zijn');
  requireValue(vector(camera.position), 'camera.position', 'moet drie eindige coördinaten bevatten');
  requireValue(vector(camera.rotation), 'camera.rotation', 'moet drie eindige rotaties in radialen bevatten');
  requireValue(Number.isFinite(camera.fov) && camera.fov > 0 && camera.fov < 180, 'camera.fov', 'moet tussen 0 en 180 graden liggen');
  requireValue(Number.isFinite(camera.near) && camera.near > 0 && Number.isFinite(camera.far) && camera.far > camera.near, 'camera.near/far', 'vereist 0 < near < far met eindige waarden');
  return camera;
}

export function validateWorldConfig(config) {
  requireValue(object(config), 'config', 'moet een object zijn');
  requireValue(typeof config.id === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(config.id), 'id', 'moet een kleine-letter-ID zijn, bijvoorbeeld neon-city');
  requireValue(typeof config.name === 'string' && config.name.trim().length > 0, 'name', 'moet een niet-lege wereldnaam zijn');
  validateCameraConfig(config.camera);
  requireValue(object(config.environment), 'environment', 'moet een object zijn');
  requireValue(color(config.environment.background), 'environment.background', 'moet een RGB-geheel getal van 0x000000 tot 0xffffff zijn');
  const fog = config.environment.fog;
  if (fog !== null) {
    requireValue(object(fog) && ['exp2', 'linear'].includes(fog.type), 'environment.fog', 'moet null, exp2 of linear zijn');
    requireValue(color(fog.color), 'environment.fog.color', 'moet een geldig RGB-geheel getal zijn');
    if (fog.type === 'exp2') requireValue(Number.isFinite(fog.density) && fog.density >= 0, 'environment.fog.density', 'moet eindig en niet-negatief zijn');
    else requireValue(Number.isFinite(fog.near) && fog.near >= 0 && Number.isFinite(fog.far) && fog.far > fog.near, 'environment.fog.near/far', 'vereist 0 <= near < far met eindige waarden');
  }
  requireValue(typeof config.guidedJourney === 'boolean', 'guidedJourney', 'moet true of false zijn');
  requireValue(object(config.settings), 'settings', 'moet een object met wereldspecifieke instellingen zijn');
  validateAudioConfig(config.audio);
  return config;
}

// Worlds own their objects; the engine owns the scene environment and camera.
// Required: config, init(scene), update(dt, camera), getAudioState(), dispose().
// Optional: getJourneyRoute(); required only when guidedJourney is true.
export function validateWorldContract(world) {
  requireValue(object(world), 'world', 'moet een object zijn');
  validateWorldConfig(world.config);
  for (const method of ['init', 'update', 'getAudioState', 'dispose']) {
    requireValue(typeof world[method] === 'function', method, 'moet een lifecycle-functie zijn');
  }
  requireValue(world.getJourneyRoute === undefined || typeof world.getJourneyRoute === 'function', 'getJourneyRoute', 'moet een functie zijn indien aanwezig');
  requireValue(!world.config.guidedJourney || typeof world.getJourneyRoute === 'function', 'getJourneyRoute', 'is vereist bij guidedJourney: true');
  return world;
}

export function applyWorldEnvironment(scene, config) {
  validateWorldConfig(config);
  const { background, fog } = config.environment;
  scene.background = new THREE.Color(background);
  scene.fog = fog === null ? null : fog.type === 'exp2' ? new THREE.FogExp2(fog.color, fog.density) : new THREE.Fog(fog.color, fog.near, fog.far);
}
