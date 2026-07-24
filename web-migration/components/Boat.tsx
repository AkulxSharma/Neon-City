"use client";

import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useKeyboard } from "@/lib/useKeyboard";
import { stepCarPhysics, BOAT_HANDLING, type CarState } from "@/lib/carPhysics";
import { useHudStore } from "@/lib/hudStore";
import { WATER_LEVEL } from "@/components/Water";

// A hull has no floor to snap to, so unlike Car.tsx this doesn't use Rapier's
// KinematicCharacterController at all — no per-frame collider queries, so none
// of the reentrancy trap documented in SUMMARY.md applies here. Position is
// just the same ported arcade math (this time with BOAT_HANDLING) integrated
// directly, plus a sine bob for the "floating" feel. It's still a Rapier
// kinematic RigidBody (not a bare mesh) so it's ready to collide with a dock
// or another boat once that's ported — see SUMMARY.md, Next up.
export function Boat() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const keys = useKeyboard();
  const { camera } = useThree();

  const boat = useRef<CarState>({ h: Math.PI, speed: 0, vLat: 0, steerAng: 0 });
  const pos = useRef({ x: 40, z: 0 });
  const camPos = useRef(new THREE.Vector3(30, 5, -10));
  const camLook = useRef(new THREE.Vector3());

  const hullSize = useMemo(() => new THREE.Vector3(2.2, 1, 5), []);

  useFrame((state, dt) => {
    const body = bodyRef.current;
    if (!body) return;
    const d = Math.min(dt, 0.05);
    const isActive = useHudStore.getState().active === "boat";

    const k = keys.current;
    const steer = isActive ? (k.left ? 1 : 0) - (k.right ? 1 : 0) : 0;
    const { dx, dz } = stepCarPhysics(
      boat.current,
      {
        forward: isActive && k.forward,
        back: isActive && k.back,
        steer,
        handbrake: false,
      },
      BOAT_HANDLING,
      d
    );

    pos.current.x += dx;
    pos.current.z += dz;
    const bob = Math.sin(state.clock.elapsedTime * 1.7 + pos.current.x * 0.05) * 0.07;
    const y = WATER_LEVEL + bob;

    body.setNextKinematicTranslation({ x: pos.current.x, y, z: pos.current.z });
    const heel = clamp(boat.current.vLat / 9, -1, 1) * 0.16;
    const q = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), boat.current.h)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -heel));
    body.setNextKinematicRotation(q);

    if (!isActive) return;

    const dir = new THREE.Vector3(Math.sin(boat.current.h), 0, Math.cos(boat.current.h));
    const targetCamPos = new THREE.Vector3(
      pos.current.x - dir.x * 9,
      y + 4,
      pos.current.z - dir.z * 9
    );
    const targetLook = new THREE.Vector3(pos.current.x + dir.x * 4, y + 1, pos.current.z + dir.z * 4);
    camPos.current.lerp(targetCamPos, Math.min(1, d * 4));
    camLook.current.lerp(targetLook, Math.min(1, d * 6));
    camera.position.copy(camPos.current);
    camera.lookAt(camLook.current);

    useHudStore.getState().setHud(Math.round(Math.abs(boat.current.speed) * 3.6), true);
  });

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[pos.current.x, WATER_LEVEL, pos.current.z]}>
      <mesh castShadow>
        <boxGeometry args={[hullSize.x, hullSize.y, hullSize.z]} />
        <meshStandardMaterial color="#e8e2d0" />
      </mesh>
      <mesh position={[0, hullSize.y / 2 + 0.4, -0.6]}>
        <boxGeometry args={[hullSize.x * 0.7, 0.8, 1.6]} />
        <meshStandardMaterial color="#c9ced6" />
      </mesh>
    </RigidBody>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
