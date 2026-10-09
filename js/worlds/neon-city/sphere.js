import * as THREE from '../../../lib/three/three.module.js';

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,250,227,1)');
  gradient.addColorStop(0.08, 'rgba(255,230,199,0.95)');
  gradient.addColorStop(0.23, 'rgba(237,159,175,0.35)');
  gradient.addColorStop(0.5, 'rgba(93,180,229,0.08)');
  gradient.addColorStop(1, 'rgba(93,180,229,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export function createSphere() {
  const root = new THREE.Group();
  root.position.set(0, 19, -82);
  const sourceSphere = new THREE.SphereGeometry(11, 24, 14);
  const shellGeometry = new THREE.WireframeGeometry(sourceSphere);
  sourceSphere.dispose();
  const shell = new THREE.LineSegments(
    shellGeometry,
    new THREE.LineBasicMaterial({ color: 0x83cddd, transparent: true, opacity: 0.28, depthWrite: false })
  );
  root.add(shell);
  const rings = new THREE.Group();
  const ringLayers = [[], []];
  const point = new THREE.Vector3();
  for (let i = 0; i < 7; i++) {
    const rotation = new THREE.Euler(i * 0.61, i * 0.86, i * 0.29);
    const layer = ringLayers[i % 3 === 0 ? 1 : 0];
    for (let j = 0; j < 96; j++) {
      for (const step of [j, j + 1]) {
        const angle = step / 96 * Math.PI * 2;
        point.set(Math.cos(angle) * 11.15, Math.sin(angle) * 11.15, 0).applyEuler(rotation);
        layer.push(point.x, point.y, point.z);
      }
    }
  }
  ringLayers.forEach((positions, index) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    rings.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      color: index ? 0xe2c18b : 0xa8e9ee, transparent: true, opacity: 0.5, depthWrite: false
    })));
  });
  root.add(rings);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  glow.scale.set(14, 14, 1);
  root.add(glow);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshBasicMaterial({ color: 0xffebd7 }));
  root.add(core);
  let time = 0;
  return {
    object: root,
    update(dt) {
      time += dt;
      root.position.y = 19 + Math.sin(time * 0.65) * 0.7;
      shell.rotation.y = time * 0.075;
      rings.rotation.set(time * 0.035, time * -0.065, time * 0.02);
      const pulse = 14 + Math.sin(time * 1.5) * 0.6;
      glow.scale.set(pulse, pulse, 1);
    }
  };
}
