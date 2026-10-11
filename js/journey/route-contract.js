import * as THREE from '../../lib/three/three.module.js';
import { createTimedPath } from './timed-path.js?v=wp4';

export const DEFAULT_ENTRY = Object.freeze({
  speed: 16 / 1.875,
  minDuration: 2.5,
  safetyStepSeconds: 0.04,
  velocityMode: 'inherit',
  velocityFallback: 'zero'
});

const fail = message => { throw new Error(`Ongeldige Journey-route: ${message}.`); };
const point = value => Array.isArray(value) && value.length === 3 && [0, 1, 2].every(i => Number.isFinite(value[i]));
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function resolveEntrySettings(route) {
  const supplied = route.entry;
  if (supplied !== undefined && !plain(supplied)) fail('entry moet een object zijn');
  const allowed = new Set(['speed', 'minDuration', 'maxDuration', 'safetyStepSeconds', 'velocityMode', 'velocityFallback']);
  for (const field of Object.keys(supplied ?? {})) if (!allowed.has(field)) fail(`entry.${field} is onbekend`);
  const entry = { ...DEFAULT_ENTRY, ...supplied };
  for (const field of ['speed', 'minDuration', 'safetyStepSeconds']) {
    if (!Number.isFinite(entry[field]) || entry[field] <= 0) fail(`entry.${field} moet positief en eindig zijn`);
  }
  if (entry.maxDuration !== undefined && (!Number.isFinite(entry.maxDuration) || entry.maxDuration < entry.minDuration)) fail('entry.maxDuration moet eindig en minstens minDuration zijn');
  if (!['inherit', 'zero'].includes(entry.velocityMode)) fail('entry.velocityMode moet inherit of zero zijn');
  if (!['zero', 'reject'].includes(entry.velocityFallback)) fail('entry.velocityFallback moet zero of reject zijn');
  return entry;
}

export function validateJourneyRoute(route) {
  if (!plain(route)) fail('route moet een object zijn');
  if (!Number.isFinite(route.duration) || route.duration <= 0) fail('duration moet positief en eindig zijn');
  for (const name of ['positions', 'targets']) {
    const keys = route[name];
    if (!Array.isArray(keys) || keys.length < 2) fail(`${name} vereist minstens twee routepunten`);
    let previous = -Infinity;
    for (const [i, key] of keys.entries()) {
      if (!plain(key) || !Number.isFinite(key.time)) fail(`${name}[${i}].time moet eindig zijn`);
      if (key.time <= previous) fail(`${name}: tijdstippen lopen niet strikt op`);
      if (!point(key.value)) fail(`${name}[${i}].value bevat ongeldige coördinaten`);
      previous = key.time;
    }
    if (Math.abs(keys[0].time) > 1e-6 || Math.abs(keys.at(-1).time - route.duration) > 1e-6) fail(`${name}: begin- en eindtijd moeten 0 en duration zijn`);
  }
  if (typeof route.isSafe !== 'function') fail('isSafe moet een veiligheidsfunctie zijn');
  if (typeof route.planEntry !== 'function') fail('planEntry moet een aanloopfunctie zijn');
  resolveEntrySettings(route);

  // Check both independent curves at key times and between keys, once at install.
  const positions = createTimedPath(route.positions), targets = createTimedPath(route.targets);
  const times = [...new Set([...route.positions, ...route.targets].map(key => key.time))].sort((a, b) => a - b);
  const camera = new THREE.Vector3(), look = new THREE.Vector3();
  for (let i = 0; i < times.length - 1; i++) {
    for (let j = 0; j < 4; j++) {
      const t = times[i] + (times[i + 1] - times[i]) * j / 4;
      positions.sample(t, camera); targets.sample(t, look);
      if (camera.distanceToSquared(look) < 1e-8) fail('kijkdoel valt samen met de camerapositie');
    }
  }
  positions.sample(route.duration, camera); targets.sample(route.duration, look);
  if (camera.distanceToSquared(look) < 1e-8) fail('kijkdoel valt samen met de camerapositie');
  return route;
}
