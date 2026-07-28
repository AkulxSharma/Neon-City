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
import { teleportRequest } from "@/lib/clubTeleport";
import { checkCrashDebris } from "@/lib/debris";
import { SHORE_X, DROWN_RESPAWN } from "@/lib/marina";
import { QueryFilterFlags, type KinematicCharacterController } from "@dimforge/rapier3d-compat";

const GRAVITY_PULL = -12;
const DROWN_LIMIT = 2; // seconds past the shore before respawn — mirrors Player.tsx's on-foot drowning

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
  const drownTime = useRef(0);
  const crashCooldown = useRef(0);
  const camPos = useRef(new THREE.Vector3(-20, 4, -10));
  const camLook = useRef(new THREE.Vector3());
  const controllerRef = useRef<KinematicCharacterController | null>(null);
  const leanRef = useRef(0);
  const riderRef = useRef<THREE.Group>(null);

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
    // same visible-only-while-driving toggle as Player.tsx's own character —
    // an unridden bike (parked, or the player off on foot elsewhere) shouldn't
    // show a rider sitting on it
    if (riderRef.current) riderRef.current.visible = isActive;

    // club door teleport (enter/exit VENU) — see lib/club.ts
    if (isActive && teleportRequest.pending) {
      teleportRequest.pending = false;
      body.setTranslation({ x: teleportRequest.x, y: 1, z: teleportRequest.z }, true);
      bike.current.h = teleportRequest.h;
      bike.current.speed = 0;
      bike.current.vLat = 0;
      worldState.px = teleportRequest.x;
      worldState.pz = teleportRequest.z;
      worldState.heading = teleportRequest.h;
      return;
    }

    const k = keys.current;
    const steer = isActive ? (k.left ? 1 : 0) - (k.right ? 1 : 0) : 0;

    const { dx, dz } = stepCarPhysics(
      bike.current,
      { forward: isActive && k.forward, back: isActive && k.back, steer, handbrake: isActive && k.handbrake },
      BIKE_HANDLING,
      d
    );

    fallSpeed.current += GRAVITY_PULL * d;
    // see Car.tsx: EXCLUDE_DYNAMIC lets the bike plow through props instead of
    // sliding/stopping on them, while the solver still shoves the prop aside.
    controller.computeColliderMovement(collider, { x: dx, y: fallSpeed.current * d, z: dz }, QueryFilterFlags.EXCLUDE_DYNAMIC);
    const grounded = controller.computedGrounded();
    if (grounded) fallSpeed.current = 0;
    const movement = controller.computedMovement();

    const t = body.translation();
    const nextPos = { x: t.x + movement.x, y: t.y + movement.y, z: t.z + movement.z };

    // drowning safety net — see Car.tsx for why this is unreachable in normal
    // play but still worth a respawn instead of falling forever
    if (nextPos.x >= SHORE_X) {
      drownTime.current += d;
      if (drownTime.current > DROWN_LIMIT) {
        drownTime.current = 0;
        body.setTranslation({ x: DROWN_RESPAWN.x, y: 1, z: DROWN_RESPAWN.z }, true);
        bike.current.h = DROWN_RESPAWN.h;
        bike.current.speed = 0;
        bike.current.vLat = 0;
        fallSpeed.current = 0;
        vehicleState.bike.x = DROWN_RESPAWN.x;
        vehicleState.bike.z = DROWN_RESPAWN.z;
        vehicleState.bike.h = DROWN_RESPAWN.h;
        if (isActive) {
          worldState.px = DROWN_RESPAWN.x;
          worldState.pz = DROWN_RESPAWN.z;
          worldState.heading = DROWN_RESPAWN.h;
        }
        return;
      }
    } else {
      drownTime.current = 0;
    }

    body.setNextKinematicTranslation(nextPos);

    if (isActive) {
      checkCrashDebris(crashCooldown, d, { x: dx, z: dz }, { x: movement.x, z: movement.z }, Math.abs(bike.current.speed), nextPos, bike.current.h);
    }

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
      speedMs: Math.abs(bike.current.speed),
    });

    useHudStore.getState().setHud(Math.round(Math.abs(bike.current.speed) * 3.6), grounded);
  });

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[save?.x ?? -20, 1, save?.z ?? 0]}>
      <CuboidCollider ref={colliderRef} args={[bikeBox.x / 2, bikeBox.y / 2, bikeBox.z / 2]} />
      <BikeMesh />
      <group ref={riderRef}>
        <BikeRider />
      </group>
    </RigidBody>
  );
}

const BIKE_MAIN_MAT = new THREE.MeshStandardMaterial({ color: "#5c6142", metalness: 0.35, roughness: 0.45 });
const BIKE_PANEL_MAT = new THREE.MeshStandardMaterial({ color: "#2b2d30", metalness: 0.6, roughness: 0.35 });
const BIKE_GOLD_MAT = new THREE.MeshStandardMaterial({ color: "#c9a227", metalness: 0.8, roughness: 0.25 });
const BIKE_SEAT_MAT = new THREE.MeshStandardMaterial({ color: "#17181a", roughness: 0.6 });
const BIKE_TIRE_MAT = new THREE.MeshStandardMaterial({ color: "#141414", roughness: 0.9 });
const BIKE_HUB_MAT = new THREE.MeshStandardMaterial({ color: "#2a2c32", metalness: 0.9, roughness: 0.25 });

