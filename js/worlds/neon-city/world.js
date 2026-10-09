import * as THREE from '../../../lib/three/three.module.js';
import { createBuildings } from './buildings.js';
import { createGrid } from './grid.js';
import { createSphere } from './sphere.js';

export function createNeonCity() {
  const root = new THREE.Group();
  let sphere;
  return {
    init(scene) {
      scene.background = new THREE.Color(0x090411);
      scene.fog = new THREE.FogExp2(0x090411, 0.0055);
      sphere = createSphere();
      root.add(createGrid(), createBuildings(), sphere.object);
      scene.add(root);
    },
    update(dt) { sphere?.update(dt); },
    dispose() {
      root.removeFromParent();
      const geometries = new Set(), materials = new Set(), textures = new Set();
      root.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of objectMaterials) {
          if (!material) continue;
          materials.add(material);
          if (material.map) textures.add(material.map);
        }
      });
      textures.forEach(texture => texture.dispose());
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      root.clear();
      sphere = null;
    }
  };
}
