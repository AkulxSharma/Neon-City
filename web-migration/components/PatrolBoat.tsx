"use client";

import { useRef, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useKeyboard } from "@/lib/useKeyboard";
import { stepCarPhysics, BOAT_HANDLING, type CarState } from "@/lib/carPhysics";
import { useHudStore } from "@/lib/hudStore";
import { worldState } from "@/lib/worldState";
import { vehicleState } from "@/lib/vehicleState";
import { loadSave } from "@/lib/saveGame";
import { applyCameraRig } from "@/lib/cameraRig";
import { WATER_LEVEL } from "@/components/Water";
import { pierPush } from "@/lib/marina";

// A second hull, moored at the marina — near-copy of Boat.tsx (same
// direct-integration, no-character-controller design; see that file's class
// comment for why), so E-to-swap (lib/boatSwap.ts) has something to swap
// *into*. Distinct livery (dark hull, red nav light) so the two are easy to
// tell apart at the dock.
export function PatrolBoat() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const keys = useKeyboard();
  const { camera } = useThree();

  const [save] = useState(() => loadSave()?.vehicles.patrolBoat ?? null);
  const boat = useRef<CarState>({ h: save?.h ?? vehicleState.patrolBoat.h, speed: 0, vLat: 0, steerAng: 0 });
  const pos = useRef({ x: save?.x ?? vehicleState.patrolBoat.x, z: save?.z ?? vehicleState.patrolBoat.z });
  const camPos = useRef(new THREE.Vector3(vehicleState.patrolBoat.x - 10, 5, vehicleState.patrolBoat.z - 10));
  const camLook = useRef(new THREE.Vector3());

  const hullSize = useMemo(() => new THREE.Vector3(2.2, 1, 5), []);

  useFrame((state, dt) => {
    const body = bodyRef.current;
    if (!body) return;
    const d = Math.min(dt, 0.05);
    const isActive = useHudStore.getState().active === "patrolBoat";

    const k = keys.current;
    const steer = isActive ? (k.left ? 1 : 0) - (k.right ? 1 : 0) : 0;
    const { dx, dz } = stepCarPhysics(
      boat.current,
      { forward: isActive && k.forward, back: isActive && k.back, steer, handbrake: false },
      BOAT_HANDLING,
      d
    );

    pos.current.x += dx;
    pos.current.z += dz;
    const pushed = pierPush(pos.current.x, pos.current.z, 2.0);
    pos.current.x = pushed.x;
    pos.current.z = pushed.z;
    const bob = Math.sin(state.clock.elapsedTime * 1.7 + pos.current.x * 0.05 + 3) * 0.07;
    const y = WATER_LEVEL + bob;

    body.setNextKinematicTranslation({ x: pos.current.x, y, z: pos.current.z });
    const heel = clamp(boat.current.vLat / 9, -1, 1) * 0.16;
    const q = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), boat.current.h)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -heel));
    body.setNextKinematicRotation(q);

    vehicleState.patrolBoat.x = pos.current.x;
    vehicleState.patrolBoat.z = pos.current.z;
    vehicleState.patrolBoat.h = boat.current.h;

    if (!isActive) return;
    worldState.px = pos.current.x;
    worldState.pz = pos.current.z;
    worldState.heading = boat.current.h;

    applyCameraRig({
      camera,
      camPos: camPos.current,
      camLook: camLook.current,
      tx: pos.current.x,
      ty: y,
      tz: pos.current.z,
      th: boat.current.h,
      isBike: false,
      camMode: useHudStore.getState().camMode,
      time: state.clock.elapsedTime,
      dt: d,
    });

    useHudStore.getState().setHud(Math.round(Math.abs(boat.current.speed) * 3.6), true);
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[vehicleState.patrolBoat.x, WATER_LEVEL, vehicleState.patrolBoat.z]}
    >
      <mesh castShadow>
        <boxGeometry args={[hullSize.x, hullSize.y, hullSize.z]} />
        <meshStandardMaterial color="#1f232c" metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, hullSize.y / 2 + 0.4, -0.6]}>
        <boxGeometry args={[hullSize.x * 0.7, 0.8, 1.6]} />
        <meshStandardMaterial color="#101216" roughness={0.5} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 0.72, hullSize.y / 2 + 0.95, 0.7]} rotation={[0, sx * 0.9, 0]}>
          <circleGeometry args={[0.09, 10]} />
          <meshStandardMaterial color="#1f6fe0" metalness={0.9} roughness={0.12} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, hullSize.y / 2 + 0.3, hullSize.z / 2 - 0.3]}>
        <sphereGeometry args={[0.11, 8, 8]} />
        <meshBasicMaterial color="#ff2020" />
      </mesh>
    </RigidBody>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
