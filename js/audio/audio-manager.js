import { AUDIO_SETTINGS, validateAudioConfig, validateAudioSettings, mixAtDistance } from './audio-settings.js?v=wp2';

export function createAudioManager({ audio, settings: overrides = {}, onChange = () => {}, createContext = () => new (window.AudioContext || window.webkitAudioContext)(), createElement = () => document.createElement('audio') } = {}) {
  const copySources = value => validateAudioConfig(value).sources.map(source => ({ ...source, distance: source.distance && { ...source.distance } }));
  let descriptors = copySources(audio);
  const settings = validateAudioSettings({ ...AUDIO_SETTINGS, ...overrides });
  const makeTracks = sources => sources.map(descriptor => ({ descriptor, element: null, gain: null, node: null, mix: descriptor.type === 'global' ? 1 : 0, lastMix: -1 }));
  let tracks = makeTracks(descriptors);
  let proximity = tracks.filter(track => track.descriptor.type === 'proximity');
  let context, master;
  let state = 'idle', muted = false, volume = settings.masterVolume;
  let distances = {}, message = tracks.length ? 'Audio staat uit.' : 'Deze wereld heeft geen audio.';
  let generation = 0, stopTimer, startTimer, finishStop, finishStartTimeout, switching = false;
  let graphEvents;
  const snapshot = () => ({
    state, muted, volume, sourceCount: tracks.length, distances: { ...distances },
    sourceMixes: Object.fromEntries(tracks.map(track => [track.descriptor.id, track.mix])),
    // Temporary WP1 compatibility for the single Neon City proximity source.
    distance: proximity.length === 1 ? distances[proximity[0].descriptor.distanceKey] ?? Infinity : Infinity,
    coreMix: tracks.find(track => track.descriptor.id === 'energy-core')?.mix ?? 0,
    message, contextState: context?.state ?? 'uninitialized'
  });
  const emit = () => onChange(snapshot());
  const hold = param => {
    const now = context.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { const value = param.value; param.cancelScheduledValues(now); param.setValueAtTime(value, now); }
    return now;
  };
  function masterTarget() {
    if (!master) return;
    const now = hold(master.gain);
    master.gain.setTargetAtTime(state === 'playing' && !muted ? volume : 0, now, settings.startStopSeconds / 3);
  }
  function cancelTimers() {
    clearTimeout(stopTimer); clearTimeout(startTimer);
    finishStop?.(); finishStop = null;
    finishStartTimeout?.(); finishStartTimeout = null;
  }
  function fail(text) {
    if (state === 'disposed') return;
    generation++; cancelTimers();
    for (const track of tracks) track.element?.pause();
    state = 'error'; message = text; masterTarget(); emit();
  }
  function initialize() {
    if (context && tracks.every(track => track.node)) return;
    graphEvents = new AbortController();
    if (!context) {
      context = createContext();
      master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
    }
    for (const track of tracks) {
      const { descriptor } = track;
      track.gain = context.createGain();
      track.gain.gain.value = descriptor.gain * track.mix;
      track.gain.connect(master);
      track.element = createElement();
      track.element.loop = descriptor.loop ?? true; track.element.preload = 'none'; track.element.src = descriptor.url;
      track.element.addEventListener('error', () => fail(`Audiobron ${descriptor.id} kan niet worden gelezen. Controleer ${descriptor.url} en druk opnieuw op Start audio.`), { signal: graphEvents.signal });
      track.node = context.createMediaElementSource(track.element);
      track.node.connect(track.gain);
    }
    context.addEventListener('statechange', () => {
      if (state === 'playing') {
        message = context.state === 'running' ? 'Audio speelt; nabijheidslagen volgen je afstand.' : 'Audio onderbroken door de browser. Druk op Hervat audio.';
        emit();
      }
    }, { signal: graphEvents.signal });
  }
  function releaseSources() {
    graphEvents?.abort(); graphEvents = null;
    for (const track of tracks) {
      if (track.element) { track.element.pause(); track.element.removeAttribute('src'); track.element.load(); }
      track.node?.disconnect(); track.gain?.disconnect();
      track.element = null; track.node = null; track.gain = null; track.lastMix = -1;
    }
  }
  async function releaseGraph() {
    releaseSources();
    master?.disconnect(); master = null;
    const oldContext = context; context = null;
    if (oldContext && oldContext.state !== 'closed') await oldContext.close();
  }
  const manager = {
    getState: snapshot,
    getPlaybackState() {
      return tracks.map(({ descriptor, element }) => element ? ({ id: descriptor.id, time: element.currentTime, duration: element.duration, paused: element.paused, loop: element.loop, readyState: element.readyState }) : null);
    },
    // Call only from a Start/Hervat button or another explicit user gesture.
    async start() {
      if (state === 'disposed' || state === 'starting' || switching) return;
      if (!tracks.length) { state = 'empty'; emit(); return; }
      if (state === 'playing' && context?.state === 'running') return;
      cancelTimers(); const token = ++generation;
      try {
        initialize();
        for (const track of tracks) if (track.element.error) track.element.load();
        state = 'starting'; message = 'Lokale muziek wordt gestart…'; masterTarget(); emit();
        // Resume and every play() run synchronously inside the user's gesture.
        const play = ({ descriptor, element }) => element.play().catch(error => {
          const reason = error.name === 'NotAllowedError' ? 'Safari heeft afspelen geweigerd. Klik opnieuw op Start audio.' : `Controleer of ${descriptor.url} aanwezig is en een leesbare MP3 bevat.`;
          throw new Error(`Audiobron ${descriptor.id} kon niet afspelen. ${reason} (${error.message})`);
        });
        const attempts = [context.resume(), ...tracks.map(play)];
        const timeout = new Promise((_, reject) => {
          finishStartTimeout = () => reject(new Error('Audio starten geannuleerd.'));
          startTimer = setTimeout(() => reject(new Error('Audio laden duurt te lang. Controleer de lokale MP3-bestanden en probeer opnieuw.')), settings.startTimeoutMs);
        });
        await Promise.race([Promise.all(attempts), timeout]);
        clearTimeout(startTimer); finishStartTimeout = null;
        if (token !== generation || state === 'disposed') return;
        state = 'playing'; message = 'Audio speelt; nabijheidslagen volgen je afstand.'; masterTarget(); emit();
      } catch (error) {
        if (token !== generation || state === 'disposed') return;
        if (graphEvents && (!context || !master || tracks.some(track => !track.node))) {
          try { await releaseGraph(); } catch (cleanupError) { console.error('Audio-opruimen na startfout:', cleanupError); }
        }
        if (token !== generation || state === 'disposed') return;
        fail(`Audio kon niet starten: ${error.message || 'Safari heeft afspelen geweigerd.'}`);
      }
    },
    async pause() {
      if (state === 'disposed' || switching || !context || state === 'paused' || state === 'idle') return;
      const token = ++generation; cancelTimers();
      state = 'pausing'; message = 'Audio wordt zacht gepauzeerd…'; emit();
      const now = hold(master.gain);
      master.gain.linearRampToValueAtTime(0, now + settings.startStopSeconds);
      await new Promise(resolve => { finishStop = resolve; stopTimer = setTimeout(resolve, settings.startStopSeconds * 1000 + 30); });
      finishStop = null;
      if (token !== generation || state === 'disposed') return;
      for (const track of tracks) track.element.pause();
      state = 'paused'; message = 'Audio gepauzeerd; opnieuw starten gaat verder waar je was.';
      emit();
    },
    setMuted(value) { if (state === 'disposed') return; muted = Boolean(value); masterTarget(); emit(); },
    setVolume(value) { if (state === 'disposed' || !Number.isFinite(value)) return; volume = Math.max(0, Math.min(1, value)); masterTarget(); emit(); },
    updateDistances(values = {}) {
      if (state === 'disposed') return;
      distances = values && typeof values === 'object' && !Array.isArray(values) ? { ...values } : {};
      for (const track of proximity) {
        const distance = distances[track.descriptor.distanceKey];
        track.mix = mixAtDistance(distance, track.descriptor.distance);
        if (!track.gain || (Math.abs(track.mix - track.lastMix) < 0.0001 && !(track.mix === 0 && track.lastMix !== 0))) continue;
        track.lastMix = track.mix;
        track.gain.gain.setTargetAtTime(track.descriptor.gain * track.mix, context.currentTime, settings.smoothingSeconds);
      }
    },
    updateAudioState(value = {}) {
      if (value.distances !== undefined) { manager.updateDistances(value.distances); return; }
      if (value.proximityDistance !== undefined) { manager.updateDistance(value.proximityDistance); return; }
      manager.updateDistances({});
    },
    // Temporary WP1 compatibility; ambiguous for multiple proximity sources.
    updateDistance(value) {
      if (proximity.length > 1) throw new Error('updateDistance ondersteunt slechts één proximity-bron; gebruik updateDistances met distanceKey.');
      manager.updateDistances(proximity.length ? { [proximity[0].descriptor.distanceKey]: value } : {});
    },
    // A world switch changes source ownership, never the shared AudioContext or master settings.
    // Callers must request a fresh user click before playing the new sources in Safari.
    async setSources(nextAudio, { fadeSeconds = settings.startStopSeconds } = {}) {
      const next = copySources(nextAudio); // Validate before touching active playback.
      if (state === 'disposed') throw new Error('Audio is al opgeruimd.');
      if (switching) throw new Error('Audiobronnen worden al gewisseld.');
      if (!Number.isFinite(fadeSeconds) || fadeSeconds < 0) throw new Error('Ongeldige audio-fadeduur.');
      switching = true;
      const token = ++generation;
      cancelTimers();
      state = 'switching'; message = 'Audio wisselt van wereld…'; emit();
      try {
        if (master && tracks.length && fadeSeconds > 0) {
          const now = hold(master.gain);
          master.gain.linearRampToValueAtTime(0, now + fadeSeconds);
          await new Promise(resolve => { finishStop = resolve; stopTimer = setTimeout(resolve, fadeSeconds * 1000 + 30); });
          finishStop = null;
        }
        if (token !== generation || state === 'disposed') return false;
        releaseSources();
        descriptors = next;
        tracks = makeTracks(descriptors);
        proximity = tracks.filter(track => track.descriptor.type === 'proximity');
        distances = {};
        state = tracks.length ? 'idle' : 'empty';
        message = tracks.length ? 'Nieuwe wereld geladen. Klik Start audio.' : 'Deze wereld heeft geen audio.';
        emit();
        return true;
      } finally { switching = false; }
    },
    async dispose() {
      if (state === 'disposed') return;
      state = 'disposed'; generation++; cancelTimers();
      await releaseGraph();
    }
  };
  return manager;
}
