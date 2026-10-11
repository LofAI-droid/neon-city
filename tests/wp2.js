import * as THREE from '../lib/three/three.module.js';
import { NEON_CITY_CONFIG } from '../js/worlds/neon-city/config.js?v=wp2';
import { validateWorldConfig } from '../js/world-contract.js?v=wp2';
import { validateAudioConfig, MAX_AUDIO_SOURCES, mixAtDistance } from '../js/audio/audio-settings.js?v=wp2';
import { createAudioManager } from '../js/audio/audio-manager.js?v=wp2';
import { createAudioPanel } from '../js/audio/audio-panel.js?v=wp2';
import { createCamera } from '../js/camera.js?v=wp1';
import { createControls } from '../js/controls.js?v=wp2';
import { createFlightModes } from '../js/journey/flight-modes.js?v=wp2';
import { createFlightPanel } from '../js/ui/flight-panel.js?v=wp2';
import { createNeonCityRoute } from '../js/worlds/neon-city/journey-route.js?v=wp1';

const source = NEON_CITY_CONFIG.audio.sources;
const audio = sources => ({ sources });
const rejects = (action, field) => { try { action(); return false; } catch (error) { return error.message.includes(field); } };

function fakeAudio() {
  const elements = [], gains = [], counts = { contexts: 0, nodes: 0, closes: 0, disconnects: 0, plays: 0 };
  const createContext = () => {
    counts.contexts++;
    const context = new EventTarget();
    context.currentTime = 5; context.state = 'suspended'; context.destination = {};
    context.resume = () => { context.state = 'running'; return Promise.resolve(); };
    context.close = () => { counts.closes++; context.state = 'closed'; return Promise.resolve(); };
    context.createGain = () => {
      const gain = { value: 0, target: 0, cancelAndHoldAtTime() {}, setTargetAtTime(value) { this.target = value; }, linearRampToValueAtTime(value) { this.target = value; } };
      gains.push(gain);
      return { gain, connect() {}, disconnect() { counts.disconnects++; } };
    };
    context.createMediaElementSource = () => { counts.nodes++; return { connect() {}, disconnect() { counts.disconnects++; } }; };
    return context;
  };
  const createElement = () => {
    const element = new EventTarget(); element.currentTime = 17 + elements.length; element.paused = true; element.error = null;
    element.play = () => { counts.plays++; element.paused = false; return Promise.resolve(); };
    element.pause = () => { element.paused = true; };
    element.load = () => {}; element.removeAttribute = () => {};
    elements.push(element); return element;
  };
  return { elements, gains, counts, createContext, createElement };
}

