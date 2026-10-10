import { NEON_CITY_CONFIG } from './config.js';
import { createEnergyCore } from '../../objects/energy-core.js';

// Only the placement belongs to Neon City; the interactive object is reusable.
export function createSphere(options = {}) {
  return createEnergyCore({ ...NEON_CITY_CONFIG.settings.energyCore, ...options });
}
