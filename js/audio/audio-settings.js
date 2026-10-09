export const AUDIO_SETTINGS = Object.freeze({
  cityUrl: './assets/audio/city-ambient.mp3',
  coreUrl: './assets/audio/energy-core.mp3',
  cityVolume: 0.55,
  coreVolume: 0.45,
  masterVolume: 0.65,
  fadeStartDistance: 90,
  fullVolumeDistance: 12,
  smoothingSeconds: 0.65,
  startStopSeconds: 0.18,
  startTimeoutMs: 15000
});

export function coreMixAtDistance(distance, settings = AUDIO_SETTINGS) {
  if (!Number.isFinite(distance)) return 0;
  const t = Math.max(0, Math.min(1, (settings.fadeStartDistance - distance) / (settings.fadeStartDistance - settings.fullVolumeDistance)));
  return t * t * (3 - 2 * t);
}
