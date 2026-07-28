"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useHudStore } from "@/lib/hudStore";
import { skyState } from "@/lib/skyState";
import { worldState } from "@/lib/worldState";

// Port of the original's headlight rig (index.html ~6240 for the lights,
// ~7359 for the per-frame placement). Two spotlights that follow whatever the
// player is currently driving, aimed 30m down the road, cycled AUTO/ON/OFF
// with L.
//
// Deliberately ONE rig for the whole game rather than a pair of lights per
// vehicle component, exactly as the original does it: only one vehicle is ever
// driven at a time, so five rigs would mean four idle shadow-casting spotlights
// and four more lights in every material's shader loop, for nothing.

// Original's numbers: color 0xfff2cf, distance 60, angle 0.5, penumbra 0.4.
const COLOR = 0xfff2cf;
const DISTANCE = 60;
const ANGLE = 0.5;
const PENUMBRA = 0.4;

// The original ran three.js r128, where a light's `decay` only applied under
// the old opt-in `physicallyCorrectLights` path; by default the falloff was a
// simple ramp to `distance`. Modern three (0.185 here) is always physical, so
// porting the original's `decay: 1.2` verbatim would divide the beam by
// distance^1.2 and leave it invisible past a few metres. `decay = 0` keeps the
// smooth cutoff at `distance` while dropping the inverse-square term — the
// closest match to what r128 actually drew, and it keeps the intensity number
// below in the same familiar range as the original's.
const DECAY = 0;
const FULL_INTENSITY = 1.6; // original's on-value

// The original hangs its lights off the vehicle at these offsets: 2m ahead of
// centre, 0.7m to each side, 0.8m up, aiming at a point 30m ahead and 0.2m off
// the ground (so the cone lands on the road rather than the skyline).
const AHEAD = 2;
const SIDE = 0.7;
const HEIGHT = 0.8;
const AIM_AHEAD = 30;
const AIM_HEIGHT = 0.2;

export function Headlights() {
  const leftRef = useRef<THREE.SpotLight>(null);
  const rightRef = useRef<THREE.SpotLight>(null);
  const leftTarget = useRef<THREE.Object3D>(null);
  const rightTarget = useRef<THREE.Object3D>(null);

  useFrame(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    const lTarget = leftTarget.current;
    const rTarget = rightTarget.current;
    if (!left || !right || !lTarget || !rTarget) return;
    // Wired here rather than as a `target` prop: the target refs are still
    // null on the first render pass, and R3F would not re-apply the prop once
    // they populate.
    if (left.target !== lTarget) left.target = lTarget;
    if (right.target !== rTarget) right.target = rTarget;

    const hud = useHudStore.getState();
    // On foot there is no car to light the way with, and the club is its own
    // interior scene — the original zeroes the lights in both cases (index.html
    // ~6237 on dismount, ~6890 on entering the club).
    const driving = hud.active !== "foot" && !hud.inClub;
    // AUTO (0) tracks the day/night cycle with the original's +0.15 bias, so
    // they come on slightly before true dusk; ON (1) forces full; OFF (2) kills.
    const intensity = !driving
      ? 0
      : hud.lightMode === 2
        ? 0
        : hud.lightMode === 1
          ? FULL_INTENSITY
          : FULL_INTENSITY * THREE.MathUtils.clamp(skyState.nightK + 0.15, 0, 1);

    left.intensity = intensity;
    right.intensity = intensity;
    // Nothing to place if they're dark — skip the trig on the common daytime
    // and on-foot cases.
    if (intensity === 0) return;

    const { px, pz, heading } = worldState;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);

    left.position.set(px + fx * AHEAD + fz * SIDE, HEIGHT, pz + fz * AHEAD - fx * SIDE);
    right.position.set(px + fx * AHEAD - fz * SIDE, HEIGHT, pz + fz * AHEAD + fx * SIDE);
    lTarget.position.set(px + fx * AIM_AHEAD + fz * SIDE, AIM_HEIGHT, pz + fz * AIM_AHEAD - fx * SIDE);
    rTarget.position.set(px + fx * AIM_AHEAD - fz * SIDE, AIM_HEIGHT, pz + fz * AIM_AHEAD + fx * SIDE);
    // Targets are plain Object3Ds parented to the scene root; their world
    // matrices are only rebuilt on render, which happens after this frame
    // callback, so the light would aim one frame stale without this.
    lTarget.updateMatrixWorld();
    rTarget.updateMatrixWorld();
  });

  return (
    <>
      <object3D ref={leftTarget} />
      <object3D ref={rightTarget} />
      <spotLight
        ref={leftRef}
        color={COLOR}
        intensity={0}
        distance={DISTANCE}
        angle={ANGLE}
        penumbra={PENUMBRA}
        decay={DECAY}
        target={leftTarget.current ?? undefined}
      />
      <spotLight
        ref={rightRef}
        color={COLOR}
        intensity={0}
        distance={DISTANCE}
        angle={ANGLE}
        penumbra={PENUMBRA}
        decay={DECAY}
        target={rightTarget.current ?? undefined}
      />
    </>
  );
}
