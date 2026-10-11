import * as THREE from '../../../lib/three/three.module.js';
import { createBuildings } from './buildings.js?v=0.4B';
import { createGrid } from './grid.js';
import { createSphere } from './sphere.js?v=wp1';
import { NEON_CITY_CONFIG } from './config.js?v=wp2';
import { validateWorldConfig } from '../../world-contract.js?v=wp2';
import { createAtmosphere } from './atmosphere.js';
import { createNeonCityRoute } from './journey-route.js?v=wp1';

export function createNeonCity({ config = NEON_CITY_CONFIG } = {}) {
  validateWorldConfig(config);
  const root = new THREE.Group();
  let sphere;
  let atmosphere;
  let journeyRoute;
  return {
    config,
    init(scene) {
      sphere = createSphere(config.settings.energyCore);
      atmosphere = createAtmosphere();
      const buildings = createBuildings();
      journeyRoute = config.guidedJourney ? createNeonCityRoute(buildings.userData.collisionBounds, config) : null;
      root.add(createGrid(), buildings, sphere.object, atmosphere.object);
      scene.add(root);
    },
    getJourneyRoute() { return journeyRoute; },
    getAudioState() {
      const proximityDistance = sphere?.getDistance() ?? Infinity;
      return { distances: { 'energy-core': proximityDistance }, proximityDistance };
    },
    // Compatibility accessor; the bootstrap now uses the neutral contract.
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
