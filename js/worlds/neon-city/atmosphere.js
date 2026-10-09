import * as THREE from '../../../lib/three/three.module.js';

// A single draw call; only the time uniform changes, no per-frame buffer uploads.
export function createAtmosphere() {
  let seed = 48217;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const positions = [], phases = [], speeds = [], colors = [];
  for (let i = 0; i < 90; i++) {
    const x = (random() - 0.5) * 160;
    const y = random() * 90;
    const z = 40 - random() * 330;
    const length = i % 9 === 0 ? 5 + random() * 7 : 0.3 + random() * 0.7;
    const phase = random() * 6.28;
    const speed = 0.8 + random() * 1.4;
    const color = new THREE.Color(i % 7 === 0 ? 0xd8bd85 : 0x73c8dc);
    for (const endpoint of [0, 1]) {
      positions.push(x, y + length * endpoint, z);
      phases.push(phase); speeds.push(speed); colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute('speed', new THREE.Float32BufferAttribute(speeds, 1));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false,
    vertexShader: `
      attribute float phase;
      attribute float speed;
      attribute vec3 color;
      uniform float time;
      varying vec3 tint;
      varying float visibility;
      void main() {
        vec3 p = position;
        p.y += sin(time * 0.16 * speed + phase) * 4.0;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        float distanceSquared = dot(view.xyz, view.xyz);
        visibility = (0.13 + 0.12 * sin(time * 0.5 + phase)) * exp(-0.000035 * distanceSquared);
        tint = color;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      varying vec3 tint;
      varying float visibility;
      void main() {
        gl_FragColor = vec4(tint, visibility);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const object = new THREE.LineSegments(geometry, material);
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += 4;
  return { object, update(dt) { material.uniforms.time.value += dt; } };
}
