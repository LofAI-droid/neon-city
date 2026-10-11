import * as THREE from '../lib/three/three.module.js';
import { createFlightModes } from '../js/journey/flight-modes.js?v=wp2';
import { createNeonCityRoute } from '../js/worlds/neon-city/journey-route.js?v=wp1';
import { createAudioManager } from '../js/audio/audio-manager.js?v=wp3';
import { coreMixAtDistance } from '../js/audio/audio-settings.js?v=wp2';
import { NEON_CITY_CONFIG } from '../js/worlds/neon-city/config.js?v=wp2';

export async function testAudio(check) {
  let contexts = 0, sources = 0, playCalls = 0, closed = 0, disconnected = 0;
  const elements = [], gains = [];
  const context = new EventTarget();
  context.currentTime = 1; context.state = 'suspended'; context.destination = {};
  context.resume = () => { context.state = 'running'; return Promise.resolve(); };
  context.close = () => { closed++; context.state = 'closed'; return Promise.resolve(); };
  context.createGain = () => {
    const gain = { value: 0, target: 0, cancelAndHoldAtTime() {}, setTargetAtTime(value) { this.target = value; }, linearRampToValueAtTime(value) { this.target = value; } };
    gains.push(gain); return { gain, connect() {}, disconnect() { disconnected++; } };
  };
  context.createMediaElementSource = element => { sources++; return { connect() {}, disconnect() { disconnected++; } }; };
  const manager = createAudioManager({
    audio: NEON_CITY_CONFIG.audio,
    settings: { startStopSeconds: 0.001 },
    createContext() { contexts++; return context; },
    createElement() {
      const element = new EventTarget(); element.currentTime = 17; element.paused = true; element.error = null;
      element.play = () => { playCalls++; element.paused = false; return Promise.resolve(); };
      element.pause = () => { element.paused = true; };
      element.load = () => {}; element.removeAttribute = () => {};
      elements.push(element); return element;
    }
  });
  manager.updateDistance(0);
  check('Audio: geen context, bron of afspelen vóór Start', contexts === 0 && sources === 0 && playCalls === 0);
  check('Audio: afstandscurve stil buiten 90 en vol binnen 12', coreMixAtDistance(90) === 0 && coreMixAtDistance(200) === 0 && coreMixAtDistance(0) === 1 && coreMixAtDistance(12) === 1);
  check('Audio: vloeiende, begrensde afstandscurve', coreMixAtDistance(51) === 0.5 && coreMixAtDistance(Infinity) === 0 && Math.abs(coreMixAtDistance(90 - 0.001) - coreMixAtDistance(90 + 0.001)) < 1e-8);
  await manager.start();
  check('Audio: twee onafhankelijke loops en gains', elements.length === 2 && elements.every(element => element.loop) && gains.length === 3 && sources === 2 && manager.getState().state === 'playing');
  for (let i = 0; i < 120; i++) manager.updateDistance(i);
  const before = manager.getState().coreMix;
  manager.setMuted(true); manager.updateDistance(51); manager.setVolume(0.35); manager.setMuted(false);
  check('Audio: mute/volume behouden afstand en tijdlijn', manager.getState().coreMix === 0.5 && elements.every(element => element.currentTime === 17) && playCalls === 2 && gains[0].target === 0.35);
  manager.updateDistance(200);
  check('Audio: alleen kernlaag valt weg; stadsgain blijft constant', gains[2].target === 0 && gains[1].value === NEON_CITY_CONFIG.audio.sources[0].gain && playCalls === 2);
  await manager.pause(); await manager.start();
  check('Audio: pauzeren/hervatten hergebruikt context en bronnen', contexts === 1 && sources === 2 && playCalls === 4 && elements.every(element => element.currentTime === 17) && manager.getState().state === 'playing');
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0,7,62);
  const modes = createFlightModes(camera, { getVelocity: out => out.set(0,0,0), setEnabled() {}, update() {} }, { visibility:new EventTarget(), button:null, progress:null, status:null });
  modes.setRoute(createNeonCityRoute([]));
  const callsBeforeJourney = playCalls;
  for (let i=0;i<5;i++) { modes.start(); modes.update(20); manager.updateDistance(camera.position.distanceTo(new THREE.Vector3(0,19,-82))); modes.stop(); }
  modes.start(); modes.update(modes.getState().entryDuration + 90);
  check('Audio: Journey-wissels en voltooiing behouden beide tijdlijnen', playCalls === callsBeforeJourney && elements.every(element => element.currentTime === 17 && !element.paused) && manager.getState().state === 'playing');
  modes.dispose();
  await manager.dispose(); await manager.dispose();
  check('Audio: cleanup sluit context eenmaal en koppelt nodes los', closed === 1 && disconnected === 5 && elements.every(element => element.paused));
  const failing = createAudioManager({ audio: NEON_CITY_CONFIG.audio, createContext: () => context, createElement() {
    const element = new EventTarget(); element.play = () => Promise.reject(new Error('Afspelen geweigerd')); element.pause = () => {}; element.load = () => {}; element.removeAttribute = () => {}; return element;
  } });
  await failing.start();
  check('Audio: afgewezen play wordt zichtbare foutstatus', failing.getState().state === 'error' && failing.getState().message.includes('Afspelen geweigerd'));
  await failing.dispose();
}
