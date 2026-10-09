export function createAudioPanel(manager) {
  const start = document.querySelector('#audio-start');
  const mute = document.querySelector('#audio-mute');
  const slider = document.querySelector('#audio-volume');
  const volume = document.querySelector('#audio-volume-value');
  const status = document.querySelector('#audio-status');
  const mix = document.querySelector('#audio-mix');
  const events = new AbortController();
  let elapsed = 0;
  const text = (element, value) => { if (element.textContent !== value) element.textContent = value; };
  function render() {
    const current = manager.getState();
    start.disabled = current.state === 'starting' || current.state === 'pausing';
    text(start, current.state === 'playing' ? (current.contextState === 'running' ? 'Pauzeer audio' : 'Hervat audio') : 'Start audio');
    text(mute, current.muted ? 'Unmute' : 'Mute');
    mute.setAttribute('aria-pressed', String(current.muted));
    const sliderValue = String(Math.round(current.volume * 100));
    if (slider.value !== sliderValue) slider.value = sliderValue;
    volume.value = `${slider.value}%`;
    text(status, current.message);
    text(mix, `Kernmix: ${Math.round(current.coreMix * 100)}%`);
  }
  start.addEventListener('click', () => {
    const current = manager.getState();
    if (current.state === 'playing' && current.contextState === 'running') manager.pause();
    else manager.start();
    start.blur(); document.querySelector('#world canvas')?.focus({ preventScroll: true });
  }, { signal: events.signal });
  mute.addEventListener('click', () => {
    manager.setMuted(!manager.getState().muted);
    mute.blur(); document.querySelector('#world canvas')?.focus({ preventScroll: true });
  }, { signal: events.signal });
  slider.addEventListener('input', () => manager.setVolume(Number(slider.value) / 100), { signal: events.signal });
  render();
  return { render, update(dt) { elapsed += dt; if (elapsed >= 0.2) { elapsed = 0; render(); } }, dispose() { events.abort(); } };
}
