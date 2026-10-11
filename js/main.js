const status = document.querySelector('#status');
let engine, audio, audioPanel, flightPanel, manager;
try {
  // Only this page adapter knows its DOM selectors and production world list.
  const [{ createEngine }, { createNeonCity }, { createFlightPanel }, { createAudioManager },
    { createAudioPanel }, { createWorldRegistry }, { createWorldManager }] = await Promise.all([
    import('./engine.js?v=wp4'), import('./worlds/neon-city/world.js?v=wp4'),
    import('./ui/flight-panel.js?v=wp4'), import('./audio/audio-manager.js?v=wp3'),
    import('./audio/audio-panel.js?v=wp3'), import('./world-registry.js?v=wp3'),
    import('./world-manager.js?v=wp3')
  ]);
  engine = createEngine(document.querySelector('#world'), {
    ui: { status, performance: document.querySelector('#performance'), canvasLabel: '3D-stad. Gebruik de toetsenlegenda om vrij te vliegen.' },
    onUpdate(dt, activeWorld) {
      audio?.updateAudioState(activeWorld?.getAudioState() ?? {});
      audioPanel?.update(dt);
    }
  });
  audio = createAudioManager({ audio: { sources: [] }, onChange: () => audioPanel?.render() });
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
  audioPanel = createAudioPanel(audio, {
    elements: {
      start: document.querySelector('#audio-start'), mute: document.querySelector('#audio-mute'),
      slider: document.querySelector('#audio-volume'), volume: document.querySelector('#audio-volume-value'),
      status: document.querySelector('#audio-status'), mix: document.querySelector('#audio-mix')
    },
    focusTarget: engine.canvas
  });
  const registry = createWorldRegistry([{ id: 'neon-city', create: createNeonCity }]);
  manager = createWorldManager({ registry, engine, audio, onChange(state) {
    if (state.error) { status.hidden = false; status.textContent = state.error; }
    else if (state.busy) { status.hidden = false; status.textContent = 'Wereld wordt geladen…'; }
    else if (state.activeId) status.hidden = true;
  } });
  await manager.switchWorld('neon-city');
  audioPanel.setPresentation({ sourceId: engine.getWorld().config.ui?.mixSourceId, label: engine.getWorld().config.ui?.mixLabel });
  engine.start();
  window.addEventListener('pagehide', event => {
    if (!event.persisted) { flightPanel?.dispose(); audioPanel?.dispose(); manager?.dispose().catch(console.error); }
    else audio?.pause();
  });
} catch (error) {
  console.error('Neon City kon niet starten:', error);
  flightPanel?.dispose(); audioPanel?.dispose();
  if (manager) manager.dispose().catch(console.error);
  else { engine?.dispose(); audio?.dispose().catch(console.error); }
  status.hidden = false;
  status.textContent = 'Neon City kon niet starten. Open de map via de Python-webserver (http://localhost:8000), controleer of lib/three compleet is en of WebGL beschikbaar is. Details staan in de browserconsole. ' + error.message;
}
