import * as THREE from '../../../lib/three/three.module.js';

export const CITY_SEED = 73129;
export function createBuildings() {
  let state = CITY_SEED;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const layers = [[], [], []];
  const collisionBounds = [];
  const line = (layer, x1, y1, z1, x2, y2, z2) => layers[layer].push(x1, y1, z1, x2, y2, z2);
  function box(layer, x, y, z, width, height, depth) {
    const a = x - width / 2, b = x + width / 2, c = z - depth / 2, d = z + depth / 2;
    for (const level of (height === 0 ? [y] : [y, y + height])) {
      line(layer, a, level, c, b, level, c); line(layer, b, level, c, b, level, d);
      line(layer, b, level, d, a, level, d); line(layer, a, level, d, a, level, c);
    }
    if (height > 0) for (const xx of [a, b]) for (const zz of [c, d]) line(layer, xx, y, zz, xx, y + height, zz);
  }
  let count = 0;
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 18; i++) {
        const width = 9 + random() * 9, depth = 10 + random() * 7;
        const height = 15 + random() * 46 + (row === 1 ? 8 : 0);
        const x = side * (23 + row * 23 + random() * 5);
        const z = 32 - i * 22 + (random() - 0.5) * 4;
        box(0, x, 0, z, width, height, depth);
        const floorHeight = 4 + random() * 3;
        for (let y = floorHeight; y < height; y += floorHeight) {
          box(1, x, y, z, width, 0, depth);
        }
        // Offset crown and antenna create varied, architectural silhouettes.
        if (random() > 0.3) {
          const crown = 3 + random() * 10;
          box(0, x + side * width * 0.1, height, z, width * 0.62, crown, depth * 0.68);
          line(2, x, height + crown, z, x, height + crown + 4 + random() * 12, z);
        }
        for (let j = 1; j <= 3; j++) {
          const xx = x - width / 2 + width * j / 4;
          line(1, xx, 0, z + depth / 2, xx, height, z + depth / 2);
        }
        const detailLayer = random() > 0.72 ? 2 : 1;
        const face = z + depth / 2 + 0.03;
        box(detailLayer, x + side * width * 0.23, height * 0.4, face, width * 0.22, height * 0.43, 0.35);
        for (let y = 6; y < height * 0.82; y += 9) {
          line(detailLayer, x - width * 0.2, y, face, x + width * 0.1, y + 1.6, face);
          line(detailLayer, x + width * 0.1, y + 1.6, face, x + width * 0.1, y + 3, face);
        }
        if (random() > 0.45) box(1, x + side * width * 0.56, 2, z, width * 0.3, height * 0.23, depth * 0.7);
        // Terraced podiums, recessed upper volumes and fine facade structure.
        box(0, x, 0.3, z, width * 1.12, 3.2, depth * 1.08);
        if (i % 3 === 0) {
          box(0, x - side * width * 0.12, height * 0.65, z - depth * 0.1, width * 0.72, height * 0.46, depth * 0.76);
          box(2, x - side * width * 0.12, height * 1.11, z - depth * 0.1, width * 0.48, 2.5, depth * 0.5);
        }
        const innerFace = x - side * width / 2 - side * 0.04;
        for (let y = 5; y < height - 3; y += 8) {
          line(1, innerFace, y, z - depth * 0.35, innerFace, y, z + depth * 0.35);
          if (i % 4 === 0) {
            line(2, innerFace, y, z - depth * 0.12, innerFace, y + 2, z - depth * 0.12);
            line(2, innerFace, y + 2, z - depth * 0.12, innerFace, y + 2, z + depth * 0.12);
          }
        }
        if (row === 0 && i % 3 === 1) {
          const mastX = x - side * (width / 2 + 1.5);
          line(2, mastX, 0, z, mastX, height + 7, z);
          line(0, mastX, height * 0.55, z, x, height * 0.55, z);
        }
        // Conservative envelopes also cover crowns, side details and antennae.
        collisionBounds.push(new THREE.Box3(new THREE.Vector3(x-width*0.7, 0, z-depth*0.7), new THREE.Vector3(x+width*0.7, height+35, z+depth*0.7)));
        count++;
      }
    }
  }
  const group = new THREE.Group();
  const palette = [[0x91e4e9, 0.64], [0x4d9eb9, 0.31], [0xe0c18a, 0.57]];
  layers.forEach((positions, index) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const [color, opacity] = palette[index];
    group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, opacity, transparent: true, depthWrite: false })));
  });
  group.userData.buildingCount = count;
  group.userData.collisionBounds = collisionBounds;
  return group;
}
