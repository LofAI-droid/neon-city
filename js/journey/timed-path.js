import * as THREE from '../../lib/three/three.module.js';

export const ease = t => t * t * t * (10 + t * (-15 + 6 * t));
export function createTimedPath(keys) {
  const times = keys.map(key => key.time);
  const curve = new THREE.CatmullRomCurve3(keys.map(key => new THREE.Vector3(...key.value)), false, 'catmullrom', 0.5);
  const slopes = times.map((time, i) => i === 0 || i === times.length - 1 ? 0 : 2 / (times[i + 1] - times[i - 1]));
  return {
    sample(time, target) {
      time = THREE.MathUtils.clamp(time, times[0], times.at(-1));
      let i = 0; while (i < times.length - 2 && time > times[i + 1]) i++;
      const duration = times[i + 1] - times[i], t = (time - times[i]) / duration;
      const t2 = t * t, t3 = t2 * t;
      const index = (2*t3-3*t2+1)*i + (t3-2*t2+t)*duration*slopes[i] + (-2*t3+3*t2)*(i+1) + (t3-t2)*duration*slopes[i+1];
      return curve.getPoint(THREE.MathUtils.clamp(index / (times.length - 1), 0, 1), target);
    }
  };
}

export function createEntryPath(points, initialVelocity = new THREE.Vector3(), settings = {}) {
  const speed = settings.speed ?? 16 / 1.875;
  const minDuration = settings.minDuration ?? 2.5;
  const maxDuration = settings.maxDuration ?? Infinity;
  const durations = points.slice(1).map((point, i) => Math.min(maxDuration, Math.max(minDuration, point.distanceTo(points[i]) / speed)));
  const total = durations.reduce((sum, value) => sum + value, 0);
  return {
    duration: total,
    sample(time, target) {
      let i = 0;
      while (i < durations.length - 1 && time > durations[i]) { time -= durations[i]; i++; }
      const t = THREE.MathUtils.clamp(time / durations[i], 0, 1);
      target.copy(points[i]).lerp(points[i + 1], ease(t));
      if (i === 0) target.addScaledVector(initialVelocity, durations[i] * (t - 6*t**3 + 8*t**4 - 3*t**5));
      return target;
    }
  };
}
