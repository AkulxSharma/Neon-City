"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CuboidCollider, useRapier, type RapierRigidBody, type RapierCollider } from "@react-three/rapier";
import * as THREE from "three";
import { useKeyboard } from "@/lib/useKeyboard";
import { stepCarPhysics, DEFAULT_HANDLING, type CarState, type CarHandling } from "@/lib/carPhysics";
import { useHudStore } from "@/lib/hudStore";
import { worldState } from "@/lib/worldState";
import { vehicleState } from "@/lib/vehicleState";
import { loadSave } from "@/lib/saveGame";
import { applyCameraRig } from "@/lib/cameraRig";
import { teleportRequest } from "@/lib/clubTeleport";
import type { KinematicCharacterController } from "@dimforge/rapier3d-compat";

const GRAVITY_PULL = -12; // m/s^2 fed into the character controller so it stays snapped to the ground
const NITRO_MAX = 10; // seconds of fuel — same numbers as the original's NITRO_MAX/NITRO_BOOST
const NITRO_BOOST = 41.7; // +150 km/h over the car's normal top speed while boosting

export function Car() {
  const { world } = useRapier();
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const keys = useKeyboard();
  const { camera } = useThree();

  // one-time impure read (localStorage), same pattern as CarMesh's random color below
  const [save] = useState(() => loadSave()?.vehicles.car ?? null);

  // persistent car state across frames (heading/speed/vLat/steerAng) — mirrors the
  // original game's per-vehicle object, kept in a ref so updating it never re-renders
  const car = useRef<CarState>({ h: save?.h ?? 0, speed: 0, vLat: 0, steerAng: 0 });
  const fallSpeed = useRef(0);
  const nitroFuel = useRef(NITRO_MAX);
  const camPos = useRef(new THREE.Vector3(0, 4, -10));
  const camLook = useRef(new THREE.Vector3());
  const controllerRef = useRef<KinematicCharacterController | null>(null);

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

  // overall envelope used for the collider — roughly the original's city-sedan
  // spec (len 4.6, wid 1.85); local y=0 is the car's vertical mid-point
  const carBox = useMemo(() => new THREE.Vector3(1.85, 1.3, 4.6), []);

  useFrame((state, dt) => {
    const body = bodyRef.current;
    const controller = controllerRef.current;
    const collider = colliderRef.current;
    if (!body || !controller || !collider) return;
    const d = Math.min(dt, 0.05); // clamp like the original tick() to avoid a tab-switch spike

    const isActive = useHudStore.getState().active === "car";

    // club door teleport (enter/exit VENU) — see lib/club.ts
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

    // nitro: SHIFT+forward burns fuel for extra thrust and a raised top speed —
    // same constants as the original (10s tank, +150km/h, drains 1:1, refills at half rate)
    const wantNitro = isActive && k.forward && k.boost;
    const nitroOn = wantNitro && nitroFuel.current > 0;
    nitroFuel.current = nitroOn
      ? Math.max(0, nitroFuel.current - d)
      : Math.min(NITRO_MAX, nitroFuel.current + d * 0.5);
    const handling: CarHandling = nitroOn
      ? { ...DEFAULT_HANDLING, accel: DEFAULT_HANDLING.accel * 2.7, max: DEFAULT_HANDLING.max + NITRO_BOOST }
      : DEFAULT_HANDLING;
    if (isActive) useHudStore.getState().setNitro(nitroFuel.current / NITRO_MAX, nitroOn);

    const { dx, dz } = stepCarPhysics(
      car.current,
      {
        forward: isActive && k.forward,
        back: isActive && k.back,
        steer,
        handbrake: isActive && k.handbrake,
      },
      handling,
      d
    );

    // ground snap: small constant fall fed into the character controller, which
    // clamps it back to zero the instant it detects the floor (see enableSnapToGround)
    fallSpeed.current += GRAVITY_PULL * d;
    controller.computeColliderMovement(collider, { x: dx, y: fallSpeed.current * d, z: dz });
    const grounded = controller.computedGrounded();
    if (grounded) fallSpeed.current = 0;
    const movement = controller.computedMovement();

    const t = body.translation();
    const nextPos = { x: t.x + movement.x, y: t.y + movement.y, z: t.z + movement.z };
    body.setNextKinematicTranslation(nextPos);

    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), car.current.h);
    body.setNextKinematicRotation(q);

    vehicleState.car.x = nextPos.x;
    vehicleState.car.z = nextPos.z;
    vehicleState.car.h = car.current.h;

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
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[save?.x ?? 0, 1, save?.z ?? 0]}>
      <CuboidCollider ref={colliderRef} args={[carBox.x / 2, carBox.y / 2, carBox.z / 2]} />
      <CarMesh />
    </RigidBody>
  );
}

// Original sedan silhouette, approximated: low wide body + a set-back cabin/roof,
// four wheels, emissive head/tail lights (bright enough to trip the bloom pass'
// luminance threshold — see Game.tsx).
const SEDAN_COLORS = ["#8b93a1", "#3a3f4a", "#7a2020", "#1f4a7a", "#cfd3da", "#2a5a3a", "#5a4a7a"];

export function CarMesh({ color }: { color?: string } = {}) {
  // random-once-at-mount, not a memo: color never changes after mount for any
  // given instance, and useState's lazy initializer is the sanctioned place
  // for a one-time impure value (Math.random) — a plain useMemo re-running is
  // not guaranteed not to happen more than once
  const [bodyColor] = useState(() => color ?? SEDAN_COLORS[Math.floor(Math.random() * SEDAN_COLORS.length)]);
  // chromeMat, ported from the original's shared wheel-hub material (index.html line 4833)
  const wheelMat = <meshStandardMaterial color="#2a2c32" metalness={0.95} roughness={0.28} />;

  return (
    <group>
      <mesh castShadow position={[0, -0.2, 0]}>
        <boxGeometry args={[1.85, 0.9, 4.6]} />
        <meshStandardMaterial color={bodyColor} metalness={0.35} roughness={0.4} />
      </mesh>
      {/* glassMat, ported from the original's shared cab-glass material (index.html line
          4829); envMap:envCube wiring skipped — this migration has no scene environment map yet */}
      <mesh castShadow position={[0, 0.53, -0.3]}>
        <boxGeometry args={[1.5, 0.55, 2.3]} />
        <meshStandardMaterial color="#3a5068" metalness={0.55} roughness={0.05} transparent opacity={0.32} />
      </mesh>
      {[
        [0.85, -0.62, 1.55],
        [-0.85, -0.62, 1.55],
        [0.85, -0.62, -1.55],
        [-0.85, -0.62, -1.55],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.28, 14]} />
          {wheelMat}
        </mesh>
      ))}
      {[0.6, -0.6].map((x) => (
        <mesh key={`hl-${x}`} position={[x, -0.15, 2.28]}>
          <boxGeometry args={[0.25, 0.15, 0.05]} />
          <meshBasicMaterial color="#fff6d0" />
        </mesh>
      ))}
      {[0.65, -0.65].map((x) => (
        <mesh key={`tl-${x}`} position={[x, -0.15, -2.28]}>
          <boxGeometry args={[0.2, 0.12, 0.05]} />
          <meshBasicMaterial color="#ff2020" />
        </mesh>
      ))}
    </group>
  );
}
