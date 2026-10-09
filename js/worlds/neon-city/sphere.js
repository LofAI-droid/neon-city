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
  root.position.set(0, 17, -110);
  const shell = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(10, 24, 14)),
    new THREE.LineBasicMaterial({ color: 0x83cddd, transparent: true, opacity: 0.2, depthWrite: false })
  );
  root.add(shell);
  const rings = new THREE.Group();
  const ringGeometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, i) => {
    const angle = i / 128 * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * 10.15, Math.sin(angle) * 10.15, 0);
  }));
  const blue = new THREE.LineBasicMaterial({ color: 0x9ce1e8, transparent: true, opacity: 0.42, depthWrite: false });
  const gold = new THREE.LineBasicMaterial({ color: 0xd9b780, transparent: true, opacity: 0.4, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const ring = new THREE.Line(ringGeometry, i % 3 === 0 ? gold : blue);
    ring.rotation.set(i * 0.61, i * 0.86, i * 0.29);
    rings.add(ring);
  }
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
      root.position.y = 17 + Math.sin(time * 0.65) * 0.7;
      shell.rotation.y = time * 0.075;
      rings.rotation.set(time * 0.035, time * -0.065, time * 0.02);
      const pulse = 14 + Math.sin(time * 1.5) * 0.6;
      glow.scale.set(pulse, pulse, 1);
    }
  };
}
