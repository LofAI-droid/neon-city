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
  audio: {
    sources: [
      { id: 'city-ambient', type: 'global', url: './assets/audio/city-ambient.mp3', gain: 0.55 },
      { id: 'energy-core', type: 'proximity', url: './assets/audio/energy-core.mp3', gain: 0.45,
        distanceKey: 'energy-core', distance: { fadeStart: 90, fullVolume: 12 } }
    ]
  },
  ui: { mixSourceId: 'energy-core', mixLabel: 'Kernmix' },
  settings: {
    energyCore: { position: [0, 19, -82], settings: ENERGY_CORE_DEFAULTS }
  }
};
