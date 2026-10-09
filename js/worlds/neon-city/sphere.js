import { createEnergyCore } from '../../objects/energy-core.js';

// Only the placement belongs to Neon City; the interactive object is reusable.
export function createSphere(options = {}) {
  return createEnergyCore({ position: [0, 19, -82], ...options });
}
