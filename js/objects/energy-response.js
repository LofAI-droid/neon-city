// Continuous proximity values; the state name is descriptive, not a visual switch.
function smoothstep(low, high, value) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

export function createEnergyResponse(settings) {
  const state = { distance: Infinity, activation: 0, resonance: 0, intensity: 0, integratedIntensity: 0, state: 'rest' };
  return {
    state,
    update(dt, distance) {
      if (!Number.isFinite(dt) || dt < 0) throw new Error('Energy core deltaTime must be finite and nonnegative.');
      distance = Number.isFinite(distance) ? Math.max(0, distance) : Infinity;
      const { reaction, resonance, maximum } = settings.distances;
      const activationTarget = 1 - smoothstep(resonance, reaction, distance);
      const resonanceTarget = 1 - smoothstep(maximum, resonance, distance);
      const target = activationTarget * 0.65 + resonanceTarget * 0.35;
      const decay = Math.exp(-dt / settings.smoothingSeconds);
      // Exact integral preserves rotation when the same input is sampled at different FPS.
      state.integratedIntensity = target * dt + (state.intensity - target) * settings.smoothingSeconds * (1 - decay);
      state.activation = activationTarget + (state.activation - activationTarget) * decay;
      state.resonance = resonanceTarget + (state.resonance - resonanceTarget) * decay;
      state.intensity = state.activation * 0.65 + state.resonance * 0.35;
      state.distance = distance;
      state.state = distance >= reaction ? 'rest' : distance > resonance ? 'activation' : 'resonance';
      return state;
    }
  };
}