export async function testWP2(check, canvas) {
  check('WP2: twee unieke Neon City-bronnen geldig', validateAudioConfig(NEON_CITY_CONFIG.audio) === NEON_CITY_CONFIG.audio && MAX_AUDIO_SOURCES === 2 && validateWorldConfig(NEON_CITY_CONFIG) === NEON_CITY_CONFIG);
  check('WP2: één bron en geen audio geldig', validateAudioConfig(audio([source[0]])).sources.length === 1 && validateAudioConfig(audio([])).sources.length === 0 && validateAudioConfig().sources.length === 0 && validateWorldConfig({ ...NEON_CITY_CONFIG, audio:undefined }));
  const invalid = [
    ['id', audio([{ ...source[0], id:'Geen Geldige ID' }])],
    ['id', audio([source[0], { ...source[1], id:source[0].id }])],
    ['type', audio([{ ...source[0], type:'mystery' }])],
    ['url', audio([{ ...source[0], url:'https://example.com/music.mp3' }])],
    ['loop', audio([{ ...source[0], loop:'true' }])],
    ['gain', audio([{ ...source[0], gain:NaN }])],
    ['gain', audio([{ ...source[0], gain:1.1 }])],
    ['distanceKey', audio([{ ...source[1], distanceKey:'' }])],
    ['distance', audio([{ ...source[1], distance:{ fadeStart:12, fullVolume:90 } }])],
    ['distance', audio([{ ...source[1], distance:{ fadeStart:Infinity, fullVolume:12 } }])],
    ['audio.sources', audio([source[0], source[1], { ...source[0], id:'third-source' }])]
  ];
  invalid.forEach(([field, config], i) => check(`WP2: ongeldige audioconfiguratie ${i+1} (${field}) afgewezen`, rejects(() => validateAudioConfig(config), field)));
  check('WP2: derde bron krijgt expliciete limietfout', rejects(() => validateAudioConfig(audio([source[0], source[1], { ...source[0], id:'third-source' }])), 'maximaal 2'));
  check('WP2: bestaande 90/12-respons blijft gelijk', mixAtDistance(90,source[1].distance) === 0 && mixAtDistance(12,source[1].distance) === 1 && mixAtDistance(51,source[1].distance) === 0.5);

  const silent = fakeAudio();
  const noAudio = createAudioManager({ audio:audio([]), ...silent });
  await noAudio.start();
  check('WP2: wereld zonder audio maakt geen AudioContext', noAudio.getState().state === 'empty' && silent.counts.contexts === 0);
  await noAudio.dispose();
  const one = fakeAudio();
  const oneManager = createAudioManager({ audio:audio([source[0]]), ...one });
  await oneManager.start();
  check('WP2: één globale bron heeft eigen tijdlijn en gain', one.counts.contexts === 1 && one.counts.nodes === 1 && one.gains.length === 2 && one.elements[0].currentTime === 17 && one.gains[1].value === 0.55);
  await oneManager.dispose();

  const dualProximity = audio([
    { ...source[1], id:'planet-a', distanceKey:'planet-a' },
    { ...source[1], id:'planet-b', distanceKey:'planet-b' }
  ]);
  const fake = fakeAudio();
  const manager = createAudioManager({ audio:dualProximity, settings:{ startStopSeconds:0.001 }, ...fake });
  manager.updateDistances({ 'planet-a':0, 'planet-b':200 });
  await manager.start();
  check('WP2: twee nabijheidsbronnen delen één context', fake.counts.contexts === 1 && fake.counts.nodes === 2 && fake.gains.length === 3 && manager.getState().state === 'playing');
  check('WP2: onafhankelijke afstanden sturen alleen eigen gains', manager.getState().sourceMixes['planet-a'] === 1 && manager.getState().sourceMixes['planet-b'] === 0 && fake.gains[1].value === 0.45 && fake.gains[2].value === 0);
  manager.updateDistances({ 'planet-a':200, 'planet-b':0 });
  check('WP2: bronmix wisselt zonder trackreset', fake.gains[1].target === 0 && fake.gains[2].target === 0.45 && fake.elements[0].currentTime === 17 && fake.elements[1].currentTime === 18 && fake.counts.plays === 2);
  check('WP2: oude enkelvoudige afstand weigert dubbelzinnige bronkeuze', rejects(() => manager.updateDistance(12), 'updateDistances'));
  manager.setMuted(true); manager.setVolume(0.35);
  check('WP2: mute en volume behouden beide tijdlijnen', fake.gains[0].target === 0 && manager.getState().volume === 0.35 && fake.elements.every(element => !element.paused && element.currentTime >= 17));
  await manager.pause(); await manager.start();
  check('WP2: pause/resume hergebruikt één context en twee elementen', fake.counts.contexts === 1 && fake.counts.nodes === 2 && fake.counts.plays === 4 && fake.elements.every(element => !element.paused));
  await manager.dispose(); await manager.dispose();
  check('WP2: beide bronnen en master eenmaal opgeruimd', fake.counts.closes === 1 && fake.counts.disconnects === 5 && fake.elements.every(element => element.paused));

  const delayed = fakeAudio(); let finishPlay;
  const race = createAudioManager({ audio:audio([source[0]]), ...delayed, createElement() {
    const element = delayed.createElement(); element.play = () => { delayed.counts.plays++; return new Promise(resolve => { finishPlay = resolve; }); }; return element;
  } });
  const pending = race.start();
  await race.dispose(); finishPlay(); await pending;
  check('WP2: oude asynchrone start herstart niet na dispose', race.getState().state === 'disposed' && delayed.counts.plays === 1 && delayed.counts.closes === 1);

  const partial = fakeAudio(); let brokenOnce = true;
  const recovery = createAudioManager({ audio:NEON_CITY_CONFIG.audio, ...partial, createContext() {
    const context = partial.createContext();
    const createSource = context.createMediaElementSource;
    context.createMediaElementSource = element => {
      if (brokenOnce && partial.counts.nodes === 1) { brokenOnce = false; throw new Error('Bronaanmaak geweigerd'); }
      return createSource(element);
    };
    return context;
  } });
  await recovery.start();
  check('WP2: gedeeltelijke audio-initialisatie ruimt graph op', recovery.getState().state === 'error' && partial.counts.closes === 1 && partial.elements.every(element => element.paused));
  await recovery.start();
  check('WP2: audio kan na gedeeltelijke fout opnieuw starten', recovery.getState().state === 'playing' && partial.counts.contexts === 2 && partial.counts.nodes === 3);
  await recovery.dispose();

  // Different markup: no Neon City IDs or selectors are used by either adapter.
  const detached = document.createElement('div');
  detached.innerHTML = '<button></button><button></button><input type="range"><output></output><p></p><span></span>';
  const [start,mute,slider,volume,status,mix] = detached.children;
  let muted = false, level = 0.65, starts = 0, pauses = 0;
  const uiManager = {
    getState:() => ({ state:starts && !pauses ? 'playing' : 'idle', contextState:'running', sourceCount:1, muted, volume:level, sourceMixes:{ 'planet-a':0.5 }, message:'Testaudio' }),
    start() { starts++; }, pause() { pauses++; }, setMuted(value) { muted=value; }, setVolume(value) { level=value; }
  };
  const audioPanel = createAudioPanel(uiManager, { elements:{ start,mute,slider,volume,status,mix }, focusTarget:canvas, mixSourceId:'planet-a', mixLabel:'Planeet A' });
  start.click(); mute.click(); slider.value = '30'; slider.dispatchEvent(new Event('input'));
  audioPanel.render();
  check('WP2: audiopaneel werkt met andere HTML en labels', starts === 1 && muted && level === 0.3 && mix.textContent === 'Planeet A: 50%' && volume.value === '30%' && status.textContent === 'Testaudio');
  audioPanel.dispose(); start.click();
  check('WP2: audiopaneel verwijdert eigen eventlisteners', starts === 1);

  const camera = createCamera(1, NEON_CITY_CONFIG.camera);
  let modes;
  const controls = createControls(camera, canvas, { onReset:() => modes.stop() });
  modes = createFlightModes(camera, controls, { visibility:new EventTarget() });
  const buttons = document.createElement('div');
  buttons.innerHTML = '<button></button><button></button><button></button><button></button><progress></progress><p></p><span></span>';
  const [mouse,reset,quality,journey,progress,flightStatus,modeLabel] = buttons.children;
  let qualityIndex = 1;
  const qualityNames = ['licht','balans','scherp'];
  const fakeEngine = { getQuality:() => ({ name:qualityNames[qualityIndex] }), cycleQuality() { qualityIndex = (qualityIndex+1)%3; } };
  const flightPanel = createFlightPanel({ controls,modes,engine:fakeEngine,canvas,elements:{mouse,reset,quality,journey,progress,status:flightStatus,modeLabel},labels:{guided:'Rondvlucht',free:'Vrije vlucht',freeHeading:'ZELF',guidedHeading:'ROUTE'} });
  check('WP2: wereld zonder Journey heeft uitgeschakelde knop', journey.disabled && !modes.start());
  mouse.click(); quality.click();
  check('WP2: muisblik en beeldkwaliteit werken via losse UI', controls.isMouseEnabled() && mouse.getAttribute('aria-pressed') === 'true' && qualityIndex === 2 && quality.textContent === 'Beeld: scherp');
  const oldRoute = createNeonCityRoute([]);
  const route = { ...oldRoute, duration:42,
    positions:oldRoute.positions.map(key => ({ ...key, time:key.time*42/90 })),
    targets:oldRoute.targets.map(key => ({ ...key, time:key.time*42/90 })) };
  modes.setRoute(route); journey.click(); modes.update(modes.getState().entryDuration + 1);
  check('WP2: Guided UI leest werkelijke duur en eigen label', modes.getState().mode === 'guided' && progress.max === 42 && journey.textContent === 'Vrije vlucht' && flightStatus.textContent.includes('Rondvlucht') && modeLabel.textContent === 'ROUTE');
  journey.click(); camera.position.set(4,4,4); reset.click();
  check('WP2: Free Flight en reset werken via losse UI', modes.getState().mode === 'free' && modeLabel.textContent === 'ZELF' && camera.position.equals(new THREE.Vector3(...NEON_CITY_CONFIG.camera.position)));
  flightPanel.dispose(); modes.stop(); journey.click();
  check('WP2: flight adapter ruimt listeners op', modes.getState().mode === 'free');
  modes.dispose(); controls.dispose();
}
