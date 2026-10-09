import * as THREE from '../../../lib/three/three.module.js';

export function createGrid() {
  const points = [];
  const extent = 300;
  for (let i = -extent; i <= extent; i += 4) {
    points.push(-extent, 0, i, extent, 0, i);
    points.push(i, 0, -extent, i, 0, extent);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({ color: 0x72d8e3, transparent: true, opacity: 0.48, depthWrite: false });
  const grid = new THREE.LineSegments(geometry, material);
  grid.position.z = -90;
  return grid;
}
