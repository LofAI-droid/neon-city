export const TECHNICAL_CAMERA = {
  position: [0, 5, 30], rotation: [0, 0, 0], fov: 70, near: 0.1, far: 500
};

// Test-only route: the shared Journey motor needs no Neon City geometry.
export function createTechnicalRoute({ entry = {}, isSafe = point => point.y > 1 } = {}) {
  return {
    duration: 42,
    positions: [
      { time: 0, value: [0, 5, 20] },
      { time: 12, value: [0, 7, 5] },
      { time: 26, value: [6, 8, -10] },
      { time: 42, value: [0, 6, -25] }
    ],
    targets: [
      { time: 0, value: [0, 6, 0] },
      { time: 14, value: [2, 7, -14] },
      { time: 28, value: [1, 8, -28] },
      { time: 42, value: [0, 7, -42] }
    ],
    entry,
    isSafe,
    planEntry(origin, begin) {
      if (!isSafe(origin) || !isSafe(begin)) return null;
      return [origin, begin];
    }
  };
}
