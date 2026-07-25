"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CuboidCollider, useRapier, type RapierRigidBody, type RapierCollider } from "@react-three/rapier";
import * as THREE from "three";
import { useKeyboard } from "@/lib/useKeyboard";
import { stepCarPhysics, BIKE_HANDLING, type CarState } from "@/lib/carPhysics";
import { useHudStore } from "@/lib/hudStore";
import { worldState } from "@/lib/worldState";
import { vehicleState } from "@/lib/vehicleState";
import { loadSave } from "@/lib/saveGame";
import { applyCameraRig } from "@/lib/cameraRig";
import type { KinematicCharacterController } from "@dimforge/rapier3d-compat";

const GRAVITY_PULL = -12;

// Same ground/collision machinery as Car.tsx (a bike still needs the floor —
// see the original: bikes go through the identical drive-loop physics as
// cars, they just default to a higher lateral grip and lean visually). The
// duplication between this and Car.tsx (character controller setup, gravity
// integration, chase camera) is small enough to leave alone for now; if a
// fourth land vehicle shows up, pull the shared part into a hook.
export function Bike() {
  const { world } = useRapier();
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const keys = useKeyboard();
  const { camera } = useThree();

  const [save] = useState(() => loadSave()?.vehicles.bike ?? null);
  const bike = useRef<CarState>({ h: save?.h ?? 0, speed: 0, vLat: 0, steerAng: 0 });
  const fallSpeed = useRef(0);
  const camPos = useRef(new THREE.Vector3(-20, 4, -10));
  const camLook = useRef(new THREE.Vector3());
  const controllerRef = useRef<KinematicCharacterController | null>(null);
  const leanRef = useRef(0);

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

  const bikeBox = useMemo(() => new THREE.Vector3(0.7, 0.9, 1.9), []);

  useFrame((state, dt) => {
    const body = bodyRef.current;
    const controller = controllerRef.current;
    const collider = colliderRef.current;
    if (!body || !controller || !collider) return;
    const d = Math.min(dt, 0.05);

    const isActive = useHudStore.getState().active === "bike";
    const k = keys.current;
    const steer = isActive ? (k.left ? 1 : 0) - (k.right ? 1 : 0) : 0;

    const { dx, dz } = stepCarPhysics(
      bike.current,
      { forward: isActive && k.forward, back: isActive && k.back, steer, handbrake: isActive && k.handbrake },
      BIKE_HANDLING,
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

    // lean into the turn — same formula as the original's isBike branch
    // (rotation.z = -steer * speed-scaled * 0.45), purely visual
    const targetLean = -steer * clamp(Math.abs(bike.current.speed) / 25, 0, 1) * 0.45;
    leanRef.current += (targetLean - leanRef.current) * clamp(d * 10, 0, 1);
    const q = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), bike.current.h)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), leanRef.current));
    body.setNextKinematicRotation(q);

    vehicleState.bike.x = nextPos.x;
    vehicleState.bike.z = nextPos.z;
    vehicleState.bike.h = bike.current.h;

    if (!isActive) return;
    worldState.px = nextPos.x;
    worldState.pz = nextPos.z;
    worldState.heading = bike.current.h;

    applyCameraRig({
      camera,
      camPos: camPos.current,
      camLook: camLook.current,
      tx: nextPos.x,
      ty: nextPos.y,
      tz: nextPos.z,
      th: bike.current.h,
      isBike: true,
      camMode: useHudStore.getState().camMode,
      time: state.clock.elapsedTime,
      dt: d,
    });

    useHudStore.getState().setHud(Math.round(Math.abs(bike.current.speed) * 3.6), grounded);
  });

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[save?.x ?? -20, 1, save?.z ?? 0]}>
      <CuboidCollider ref={colliderRef} args={[bikeBox.x / 2, bikeBox.y / 2, bikeBox.z / 2]} />
      <BikeMesh />
    </RigidBody>
  );
}

function BikeMesh() {
  return (
    <group>
      <mesh castShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[0.22, 0.3, 1.1]} />
        <meshStandardMaterial color="#c8302f" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[0, 0.28, 0.15]}>
        <boxGeometry args={[0.3, 0.22, 0.5]} />
        <meshStandardMaterial color="#c8302f" metalness={0.4} roughness={0.35} />
      </mesh>
      {[0.7, -0.7].map((z) => (
        <mesh key={z} position={[0, -0.42, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.14, 14]} />
          <meshStandardMaterial color="#111318" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.36, 0.85]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color="#fff6d0" />
      </mesh>
    </group>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
