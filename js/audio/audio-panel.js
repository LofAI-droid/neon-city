export function createAudioPanel(manager, { elements, focusTarget, mixSourceId, mixLabel = 'Nabijheid', labels = {} }) {
  const { start, mute, slider, volume, status, mix } = elements;
  const events = new AbortController();
  let elapsed = 0;
  const text = (element, value) => { if (element.textContent !== value) element.textContent = value; };
  function render() {
    const current = manager.getState();
    start.disabled = !current.sourceCount || current.state === 'starting' || current.state === 'pausing';
    text(start, current.state === 'playing' ? (current.contextState === 'running' ? labels.pause ?? 'Pauzeer audio' : labels.resume ?? 'Hervat audio') : labels.start ?? 'Start audio');
    text(mute, current.muted ? labels.unmute ?? 'Unmute' : labels.mute ?? 'Mute');
    mute.setAttribute('aria-pressed', String(current.muted));
    const sliderValue = String(Math.round(current.volume * 100));
    if (slider.value !== sliderValue) slider.value = sliderValue;
    volume.value = `${slider.value}%`;
    text(status, current.message);
    if (mix) { mix.hidden = !mixSourceId; if (mixSourceId) text(mix, `${mixLabel}: ${Math.round((current.sourceMixes[mixSourceId] ?? 0) * 100)}%`); }
  }
  start.addEventListener('click', () => {
    const current = manager.getState();
    if (current.state === 'playing' && current.contextState === 'running') manager.pause();
    else manager.start();
    start.blur(); focusTarget?.focus({ preventScroll: true });
  }, { signal: events.signal });
  mute.addEventListener('click', () => {
    manager.setMuted(!manager.getState().muted);
    mute.blur(); focusTarget?.focus({ preventScroll: true });
  }, { signal: events.signal });
  slider.addEventListener('input', () => manager.setVolume(Number(slider.value) / 100), { signal: events.signal });
  render();
  return { render, update(dt) { elapsed += dt; if (elapsed >= 0.2) { elapsed = 0; render(); } }, dispose() { events.abort(); } };
}
