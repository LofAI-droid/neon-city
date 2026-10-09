import * as THREE from '../lib/three/three.module.js';
import { testEnergyCore } from './energy-core.js';
import { testAudio } from './audio.js';
import { createCamera } from '../js/camera.js';
import { createControls } from '../js/controls.js';
import { createBuildings } from '../js/worlds/neon-city/buildings.js';
import { createNeonCity } from '../js/worlds/neon-city/world.js';

const output = document.querySelector('#results');
const results = [];
const check = (name, condition) => { results.push(`${condition ? 'PASS' : 'FAIL'} — ${name}`); };
const canvas = document.querySelector('#canvas');
const key = (type, code) => canvas.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
function simulate(code, fps = 60) {
  const camera = createCamera(1);
  const controls = createControls(camera, canvas);
  key('keydown', code);
  for (let i = 0; i < fps; i++) controls.update(1 / fps);
  key('keyup', code);
  controls.dispose();
  return camera;
}
function disposeObject(object) {
  object.traverse(child => { child.geometry?.dispose(); child.material?.dispose(); });
}
try {
  check('Vooruit / achteruit', simulate('ArrowUp').position.z < 62 && simulate('ArrowDown').position.z > 62);
  check('Stijgen / dalen (beide Shift-toetsen)', simulate('Space').position.y > 7 && simulate('ShiftLeft').position.y < 7 && simulate('ShiftRight').position.y < 7);
  check('A / D zijwaarts', simulate('KeyA').position.x < 0 && simulate('KeyD').position.x > 0);
  check('Pijltjes draaien', simulate('ArrowLeft').rotation.y > 0 && simulate('ArrowRight').rotation.y < 0);
  const a = simulate('ArrowUp', 30), b = simulate('ArrowUp', 60), c = simulate('ArrowUp', 120);
  check('Beweging gelijk bij 30 / 60 / 120 FPS', a.position.distanceTo(b.position) < 0.00001 && b.position.distanceTo(c.position) < 0.00001);
  const camera = createCamera(1), controls = createControls(camera, canvas);
  key('keydown', 'Space'); controls.update(0.5); key('keyup', 'Space');
  const moved = camera.position.y;
  window.dispatchEvent(new Event('blur')); controls.update(1);
  check('Focusverlies stopt vastzittende toetsen', Math.abs(camera.position.y - moved) < 0.00001);
  key('keydown', 'KeyR');
  check('R herstelt positie en oriëntatie', camera.position.distanceTo(createCamera(1).position) < 0.00001 && camera.rotation.y === 0);
  controls.dispose();
  const buildingsA = createBuildings(), buildingsB = createBuildings();
  check('108 reproduceerbare gebouwen', buildingsA.userData.buildingCount === 108 && buildingsA.children.every((child, i) => {
    const left = child.geometry.attributes.position.array, right = buildingsB.children[i].geometry.attributes.position.array;
    return left.length === right.length && left.every((value, j) => Number.isFinite(value) && value === right[j]);
  }));
  let degenerate = 0;
  buildingsA.traverse(child => {
    const positions = child.geometry?.attributes.position.array;
    if (!positions) return;
    for (let i = 0; i < positions.length; i += 6) if (positions[i] === positions[i + 3] && positions[i + 1] === positions[i + 4] && positions[i + 2] === positions[i + 5]) degenerate++;
  });
  check('Geen lijnsegmenten met lengte nul', degenerate === 0);
  disposeObject(buildingsA); disposeObject(buildingsB);
  const scene = new THREE.Scene(), world = createNeonCity();
  world.init(scene); world.update(1 / 60);
  const geometrySet = new Set(), materialSet = new Set(), textureSet = new Set();
  scene.traverse(child => {
    if (child.geometry) geometrySet.add(child.geometry);
    if (child.material) { materialSet.add(child.material); if (child.material.map) textureSet.add(child.material.map); }
  });
  let disposed = 0;
  const resources = [...geometrySet, ...materialSet, ...textureSet];
  resources.forEach(resource => resource.addEventListener('dispose', () => disposed++));
  world.dispose();
  check('Alle geometrieën, materialen en textures opgeruimd', disposed === resources.length && scene.children.length === 0);
  world.init(scene); world.update(1 / 60); world.dispose();
  check('Wereld kan opnieuw worden geïnitialiseerd', scene.children.length === 0);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(200, 150);
  world.init(scene); world.update(1 / 60);
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => { errors.push(args.join(' ')); originalError(...args); };
  try { renderer.render(scene, createCamera(4 / 3)); } finally { console.error = originalError; }
  check('WebGL-scène en atmosferische shader renderen zonder fout', errors.length === 0 && renderer.info.render.calls === 10);
  results.push(`INFO — ${renderer.info.render.calls} draws; ${renderer.info.render.lines} lijnsegmenten`);
  world.dispose();
  testEnergyCore(check, renderer);
  renderer.dispose(); renderer.forceContextLoss();
  await testAudio(check);
} catch (error) { results.push(`FAIL — ${error.stack}`); }
output.replaceChildren(...results.map(text => { const line = document.createElement('p'); line.textContent = text; return line; }));
