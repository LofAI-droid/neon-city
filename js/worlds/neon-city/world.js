import * as THREE from '../../../lib/three/three.module.js';
import { createBuildings } from './buildings.js';
import { createGrid } from './grid.js';
import { createSphere } from './sphere.js';
import { createAtmosphere } from './atmosphere.js';

export function createNeonCity() {
  const root = new THREE.Group();
  let sphere;
  let atmosphere;
  return {
    init(scene) {
      scene.background = new THREE.Color(0x0b0616);
      scene.fog = new THREE.FogExp2(0x0b0616, 0.006);
      sphere = createSphere();
      atmosphere = createAtmosphere();
      root.add(createGrid(), createBuildings(), sphere.object, atmosphere.object);
      scene.add(root);
    },
    update(dt) { sphere?.update(dt); atmosphere?.update(dt); },
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
      atmosphere = null;
    }
  };
}
