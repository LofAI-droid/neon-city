// DOM adapter: shared camera and mode logic only expose methods and state.
export function createFlightPanel({ controls, modes, engine, canvas, elements, labels = {} }) {
  const { mouse, reset, quality, journey, progress, status, modeLabel } = elements;
  const events = new AbortController();
  const focus = () => canvas.focus({ preventScroll: true });
  const text = (element, value) => { if (element && element.textContent !== value) element.textContent = value; };
  const guidedLabel = labels.guided ?? 'Guided Journey';
  const freeLabel = labels.free ?? 'Terug naar Free Flight';
  function render(state) {
    text(modeLabel, state.mode === 'free' ? labels.freeHeading ?? 'VRIJE VLUCHT' : labels.guidedHeading ?? 'GUIDED JOURNEY');
    if (journey) { journey.disabled = !state.available; text(journey, state.mode === 'free' ? guidedLabel : freeLabel); }
    if (progress) { progress.hidden = state.mode === 'free'; progress.max = state.duration ?? 0; progress.value = state.elapsed ?? 0; }
    const message = state.notice === 'unsafe-entry' ? (labels.unsafeEntry ?? 'Geen veilige aanloop. Kies een vrije plek.')
      : state.notice === 'invalid-camera' || state.notice === 'invalid-velocity' ? (labels.invalidCamera ?? 'Journey kan niet starten: ongeldige camerastand of vliegsnelheid.')
      : state.notice === 'invalid-entry' ? (labels.invalidEntry ?? 'Journey kan niet starten: ongeldige aanloop.')
      : state.mode === 'free' ? (labels.freeStatus ?? 'Vrij vliegen')
      : state.hidden ? (labels.paused ?? 'Journey gepauzeerd — tab verborgen')
      : state.notice === 'velocity-fallback' ? (labels.velocityFallback ?? 'Aanloop begint voorzichtig zonder meegenomen vliegsnelheid…')
      : state.phase === 'entry' ? (labels.entry ?? 'Vloeiend naar het starttraject…')
      : `${guidedLabel} · ${Math.floor(state.elapsed ?? 0)} / ${Math.ceil(state.duration ?? 0)} s`;
    text(status, message);
  }
  modes.setOnChange(render);
  function renderMouse() {
    const enabled = controls.isMouseEnabled();
    mouse?.setAttribute('aria-pressed', String(enabled));
    text(mouse, `${labels.mouse ?? 'Muisblik'}: ${enabled ? 'aan' : 'uit'}`);
  }
  function renderQuality() { text(quality, `${labels.quality ?? 'Beeld'}: ${engine.getQuality().name}`); }
  renderMouse(); renderQuality();
  mouse?.addEventListener('click', () => { controls.setMouseEnabled(!controls.isMouseEnabled()); renderMouse(); mouse.blur(); focus(); }, { signal: events.signal });
  reset?.addEventListener('click', () => { controls.reset(); reset.blur(); focus(); }, { signal: events.signal });
  quality?.addEventListener('click', () => { engine.cycleQuality(); renderQuality(); quality.blur(); focus(); }, { signal: events.signal });
  journey?.addEventListener('click', () => { if (modes.getState().mode === 'free') modes.start(); else modes.stop(); journey.blur(); focus(); }, { signal: events.signal });
  return { render, dispose() { events.abort(); modes.setOnChange(() => {}); } };
}
