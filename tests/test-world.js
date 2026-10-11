import * as THREE from '../lib/three/three.module.js';

// Test fixture only: the production registry still contains Neon City alone.
// The texture path is relative to this module, so both test pages use one config.
export const TEST_WORLD_CONFIG = {
  id: 'test-world', name: 'Test World',
  camera: { position: [6, 4, 18], rotation: [0.08, 0.25, 0], fov: 72, near: 0.2, far: 200 },
  environment: { background: 0x10243a, fog: null },
  guidedJourney: false, audio: { sources: [] },
  settings: {
    testObject: {
      position: [0, 4, 0], scale: 1, rotationSpeed: 0.2,
      texture: '../assets/worlds/test-world/signal.svg'
    }
  }
};

const defaultLoadImage = (url, onLoad, onError) => new THREE.ImageLoader().load(url, onLoad, undefined, onError);

export function createTestWorld({ config = TEST_WORLD_CONFIG, failInit = false, tracker, loadImage = defaultLoadImage } = {}) {
  const setting = config.settings?.testObject;
  if (!setting || !Array.isArray(setting.position) || setting.position.length !== 3 || !setting.position.every(Number.isFinite) ||
      !Number.isFinite(setting.scale) || setting.scale <= 0 || !Number.isFinite(setting.rotationSpeed) ||
      typeof setting.texture !== 'string' || !setting.texture.trim()) {
    throw new Error('Ongeldige Test World-instellingen voor object of textuur.');
  }
  const root = new THREE.Group();
  const own = resource => {
    if (tracker) {
      tracker.createdResources = (tracker.createdResources ?? 0) + 1;
      resource.addEventListener('dispose', () => { tracker.resources = (tracker.resources ?? 0) + 1; });
    }
    return resource;
  };
  const geometry = own(new THREE.BoxGeometry(4, 4, 4));
  const material = own(new THREE.MeshBasicMaterial({ color: 0x79d5dc }));
  const cube = new THREE.Mesh(geometry, material);
  cube.position.fromArray(setting.position);
  cube.scale.setScalar(setting.scale);
  root.add(cube);
  const groundGeometry = own(new THREE.PlaneGeometry(80, 80));
  const groundMaterial = own(new THREE.MeshBasicMaterial({ color: 0x081725, side: THREE.DoubleSide }));
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  root.add(ground);
  const textureUrl = new URL(setting.texture, import.meta.url).href;
  let texture = null, assetStatus = 'idle', assetError = '', disposed = false;
  return {
    config,
    init(scene) {
      if (disposed) throw new Error('Test World is al opgeruimd.');
      tracker && (tracker.inits = (tracker.inits ?? 0) + 1);
      scene.add(root);
      if (failInit) throw new Error('Testfout tijdens init');
      assetStatus = 'loading';
      try {
        loadImage(textureUrl, image => {
          if (disposed) { tracker && (tracker.lateIgnored = (tracker.lateIgnored ?? 0) + 1); return; }
          texture = own(new THREE.Texture(image));
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;
          material.map = texture;
          material.color.set(0xffffff);
          material.needsUpdate = true;
          assetStatus = 'ready';
          tracker && (tracker.assetLoads = (tracker.assetLoads ?? 0) + 1);
        }, error => {
          if (disposed) return;
          assetStatus = 'error';
          assetError = `Test World-textuur kon niet laden: ${textureUrl} (${error?.message ?? 'bestand ontbreekt of is onleesbaar'}).`;
          tracker && (tracker.assetErrors = (tracker.assetErrors ?? 0) + 1);
        });
      } catch (error) {
        assetStatus = 'error';
        assetError = `Test World-textuur kon niet laden: ${textureUrl} (${error.message}).`;
        tracker && (tracker.assetErrors = (tracker.assetErrors ?? 0) + 1);
      }
    },
    update(dt) { cube.rotation.y += dt * setting.rotationSpeed; tracker && (tracker.updates = (tracker.updates ?? 0) + 1); },
    getAudioState() { return { distances: {} }; },
    getAssetState() { return { status: assetStatus, error: assetError, url: textureUrl, hasTexture: Boolean(texture) }; },
    dispose() {
      if (disposed) return;
      disposed = true; assetStatus = 'disposed';
      root.removeFromParent();
      texture?.dispose(); geometry.dispose(); material.dispose(); groundGeometry.dispose(); groundMaterial.dispose();
      texture = null; root.clear();
      tracker && (tracker.disposes = (tracker.disposes ?? 0) + 1);
    }
  };
}
