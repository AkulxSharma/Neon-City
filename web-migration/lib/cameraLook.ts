// Optional mouse look for the chase camera. A shared mutable singleton, same
// pattern as worldState/skyState — the pointer handlers write it, the camera
// rig reads it every frame, and nothing re-renders.
//
// These are OFFSETS applied on top of whatever the chase camera was already
// doing, not a replacement for it: with both at 0 the camera behaves exactly
// as it did before, so not touching the mouse changes nothing.
export const cameraLook = {
  yaw: 0, // radians, added to the chase camera's orbit angle
  pitch: 0, // -1..1-ish, raises/lowers the camera and its look target
  dragging: false,
};

export const PITCH_MIN = -0.55; // looking down at the roof
export const PITCH_MAX = 1.1; // looking up from near ground level
// Radians (yaw) / units (pitch) per pixel of drag.
export const YAW_SENS = 0.005;
export const PITCH_SENS = 0.004;
// While the player is actually moving, an untouched look angle eases back to
// centre so you're never stuck driving sideways-on. Standing still holds the
// angle, so you can park and look around.
export const RECENTRE = 0.35; // fraction remaining per second

export function resetCameraLook() {
  cameraLook.yaw = 0;
  cameraLook.pitch = 0;
  cameraLook.dragging = false;
}
