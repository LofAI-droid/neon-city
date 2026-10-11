const status = document.querySelector('#status');
let engine, audio, audioPanel, flightPanel;
try {
  // The page bootstrap owns DOM selectors; shared engine, controls and modes receive elements or callbacks.
  const [{ createEngine }, { createNeonCity }, { createFlightPanel }] = await Promise.all([
    import('./engine.js?v=wp2'), import('./worlds/neon-city/world.js?v=wp2'), import('./ui/flight-panel.js?v=wp2')
  ]);
  const world = createNeonCity();
  engine = createEngine(document.querySelector('#world'), {
    ui: { status, performance: document.querySelector('#performance'), canvasLabel: '3D-stad. Gebruik de toetsenlegenda om vrij te vliegen.' },
    onUpdate(dt, activeWorld) {
      audio?.updateAudioState(activeWorld?.getAudioState() ?? {});
      audioPanel?.update(dt);
    }
  });
  flightPanel = createFlightPanel({
    engine, controls: engine.controls, modes: engine.flightModes, canvas: engine.canvas,
    labels: { unsafeEntry: 'Geen veilige aanloop. Vlieg eerst naar de vrije straat.' },
    elements: {
      mouse: document.querySelector('#mouse-toggle'), reset: document.querySelector('#reset'),
      quality: document.querySelector('#quality-toggle'), journey: document.querySelector('#journey-toggle'),
      progress: document.querySelector('#journey-progress'), status: document.querySelector('#journey-status'),
      modeLabel: document.querySelector('#flight-mode-label')
    }
  });
  engine.setWorld(world);
  engine.start();
  try {
    const [{ createAudioManager }, { createAudioPanel }] = await Promise.all([
      import('./audio/audio-manager.js?v=wp2'), import('./audio/audio-panel.js?v=wp2')
    ]);
    audio = createAudioManager({ audio: world.config.audio, onChange: () => audioPanel?.render() });
    audioPanel = createAudioPanel(audio, {
      elements: {
        start: document.querySelector('#audio-start'), mute: document.querySelector('#audio-mute'),
        slider: document.querySelector('#audio-volume'), volume: document.querySelector('#audio-volume-value'),
        status: document.querySelector('#audio-status'), mix: document.querySelector('#audio-mix')
      },
      focusTarget: engine.canvas,
      mixSourceId: world.config.ui?.mixSourceId, mixLabel: world.config.ui?.mixLabel
    });
  } catch (error) {
    console.error('Audio-interface kon niet starten:', error);
    document.querySelector('#audio-status').textContent = 'Audio is niet beschikbaar. De stad blijft bruikbaar. ' + error.message;
    document.querySelector('#audio-start').disabled = true;
  }
  window.addEventListener('pagehide', event => {
    if (!event.persisted) { flightPanel?.dispose(); engine.dispose(); audioPanel?.dispose(); audio?.dispose().catch(console.error); }
    else audio?.pause();
  });
} catch (error) {
  console.error('Neon City kon niet starten:', error);
  flightPanel?.dispose(); engine?.dispose(); audioPanel?.dispose(); audio?.dispose().catch(console.error);
  status.hidden = false;
  status.textContent = 'Neon City kon niet starten. Open de map via de Python-webserver (http://localhost:8000), controleer of lib/three compleet is en of WebGL beschikbaar is. Details staan in de browserconsole. ' + error.message;
}
