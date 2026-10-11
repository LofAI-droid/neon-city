// Sole coordinator for scene, camera, Journey and audio transitions.
// The engine still owns low-level rendering and world initialization.
export function createWorldManager({ registry, engine, audio, onChange = () => {} }) {
  let activeId = null, busy = false, disposed = false, error = null;
  const snapshot = () => ({ activeId, busy, disposed, error });
  const emit = () => onChange(snapshot());
  const manager = {
    getState: snapshot,
    async switchWorld(id) {
      if (disposed) throw new Error('World Manager is al opgeruimd.');
      if (busy) throw new Error('Een wereldwissel is al bezig. Probeer het straks opnieuw.');
      if (id === activeId && engine.getWorld()) return false;
      busy = true; error = null; emit();
      let candidate, touched = false;
      try {
        candidate = registry.create(id); // All predictable errors leave the old world intact.
        engine.suspendWorld();
        touched = true;
        const audioReady = await audio.setSources(candidate.config.audio);
        if (disposed) { candidate.dispose(); return false; }
        if (!audioReady) throw new Error('Audiowissel werd geannuleerd.');
        const next = candidate; candidate = null;
        engine.setWorld(next); // Owns old-world dispose and partial-init cleanup.
        activeId = id;
        emit();
        return true;
      } catch (cause) {
        if (candidate && engine.getWorld() !== candidate) {
          try { candidate.dispose(); } catch (cleanupError) { console.error('Kandidaatwereld opruimen:', cleanupError); }
        }
        if (touched && engine.getWorld()) engine.resumeWorld();
        else if (touched) activeId = null;
        error = `Wereldwissel naar ${id} mislukt: ${cause.message}`;
        emit();
        throw cause;
      } finally {
        busy = false;
        if (!disposed) emit();
      }
    },
    async dispose() {
      if (disposed) return;
      disposed = true; activeId = null; error = null; emit();
      try { engine.dispose(); }
      finally { await audio.dispose(); }
    }
  };
  return manager;
}
