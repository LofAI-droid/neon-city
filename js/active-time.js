// One bounded visual clock for the camera and active world's animation.
// A long browser stall lengthens the Journey in wall time instead of jumping ahead.
export const MAX_ACTIVE_FRAME_SECONDS = 0.05;

export function activeFrameSeconds(previousMs, nowMs) {
  if (previousMs === null || !Number.isFinite(previousMs) || !Number.isFinite(nowMs)) return 0;
  return Math.min(Math.max((nowMs - previousMs) / 1000, 0), MAX_ACTIVE_FRAME_SECONDS);
}