// a wheel + its hub — the rear one gets a much bigger hub disc to read as the
// Verge TS's signature hubless rear end (motor housing fills the wheel
// instead of spokes around a small hub)
function Wheel({ z, hubR, hubThick }: { z: number; hubR: number; hubThick: number }) {
  return (
    <group position={[0, -0.42, z]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow material={BIKE_TIRE_MAT}>
        <cylinderGeometry args={[0.34, 0.34, 0.1, 20]} />
      </mesh>
      <mesh material={BIKE_HUB_MAT}>
        <cylinderGeometry args={[hubR, hubR, hubThick, 16]} />
      </mesh>
    </group>
  );
}

// exported so parked decoration (components/PoliceStation.tsx) can reuse the
// exact same model without a RigidBody/physics rig attached. Redesigned after
// the Verge TS Ultra: angular faceted tank panels, twin stacked headlights,
// gold upside-down fork tubes, a floating tail with no bulky subframe, and
// an oversized rear hub standing in for the real bike's hubless rear motor.
export function BikeMesh() {
  return (
    <group>
      {/* main body spine */}
      <mesh castShadow position={[0, 0.08, 0.05]} material={BIKE_MAIN_MAT}>
        <boxGeometry args={[0.24, 0.22, 1.25]} />
      </mesh>
      {/* angular tank-side facets */}
      {[1, -1].map((s) => (
        <mesh key={s} castShadow position={[s * 0.15, 0.22, 0.25]} rotation={[0, 0, s * 0.35]} material={BIKE_PANEL_MAT}>
          <boxGeometry args={[0.05, 0.26, 0.55]} />
        </mesh>
      ))}
      {/* side vent panel */}
      <mesh position={[0.13, 0.05, -0.05]} rotation={[0, 0.2, 0]} material={BIKE_PANEL_MAT}>
        <boxGeometry args={[0.02, 0.16, 0.3]} />
      </mesh>
      {/* floating tail seat — no bulky rear bodywork under it */}
      <mesh position={[0, 0.3, -0.35]} material={BIKE_SEAT_MAT}>
        <boxGeometry args={[0.22, 0.06, 0.5]} />
      </mesh>

      {/* upside-down front fork tubes */}
      {[0.09, -0.09].map((x) => (
        <mesh key={x} castShadow position={[x, -0.15, 0.68]} rotation={[0.15, 0, 0]} material={BIKE_GOLD_MAT}>
          <cylinderGeometry args={[0.025, 0.025, 0.55, 10]} />
        </mesh>
      ))}

      {/* twin stacked headlights */}
      {[0.09, -0.09].map((dy) => (
        <mesh key={dy} position={[0, 0.3 + dy, 0.85]}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshBasicMaterial color="#c9f0ff" />
        </mesh>
      ))}
      <mesh position={[0, 0.28, -0.62]}>
        <boxGeometry args={[0.12, 0.05, 0.03]} />
        <meshBasicMaterial color="#ff2b2b" />
      </mesh>

      {/* bar-end mirrors on thin stalks */}
      {[0.16, -0.16].map((x) => (
        <group key={x} position={[x, 0.42, 0.65]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={BIKE_PANEL_MAT}>
            <cylinderGeometry args={[0.015, 0.015, 0.14, 6]} />
          </mesh>
          <mesh position={[x > 0 ? 0.08 : -0.08, 0.02, 0]} material={BIKE_PANEL_MAT}>
            <boxGeometry args={[0.09, 0.05, 0.03]} />
          </mesh>
        </group>
      ))}

      <Wheel z={0.7} hubR={0.12} hubThick={0.12} />
      <Wheel z={-0.7} hubR={0.27} hubThick={0.16} />
    </group>
  );
}

const RIDER_JACKET_MAT = new THREE.MeshStandardMaterial({ color: "#1c1e22", roughness: 0.6 });
const RIDER_HELMET_MAT = new THREE.MeshStandardMaterial({ color: "#101114", roughness: 0.3, metalness: 0.3 });
const RIDER_LIMB_MAT = new THREE.MeshStandardMaterial({ color: "#26282c", roughness: 0.65 });

// a minimal seated silhouette, not the full walk-cycle rig Pedestrians.tsx
// builds (that's tuned for walking animation, overkill for a fixed seated
// pose) — leaning forward over the tank, arms to the bars, legs to the pegs
function BikeRider() {
  return (
    <group position={[0, 0.33, -0.3]}>
      <mesh castShadow position={[0, 0.28, 0.15]} rotation={[0.35, 0, 0]} material={RIDER_JACKET_MAT}>
        <boxGeometry args={[0.26, 0.4, 0.2]} />
      </mesh>
      <mesh castShadow position={[0, 0.56, 0.32]} material={RIDER_HELMET_MAT}>
        <sphereGeometry args={[0.13, 10, 10]} />
      </mesh>
      {[0.14, -0.14].map((x) => (
        <mesh key={x} castShadow position={[x, 0.32, 0.42]} rotation={[0.9, 0, 0]} material={RIDER_LIMB_MAT}>
          <cylinderGeometry args={[0.045, 0.045, 0.42, 8]} />
        </mesh>
      ))}
      {[0.11, -0.11].map((x) => (
        <mesh key={x} castShadow position={[x, 0.04, 0.02]} rotation={[0.55, 0, 0]} material={RIDER_LIMB_MAT}>
          <cylinderGeometry args={[0.055, 0.055, 0.42, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
