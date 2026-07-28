// Optional hover look for the chase camera. A shared mutable singleton, same
// pattern as worldState/skyState — the pointer handler writes it, the camera
// rig reads it every frame, and nothing re-renders.
//
// These are OFFSETS applied on top of whatever the chase camera was already
// doing, not a replacement for it: with both at 0 the camera behaves exactly
// as it did before, so leaving the cursor centred changes nothing.
export const cameraLook = {
  yaw: 0, // radians, added to the chase camera's orbit angle (eased)
  pitch: 0, // raises/lowers the camera and its look target (eased)
  targetYaw: 0,
  targetPitch: 0,
  active: false, // cursor is over the canvas and outside the dead zone
};

// Cursor position maps straight onto an angle rather than accumulating like a
// drag would: screen centre is neutral, so the camera always has a home to
// return to and can never wander off somewhere you can't undo.
export const MAX_YAW = 0.95; // radians at the left/right edge (~54°)
export const MAX_PITCH_UP = 0.85; // cursor at the bottom edge — camera lifts
export const MAX_PITCH_DOWN = -0.45; // cursor at the top edge — camera drops
// Generous middle band where the camera stays put, so a cursor resting near
// the centre of the screen (or just crossing it) doesn't nudge the view.
export const DEAD_ZONE = 0.18;
// Fraction of the remaining distance left per second — the easing that stops
// the camera snapping around with the pointer.
export const EASE = 0.0008;

export function resetCameraLook() {
  cameraLook.yaw = 0;
  cameraLook.pitch = 0;
  cameraLook.targetYaw = 0;
  cameraLook.targetPitch = 0;
  cameraLook.active = false;
}
