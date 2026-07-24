// Ported verbatim (same constants, same formulas) from the original single-file
// game's hand-rolled arcade car physics (index.html, the player-drive branch of
// tick()). Position integration + collision resolution now happen outside this
// function (Rapier's KinematicCharacterController) — this only owns the "feel":
// steering ramp, engine/drag, and lateral grip. See migration plan Phase 2.

export interface CarState {
  h: number; // heading, radians
  speed: number; // forward (longitudinal) velocity, m/s
  vLat: number; // lateral (sideways) velocity, m/s
  steerAng: number; // current steering angle, -1..1
}

export interface CarHandling {
  max: number; // top speed, m/s
  accel: number; // m/s^2
  grip: number;
  turnGain: number;
  steerRamp: number;
  steerMin: number;
  drag: number;
  dragQ: number;
}

export const DEFAULT_HANDLING: CarHandling = {
  max: 40,
  accel: 18,
  grip: 6.5,
  turnGain: 0.78,
  steerRamp: 2.6,
  steerMin: 0.26,
  drag: 0.4,
  dragQ: 0.0016,
};

export interface CarInput {
  forward: boolean;
  back: boolean;
  steer: number; // -1 (left) .. 1 (right), already resolved from left/right keys
  handbrake: boolean;
}

/** Mutates `car` in place, returns the desired world-space displacement this frame. */
export function stepCarPhysics(
  car: CarState,
  input: CarInput,
  h: CarHandling,
  dt: number
): { dx: number; dz: number } {
  const spd0 = Math.abs(car.speed);

  // steering: speed-sensitive authority, ramps toward full lock while held
  // (a tap gives an instant baseline angle; holding winds it up further)
  const ramp = Math.max(h.steerRamp / (1 + spd0 * 0.05), h.steerRamp * 0.55);
  let sa = car.steerAng;
  if (input.handbrake) {
    sa = input.steer;
  } else if (input.steer !== 0) {
    if (input.steer > 0 && sa < h.steerMin) sa = h.steerMin;
    else if (input.steer < 0 && sa > -h.steerMin) sa = -h.steerMin;
    sa += (input.steer - sa) * clamp(ramp * dt, 0, 1);
  } else {
    sa *= clamp(1 - 8 * dt, 0, 1);
  }
  car.steerAng = sa;

  const steerAuth = clamp(spd0 / 6, 0, 1) / (1 + spd0 * 0.03);
  const turn =
    sa * (input.handbrake ? 3.5 : 2.7) * steerAuth * h.turnGain * dt * Math.sign(car.speed || 1);
  car.h += turn;

  // carry momentum: velocity lives in the car frame (forward + lateral); rotating
  // the heading rotates these components too, so the body keeps its old momentum
  // direction until grip drags it round
  let vlong = car.speed;
  let vlat = car.vLat;
  {
    const cT = Math.cos(turn);
    const sT = Math.sin(turn);
    const nl = vlong * cT + vlat * sT;
    const na = -vlong * sT + vlat * cT;
    vlong = nl;
    vlat = na;
  }

  // engine / brakes / drag
  if (input.forward) vlong += (vlong < 0 ? 40 : h.accel) * dt;
  else if (input.back) vlong -= (vlong > 0 ? 42 : h.accel * 0.5) * dt;
  vlong -= vlong * h.drag * dt;
  vlong -= vlong * Math.abs(vlong) * h.dragQ * dt;
  if (input.handbrake) vlong -= vlong * 1.8 * dt;
  vlong = clamp(vlong, -16, h.max);

  // lateral grip: tyres bleed sideways velocity away; handbrake breaks traction
  const grip = (input.handbrake ? 2.2 : h.grip) * 1;
  vlat -= vlat * clamp(grip * dt, 0, 1);
  vlat = clamp(vlat, -16, 16);

  car.speed = vlong;
  car.vLat = vlat;

  const sh = Math.sin(car.h);
  const ch = Math.cos(car.h);
  return {
    dx: (sh * vlong + ch * vlat) * dt,
    dz: (ch * vlong - sh * vlat) * dt,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
