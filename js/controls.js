import * as THREE from '../lib/three/three.module.js';
import { resetCamera } from './camera.js?v=wp1';

export function createControls(camera, canvas, { onReset = () => {} } = {}) {
  let enabled = true;
  const keys = new Set();
  const velocity = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const difference = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const supported = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyR']);
  let mouseEnabled = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let turnSpeed = 0;
  const events = new AbortController();
  const on = (target, name, fn) => target.addEventListener(name, fn, { signal: events.signal });
  const reset = () => { onReset(); resetCamera(camera); velocity.set(0, 0, 0); turnSpeed = 0; keys.clear(); };
  const clear = () => { keys.clear(); velocity.set(0, 0, 0); turnSpeed = 0; dragging = false; };
  on(window, 'keydown', event => {
    if (!supported.has(event.code) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest('button, input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    if (event.code === 'KeyR') { if (!event.repeat) reset(); return; }
    if (!enabled) return;
    keys.add(event.code);
  });
  on(window, 'keyup', event => { if (supported.has(event.code)) keys.delete(event.code); });
  on(window, 'blur', clear);
  on(document, 'visibilitychange', () => { if (document.hidden) clear(); });
  on(canvas, 'pointerdown', event => {
    canvas.focus({ preventScroll: true });
    if (!enabled || !mouseEnabled || event.button !== 0) return;
    dragging = true; lastX = event.clientX; lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  on(canvas, 'pointermove', event => {
    if (!dragging) return;
    camera.rotation.y -= (event.clientX - lastX) * 0.003;
    camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - (event.clientY - lastY) * 0.003, -Math.PI / 2 + 0.03, Math.PI / 2 - 0.03);
    lastX = event.clientX; lastY = event.clientY;
  });
  const stopDrag = () => { dragging = false; canvas.style.cursor = mouseEnabled ? 'grab' : 'default'; };
  on(canvas, 'pointerup', stopDrag);
  on(canvas, 'pointercancel', stopDrag);
  on(canvas, 'lostpointercapture', stopDrag);

  return {
    isMouseEnabled() { return mouseEnabled; },
    setMouseEnabled(value) { mouseEnabled = Boolean(value); dragging = false; canvas.style.cursor = mouseEnabled ? 'grab' : 'default'; },
    getVelocity(target) { return target.copy(velocity); },
    setEnabled(value, inheritedVelocity) { clear(); enabled = value; if (enabled && inheritedVelocity) velocity.copy(inheritedVelocity); },
    update(dt) {
      if (!enabled) return;
      const move = Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'));
      const strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
      const lift = Number(keys.has('Space')) - Number(keys.has('ShiftLeft') || keys.has('ShiftRight'));
      const turn = Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'));
      const targetTurn = turn * 1.05;
      const smoothing = 5;
      const decay = Math.exp(-smoothing * dt);
      const turnDistance = targetTurn * dt + (turnSpeed - targetTurn) * (1 - decay) / smoothing;
      turnSpeed = targetTurn + (turnSpeed - targetTurn) * decay;
      camera.rotation.y += turnDistance;
      camera.getWorldDirection(forward);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      desired.copy(forward).multiplyScalar(move).addScaledVector(right, strafe).addScaledVector(up, lift);
      if (desired.lengthSq() > 1) desired.normalize();
      desired.multiplyScalar(22);
      // Exact exponential integration for constant input during this frame.
      camera.position.addScaledVector(desired, dt).addScaledVector(difference.copy(velocity).sub(desired), (1 - decay) / smoothing);
      velocity.sub(desired).multiplyScalar(decay).add(desired);
    },
    reset,
    dispose() { events.abort(); clear(); }
  };
}
