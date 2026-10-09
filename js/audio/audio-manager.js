import { AUDIO_SETTINGS, coreMixAtDistance } from './audio-settings.js';

export function createAudioManager({ settings: overrides = {}, onChange = () => {}, createContext = () => new (window.AudioContext || window.webkitAudioContext)(), createElement = () => document.createElement('audio') } = {}) {
  const settings = { ...AUDIO_SETTINGS, ...overrides };
  if (!(settings.fadeStartDistance > settings.fullVolumeDistance && settings.fullVolumeDistance >= 0 && settings.smoothingSeconds > 0 && settings.startStopSeconds > 0)) throw new Error('Ongeldige audio-afstandsgrenzen of fade-tijden.');
  let context, master, cityGain, coreGain, city, core, sources;
  let state = 'idle', muted = false, volume = settings.masterVolume;
  let distance = Infinity, mix = 0, lastMix = -1, message = 'Audio staat uit.';
  let generation = 0, stopTimer, startTimer, finishStop, finishStartTimeout;
  const events = new AbortController();
  const snapshot = () => ({ state, muted, volume, distance, coreMix: mix, message, contextState: context?.state ?? 'uninitialized' });
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
    city?.pause(); core?.pause();
    state = 'error'; message = text; masterTarget(); emit();
  }
  function initialize() {
    if (context) return;
    context = createContext();
    master = context.createGain(); cityGain = context.createGain(); coreGain = context.createGain();
    master.gain.value = 0; cityGain.gain.value = settings.cityVolume; coreGain.gain.value = settings.coreVolume * mix;
    master.connect(context.destination); cityGain.connect(master); coreGain.connect(master);
    city = createElement(); core = createElement();
    for (const [element, url, label] of [[city, settings.cityUrl, 'Stadsmuziek'], [core, settings.coreUrl, 'Kernmuziek']]) {
      element.loop = true; element.preload = 'none'; element.src = url;
      element.addEventListener('error', () => fail(`${label} kan niet worden gelezen. Controleer ${url} in assets/audio/ en druk opnieuw op Start audio.`), { signal: events.signal });
    }
    sources = [context.createMediaElementSource(city), context.createMediaElementSource(core)];
    sources[0].connect(cityGain); sources[1].connect(coreGain);
    context.addEventListener('statechange', () => {
      if (state === 'playing') {
        message = context.state === 'running' ? 'Stadsmuziek speelt; de kernlaag volgt je afstand.' : 'Audio onderbroken door de browser. Druk op Hervat audio.';
        emit();
      }
    }, { signal: events.signal });
  }
  const manager = {
    getState: snapshot,
    getPlaybackState() {
      return [city, core].map(element => element ? ({ time: element.currentTime, duration: element.duration, paused: element.paused, loop: element.loop, readyState: element.readyState }) : null);
    },
    // Call only from a Start/Hervat button or another explicit user gesture.
    async start() {
      if (state === 'disposed' || state === 'starting') return;
      if (state === 'playing' && context?.state === 'running') return;
      cancelTimers(); const token = ++generation;
      try {
        initialize();
        for (const element of [city, core]) if (element.error) element.load();
        state = 'starting'; message = 'Lokale muziek wordt gestart…'; masterTarget(); emit();
        // All three calls happen synchronously in the user gesture, before await.
        const play = (element, label, url) => element.play().catch(error => {
          const reason = error.name === 'NotAllowedError' ? 'Safari heeft afspelen geweigerd. Klik opnieuw op Start audio.' : `Controleer of ${url} aanwezig is en een leesbare MP3 bevat.`;
          throw new Error(`${label} kon niet afspelen. ${reason} (${error.message})`);
        });
        const attempts = [context.resume(), play(city, 'Stadsmuziek', settings.cityUrl), play(core, 'Kernmuziek', settings.coreUrl)];
        const timeout = new Promise((_, reject) => {
          finishStartTimeout = () => reject(new Error('Audio starten geannuleerd.'));
          startTimer = setTimeout(() => reject(new Error('Audio laden duurt te lang. Controleer de lokale MP3-bestanden en probeer opnieuw.')), settings.startTimeoutMs);
        });
        await Promise.race([Promise.all(attempts), timeout]);
        clearTimeout(startTimer); finishStartTimeout = null;
        if (token !== generation || state === 'disposed') return;
        state = 'playing'; message = 'Stadsmuziek speelt; de kernlaag volgt je afstand.'; masterTarget(); emit();
      } catch (error) {
        if (token !== generation || state === 'disposed') return;
        fail(`Audio kon niet starten: ${error.message || 'Safari heeft afspelen geweigerd.'}`);
      }
    },
    async pause() {
      if (state === 'disposed' || !context || state === 'paused' || state === 'idle') return;
      const token = ++generation; cancelTimers();
      state = 'pausing'; message = 'Audio wordt zacht gepauzeerd…'; emit();
      const now = hold(master.gain);
      master.gain.linearRampToValueAtTime(0, now + settings.startStopSeconds);
      await new Promise(resolve => { finishStop = resolve; stopTimer = setTimeout(resolve, settings.startStopSeconds * 1000 + 30); });
      finishStop = null;
      if (token !== generation || state === 'disposed') return;
      city.pause(); core.pause();
      state = 'paused'; message = 'Audio gepauzeerd; opnieuw starten gaat verder waar je was.';
      // Keep the context running silently; Safari resume is reserved for user gestures.
      emit();
    },
    setMuted(value) { if (state === 'disposed') return; muted = Boolean(value); masterTarget(); emit(); },
    setVolume(value) { if (state === 'disposed' || !Number.isFinite(value)) return; volume = Math.max(0, Math.min(1, value)); masterTarget(); emit(); },
    updateDistance(value) {
      if (state === 'disposed') return;
      distance = Number.isFinite(value) ? Math.max(0, value) : Infinity;
      mix = coreMixAtDistance(distance, settings);
      if (!coreGain || (Math.abs(mix - lastMix) < 0.0001 && !(mix === 0 && lastMix !== 0))) return;
      lastMix = mix;
      coreGain.gain.setTargetAtTime(settings.coreVolume * mix, context.currentTime, settings.smoothingSeconds);
    },
    async dispose() {
      if (state === 'disposed') return;
      state = 'disposed'; generation++; cancelTimers(); events.abort();
      for (const element of [city, core]) if (element) { element.pause(); element.removeAttribute('src'); element.load(); }
      for (const node of [...(sources || []), cityGain, coreGain, master]) node?.disconnect();
      if (context && context.state !== 'closed') await context.close();
    }
  };
  return manager;
}
