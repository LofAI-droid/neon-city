import * as THREE from '../lib/three/three.module.js';
import { validateJourneyRoute } from '../js/journey/route-contract.js';
import { createJourney } from '../js/journey/journey.js?v=wp4';
import { createFlightModes } from '../js/journey/flight-modes.js?v=wp4';
import { activeFrameSeconds } from '../js/active-time.js';
import { createCamera } from '../js/camera.js?v=wp1';
import { createNeonCityRoute } from '../js/worlds/neon-city/journey-route.js?v=wp4';
import { createNeonCity } from '../js/worlds/neon-city/world.js?v=wp4';
import { createEngine } from '../js/engine.js?v=wp4';
import { createWorldRegistry } from '../js/world-registry.js?v=wp3';
import { createWorldManager } from '../js/world-manager.js?v=wp3';
import { createTestWorld, TEST_WORLD_CONFIG } from './test-world.js';
import { createTechnicalRoute, TECHNICAL_CAMERA } from './technical-route.js';

const rejects = (action, text) => { try { action(); return false; } catch (error) { return error.message.includes('Ongeldige Journey-route') && error.message.includes(text); } };
const cloneRoute = route => ({ ...route, positions:route.positions.map(key => ({ time:key.time, value:[...key.value] })), targets:route.targets.map(key => ({ time:key.time, value:[...key.value] })), entry:{ ...route.entry } });
const near = (a,b,epsilon=1e-7) => Math.abs(a-b) < epsilon;

