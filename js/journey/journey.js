import * as THREE from '../../lib/three/three.module.js';
import { createTimedPath, createEntryPath, ease } from './timed-path.js?v=wp4';
import { validateJourneyRoute, resolveEntrySettings } from './route-contract.js';

export function createJourney(route) {
  validateJourneyRoute(route);
  const entrySettings = resolveEntrySettings(route);
  const positionPath = createTimedPath(route.positions), targetPath = createTimedPath(route.targets);
  const position = new THREE.Vector3(), target = new THREE.Vector3(), probe = new THREE.Vector3();
  const matrix = new THREE.Matrix4(), rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  const up = new THREE.Vector3(0, 1, 0);
  const velocity = new THREE.Vector3(), entryVelocity = new THREE.Vector3();
  let phase = 'idle', elapsed = 0, entryElapsed = 0, entry, disposed = false;
  let startError = '', entryFallback = false;
  let startYaw = 0, startPitch = 0, targetYaw = 0, targetPitch = 0;
  const finiteVector = value => value?.isVector3 && [value.x, value.y, value.z].every(Number.isFinite);
  function aim(point, look, fallbackYaw) {
    const dx = look.x - point.x, dy = look.y - point.y, dz = look.z - point.z;
    const horizontal = Math.hypot(dx, dz);
    if (horizontal < 1e-4) return { yaw: fallbackYaw, pitch: Math.sign(dy) * (Math.PI / 2 - 0.0001) };
    matrix.lookAt(point, look, up); rotation.setFromRotationMatrix(matrix, 'YXZ');
    if (horizontal >= 0.05) return { yaw: rotation.y, pitch: rotation.x };
    const weight = (horizontal - 1e-4) / (0.05 - 1e-4);
    const turn = THREE.MathUtils.euclideanModulo(rotation.y - fallbackYaw + Math.PI, 2 * Math.PI) - Math.PI;
    return { yaw: fallbackYaw + turn * weight, pitch: rotation.x };
  }
  function orient(camera, point, look) {
    const facing = aim(point, look, camera.rotation.y);
    camera.rotation.set(facing.pitch, facing.yaw, 0, 'YXZ');
  }
  const sample = (time, out) => positionPath.sample(time, out);
  return {
    start(camera, initialVelocity = new THREE.Vector3()) {
      if (disposed) return false;
      if (phase === 'entry' || phase === 'running') return false;
      startError = ''; entryFallback = false; entry = null;
      if (!finiteVector(camera?.position) || !camera?.rotation || ![camera.rotation.x, camera.rotation.y, camera.rotation.z].every(Number.isFinite)) { startError = 'invalid-camera'; return false; }
      if (!finiteVector(initialVelocity)) { startError = 'invalid-velocity'; return false; }
      const begin = sample(0, position).clone();
      let points;
      try { points = route.planEntry(camera.position.clone(), begin); }
      catch (error) { startError = 'invalid-entry'; return false; }
      if (!points) { startError = 'unsafe-entry'; return false; }
      if (!Array.isArray(points) || points.length < 2 || !points.every(finiteVector) || points[0].distanceTo(camera.position) > 1e-6 || points.at(-1).distanceTo(begin) > 1e-6) { startError = 'invalid-entry'; return false; }
      entryVelocity.copy(initialVelocity);
      if (entrySettings.velocityMode === 'zero') entryVelocity.set(0, 0, 0);
      entry = createEntryPath(points, entryVelocity, entrySettings);
      // Validate the actual curved entry, including the player's starting velocity.
      const safe = () => {
        const steps = Math.ceil(entry.duration / entrySettings.safetyStepSeconds);
        if (steps > 50000) return false;
        try { for (let i = 0; i <= steps; i++) if (!route.isSafe(entry.sample(entry.duration * i / steps, probe))) return false; }
        catch (error) { return false; }
        return true;
      };
      if (!safe()) {
        if (entrySettings.velocityFallback !== 'zero' || entryVelocity.lengthSq() === 0) { startError = 'unsafe-entry'; return false; }
        entryVelocity.set(0, 0, 0);
        entry = createEntryPath(points, entryVelocity, entrySettings);
        if (!safe()) { startError = 'unsafe-entry'; return false; }
        entryFallback = true;
      }
      startYaw = camera.rotation.y; startPitch = camera.rotation.x;
      targetPath.sample(0, target);
      const facing = aim(begin, target, startYaw);
      targetYaw = startYaw + THREE.MathUtils.euclideanModulo(facing.yaw - startYaw + Math.PI, 2*Math.PI) - Math.PI;
      targetPitch = facing.pitch;
      elapsed = 0; entryElapsed = 0; phase = 'entry'; velocity.copy(entryVelocity);
      return true;
    },
    update(dt, camera) {
      if (disposed || phase === 'idle' || phase === 'complete') return;
      if (!Number.isFinite(dt) || dt < 0) throw new Error('Journey deltaTime must be finite and nonnegative.');
      if (phase === 'entry') {
        entryElapsed += dt;
        const entryTime = Math.min(entryElapsed, entry.duration);
        entry.sample(entryTime, camera.position);
        const blend = ease(entryTime / entry.duration);
        camera.rotation.set(THREE.MathUtils.lerp(startPitch, targetPitch, blend), THREE.MathUtils.lerp(startYaw, targetYaw, blend), 0, 'YXZ');
        const a = Math.max(0, entryTime - 0.001), b = Math.min(entry.duration, entryTime + 0.001);
        entry.sample(b, velocity); entry.sample(a, probe); velocity.sub(probe).divideScalar(Math.max(b-a, 0.001));
        if (entryElapsed < entry.duration - 1e-9) return;
        dt = Math.max(0, entryElapsed - entry.duration); phase = 'running';
      }
      elapsed = Math.min(route.duration, elapsed + dt);
      sample(elapsed, camera.position); targetPath.sample(elapsed, target); orient(camera, camera.position, target);
      const a = Math.max(0, elapsed - 0.001), b = Math.min(route.duration, elapsed + 0.001);
      sample(b, velocity); sample(a, probe); velocity.sub(probe).divideScalar(Math.max(b-a, 0.001));
      if (elapsed >= route.duration - 1e-8) { elapsed = route.duration; phase = 'complete'; velocity.set(0, 0, 0); }
    },
    getState() { return { phase, elapsed, duration: route.duration, entryDuration: entry?.duration ?? 0, startError, entryFallback }; },
    getVelocity(out) { return out.copy(velocity); },
    cancel() { phase = 'idle'; },
    dispose() { disposed = true; entry = null; phase = 'idle'; }
  };
}
