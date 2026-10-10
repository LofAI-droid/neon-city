import * as THREE from '../../../lib/three/three.module.js';
import { createBuildings } from './buildings.js?v=0.4B';
import { createGrid } from './grid.js';
import { createSphere } from './sphere.js';
import { createAtmosphere } from './atmosphere.js';
import { createNeonCityRoute } from './journey-route.js';

export function createNeonCity() {
  const root = new THREE.Group();
  let sphere;
  let atmosphere;
  let journeyRoute;
  return {
    init(scene) {
      scene.background = new THREE.Color(0x0b0616);
      scene.fog = new THREE.FogExp2(0x0b0616, 0.006);
      sphere = createSphere();
      atmosphere = createAtmosphere();
      const buildings = createBuildings();
      journeyRoute = createNeonCityRoute(buildings.userData.collisionBounds);
      root.add(createGrid(), buildings, sphere.object, atmosphere.object);
      scene.add(root);
    },
    getJourneyRoute() { return journeyRoute; },
    getEnergyDistance() { return sphere?.getDistance() ?? Infinity; },
    update(dt, camera) { sphere?.update(dt, camera); atmosphere?.update(dt); },
    dispose() {
      sphere?.dispose();
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
      journeyRoute = null;
    }
  };
}
