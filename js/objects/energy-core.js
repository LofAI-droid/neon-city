import * as THREE from '../../lib/three/three.module.js';
import { resolveEnergySettings } from './energy-core-settings.js';
import { createEnergyResponse } from './energy-response.js';

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [stop, alpha] of [[0, 1], [0.08, 0.95], [0.23, 0.35], [0.5, 0.08], [1, 0]]) {
    gradient.addColorStop(stop, `rgba(255,255,255,${alpha})`);
  }
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

// Optional onInteraction(snapshot) is the future audio/portal integration point.
// This object never changes the camera, plays audio or performs navigation.
export function createEnergyCore({ position = [0, 0, 0], settings: overrides = {}, onInteraction } = {}) {
  const settings = resolveEnergySettings(overrides);
  const response = createEnergyResponse(settings);
  const root = new THREE.Group();
  root.name = 'interactive-energy-core';
  root.position.fromArray(position);
  const baseY = root.position.y;
  const center = new THREE.Vector3(), observer = new THREE.Vector3();
  const cyan = new THREE.Color(settings.colors.cyan);
  const turquoise = new THREE.Color(settings.colors.turquoise);
  const gold = new THREE.Color(settings.colors.gold);
  const pale = new THREE.Color(settings.colors.coreRest);
  const bright = new THREE.Color(settings.colors.coreMaximum);
  const orbitEnergy = { value: 0 };
  const source = new THREE.SphereGeometry(settings.radius, 24, 14);
  const shellGeometry = new THREE.WireframeGeometry(source);
  source.dispose();
  const shell = new THREE.LineSegments(shellGeometry, new THREE.LineBasicMaterial({ color: cyan, transparent: true, opacity: settings.brightness.shellRest, depthWrite: false }));
  root.add(shell);
  const rings = new THREE.Group();
  const layers = [{ positions: [], reveals: [] }, { positions: [], reveals: [] }];
  const point = new THREE.Vector3();
  for (let i = 0; i < settings.orbitCount; i++) {
    const rotation = new THREE.Euler(i * 0.61, i * 0.86, i * 0.29);
    const layer = layers[i % 3 === 0 ? 1 : 0];
    const reveal = i < 3 ? -1 : 0.12 + (i - 3) / Math.max(1, settings.orbitCount - 4) * 0.8;
    const radius = settings.radius * (1.013 + (i % 4) * 0.022);
    for (let j = 0; j < settings.orbitSegments; j++) for (const step of [j, j + 1]) {
      const angle = step / settings.orbitSegments * Math.PI * 2;
      point.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0).applyEuler(rotation);
      layer.positions.push(point.x, point.y, point.z); layer.reveals.push(reveal);
    }
  }
  layers.forEach((layer, index) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(layer.positions, 3));
    geometry.setAttribute('reveal', new THREE.Float32BufferAttribute(layer.reveals, 1));
    const material = new THREE.LineBasicMaterial({ color: index ? gold : cyan, transparent: true, opacity: settings.brightness.orbitRest, depthWrite: false });
    // Retain Three.js's fog, clipping and color-space handling; only fade each ring.
    material.onBeforeCompile = shader => {
      shader.uniforms.orbitEnergy = orbitEnergy;
      shader.vertexShader = 'attribute float reveal; varying float vReveal;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvReveal = reveal;');
      shader.fragmentShader = 'uniform float orbitEnergy; varying float vReveal;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity * smoothstep(vReveal - 0.1, vReveal + 0.1, orbitEnergy) );');
    };
    material.customProgramCacheKey = () => 'energy-orbit-reveal-v1';
    rings.add(new THREE.LineSegments(geometry, material));
  });
  root.add(rings);
  const texture = glowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color: cyan, opacity: settings.brightness.glowRest, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  root.add(glow);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(settings.radius * 0.055, 1), new THREE.MeshBasicMaterial({ color: pale, transparent: true, opacity: 0.75, depthWrite: false }));
  root.add(core);
  const coreState = response.state;
  let time = 0, angle = 0, callbackTime = 0;
  let disposed = false;
  function applyVisuals() {
    const strength = coreState.intensity;
    const colorWave = (Math.sin(time * 0.23) + 1) * 0.5;
    shell.material.color.copy(cyan).lerp(turquoise, coreState.resonance * colorWave * 0.55);
    shell.material.opacity = THREE.MathUtils.lerp(settings.brightness.shellRest, settings.brightness.shellMaximum, strength);
    rings.children.forEach((ring, index) => {
      ring.material.color.copy(index ? gold : cyan).lerp(index ? cyan : turquoise, coreState.resonance * colorWave * 0.3);
      ring.material.opacity = THREE.MathUtils.lerp(settings.brightness.orbitRest, settings.brightness.orbitMaximum, strength);
    });
    orbitEnergy.value = strength;
    const amplitude = THREE.MathUtils.lerp(settings.pulse.restAmplitude, settings.pulse.maximumAmplitude, strength);
    const pulse = 1 + Math.sin(time * settings.pulse.frequency) * amplitude;
    glow.material.opacity = THREE.MathUtils.lerp(settings.brightness.glowRest, settings.brightness.glowMaximum, strength) * pulse;
    glow.material.color.copy(cyan).lerp(gold, coreState.resonance * (0.15 + colorWave * 0.2));
    // Limit angular glow size near the center, avoiding a full-screen white flash.
    const distance = coreState.distance;
    const closeScale = Number.isFinite(distance) ? distance / Math.hypot(distance, settings.radius * 0.9) : 1;
    const size = settings.radius * THREE.MathUtils.lerp(1.27, 1.75, strength) * pulse * closeScale;
    glow.scale.set(size, size, 1);
    core.material.color.copy(pale).lerp(bright, strength);
    core.material.opacity = (0.75 + strength * 0.2) * THREE.MathUtils.smoothstep(distance, 0, settings.radius * 0.23);
    core.scale.setScalar(pulse * (1 + strength * 0.12));
    shell.rotation.y = angle;
    rings.rotation.set(angle * 0.45, -angle * settings.rotation.orbitFactor, angle * 0.27);
  }
  applyVisuals();
  return {
    object: root,
    getInteractionState() {
      const { distance, activation, resonance, intensity, state } = coreState;
      return { distance, activation, resonance, intensity, state };
    },
    update(dt, camera) {
      if (disposed) return;
      if (!Number.isFinite(dt) || dt < 0) throw new Error('Energy core deltaTime must be finite and nonnegative.');
      time += dt;
      root.position.y = baseY + Math.sin(time * settings.hover.frequency) * settings.hover.amplitude;
      root.getWorldPosition(center);
      const distance = camera ? camera.getWorldPosition(observer).distanceTo(center) : Infinity;
      response.update(dt, distance);
      angle += settings.rotation.rest * dt + (settings.rotation.maximum - settings.rotation.rest) * coreState.integratedIntensity;
      applyVisuals();
      if (onInteraction) {
        callbackTime += dt;
        if (callbackTime >= settings.callbackInterval) {
          callbackTime %= Math.max(settings.callbackInterval, 0.001);
          onInteraction(this.getInteractionState());
        }
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      root.traverse(child => { child.geometry?.dispose(); child.material?.dispose(); });
      texture.dispose(); root.clear();
    }
  };
}
