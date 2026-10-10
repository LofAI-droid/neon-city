const status = document.querySelector('#status');
let engine;
let audio;
let audioPanel;
try {
  // Dynamic imports also surface missing local modules in the visible error message.
  const [{ createEngine }, { createNeonCity }] = await Promise.all([
    import('./engine.js?v=0.4B'), import('./worlds/neon-city/world.js?v=0.4B')
  ]);
  try {
    const [{ createAudioManager }, { createAudioPanel }] = await Promise.all([
      import('./audio/audio-manager.js'), import('./audio/audio-panel.js')
    ]);
    audio = createAudioManager({ onChange: () => audioPanel?.render() });
    audioPanel = createAudioPanel(audio);
  } catch (error) {
    console.error('Audio-interface kon niet starten:', error);
    document.querySelector('#audio-status').textContent = 'Audio is niet beschikbaar. De stad blijft bruikbaar.';
    document.querySelector('#audio-start').disabled = true;
  }
  engine = createEngine(document.querySelector('#world'), { onUpdate(dt, world) {
    audio?.updateDistance(world?.getEnergyDistance?.() ?? Infinity);
    audioPanel?.update(dt);
  } });
  engine.setWorld(createNeonCity());
  engine.start();
  window.addEventListener('pagehide', event => {
    if (!event.persisted) { engine.dispose(); audioPanel?.dispose(); audio?.dispose().catch(console.error); }
    else audio?.pause();
  });
} catch (error) {
  console.error('Neon City kon niet starten:', error);
  engine?.dispose();
  status.hidden = false;
  status.textContent = 'Neon City kon niet starten. Open de map via de Python-webserver (http://localhost:8000), controleer of lib/three compleet is en of WebGL beschikbaar is. Details staan in de browserconsole. ' + error.message;
}
