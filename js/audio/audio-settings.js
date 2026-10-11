export const AUDIO_SETTINGS = Object.freeze({
  masterVolume: 0.65,
  smoothingSeconds: 0.65,
  startStopSeconds: 0.18,
  startTimeoutMs: 15000
});

export const MAX_AUDIO_SOURCES = 2;
const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const validGain = value => Number.isFinite(value) && value >= 0 && value <= 1;
const requireAudio = (condition, field, rule) => {
  if (!condition) throw new Error(`Ongeldige audioconfiguratie: ${field} ${rule}.`);
};

// URLs are page-relative local files; no network URLs or inline media.
export function validateAudioConfig(audio) {
  if (audio === undefined) return { sources: [] };
  requireAudio(audio !== null && typeof audio === 'object' && !Array.isArray(audio), 'audio', 'moet een object zijn');
  requireAudio(Array.isArray(audio.sources), 'audio.sources', 'moet een lijst zijn');
  requireAudio(audio.sources.length <= MAX_AUDIO_SOURCES, 'audio.sources', `ondersteunt momenteel maximaal ${MAX_AUDIO_SOURCES} bronnen`);
  const ids = new Set();
  for (const [index, source] of audio.sources.entries()) {
    const field = `audio.sources[${index}]`;
    requireAudio(source !== null && typeof source === 'object' && !Array.isArray(source), field, 'moet een object zijn');
    requireAudio(typeof source.id === 'string' && idPattern.test(source.id), `${field}.id`, 'moet een geldige kleine-letter-ID zijn');
    requireAudio(!ids.has(source.id), `${field}.id`, `is dubbel gebruikt: ${source.id}`);
    ids.add(source.id);
    requireAudio(source.type === 'global' || source.type === 'proximity', `${field}.type`, 'moet global of proximity zijn');
    requireAudio(typeof source.url === 'string' && /^(\.\.?\/|\/(?!\/))[^?#\s\\]+(?:\/[^?#\s\\]+)*\.mp3(?:\?[^#\s\\]*)?$/i.test(source.url), `${field}.url`, 'moet een lokaal pad naar een MP3 zijn');
    requireAudio(source.loop === undefined || typeof source.loop === 'boolean', `${field}.loop`, 'moet true of false zijn indien opgegeven');
    requireAudio(validGain(source.gain), `${field}.gain`, 'moet eindig zijn tussen 0 en 1');
    if (source.type === 'proximity') {
      requireAudio(typeof source.distanceKey === 'string' && idPattern.test(source.distanceKey), `${field}.distanceKey`, 'moet een geldige afstandssleutel zijn');
      const distance = source.distance;
      requireAudio(distance !== null && typeof distance === 'object' && !Array.isArray(distance), `${field}.distance`, 'moet grenzen bevatten');
      requireAudio(Number.isFinite(distance.fadeStart) && Number.isFinite(distance.fullVolume) && distance.fadeStart > distance.fullVolume && distance.fullVolume >= 0, `${field}.distance`, 'vereist 0 <= fullVolume < fadeStart met eindige waarden');
    } else {
      requireAudio(source.distanceKey === undefined && source.distance === undefined, field, 'mag als globale bron geen afstandsinstellingen bevatten');
    }
  }
  return audio;
}

export function validateAudioSettings(settings) {
  requireAudio(validGain(settings.masterVolume), 'masterVolume', 'moet eindig zijn tussen 0 en 1');
  requireAudio(Number.isFinite(settings.smoothingSeconds) && settings.smoothingSeconds > 0, 'smoothingSeconds', 'moet positief en eindig zijn');
  requireAudio(Number.isFinite(settings.startStopSeconds) && settings.startStopSeconds > 0, 'startStopSeconds', 'moet positief en eindig zijn');
  requireAudio(Number.isFinite(settings.startTimeoutMs) && settings.startTimeoutMs > 0, 'startTimeoutMs', 'moet positief en eindig zijn');
  return settings;
}

export function mixAtDistance(distance, { fadeStart, fullVolume }) {
  if (!Number.isFinite(distance)) return 0;
  const t = Math.max(0, Math.min(1, (fadeStart - distance) / (fadeStart - fullVolume)));
  return t * t * (3 - 2 * t);
}

// Temporary WP1 compatibility for callers using the original energy-core curve.
export function coreMixAtDistance(distance, settings = { fadeStartDistance: 90, fullVolumeDistance: 12 }) {
  return mixAtDistance(distance, { fadeStart: settings.fadeStartDistance, fullVolume: settings.fullVolumeDistance });
}
