import * as THREE from '../lib/three/three.module.js';
import { createEngine } from '../js/engine.js?v=wp3';
import { createAudioManager } from '../js/audio/audio-manager.js?v=wp3';
import { createWorldRegistry } from '../js/world-registry.js?v=wp3';
import { createWorldManager } from '../js/world-manager.js?v=wp3';
import { createNeonCity } from '../js/worlds/neon-city/world.js?v=wp2';
import { createTestWorld, TEST_WORLD_CONFIG } from './test-world.js';

const rejects = (fn, part) => { try { fn(); return false; } catch (error) { return error.message.includes(part); } };
const rejectsAsync = async (fn, part) => { try { await fn(); return false; } catch (error) { return error.message.includes(part); } };
const tick = () => new Promise(resolve => requestAnimationFrame(resolve));

function fakeAudio() {
  const elements = [];
  const counts = { contexts: 0, closes: 0, nodes: 0, disconnects: 0, plays: 0 };
  return {
    elements, counts,
    createContext() {
      counts.contexts++;
      const context = new EventTarget();
      context.currentTime = 1; context.state = 'suspended'; context.destination = {};
      context.resume = () => { context.state = 'running'; return Promise.resolve(); };
      context.close = () => { counts.closes++; context.state = 'closed'; return Promise.resolve(); };
      context.createGain = () => ({ gain: { value: 0, cancelAndHoldAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() { counts.disconnects++; } });
      context.createMediaElementSource = () => { counts.nodes++; return { connect() {}, disconnect() { counts.disconnects++; } }; };
      return context;
    },
    createElement() {
      const element = new EventTarget();
      element.currentTime = 7 + elements.length; element.paused = true; element.error = null;
      element.play = () => { counts.plays++; element.paused = false; return Promise.resolve(); };
      element.pause = () => { element.paused = true; };
      element.load = () => {}; element.removeAttribute = () => { element.src = ''; };
      elements.push(element); return element;
    }
  };
}

export async function testWP3(check) {
  check('WP3: register weigert dubbele IDs', rejects(() => createWorldRegistry([{ id:'a', create:createNeonCity }, { id:'a', create:createNeonCity }]), 'Dubbele'));
  check('WP3: register weigert ontbrekende factory', rejects(() => createWorldRegistry([{ id:'bad' }]), 'create'));
  const mismatch = createWorldRegistry([{ id:'wrong-world', create:() => createTestWorld() }]);
  check('WP3: register weigert afwijkende config-ID', rejects(() => mismatch.create('wrong-world'), 'komt niet overeen'));
  const reused = createTestWorld();
  const singleton = createWorldRegistry([{ id:'test-world', create:() => reused }]);
  singleton.create('test-world');
  check('WP3: register weigert hergebruik van oude wereldinstantie', rejects(() => singleton.create('test-world'), 'nieuwe wereldinstantie'));
  reused.dispose();

  const slow = fakeAudio(); let finishPlay;
  const delayedAudio = createAudioManager({ audio:{ sources:[{ id:'slow', type:'global', url:'./slow.mp3', gain:0.4 }] },
    settings:{ startStopSeconds:0.001 }, ...slow,
    createElement() {
      const element = slow.createElement();
      element.play = () => { slow.counts.plays++; return new Promise(resolve => { finishPlay = resolve; }); };
      return element;
    }
  });
  const pendingStart = delayedAudio.start();
  await delayedAudio.setSources({ sources:[] });
  finishPlay(); await pendingStart;
  check('WP3: late start na bronwissel herstart oude audio niet', delayedAudio.getState().state === 'empty' && slow.elements[0].paused && slow.counts.plays === 1 && slow.counts.contexts === 1);
  await delayedAudio.dispose();

  const host = document.createElement('div'); document.body.appendChild(host);
  const fake = fakeAudio();
  const audio = createAudioManager({ audio:{ sources:[] }, settings:{ startStopSeconds:0.001 }, ...fake });
  const engine = createEngine(host, { onUpdate(_, world) { audio.updateAudioState(world?.getAudioState() ?? {}); } });
  const canvas = engine.canvas;
  const tracker = {};
  const registry = createWorldRegistry([
    { id:'neon-city', create:createNeonCity },
    { id:'test-world', create:() => createTestWorld({ tracker }) },
    { id:'bad-config', create:() => createTestWorld({ config:{ ...TEST_WORLD_CONFIG, id:'bad-config', camera:{ ...TEST_WORLD_CONFIG.camera, fov:0 } } }) },
    { id:'broken-factory', create:() => { throw new Error('Factoryfout'); } },
    { id:'fail-world', create:() => createTestWorld({ config:{ ...TEST_WORLD_CONFIG, id:'fail-world' }, failInit:true, tracker }) }
  ]);
  const manager = createWorldManager({ registry, engine, audio });
  try {
    await manager.switchWorld('neon-city'); engine.start(); await tick();
    check('WP3: Neon City start met één canvas, mist en twee audiobronnen', host.querySelectorAll('canvas').length === 1 && engine.scene.children.length === 1 && engine.scene.fog?.isFogExp2 && audio.getState().sourceCount === 2);
    await audio.start();
    const firstTimes = fake.elements.map(element => element.currentTime);
    const plays = fake.counts.plays;
    check('WP3: twee Neon City-tracks starten onafhankelijk', plays === 2 && firstTimes.length === 2 && firstTimes[0] !== firstTimes[1] && fake.counts.contexts === 1);
    audio.setMuted(true); audio.setVolume(0.3);
    const activeBefore = engine.getWorld();
    check('WP3: onbekende wereld laat actieve wereld intact', await rejectsAsync(() => manager.switchWorld('unknown'), 'Onbekende') && engine.getWorld() === activeBefore && engine.scene.children.length === 1);
    check('WP3: ongeldige kandidaatconfiguratie laat actieve wereld intact', await rejectsAsync(() => manager.switchWorld('bad-config'), 'camera.fov') && engine.getWorld() === activeBefore && audio.getState().state === 'playing');
    check('WP3: factoryfout laat actieve wereld intact', await rejectsAsync(() => manager.switchWorld('broken-factory'), 'Factoryfout') && engine.getWorld() === activeBefore);
    check('WP3: dezelfde wereld opnieuw kiezen is een no-op', await manager.switchWorld('neon-city') === false && fake.counts.plays === plays);
    const guidedStarted = engine.flightModes.start();
    await manager.switchWorld('test-world'); await tick();
    check('WP3: wissel stopt Journey en activeert testwereld zonder route', guidedStarted && engine.flightModes.getState().mode === 'free' && !engine.flightModes.getState().available && manager.getState().activeId === 'test-world');
    check('WP3: andere pose, lens, achtergrond en geen mist', engine.camera.position.equals(new THREE.Vector3(6,4,18)) && engine.camera.fov === 72 && engine.scene.background.getHex() === 0x10243a && engine.scene.fog === null);
    check('WP3: oude tracks weg, AudioContext en masterinstellingen behouden', audio.getState().sourceCount === 0 && fake.elements.slice(0,2).every(element => element.paused && element.src === '') && fake.counts.contexts === 1 && fake.counts.closes === 0 && audio.getState().muted && audio.getState().volume === 0.3);
    engine.camera.position.set(100,100,100); engine.controls.reset();
    check('WP3: R gebruikt startpose van de testwereld', engine.camera.position.equals(new THREE.Vector3(6,4,18)));
    check('WP3: testwereld heeft één eigen mesh en geen Neon-objecten', engine.scene.children.length === 1 && engine.scene.children[0].children.length === 1 && tracker.inits === 1);
    await manager.switchWorld('neon-city'); await tick();
    check('WP3: A→B→A maakt nieuwe Neon City-instantie', engine.getWorld() !== activeBefore && engine.scene.fog?.isFogExp2 && engine.camera.position.equals(new THREE.Vector3(0,7,62)) && tracker.disposes === 1);
    check('WP3: nieuwe muziek wacht op Start, oude tijdlijn start niet vanzelf', audio.getState().state === 'idle' && audio.getState().sourceCount === 2 && fake.counts.plays === plays);
    await audio.start();
    check('WP3: nieuwe tracks gebruiken nog steeds één AudioContext', fake.counts.contexts === 1 && fake.counts.nodes === 4 && fake.counts.plays === 4 && audio.getState().muted && audio.getState().volume === 0.3);
    const inFlight = manager.switchWorld('test-world');
    const fixed = engine.camera.position.clone();
    canvas.dispatchEvent(new KeyboardEvent('keydown', { code:'ArrowUp', bubbles:true, cancelable:true }));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { code:'KeyR', bubbles:true, cancelable:true }));
    engine.controls.reset();
    engine.controls.update(1);
    check('WP3: tijdens fade zijn beweging en R/reset stilgezet', engine.isSuspended() && engine.camera.position.equals(fixed));
    check('WP3: overlappende wissel wordt duidelijk geweigerd', await rejectsAsync(() => manager.switchWorld('neon-city'), 'al bezig'));
    await inFlight;
    check('WP3: tijdens wissel bleef één canvas bestaan', host.querySelectorAll('canvas').length === 1 && engine.getWorld()?.config.id === 'test-world');
    await manager.switchWorld('fail-world').catch(() => {});
    check('WP3: init-fout geeft veilige lege toestand en zichtbare foutstatus', manager.getState().activeId === null && manager.getState().error?.includes('Testfout') && engine.getWorld() === null && engine.scene.children.length === 0 && engine.scene.fog === null && tracker.disposes >= 2);
    await manager.switchWorld('neon-city');
    check('WP3: herstel na init-fout zonder reload', manager.getState().activeId === 'neon-city' && engine.getWorld()?.config.id === 'neon-city' && engine.scene.children.length === 1);
    for (let i = 0; i < 20; i++) await manager.switchWorld(i % 2 ? 'neon-city' : 'test-world');
    check('WP3: twintig extra wissels houden één canvas en één wereld vast', host.querySelectorAll('canvas').length === 1 && engine.scene.children.length === 1 && manager.getState().activeId === 'neon-city' && fake.counts.contexts === 1);
    check('WP3: testwereldresources worden per activatie opgeruimd', tracker.inits === tracker.disposes && tracker.resources === 2 * tracker.disposes);
    await audio.start();
    const pending = manager.switchWorld('test-world');
    await manager.dispose(); await pending;
    check('WP3: dispose tijdens fade stopt wissel, canvas en context', host.querySelectorAll('canvas').length === 0 && fake.counts.closes === 1 && fake.elements.every(element => element.paused) && manager.getState().disposed);
    check('WP3: na dispose geen nieuwe wereldwissel mogelijk', await rejectsAsync(() => manager.switchWorld('neon-city'), 'opgeruimd'));
  } finally {
    await manager.dispose(); host.remove();
  }
}
