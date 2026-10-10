import { ENERGY_CORE_DEFAULTS } from '../../objects/energy-core-settings.js';

// Position units and radians follow the existing v0.4B world scale.
export const NEON_CITY_CONFIG = {
  id: 'neon-city',
  name: 'Neon City',
  camera: {
    position: [0, 7, 62],
    rotation: [0.018, 0, 0], // Euler YXZ, radians; preserved from v0.4B.
    fov: 66,
    near: 0.15,
    far: 650
  },
  environment: {
    background: 0x0b0616,
    fog: { type: 'exp2', color: 0x0b0616, density: 0.006 }
  },
  guidedJourney: true,
  settings: {
    energyCore: { position: [0, 19, -82], settings: ENERGY_CORE_DEFAULTS }
  }
};
