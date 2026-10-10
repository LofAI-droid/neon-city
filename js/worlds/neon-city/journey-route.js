import * as THREE from '../../../lib/three/three.module.js';

import { NEON_CITY_CONFIG } from './config.js';

export function createNeonCityRoute(bounds, config = NEON_CITY_CONFIG) {
  const positions = [
    [0, ...config.camera.position], [8, 0,7.5,42], [15, 0,8,18],
    [22, -6,9,7], [30, 6,12,-5], [40, -4,10,-18],
    [48, -6,13,-36], [57, -8,18,-54], [65, -8.8,21,-69.2],
    [70, -5,21,-67.3], [75, 3.5,21,-66.9], [80, 8.8,21,-69.2],
    [85, 7,22,-66.5], [90, 5.8,22,-65.5]
  ].map(([time,...value]) => ({ time, value }));
  const targets = [
    [0,0,11,12], [8,0,12,-5], [15,-3,12,-18], [22,2,13,-30],
    [30,-2,15,-44], [40,0,19,-82], [48,0,19,-82], [57,0,19,-82],
    [65,0,19,-82], [70,0,19,-82], [75,0,19,-82], [80,0,19,-82],
    [85,0,19,-82], [90,0,19,-82]
  ].map(([time,...value]) => ({ time, value }));
  const clearance = 0.8;
  const coreCenter = new THREE.Vector3(...config.settings.energyCore.position);
  const isSafe = point => point.y > 1 && point.distanceToSquared(coreCenter) > 13.5**2 && !bounds.some(box => point.x >= box.min.x-clearance && point.x <= box.max.x+clearance && point.y >= box.min.y-clearance && point.y <= box.max.y+clearance && point.z >= box.min.z-clearance && point.z <= box.max.z+clearance);
  const segmentSafe = (a,b) => {
    const sample = new THREE.Vector3(); const steps = Math.max(1, Math.ceil(a.distanceTo(b) / 0.4));
    for (let i=0; i<=steps; i++) if (!isSafe(sample.copy(a).lerp(b,i/steps))) return false;
    return true;
  };
  const sky = Math.max(100, ...bounds.map(box => box.max.y + 8));
  return {
    duration: 90, positions, targets, isSafe,
    planEntry(origin, begin) {
      if (!isSafe(origin)) return null;
      if (segmentSafe(origin, begin)) return [origin, begin];
      for (const [dx,dz] of [[0,0],[8,0],[-8,0],[0,8],[0,-8],[16,0],[-16,0],[0,16],[0,-16]]) {
        const escape = origin.clone().add(new THREE.Vector3(dx,0,dz));
        const above = escape.clone(); above.y = Math.max(sky, origin.y);
        const overStart = begin.clone(); overStart.y = above.y;
        const points = [origin, escape, above, overStart, begin].filter((point,i,array) => i===0 || point.distanceTo(array[i-1]) > 0.01);
        if (points.slice(1).every((point,i) => segmentSafe(points[i],point))) return points;
      }
      return null;
    }
  };
}
