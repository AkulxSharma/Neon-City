"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CuboidCollider, useRapier, type RapierRigidBody, type RapierCollider } from "@react-three/rapier";
import * as THREE from "three";
import { useKeyboard } from "@/lib/useKeyboard";
import { stepCarPhysics, POLICE_HANDLING, type CarState } from "@/lib/carPhysics";
import { useHudStore } from "@/lib/hudStore";
import { worldState } from "@/lib/worldState";
import { vehicleState } from "@/lib/vehicleState";
import { loadSave } from "@/lib/saveGame";
import { applyCameraRig } from "@/lib/cameraRig";
import { teleportRequest } from "@/lib/clubTeleport";
import type { KinematicCharacterController } from "@dimforge/rapier3d-compat";

const GRAVITY_PULL = -12;

// Parked at POLICE HARBOR STATION — a near-copy of Car.tsx (same
// character-controller/gravity/camera boilerplate Bike.tsx already
// duplicates; a fourth+fifth land vehicle is exactly the point where
// SUMMARY.md/Milestone 4 said to pull this into a shared hook instead of
// copying a third time). What's genuinely new here: POLICE_HANDLING (83.3
// m/s top speed) and a flashing red/blue light bar that also *is* this
// build's "siren" — driving this car is what lets Traffic.tsx's convoy
// cars recruit (see Traffic.tsx), matching the original's
// `player.veh.userData.siren.kind==='police'` implicit-siren design (no
// separate siren toggle key, same as the original).
export function PoliceCar() {
  const { world } = useRapier();
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const keys = useKeyboard();
  const { camera } = useThree();

  const [save] = useState(() => loadSave()?.vehicles.policeCar ?? null);
  const car = useRef<CarState>({ h: save?.h ?? vehicleState.policeCar.h, speed: 0, vLat: 0, steerAng: 0 });
  const fallSpeed = useRef(0);
  const camPos = useRef(new THREE.Vector3(0, 4, -10));
  const camLook = useRef(new THREE.Vector3());
  const controllerRef = useRef<KinematicCharacterController | null>(null);
  const lightRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  useEffect(() => {
    const controller = world.createCharacterController(0.02);
    controller.enableAutostep(0.3, 0.1, true);
    controller.enableSnapToGround(0.4);
    controller.setSlideEnabled(true);
    controller.setMaxSlopeClimbAngle((60 * Math.PI) / 180);
    controllerRef.current = controller;
    return () => {
      world.removeCharacterController(controller);
      controllerRef.current = null;
    };
  }, [world]);

  const carBox = useMemo(() => new THREE.Vector3(1.9, 1.35, 4.8), []);

  useFrame((state, dt) => {
    const body = bodyRef.current;
    const controller = controllerRef.current;
    const collider = colliderRef.current;
    if (!body || !controller || !collider) return;
    const d = Math.min(dt, 0.05);
    const isActive = useHudStore.getState().active === "policeCar";

    if (isActive && teleportRequest.pending) {
      teleportRequest.pending = false;
      body.setTranslation({ x: teleportRequest.x, y: 1, z: teleportRequest.z }, true);
      car.current.h = teleportRequest.h;
      car.current.speed = 0;
      car.current.vLat = 0;
      worldState.px = teleportRequest.x;
      worldState.pz = teleportRequest.z;
      worldState.heading = teleportRequest.h;
      return;
    }

    const k = keys.current;
    const steer = isActive ? (k.left ? 1 : 0) - (k.right ? 1 : 0) : 0;
    const { dx, dz } = stepCarPhysics(
      car.current,
      { forward: isActive && k.forward, back: isActive && k.back, steer, handbrake: isActive && k.handbrake },
      POLICE_HANDLING,
      d
    );

    fallSpeed.current += GRAVITY_PULL * d;
    controller.computeColliderMovement(collider, { x: dx, y: fallSpeed.current * d, z: dz });
    const grounded = controller.computedGrounded();
    if (grounded) fallSpeed.current = 0;
    const movement = controller.computedMovement();

    const t = body.translation();
    const nextPos = { x: t.x + movement.x, y: t.y + movement.y, z: t.z + movement.z };
    body.setNextKinematicTranslation(nextPos);
    body.setNextKinematicRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), car.current.h));

    vehicleState.policeCar.x = nextPos.x;
    vehicleState.policeCar.z = nextPos.z;
    vehicleState.policeCar.h = car.current.h;

    // light bar always flashes, active or parked — police cars look "on duty" whether driven or not
    const flashRed = Math.floor(state.clock.elapsedTime * 5) % 2 === 0;
    if (lightRefs.current[0]) lightRefs.current[0].color.set(flashRed ? "#ff2020" : "#160000");
    if (lightRefs.current[1]) lightRefs.current[1].color.set(flashRed ? "#0a1030" : "#2040ff");

    if (!isActive) return;
    worldState.px = nextPos.x;
    worldState.pz = nextPos.z;
    worldState.heading = car.current.h;

    applyCameraRig({
      camera,
      camPos: camPos.current,
      camLook: camLook.current,
      tx: nextPos.x,
      ty: nextPos.y,
      tz: nextPos.z,
      th: car.current.h,
      isBike: false,
      camMode: useHudStore.getState().camMode,
      time: state.clock.elapsedTime,
      dt: d,
    });

    useHudStore.getState().setHud(Math.round(Math.abs(car.current.speed) * 3.6), grounded);
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[save?.x ?? vehicleState.policeCar.x, 1, save?.z ?? vehicleState.policeCar.z]}
    >
      <CuboidCollider ref={colliderRef} args={[carBox.x / 2, carBox.y / 2, carBox.z / 2]} />
      <group>
        <mesh castShadow position={[0, -0.18, 0]}>
          <boxGeometry args={[1.9, 0.95, 4.8]} />
          <meshStandardMaterial color="#eef1f6" metalness={0.3} roughness={0.4} />
        </mesh>
        <mesh castShadow position={[0, 0.56, -0.3]}>
          <boxGeometry args={[1.55, 0.55, 2.3]} />
          <meshStandardMaterial color="#0c0c0e" metalness={0.2} roughness={0.15} />
        </mesh>
        {/* light bar — the flashing squares above are this build's "siren", read by Traffic.tsx */}
        <mesh position={[-0.35, 0.86, -0.3]}>
          <boxGeometry args={[0.6, 0.15, 0.3]} />
          <meshBasicMaterial ref={(el) => (lightRefs.current[0] = el)} color="#ff2020" />
        </mesh>
        <mesh position={[0.35, 0.86, -0.3]}>
          <boxGeometry args={[0.6, 0.15, 0.3]} />
          <meshBasicMaterial ref={(el) => (lightRefs.current[1] = el)} color="#2040ff" />
        </mesh>
        {[
          [0.87, -0.6, 1.6],
          [-0.87, -0.6, 1.6],
          [0.87, -0.6, -1.6],
          [-0.87, -0.6, -1.6],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.37, 0.37, 0.28, 14]} />
            <meshStandardMaterial color="#111318" roughness={0.6} />
          </mesh>
        ))}
        {[0.62, -0.62].map((x) => (
          <mesh key={`hl-${x}`} position={[x, -0.13, 2.38]}>
            <boxGeometry args={[0.25, 0.15, 0.05]} />
            <meshBasicMaterial color="#fff6d0" />
          </mesh>
        ))}
        {[0.65, -0.65].map((x) => (
          <mesh key={`tl-${x}`} position={[x, -0.13, -2.38]}>
            <boxGeometry args={[0.2, 0.12, 0.05]} />
            <meshBasicMaterial color="#ff2020" />
          </mesh>
        ))}
      </group>
    </RigidBody>
  );
}
