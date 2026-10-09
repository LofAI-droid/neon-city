const status = document.querySelector('#status');
let engine;
try {
  // Dynamic imports also surface missing local modules in the visible error message.
  const [{ createEngine }, { createNeonCity }] = await Promise.all([
    import('./engine.js'), import('./worlds/neon-city/world.js')
  ]);
  engine = createEngine(document.querySelector('#world'));
  engine.setWorld(createNeonCity());
  engine.start();
  window.addEventListener('pagehide', event => { if (!event.persisted) engine.dispose(); });
} catch (error) {
  console.error('Neon City kon niet starten:', error);
  engine?.dispose();
  status.hidden = false;
  status.textContent = 'Neon City kon niet starten. Open de map via de Python-webserver (http://localhost:8000), controleer of lib/three compleet is en of WebGL beschikbaar is. Details staan in de browserconsole.';
}
