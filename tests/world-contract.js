import * as THREE from '../lib/three/three.module.js';
import { NEON_CITY_CONFIG } from '../js/worlds/neon-city/config.js?v=wp2';
import { validateWorldConfig, validateWorldContract, applyWorldEnvironment } from '../js/world-contract.js';
import { createCamera, configureCamera } from '../js/camera.js?v=wp1';
import { createControls } from '../js/controls.js?v=wp3';
import { createNeonCity } from '../js/worlds/neon-city/world.js?v=wp2';
import { createFlightModes } from '../js/journey/flight-modes.js?v=wp2';
import { createEngine } from '../js/engine.js?v=wp3';
import { createFlightPanel } from '../js/ui/flight-panel.js?v=wp2';
import { coreMixAtDistance } from '../js/audio/audio-settings.js';

const copyConfig = () => structuredClone(NEON_CITY_CONFIG);
const rejects = (fn, field) => { try { fn(); return false; } catch (error) { return error.message.includes('Ongeldige wereldconfiguratie') && error.message.includes(field); } };
const near = (a,b) => Math.abs(a-b) < 1e-9;

export async function testWorldContract(check, canvas) {
  check('WP1: Neon City-configuratie en contract geldig', validateWorldContract(createNeonCity()).config === NEON_CITY_CONFIG);
  const custom = copyConfig();
  custom.id = 'contract-fixture'; custom.name = 'Alleen testgegevens';
  custom.camera = { position:[12,25,-30], rotation:[0.1,0.4,-0.2], fov:75, near:0.4, far:300 };
  custom.environment = { background:0x112233, fog:null };
  custom.guidedJourney = false; custom.settings = {};
  const camera = createCamera(1.5, custom.camera);
  const expectedRotation = camera.quaternion.clone();
  check('WP1: camera leest positie, oriëntatie en lens uit config', camera.position.equals(new THREE.Vector3(...custom.camera.position)) && camera.rotation.order === 'YXZ' && custom.camera.rotation.every((value,i) => near(value,[camera.rotation.x,camera.rotation.y,camera.rotation.z][i])) && camera.fov === 75 && camera.near === 0.4 && camera.far === 300 && camera.aspect === 1.5);
  check('WP1: standaardcamera bevat geen Neon City-startpositie', createCamera(1).position.equals(new THREE.Vector3(0,0,0)));
  const controls = createControls(camera, canvas);
  camera.position.set(100,100,100); camera.rotation.set(1,2,0);
  canvas.dispatchEvent(new KeyboardEvent('keydown', { code:'KeyR', bubbles:true, cancelable:true }));
  check('WP1: R herstelt wereldspecifieke positie en oriëntatie', camera.position.equals(new THREE.Vector3(12,25,-30)) && camera.quaternion.angleTo(expectedRotation) < 1e-7);
  const later = copyConfig(); later.camera.position = [-9,13,42]; later.camera.rotation = [0.2,-0.3,0];
  configureCamera(camera, later.camera); const laterRotation = camera.quaternion.clone();
  camera.position.set(0,0,0); camera.rotation.set(0,0,0);
  const resetButton = document.querySelector('#reset');
  const resetPanel = createFlightPanel({ controls, canvas, engine:{ getQuality:()=>({ name:'balans' }) }, modes:{ getState:()=>({ mode:'free', available:false }), setOnChange() {} }, elements:{ reset:resetButton } });
  resetButton.click();
  check('WP1: resetknop gebruikt de nieuw ingestelde actieve pose', camera.position.equals(new THREE.Vector3(-9,13,42)) && camera.quaternion.angleTo(laterRotation) < 1e-7);
  later.camera.position[0] = 500;
  controls.reset();
  check('WP1: resetpose is een kopie van configuratiegegevens', camera.position.x === -9);
  resetPanel.dispose();
  controls.dispose();

  const cases = [
    ['id', c => c.id = 'Neon City'],
    ['name', c => c.name = '  '],
    ['camera.position', c => c.camera.position = [0,NaN,1]],
    ['camera.position', c => c.camera.position = [0,1]],
    ['camera.position', c => c.camera.position = new Array(3)],
    ['camera.rotation', c => c.camera.rotation = [0,Infinity,0]],
    ['camera.fov', c => c.camera.fov = 0],
    ['camera.fov', c => c.camera.fov = 180],
    ['camera.near/far', c => c.camera.near = 0],
    ['camera.near/far', c => c.camera.far = c.camera.near],
    ['camera.near/far', c => c.camera.far = Infinity],
    ['environment.background', c => c.environment.background = -1],
    ['environment.background', c => c.environment.background = '#invalid'],
    ['environment.fog', c => c.environment.fog = { type:'unknown', color:0 }],
    ['environment.fog', c => delete c.environment.fog],
    ['environment.fog.color', c => c.environment.fog.color = 0x1000000],
    ['environment.fog.density', c => c.environment.fog.density = -0.1],
    ['environment.fog.density', c => c.environment.fog.density = Infinity],
    ['environment.fog.near/far', c => c.environment.fog = { type:'linear', color:0, near:5, far:5 }],
    ['guidedJourney', c => c.guidedJourney = 'false'],
    ['settings', c => c.settings = null]
  ];
  cases.forEach(([field, change], i) => { const c = copyConfig(); change(c); check(`WP1: ongeldige configuratie ${i+1} (${field}) begrijpelijk afgewezen`, rejects(() => validateWorldConfig(c),field)); });
  check('WP1: ontbrekende configuratie begrijpelijk afgewezen', rejects(() => validateWorldConfig(null),'config'));
  // Inline lifecycle doubles only: no Test World module, assets or new artwork.
  const fixture = { config:custom, init() {}, update() {}, getAudioState: () => ({ proximityDistance:Infinity }), dispose() {} };
  check('WP1: contract zonder Journey en zonder kern is geldig', validateWorldContract(fixture) === fixture && fixture.getAudioState().proximityDistance === Infinity);
  for (const method of ['init','update','getAudioState','dispose']) {
    check(`WP1: ontbrekende ${method} afgewezen`, rejects(() => validateWorldContract({ ...fixture, [method]:undefined }),method));
  }
  check('WP1: actieve Journey vereist routefunctie', rejects(() => validateWorldContract({ ...fixture, config:{ ...custom, guidedJourney:true } }),'getJourneyRoute'));
  check('WP1: ongeldige optionele routefunctie afgewezen', rejects(() => validateWorldContract({ ...fixture, getJourneyRoute:42 }),'getJourneyRoute'));
  const button = document.createElement('button'), visibility = new EventTarget();
  const modes = createFlightModes(camera, { getVelocity: out => out.set(0,0,0), setEnabled() {}, update() {} }, { visibility });
  const panel = createFlightPanel({ controls:{ isMouseEnabled:()=>false }, modes, engine:{ getQuality:()=>({ name:'balans' }) }, canvas, elements:{ journey:button } });
  modes.setRoute(null);
  check('WP1: zonder route is Guided-knop uit en starten onmogelijk', button.disabled && !modes.start() && modes.getState().mode === 'free');
  panel.dispose(); modes.dispose();

  const scene = new THREE.Scene(); applyWorldEnvironment(scene, NEON_CITY_CONFIG);
  check('WP1: Neon City-achtergrond en mist behouden', scene.background.getHex() === 0x0b0616 && scene.fog.isFogExp2 && scene.fog.density === 0.006);
  applyWorldEnvironment(scene, custom);
  check('WP1: fog null verwijdert oude mist', scene.fog === null && scene.background.getHex() === 0x112233);
  const linear = { ...custom, environment:{ background:0, fog:{ type:'linear', color:0xabcdef, near:3, far:50 } } };
  applyWorldEnvironment(scene, linear);
  check('WP1: lineaire mist is geldig en wordt toegepast', scene.fog.isFog && scene.fog.near === 3 && scene.fog.far === 50 && scene.fog.color.getHex() === 0xabcdef);
  const world = createNeonCity(); world.init(scene);
  const observer = createCamera(1, NEON_CITY_CONFIG.camera);
  observer.position.set(0,19,-31); world.update(0,observer);
  check('WP1: neutrale audiostaat behoudt exacte 3D-afstand en kernmix', near(world.getAudioState().proximityDistance,51) && coreMixAtDistance(world.getAudioState().proximityDistance) === 0.5 && world.getEnergyDistance() === 51);
  check('WP1: Neon City init wijzigt de engine-omgeving niet', scene.fog.isFog && scene.background.getHex() === 0);
  let count = 0;
  scene.traverse(o => { if (o.geometry) o.geometry.addEventListener('dispose',() => count++); });
  const resources = new Set(); scene.traverse(o => { if (o.geometry) resources.add(o.geometry); });
  world.dispose(); world.dispose();
  check('WP1: Neon City ruimt uitsluitend eigen objecten eenmaal op', scene.children.length === 0 && count === resources.size && scene.fog.isFog && world.getAudioState().proximityDistance === Infinity);

  const freeOnly = createNeonCity({ config:{ ...NEON_CITY_CONFIG, guidedJourney:false } });
  freeOnly.init(scene);
  check('WP1: Neon City zonder Journey initialiseert zonder route', freeOnly.getJourneyRoute() === null && scene.children.length === 1);
  freeOnly.dispose();

  // Exercise the real engine's configuration path with an empty contract double.
  const host = document.createElement('div'); document.body.appendChild(host);
  const ui = document.createElement('div');
  ui.innerHTML = '<button id="quality-toggle"></button><button id="journey-toggle"></button><div id="performance"></div><div id="status"></div>';
  document.body.appendChild(ui);
  let engine, enginePanel, observedCamera, observedScene, initialized = 0, disposed = 0;
  try {
    const empty = { ...fixture, init(s) { initialized++; observedScene = s; }, update(dt,c) { observedCamera = c; }, dispose() { disposed++; } };
    engine = createEngine(host, { ui:{ status:ui.querySelector('#status'), performance:ui.querySelector('#performance') } });
    enginePanel = createFlightPanel({ controls:engine.controls, modes:engine.flightModes, engine, canvas:engine.canvas, elements:{ journey:ui.querySelector('#journey-toggle') } });
    engine.setWorld(empty); engine.start();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    check('WP1: echte engine initialiseert contract zonder kern/route', initialized === 1 && observedCamera && observedCamera.position.equals(new THREE.Vector3(12,25,-30)) && observedCamera.fov === 75 && observedScene.fog === null && host.querySelectorAll('canvas').length === 1 && ui.querySelector('#journey-toggle').disabled);
    observedCamera.position.set(1,2,3);
    host.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown',{ code:'KeyR', bubbles:true, cancelable:true }));
    check('WP1: R via echte engine herstelt actieve wereldpose', observedCamera.position.equals(new THREE.Vector3(12,25,-30)) && observedCamera.quaternion.angleTo(expectedRotation) < 1e-7);
    check('WP1: engine weigert fout contract vóór actieve wereld wordt geraakt', rejects(() => engine.setWorld({ ...empty, update:null }),'update') && disposed === 0 && initialized === 1);
  } finally { enginePanel?.dispose(); engine?.dispose(); host.remove(); ui.remove(); }
  check('WP1: engine verwijdert contractfixture en canvas', disposed === 1 && host.children.length === 0);
}
