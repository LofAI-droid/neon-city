import { NEON_CITY_CONFIG } from '../js/worlds/neon-city/config.js';
import * as THREE from '../lib/three/three.module.js';
import { createCamera } from '../js/camera.js?v=wp1';
import { createControls } from '../js/controls.js?v=wp1';
import { createBuildings } from '../js/worlds/neon-city/buildings.js';
import { createNeonCityRoute } from '../js/worlds/neon-city/journey-route.js?v=wp1';
import { createJourney } from '../js/journey/journey.js';
import { createEntryPath } from '../js/journey/timed-path.js';
import { createFlightModes } from '../js/journey/flight-modes.js?v=wp1';

export function testJourney(check, canvas) {
  const buildings = createBuildings();
  const route = createNeonCityRoute(buildings.userData.collisionBounds);
  buildings.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  const camera = createCamera(1, NEON_CITY_CONFIG.camera), journey = createJourney(route);
  const initialPosition = camera.position.clone(), initialQuaternion = camera.quaternion.clone();
  journey.start(camera);
  check('Journey: starten verplaatst of draait camera niet', camera.position.equals(initialPosition) && camera.quaternion.equals(initialQuaternion));
  const entryDuration = journey.getState().entryDuration;
  journey.update(entryDuration, camera);
  check('Journey: aanloop telt niet mee in 90 seconden', journey.getState().elapsed === 0 && journey.getState().phase === 'running');
  let safe = true, maxStep = 0, maxAngle = 0, previous = camera.position.clone(), previousRotation = camera.quaternion.clone();
  for (let i = 0; i < 90 * 120; i++) {
    journey.update(1/120, camera);
    safe &&= route.isSafe(camera.position) && camera.position.distanceTo(new THREE.Vector3(0,19,-82)) > 13 && camera.rotation.z === 0;
    maxStep = Math.max(maxStep, camera.position.distanceTo(previous));
    maxAngle = Math.max(maxAngle, camera.quaternion.angleTo(previousRotation));
    previous.copy(camera.position); previousRotation.copy(camera.quaternion);
    if (i === 90*120-2) check('Journey: vóór 90 seconden nog actief', journey.getState().phase === 'running');
  }
  check('Journey: precies 90 seconden, daarna voltooid', journey.getState().elapsed === 90 && journey.getState().phase === 'complete');
  check('Journey: volledige route vrij van gebouwen, kern en camera-roll', safe);
  check('Journey: geen abrupte positie- of kijkrichtingssprongen', maxStep < 0.06 && maxAngle < 0.02);
  const poses = [30,60,120].map(fps => {
    const c = createCamera(1, NEON_CITY_CONFIG.camera), j = createJourney(route), snapshots = [];
    j.start(c); j.update(j.getState().entryDuration, c);
    for (let i=1; i<=90*fps; i++) { j.update(1/fps,c); if (i % (5*fps) === 0) snapshots.push([c.position.clone(),c.quaternion.clone()]); }
    j.dispose(); return snapshots;
  });
  check('Journey: gelijke route bij 30, 60 en 120 FPS', poses[0].every((pose,i) => poses.slice(1).every(other => pose[0].distanceTo(other[i][0]) < 1e-7 && pose[1].angleTo(other[i][1]) < 1e-7)));
  const visibility = new EventTarget(); visibility.hidden = false;
  const button = document.createElement('button');
  let modes;
  const controls = createControls(camera, canvas, { onReset: () => modes.stop() });
  modes = createFlightModes(camera, controls, { visibility, button, progress:null, status:null });
  modes.setRoute(route); camera.copy(createCamera(1, NEON_CITY_CONFIG.camera)); modes.start(); modes.update(10);
  const before = camera.position.clone(), orientation = camera.quaternion.clone(), elapsed = modes.getState().elapsed;
  visibility.hidden = true; visibility.dispatchEvent(new Event('visibilitychange')); modes.update(50);
  check('Journey: verborgen tab pauzeert tijd en camera', modes.getState().elapsed === elapsed && camera.position.equals(before));
  visibility.hidden = false; modes.stop();
  check('Journey: onderbreken behoudt positie en kijkrichting', camera.position.equals(before) && camera.quaternion.equals(orientation) && modes.getState().mode === 'free');
  let repeat = true;
  for (let i=0;i<20;i++) { repeat &&= modes.start(); modes.update(0.1); modes.stop(); }
  check('Journey: twintig keer starten en onderbreken', repeat && modes.getState().mode === 'free');
  modes.start(); modes.update(modes.getState().entryDuration + 90);
  check('Journey: automatisch terug naar Free Flight', modes.getState().mode === 'free');
  modes.start(); modes.update(2);
  canvas.dispatchEvent(new KeyboardEvent('keydown', { code:'KeyR', bubbles:true, cancelable:true }));
  check('Journey: R onderbreekt en herstelt de bestaande startpositie', modes.getState().mode === 'free' && camera.position.equals(createCamera(1, NEON_CITY_CONFIG.camera).position));
  camera.position.copy(buildings.userData.collisionBounds[0].getCenter(new THREE.Vector3()));
  check('Journey: onveilige start in gebouw wordt geweigerd', !modes.start() && modes.getState().mode === 'free');
  camera.position.set(120,7,-100); const detour = route.planEntry(camera.position.clone(), initialPosition);
  check('Journey: veilige aanloop via hoogte bij geblokkeerde directe route', detour && detour.length > 2 && detour.every(point => route.isSafe(point)));
  const entryPath = createEntryPath(detour); let entrySafe = true;
  for (let t=0;t<=entryPath.duration;t+=1/120) entrySafe &&= route.isSafe(entryPath.sample(t,new THREE.Vector3()));
  check('Journey: volledige aanloop langs omweg blijft vrij van geometrie', entrySafe);
  const movingCamera = createCamera(1, NEON_CITY_CONFIG.camera), movingJourney = createJourney(route), initialVelocity = new THREE.Vector3(0,0,-10);
  movingJourney.start(movingCamera,initialVelocity); movingJourney.update(0.0001,movingCamera);
  check('Journey: aanloop neemt bestaande vliegsnelheid vloeiend over', movingCamera.position.clone().sub(initialPosition).divideScalar(0.0001).distanceTo(initialVelocity) < 0.001);
  movingJourney.dispose();
  const entries = [30,60,120].map(fps => {
    const c=createCamera(1, NEON_CITY_CONFIG.camera), j=createJourney(route); c.position.set(0,12,90); j.start(c);
    for (let i=0;i<2*fps;i++) j.update(1/fps,c);
    j.dispose(); return c;
  });
  check('Journey: aanlooppositie en kijkrichting gelijk bij 30/60/120 FPS', entries.slice(1).every(c => c.position.distanceTo(entries[0].position) < 1e-7 && c.quaternion.angleTo(entries[0].quaternion) < 1e-7));
  modes.dispose(); modes.dispose(); button.click(); visibility.dispatchEvent(new Event('visibilitychange'));
  check('Journey: cleanup verwijdert bediening en voorkomt herstart', !modes.start() && modes.getState().mode === 'free');
  controls.dispose(); journey.dispose();
  check('Journey: disposed motor kan niet opnieuw starten', !journey.start(camera));
}
