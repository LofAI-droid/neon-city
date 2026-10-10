import * as THREE from '../../lib/three/three.module.js';
import { createTimedPath, createEntryPath, ease } from './timed-path.js';

export function createJourney(route) {
  const positionPath = createTimedPath(route.positions), targetPath = createTimedPath(route.targets);
  const position = new THREE.Vector3(), target = new THREE.Vector3(), probe = new THREE.Vector3();
  const matrix = new THREE.Matrix4(), rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  const up = new THREE.Vector3(0, 1, 0);
  const velocity = new THREE.Vector3();
  let phase = 'idle', elapsed = 0, entryElapsed = 0, entry, disposed = false;
  let startYaw = 0, startPitch = 0, targetYaw = 0, targetPitch = 0;
  function orient(camera, point, look) {
    matrix.lookAt(point, look, up); rotation.setFromRotationMatrix(matrix, 'YXZ');
    camera.rotation.set(rotation.x, rotation.y, 0, 'YXZ');
  }
  const sample = (time, out) => positionPath.sample(time, out);
  return {
    start(camera, initialVelocity = new THREE.Vector3()) {
      if (disposed) return false;
      const begin = sample(0, position).clone();
      const points = route.planEntry(camera.position.clone(), begin);
      if (!points) return false;
      entry = createEntryPath(points, initialVelocity);
      // Validate the actual curved entry, including the player's starting velocity.
      const safe = () => { for (let t = 0; t <= entry.duration; t += 0.04) if (!route.isSafe(entry.sample(t, probe))) return false; return true; };
      if (!safe()) { entry = createEntryPath(points); if (!safe()) return false; }
      startYaw = camera.rotation.y; startPitch = camera.rotation.x;
      targetPath.sample(0, target); matrix.lookAt(begin, target, up); rotation.setFromRotationMatrix(matrix, 'YXZ');
      targetYaw = startYaw + THREE.MathUtils.euclideanModulo(rotation.y - startYaw + Math.PI, 2*Math.PI) - Math.PI;
      targetPitch = rotation.x;
      elapsed = 0; entryElapsed = 0; phase = 'entry'; velocity.copy(initialVelocity);
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
    getState() { return { phase, elapsed, duration: route.duration, entryDuration: entry?.duration ?? 0 }; },
    getVelocity(out) { return out.copy(velocity); },
    cancel() { phase = 'idle'; },
    dispose() { disposed = true; entry = null; phase = 'idle'; }
  };
}
