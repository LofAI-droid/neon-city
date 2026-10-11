import * as THREE from '../lib/three/three.module.js';
import { createCamera } from '../js/camera.js?v=wp1';
import { createEngine } from '../js/engine.js?v=wp4';
import { createAudioManager } from '../js/audio/audio-manager.js?v=wp3';
import { applyWorldEnvironment, validateWorldConfig } from '../js/world-contract.js?v=wp2';
import { createWorldRegistry } from '../js/world-registry.js?v=wp3';
import { createWorldManager } from '../js/world-manager.js?v=wp3';
import { createNeonCity } from '../js/worlds/neon-city/world.js?v=wp4';
import { createTestWorld, TEST_WORLD_CONFIG } from './test-world.js?v=wp5';

const tick = () => new Promise(resolve => requestAnimationFrame(resolve));
async function waitFor(test, timeoutMs = 5000) {
  const deadline = performance.now() + timeoutMs;
  while (!test() && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  return test();
}
const variant = (id, changes = {}) => ({
  ...TEST_WORLD_CONFIG, id,
  camera: { ...TEST_WORLD_CONFIG.camera, ...changes.camera },
  environment: { ...TEST_WORLD_CONFIG.environment, ...changes.environment },
  settings: { testObject: { ...TEST_WORLD_CONFIG.settings.testObject, ...changes.testObject } }
});

export async function testWP5(check, info = () => {}) {
  const configured = variant('test-variant', {
    camera: { position: [9, 6, 22], rotation: [0.12, -0.3, 0] },
    environment: { background: 0x203044 },
    testObject: { position: [3, 5, -2], scale: 1.5, rotationSpeed: 0.7 }
  });
  const fixtureScene = new THREE.Scene(), fixtureTracker = {};
  const fixture = createTestWorld({ config: configured, tracker: fixtureTracker,
    loadImage: (_, onLoad) => onLoad({ width: 64, height: 64 }) });
  applyWorldEnvironment(fixtureScene, configured);
  fixture.init(fixtureScene);
  const fixtureRoot = fixtureScene.children[0], fixtureCube = fixtureRoot.children[0];
  check('WP5: Test World-config bevat eigen camera, omgeving, audio en Journey-vlag', validateWorldConfig(TEST_WORLD_CONFIG) === TEST_WORLD_CONFIG && TEST_WORLD_CONFIG.guidedJourney === false && TEST_WORLD_CONFIG.audio.sources.length === 0 && TEST_WORLD_CONFIG.environment.fog === null);
  check('WP5: gewijzigde camera en achtergrond werken zonder enginewijziging', createCamera(1, configured.camera).position.equals(new THREE.Vector3(9,6,22)) && fixtureScene.background.getHex() === 0x203044 && fixtureScene.fog === null);
  check('WP5: objectpositie en schaal komen uit wereldinstellingen', fixtureCube.position.equals(new THREE.Vector3(3,5,-2)) && fixtureCube.scale.x === 1.5 && fixtureRoot.children.length === 2);
  const angle = fixtureCube.rotation.y; fixture.update(1);
  check('WP5: rotatiesnelheid komt uit wereldinstellingen', Math.abs(fixtureCube.rotation.y - angle - 0.7) < 1e-9);
  check('WP5: de wereld koppelt geladen textuur aan haar eigen materiaal', fixture.getAssetState().status === 'ready' && fixtureCube.material.map?.isTexture && fixtureCube.material.map.image.width === 64);
  fixture.dispose(); fixture.dispose();
  check('WP5: geometrieën, materialen en textuur worden eenmaal opgeruimd', fixtureScene.children.length === 0 && fixtureTracker.createdResources === 5 && fixtureTracker.resources === 5 && fixtureTracker.disposes === 1);

  let lateLoad;
  const lateTracker = {};
  const lateScene = new THREE.Scene();
  const late = createTestWorld({ tracker: lateTracker, loadImage: (_, onLoad) => { lateLoad = onLoad; } });
  late.init(lateScene);
  check('WP5: asynchrone assetload blijft eerst in laadstatus', late.getAssetState().status === 'loading' && !late.getAssetState().hasTexture);
  late.dispose(); lateLoad({ width:64, height:64 });
  check('WP5: laat laadresultaat activeert verwijderde wereld niet', late.getAssetState().status === 'disposed' && !late.getAssetState().hasTexture && lateScene.children.length === 0 && lateTracker.lateIgnored === 1 && lateTracker.createdResources === lateTracker.resources);

  const host = document.createElement('div'); document.body.appendChild(host);
  const engine = createEngine(host);
  const canvas = engine.canvas, camera = engine.camera, controls = engine.controls;
  const audio = createAudioManager({ audio: { sources: [] } });
  audio.setMuted(true); audio.setVolume(0.3);
  const tracker = {};
  let delayedCallback;
  const registry = createWorldRegistry([
    { id:'neon-city', create:createNeonCity },
    { id:'test-world', create:() => createTestWorld({ tracker }) },
    { id:'test-variant', create:() => createTestWorld({ config:configured }) },
    { id:'missing-world', create:() => createTestWorld({ config:variant('missing-world', { testObject:{ texture:'../assets/worlds/test-world/__ontbrekend__.svg' } }) }) },
    { id:'late-world', create:() => createTestWorld({ config:variant('late-world'), loadImage:(_,onLoad) => { delayedCallback = onLoad; } }) },
    { id:'fail-world', create:() => createTestWorld({ config:variant('fail-world'), failInit:true }) }
  ]);
  const manager = createWorldManager({ registry, engine, audio });
  try {
    await manager.switchWorld('neon-city'); engine.start(); await tick(); await tick();
    const neonBefore = engine.getRenderStats();
    check('WP5: productiewereld gebruikt dezelfde gedeelde engine', engine.getWorld()?.config.id === 'neon-city' && neonBefore.draws === 10 && engine.scene.fog?.isFogExp2);
    await manager.switchWorld('test-world');
    const testWorld = engine.getWorld();
    const loaded = await waitFor(() => testWorld.getAssetState().status !== 'loading');
    await tick();
    const testStats = engine.getRenderStats();
    check('WP5: lokaal SVG-asset laadt onafhankelijk van Neon City', loaded && testWorld.getAssetState().status === 'ready' && testWorld.getAssetState().url.includes('/assets/worlds/test-world/signal.svg') && testWorld.getAssetState().hasTexture);
    check('WP5: grondvlak en getextureerd object renderen met twee drawcalls', engine.scene.children[0].children.length === 2 && engine.scene.children[0].children[0].material.map?.image?.width === 64 && testStats.draws === 2);
    check('WP5: Test World heeft eigen pose, donkerblauw en geen mist', camera.position.equals(new THREE.Vector3(6,4,18)) && engine.scene.background.getHex() === 0x10243a && engine.scene.fog === null);
    check('WP5: stille wereld heeft Free Flight en geen Journey', engine.flightModes.getState().mode === 'free' && !engine.flightModes.getState().available && audio.getState().sourceCount === 0);
    await manager.switchWorld('test-variant');
    check('WP5: aangepaste configuratie werkt in dezelfde engine', camera.position.equals(new THREE.Vector3(9,6,22)) && Math.abs(camera.rotation.y + 0.3) < 1e-9 && engine.scene.background.getHex() === 0x203044 && engine.scene.children[0].children[0].scale.x === 1.5);
    await manager.switchWorld('missing-world');
    const missing = engine.getWorld();
    const failed = await waitFor(() => missing.getAssetState().status !== 'loading');
    check('WP5: ontbrekend asset geeft foutstatus en behoudt Free Flight', failed && missing.getAssetState().status === 'error' && missing.getAssetState().error.includes('__ontbrekend__') && !missing.getAssetState().hasTexture && manager.getState().activeId === 'missing-world' && engine.flightModes.getState().mode === 'free');
    await manager.switchWorld('late-world');
    const pending = engine.getWorld();
    check('WP5: wereldwissel kan plaatsvinden terwijl textuur nog laadt', pending.getAssetState().status === 'loading');
    await manager.switchWorld('neon-city');
    delayedCallback({ width:64, height:64 });
    check('WP5: late callback na wereldwissel wijzigt de nieuwe wereld niet', pending.getAssetState().status === 'disposed' && !pending.getAssetState().hasTexture && engine.getWorld()?.config.id === 'neon-city' && engine.scene.children.length === 1);
    const previous = engine.getWorld();
    let unknown = false;
    try { await manager.switchWorld('unknown'); } catch (error) { unknown = error.message.includes('Onbekende'); }
    check('WP5: onbekende wereld laat bestaande wereld intact', unknown && engine.getWorld() === previous);
    const journeyStarted = engine.flightModes.start();
    await manager.switchWorld('test-world');
    check('WP5: wereldwissel beëindigt Neon City-Journey definitief', journeyStarted && !engine.flightModes.getState().available && engine.flightModes.getState().mode === 'free');
    await manager.switchWorld('neon-city');
    await manager.switchWorld('fail-world').catch(() => {});
    check('WP5: opzettelijke init-fout laat veilige hersteltoestand', manager.getState().activeId === null && engine.getWorld() === null && engine.scene.children.length === 0);
    await manager.switchWorld('neon-city');
    check('WP5: Neon City herstelt zonder herladen', manager.getState().activeId === 'neon-city' && engine.flightModes.getState().available);
    for (let i = 0; i < 20; i++) {
      await manager.switchWorld('test-world');
      if (!(await waitFor(() => engine.getWorld().getAssetState().status !== 'loading'))) throw new Error(`Testasset bleef laden bij wissel ${i + 1}.`);
      await manager.switchWorld('neon-city');
    }
    await tick(); await tick();
    const neonAfter = engine.getRenderStats();
    check('WP5: twintig A→B→A-cycli houden één canvas, camera en controls', host.querySelectorAll('canvas').length === 1 && engine.canvas === canvas && engine.camera === camera && engine.controls === controls && engine.scene.children.length === 1 && manager.getState().activeId === 'neon-city');
    check('WP5: assets van alle verwijderde testwerelden zijn opgeruimd', tracker.inits === tracker.disposes && tracker.createdResources === tracker.resources && tracker.assetLoads >= 20);
    check('WP5: renderer-resource-indicator blijft begrensd na wissels', neonAfter.geometries <= neonBefore.geometries + 1 && neonAfter.textures <= neonBefore.textures + 1 && neonAfter.draws === neonBefore.draws);
    check('WP5: mute, volume en audiobronnen volgen actieve wereld', audio.getState().muted && audio.getState().volume === 0.3 && audio.getState().sourceCount === 2 && engine.flightModes.getState().available);
    info(`Neon vóór/na 20 cycli: draws ${neonBefore.draws}/${neonAfter.draws}, geometrieën ${neonBefore.geometries}/${neonAfter.geometries}, textures ${neonBefore.textures}/${neonAfter.textures}; Test World: ${testStats.draws} draws, ${testStats.geometries} geometrieën, ${testStats.textures} textures.`);
  } finally { await manager.dispose(); host.remove(); }
  check('WP5: totale cleanup verwijdert canvas en sluit wereld', host.querySelectorAll('canvas').length === 0 && manager.getState().disposed);
}
