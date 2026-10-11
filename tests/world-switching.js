import { createEngine } from '../js/engine.js?v=wp4';
import { createAudioManager } from '../js/audio/audio-manager.js?v=wp3';
import { createAudioPanel } from '../js/audio/audio-panel.js?v=wp3';
import { createFlightPanel } from '../js/ui/flight-panel.js?v=wp4';
import { createWorldRegistry } from '../js/world-registry.js?v=wp3';
import { createWorldManager } from '../js/world-manager.js?v=wp3';
import { createNeonCity } from '../js/worlds/neon-city/world.js?v=wp4';
import { NEON_CITY_CONFIG } from '../js/worlds/neon-city/config.js?v=wp4';
import { createTestWorld, TEST_WORLD_CONFIG } from './test-world.js?v=wp5';

const find = id => document.querySelector(`#${id}`);
const status = find('switch-status');
let engine, audio, audioPanel, flightPanel, manager;
function renderReadout(state = manager?.getState()) {
  if (!engine || !audio) return;
  const scene = engine.scene;
  const stats = engine.getRenderStats();
  const asset = engine.getWorld()?.getAssetState?.();
  find('readout').textContent = `Wereld: ${state?.activeId ?? 'geen'}\nCanvas: ${find('world').querySelectorAll('canvas').length} · scèneobjecten: ${scene.children.length}\nDrawcalls vorige frame: ${stats.draws} · geometrieën: ${stats.geometries} · textures: ${stats.textures}\nCamera: ${engine.camera.position.toArray().map(n => n.toFixed(1)).join(', ')}\nMist: ${scene.fog ? 'aan' : 'uit'} · Audio: ${audio.getState().state}\nTestasset: ${asset?.status ?? 'n.v.t.'}\n${find('performance').textContent} · ${find('performance').title}`;
}
try {
  engine = createEngine(find('world'), {
    ui: { performance: find('performance') },
    onUpdate(dt, world) {
      audio.updateAudioState(world?.getAudioState() ?? {});
      audioPanel.update(dt);
      renderReadout();
    }
  });
  audio = createAudioManager({ audio:{ sources:[] }, onChange:() => audioPanel?.render() });
  audioPanel = createAudioPanel(audio, { elements:{ start:find('audio-start'), mute:find('audio-mute'), slider:find('audio-volume'), volume:find('audio-volume-value'), status:find('audio-status'), mix:find('audio-mix') }, focusTarget:engine.canvas });
  flightPanel = createFlightPanel({ engine, controls:engine.controls, modes:engine.flightModes, canvas:engine.canvas,
    elements:{ mouse:find('mouse'), reset:find('reset'), quality:find('quality'), journey:find('journey'), progress:find('progress'), status:find('flight-status'), modeLabel:find('mode') } });
  const registry = createWorldRegistry([
    { id:'neon-city', create:() => createNeonCity({ config:{ ...NEON_CITY_CONFIG, audio:{ sources:NEON_CITY_CONFIG.audio.sources.map(source => ({ ...source, url:source.url.replace('./assets/', '../assets/') })) } } }) },
    { id:'test-world', create:createTestWorld },
    { id:'fail-world', create:() => createTestWorld({ config:{ ...TEST_WORLD_CONFIG, id:'fail-world' }, failInit:true }) }
  ]);
  manager = createWorldManager({ registry, engine, audio, onChange(state) {
    status.textContent = state.error ?? (state.busy ? 'Wereld wordt veilig gewisseld…' : state.activeId ? `Actief: ${state.activeId}` : 'Geen actieve wereld');
    for (const id of ['neon','test','back','fail']) find(id).disabled = state.busy;
    renderReadout(state);
  } });
  for (const [button,id] of [['neon','neon-city'],['test','test-world'],['back','neon-city'],['fail','fail-world']]) {
    find(button).addEventListener('click', async () => {
      try {
        await manager.switchWorld(id);
      } catch (error) { console.warn('Verwachte of onverwachte wisselfout:', error); }
      const ui = engine.getWorld()?.config.ui;
      audioPanel.setPresentation({ sourceId:ui?.mixSourceId, label:ui?.mixLabel });
    });
  }
  await manager.switchWorld('neon-city');
  audioPanel.setPresentation({ sourceId:'energy-core', label:'Kernmix' });
  engine.start();
  window.addEventListener('pagehide', () => { flightPanel.dispose(); audioPanel.dispose(); manager.dispose().catch(console.error); });
} catch (error) {
  status.textContent = `Testpagina kon niet starten: ${error.message}`;
  console.error(error);
  flightPanel?.dispose(); audioPanel?.dispose();
  if (manager) manager.dispose().catch(console.error);
  else { engine?.dispose(); audio?.dispose().catch(console.error); }
}
