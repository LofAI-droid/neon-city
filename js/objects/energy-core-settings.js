// World units, radians/second and seconds. No scene or controls dependencies.
export const ENERGY_CORE_DEFAULTS = Object.freeze({
  radius: 11,
  distances: Object.freeze({ reaction: 90, resonance: 26, maximum: 12 }),
  smoothingSeconds: 1.2,
  rotation: Object.freeze({ rest: 0.075, maximum: 0.19, orbitFactor: 0.85 }),
  brightness: Object.freeze({ shellRest: 0.22, shellMaximum: 0.43, orbitRest: 0.3, orbitMaximum: 0.66, glowRest: 0.48, glowMaximum: 0.94 }),
  colors: Object.freeze({ cyan: 0x91e1e8, turquoise: 0x69dcca, gold: 0xe2c18b, coreRest: 0xc9eeee, coreMaximum: 0xffedcf }),
  pulse: Object.freeze({ frequency: 0.9, restAmplitude: 0.025, maximumAmplitude: 0.055 }),
  hover: Object.freeze({ amplitude: 0.7, frequency: 0.45 }),
  orbitCount: 12,
  orbitSegments: 72,
  callbackInterval: 0.1
});

export function resolveEnergySettings(overrides = {}) {
  const settings = { ...ENERGY_CORE_DEFAULTS, ...overrides };
  for (const section of ['distances', 'rotation', 'brightness', 'colors', 'pulse', 'hover']) {
    settings[section] = { ...ENERGY_CORE_DEFAULTS[section], ...overrides[section] };
  }
  const { reaction, resonance, maximum } = settings.distances;
  if (!(Number.isFinite(reaction) && reaction > resonance && resonance > maximum && maximum >= 0)) {
    throw new Error('Energy core distances must satisfy reaction > resonance > maximum >= 0.');
  }
  if (!(settings.smoothingSeconds > 0 && Number.isFinite(settings.smoothingSeconds))) throw new Error('Energy core smoothingSeconds must be positive.');
  if (!(settings.radius > 0 && Number.isFinite(settings.radius))) throw new Error('Energy core radius must be positive.');
  if (!(Number.isInteger(settings.orbitCount) && settings.orbitCount >= 3 && settings.orbitCount <= 32 && Number.isInteger(settings.orbitSegments) && settings.orbitSegments >= 16 && settings.orbitSegments <= 256)) throw new Error('Energy core orbit geometry exceeds its supported bounds.');
  return settings;
}
