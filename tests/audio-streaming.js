import { createAudioManager } from '../js/audio/audio-manager.js';
const output = document.querySelector('#results');
const startButton = document.querySelector('#start'), resumeButton = document.querySelector('#resume'), missingButton = document.querySelector('#missing');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const append = text => { const p = document.createElement('p'); p.textContent = text; output.appendChild(p); };
const check = (label, value) => append(`${value ? 'PASS' : 'FAIL'} — ${label}`);
const manager = createAudioManager({ settings: { cityUrl: '../assets/audio/city-ambient.mp3', coreUrl: '../assets/audio/energy-core.mp3', masterVolume: 0 } });
let pausedTimes;
startButton.addEventListener('click', async () => {
  startButton.disabled = true; output.replaceChildren();
  const startPromise = manager.start();
  await startPromise;
  check('Safari start beide echte MP3-bestanden', manager.getState().state === 'playing');
  if (manager.getState().state !== 'playing') { append(manager.getState().message); return; }
  const before = manager.getPlaybackState();
  manager.updateDistance(0); manager.setMuted(true);
  await sleep(1400);
  manager.updateDistance(200);
  const after = manager.getPlaybackState();
  check('Beide onafhankelijke loops lopen ook stil door', after.every((track, i) => track.loop && !track.paused && track.time > before[i].time));
  check('Nabijheid wijzigt de tijdlijnen niet naar nul', after.every(track => track.time > 0.5) && manager.getState().coreMix === 0);
  append(`INFO — afspeeltijden ${after.map(track => track.time.toFixed(2)).join(' / ')} s; duur ${after.map(track => track.duration.toFixed(1)).join(' / ')} s`);
  await manager.pause(); pausedTimes = manager.getPlaybackState(); await sleep(500);
  check('Pauze stopt beide spelers op hun huidige tijd', manager.getPlaybackState().every((track, i) => track.paused && Math.abs(track.time - pausedTimes[i].time) < 0.05));
  resumeButton.disabled = false;
});
resumeButton.addEventListener('click', async () => {
  resumeButton.disabled = true;
  await manager.start(); await sleep(1200);
  check('Safari hervat beide tracks na een nieuwe klik', manager.getState().state === 'playing' && manager.getPlaybackState().every((track, i) => !track.paused && track.time > pausedTimes[i].time));
  await manager.pause();
});
missingButton.addEventListener('click', async () => {
  missingButton.disabled = true;
  const failing = createAudioManager({ settings: { cityUrl: '../assets/audio/__ontbrekend_testbestand__.mp3', coreUrl: '../assets/audio/energy-core.mp3', masterVolume: 0 } });
  await failing.start();
  check('Ontbrekende MP3 geeft begrijpelijke foutstatus', failing.getState().state === 'error' && /kan niet|kon niet/.test(failing.getState().message));
  append(failing.getState().message);
  await failing.dispose();
});
window.addEventListener('pagehide', () => manager.dispose().catch(console.error));