export async function testWP4(check) {
  const neon = createNeonCityRoute([]), technical = createTechnicalRoute();
  check('WP4: Neon City-route van 90 s voldoet aan contract', validateJourneyRoute(neon) === neon && neon.duration === 90);
  check('WP4: technische route van 42 s voldoet aan hetzelfde contract', validateJourneyRoute(technical) === technical && technical.duration === 42);
  check('WP4: ontbrekende route heeft begrijpelijke fout', rejects(() => validateJourneyRoute(undefined), 'route moet'));
  check('WP4: wereld zonder Journey blijft geldig', (() => { const c = createCamera(1, TECHNICAL_CAMERA), modes = createFlightModes(c, { getVelocity:v=>v.set(0,0,0), setEnabled(){}, update(){} }, { visibility:new EventTarget() }); modes.setRoute(null); const okay = !modes.getState().available && !modes.start(); modes.dispose(); return okay; })());
  const invalid = [
    ['te weinig punten', r => r.positions.splice(1), 'minstens twee'],
    ['dalende tijd', r => r.positions[2].time = 10, 'tijdstippen'],
    ['dubbele tijd', r => r.positions[1].time = 0, 'tijdstippen'],
    ['negatieve duur', r => r.duration = -1, 'duration'],
    ['verkeerde eindtijd', r => r.targets.at(-1).time = 41, 'eindtijd'],
    ['NaN in positie', r => r.positions[1].value[0] = NaN, 'positions'],
    ['Infinity in kijkdoel', r => r.targets[1].value[1] = Infinity, 'targets'],
    ['samenvallend kijkdoel', r => r.targets[0].value = [...r.positions[0].value], 'kijkdoel valt samen'],
    ['ongeldige aanloopsnelheid', r => r.entry.speed = 0, 'entry.speed'],
    ['ongeldige minimale duur', r => r.entry.minDuration = Infinity, 'entry.minDuration'],
    ['ongeldige maximale duur', r => { r.entry.minDuration = 3; r.entry.maxDuration = 2; }, 'entry.maxDuration'],
    ['ongeldige safety-sampling', r => r.entry.safetyStepSeconds = -1, 'entry.safetyStepSeconds'],
    ['ongeldige velocitymodus', r => r.entry.velocityMode = 'warp', 'entry.velocityMode'],
    ['ongeldige velocityfallback', r => r.entry.velocityFallback = 'warp', 'entry.velocityFallback'],
    ['onbekende aanloopinstelling', r => r.entry.speeed = 4, 'entry.speeed'],
    ['geen veiligheidsfunctie', r => r.isSafe = null, 'isSafe'],
    ['geen aanloopplanner', r => r.planEntry = null, 'planEntry']
  ];
  invalid.forEach(([name, mutate, message]) => { const r = cloneRoute(technical); mutate(r); check(`WP4: ${name} afgewezen`, rejects(() => validateJourneyRoute(r), message)); });

  const camera = createCamera(1, TECHNICAL_CAMERA);
  const journey = createJourney(technical);
  const pose = camera.position.clone(), orientation = camera.quaternion.clone();
  check('WP4: technische Journey start zonder teleportatie of rotatiesprong', journey.start(camera) && camera.position.equals(pose) && camera.quaternion.equals(orientation));
  const entryDuration = journey.getState().entryDuration;
  journey.update(entryDuration, camera);
  check('WP4: aanloop staat buiten de 42 s', journey.getState().elapsed === 0 && journey.getState().phase === 'running' && entryDuration > 0);
  journey.update(42, camera);
  check('WP4: technische route voltooit na precies 42 actieve seconden', journey.getState().elapsed === 42 && journey.getState().phase === 'complete');
  journey.dispose();

  const slow = createJourney(createTechnicalRoute({ entry:{ speed:4, minDuration:1 } }));
  const fast = createJourney(createTechnicalRoute({ entry:{ speed:20, minDuration:1 } }));
  const minimum = createJourney(createTechnicalRoute({ entry:{ speed:20, minDuration:5 } }));
  const maximum = createJourney(createTechnicalRoute({ entry:{ speed:4, minDuration:1, maxDuration:2 } }));
  slow.start(createCamera(1,TECHNICAL_CAMERA)); fast.start(createCamera(1,TECHNICAL_CAMERA)); minimum.start(createCamera(1,TECHNICAL_CAMERA)); maximum.start(createCamera(1,TECHNICAL_CAMERA));
  check('WP4: aanloopsnelheid configureert duur', slow.getState().entryDuration > fast.getState().entryDuration);
  check('WP4: minimale aanloopduur configureerbaar', near(minimum.getState().entryDuration,5));
  check('WP4: optionele maximale aanloopduur begrenst segment', near(maximum.getState().entryDuration,2));
  slow.dispose(); fast.dispose(); minimum.dispose(); maximum.dispose();
  const distant = createCamera(1, TECHNICAL_CAMERA); distant.position.set(0,5,220);
  const farJourney = createJourney(technical);
  check('WP4: veilige aanloop vanaf grote afstand', farJourney.start(distant) && farJourney.getState().entryDuration > 20);
  farJourney.dispose();

  const narrow = point => point.y > 1 && Math.abs(point.x) < 1;
  const fallback = createJourney(createTechnicalRoute({ isSafe:narrow }));
  const moving = createCamera(1,TECHNICAL_CAMERA);
  const inherited = new THREE.Vector3(12,0,0), carried = new THREE.Vector3();
  check('WP4: onveilige startvelocity valt expliciet terug op nul', fallback.start(moving,inherited) && fallback.getState().entryFallback && fallback.getVelocity(carried).length() === 0);
  const interrupted = moving.position.clone(); fallback.update(0.2,moving); fallback.cancel();
  check('WP4: onderbreken tijdens aanloop behoudt geldige actuele pose', !moving.position.equals(interrupted) && [moving.position.x,moving.position.y,moving.position.z,moving.rotation.x,moving.rotation.y].every(Number.isFinite));
  fallback.dispose();
  const rejected = createJourney(createTechnicalRoute({ isSafe:narrow, entry:{ velocityFallback:'reject' } }));
  const rejectCamera = createCamera(1,TECHNICAL_CAMERA), rejectPose = rejectCamera.position.clone();
  check('WP4: configureerbare fallback kan onveilige aanloop weigeren', !rejected.start(rejectCamera,inherited) && rejected.getState().startError === 'unsafe-entry' && rejectCamera.position.equals(rejectPose));
  rejected.dispose();
  const zeroMode = createJourney(createTechnicalRoute({ entry:{ velocityMode:'zero' } }));
  zeroMode.start(createCamera(1,TECHNICAL_CAMERA),inherited);
  check('WP4: startvelocity kan expliciet genegeerd worden', zeroMode.getVelocity(carried).length() === 0 && !zeroMode.getState().entryFallback);
  zeroMode.dispose();
  const badPlan = cloneRoute(technical);
  badPlan.planEntry = (_,begin) => [new THREE.Vector3(99,5,30),begin];
  const planned = createJourney(badPlan), plannedCamera = createCamera(1,TECHNICAL_CAMERA);
  check('WP4: planner met verkeerde startpositie wordt veilig geweigerd', !planned.start(plannedCamera) && planned.getState().startError === 'invalid-entry' && plannedCamera.position.equals(new THREE.Vector3(0,5,30)));
  planned.dispose();

  const poses = [30,60,120].map(fps => {
    const c = createCamera(1,TECHNICAL_CAMERA), j = createJourney(technical), samples = [];
    j.start(c); j.update(j.getState().entryDuration,c);
    for (let i=1; i<=42*fps; i++) { j.update(1/fps,c); if (i%(7*fps) === 0) samples.push([c.position.clone(),c.quaternion.clone()]); }
    j.dispose(); return samples;
  });
  check('WP4: 42 s-route is gelijk bij 30/60/120 FPS', poses[0].every((pose,i) => poses.slice(1).every(other => pose[0].distanceTo(other[i][0]) < 1e-6 && pose[1].angleTo(other[i][1]) < 1e-6)));
  check('WP4: frame van 80 ms wordt begrensd op 50 ms', near(activeFrameSeconds(1000,1080),0.05));
  check('WP4: stalls van 500 ms en 2 s krijgen dezelfde grens', near(activeFrameSeconds(1000,1500),0.05) && near(activeFrameSeconds(1000,3000),0.05));
  check('WP4: eerste frame en ongeldige tijd leveren nul actieve tijd', activeFrameSeconds(null,3000) === 0 && activeFrameSeconds(3000,2500) === 0 && activeFrameSeconds(0,NaN) === 0);
  const visualCamera = createCamera(1,TECHNICAL_CAMERA), visualJourney = createJourney(technical);
  visualJourney.start(visualCamera); visualJourney.update(visualJourney.getState().entryDuration,visualCamera);
  const before = visualCamera.position.clone(), bounded = activeFrameSeconds(1000,3000); let worldElapsed = 0;
  visualJourney.update(bounded,visualCamera); worldElapsed += bounded;
  check('WP4: Journey en wereld gebruiken dezelfde begrensde visuele delta', near(visualJourney.getState().elapsed,worldElapsed) && visualCamera.position.distanceTo(before) < 0.2);
  visualJourney.dispose();

  const vertical = createTechnicalRoute();
  vertical.positions = [{ time:0, value:[0,5,20] },{ time:42, value:[0,5,-20] }];
  vertical.targets = [{ time:0, value:[0,15,20] },{ time:42, value:[0,15,-20] }];
  const upward = createJourney(vertical), uprightCamera = createCamera(1,TECHNICAL_CAMERA);
  upward.start(uprightCamera); upward.update(upward.getState().entryDuration + 21,uprightCamera);
  check('WP4: exact verticale kijkrichting houdt eindige yaw, pitch en nul roll', [uprightCamera.rotation.x,uprightCamera.rotation.y,uprightCamera.rotation.z].every(Number.isFinite) && uprightCamera.rotation.z === 0 && uprightCamera.rotation.x > 1.5);
  upward.dispose();
  const downward = createTechnicalRoute();
  downward.positions = vertical.positions;
  downward.targets = [{ time:0, value:[0,-5,20] },{ time:42, value:[0,-5,-20] }];
  const downJourney = createJourney(downward), downCamera = createCamera(1,TECHNICAL_CAMERA);
  downJourney.start(downCamera); downJourney.update(downJourney.getState().entryDuration + 21,downCamera);
  check('WP4: recht omlaag kijken blijft eindig en zonder roll', [downCamera.rotation.x,downCamera.rotation.y,downCamera.rotation.z].every(Number.isFinite) && downCamera.rotation.z === 0 && downCamera.rotation.x < -1.5);
  downJourney.dispose();
  const almostVertical = createTechnicalRoute();
  almostVertical.positions = vertical.positions;
  almostVertical.targets = [{ time:0, value:[0.001,15,20] },{ time:42, value:[-0.001,15,-20] }];
  const nearJourney = createJourney(almostVertical), nearCamera = createCamera(1,TECHNICAL_CAMERA);
  nearJourney.start(nearCamera); nearJourney.update(nearJourney.getState().entryDuration,nearCamera);
  let maxTurn = 0, previousRotation = nearCamera.quaternion.clone();
  for (let i=0; i<42*60; i++) { nearJourney.update(1/60,nearCamera); maxTurn = Math.max(maxTurn,nearCamera.quaternion.angleTo(previousRotation)); previousRotation.copy(nearCamera.quaternion); }
  check('WP4: bijna verticale blik geeft geen yaw-flip of NaN', maxTurn < 0.05 && [nearCamera.rotation.x,nearCamera.rotation.y,nearCamera.rotation.z].every(Number.isFinite));
  nearJourney.dispose();
  const badCamera = createCamera(1,TECHNICAL_CAMERA); badCamera.rotation.y = NaN;
  const guarded = createJourney(technical);
  check('WP4: ongeldige cameraoriëntatie start geen Journey', !guarded.start(badCamera) && guarded.getState().startError === 'invalid-camera');
  guarded.dispose();

  const visibility = new EventTarget(); visibility.hidden = false;
  const modeCamera = createCamera(1,TECHNICAL_CAMERA);
  const controls = { getVelocity:v=>v.set(0,0,0), setEnabled(){}, update(){} };
  const modes = createFlightModes(modeCamera,controls,{ visibility });
  modes.setRoute(technical); modes.start(); modes.update(0.05);
  const oldJourney = modes.getState().elapsed, oldPose = modeCamera.position.clone();
  const invalidRoute = cloneRoute(technical); invalidRoute.duration = 0;
  check('WP4: ongeldige nieuwe route vervangt actieve geldige route niet', rejects(() => modes.setRoute(invalidRoute),'duration') && modes.getState().mode === 'guided' && modes.getState().available && modeCamera.position.equals(oldPose));
  visibility.hidden = true; visibility.dispatchEvent(new Event('visibilitychange')); modes.update(0.05);
  visibility.hidden = false; visibility.dispatchEvent(new Event('visibilitychange')); modes.update(0);
  check('WP4: verborgen tab en hervatting geven geen extra voortgang', near(modes.getState().elapsed,oldJourney));
  modes.stop();
  check('WP4: routeonderbreking behoudt positie en eindige rotatie', modeCamera.position.equals(oldPose) && [modeCamera.rotation.x,modeCamera.rotation.y].every(Number.isFinite));
  modes.dispose();

  const host = document.createElement('div'); document.body.appendChild(host);
  const engine = createEngine(host);
  const registry = createWorldRegistry([
    { id:'neon-city', create:createNeonCity },
    { id:'test-world', create:createTestWorld },
    { id:'bad-journey', create:() => { const world = createTestWorld({ config:{ ...TEST_WORLD_CONFIG, id:'bad-journey', guidedJourney:true } }); return { ...world, getJourneyRoute:() => invalidRoute }; } }
  ]);
  const audio = { async setSources() { return true; }, async dispose() {} };
  const manager = createWorldManager({ registry, engine, audio });
  try {
    await manager.switchWorld('neon-city'); const started = engine.flightModes.start();
    await manager.switchWorld('test-world');
    check('WP4: wereldwissel stopt oude Journey en zet nieuwe camera', started && engine.flightModes.getState().mode === 'free' && !engine.flightModes.getState().available && engine.camera.position.equals(new THREE.Vector3(6,4,18)));
    await manager.switchWorld('neon-city');
    check('WP4: terugkeer installeert nieuwe Neon City-route', engine.flightModes.getState().available && engine.flightModes.start());
    try { await manager.switchWorld('bad-journey'); } catch (error) { /* expected */ }
    check('WP4: routefout laat veilige lege toestand zonder oude callback', manager.getState().activeId === null && engine.getWorld() === null && engine.flightModes.getState().mode === 'free' && !engine.flightModes.getState().available && engine.scene.children.length === 0);
    await manager.switchWorld('neon-city');
    check('WP4: herstel na routefout zonder reload', manager.getState().activeId === 'neon-city' && engine.flightModes.getState().available);
  } finally { await manager.dispose(); host.remove(); }
  check('WP4: cleanup verwijdert het extra canvas', host.querySelectorAll('canvas').length === 0);
}
