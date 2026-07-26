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
import { checkCrashDebris } from "@/lib/debris";
import { SHORE_X, DROWN_RESPAWN } from "@/lib/marina";
import { SupercarBody, styleFor, RIDE_HEIGHT, type CarStyle, type Detail } from "@/components/SupercarBody";
import { QueryFilterFlags, type KinematicCharacterController } from "@dimforge/rapier3d-compat";

const GRAVITY_PULL = -12; // m/s^2 fed into the character controller so it stays snapped to the ground
const NITRO_MAX = 10; // seconds of fuel — same numbers as the original's NITRO_MAX/NITRO_BOOST
const NITRO_BOOST = 41.7; // +150 km/h over the car's normal top speed while boosting
const DROWN_LIMIT = 2; // seconds past the shore before respawn — mirrors Player.tsx's on-foot drowning

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
  const drownTime = useRef(0);
  const crashCooldown = useRef(0);
  const nitroFuel = useRef(NITRO_MAX);
  const camPos = useRef(new THREE.Vector3(0, 4, -10));
  const camLook = useRef(new THREE.Vector3());
  const controllerRef = useRef<KinematicCharacterController | null>(null);
  const meshRef = useRef<THREE.Group>(null);

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
      body.setTranslation({ x: teleportRequest.x, y: RIDE_HEIGHT, z: teleportRequest.z }, true);
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
    // EXCLUDE_DYNAMIC: props (components/Props.tsx) are the only dynamic bodies
    // in the game — skipping them from the sweep means the car's trajectory
    // never slides/stops on a cone, it just plows through while the solver
    // (unaffected by this query filter) still shoves the prop out of the way.
    controller.computeColliderMovement(collider, { x: dx, y: fallSpeed.current * d, z: dz }, QueryFilterFlags.EXCLUDE_DYNAMIC);
    const grounded = controller.computedGrounded();
    if (grounded) fallSpeed.current = 0;
    const movement = controller.computedMovement();

    const t = body.translation();
    // TEMP DEBUG — remove before final push
    if (process.env.NODE_ENV !== "production" && meshRef.current) {
      const box = new THREE.Box3().setFromObject(meshRef.current);
      (window as unknown as { __carDbg: unknown }).__carDbg = {
        bodyY: t.y,
        grounded,
        colliderY: collider.translation().y,
        meshMinY: box.min.y,
        meshMaxY: box.max.y,
      };
    }
    const nextPos = { x: t.x + movement.x, y: t.y + movement.y, z: t.z + movement.z };

    // drowning safety net: the shore wall (Marina.tsx) keeps this unreachable
    // in normal play, but respawn at POLICE HARBOR instead of leaving the car
    // falling forever if it ever ends up past the coastline
    if (nextPos.x >= SHORE_X) {
      drownTime.current += d;
      if (drownTime.current > DROWN_LIMIT) {
        drownTime.current = 0;
        body.setTranslation({ x: DROWN_RESPAWN.x, y: RIDE_HEIGHT, z: DROWN_RESPAWN.z }, true);
        car.current.h = DROWN_RESPAWN.h;
        car.current.speed = 0;
        car.current.vLat = 0;
        fallSpeed.current = 0;
        vehicleState.car.x = DROWN_RESPAWN.x;
        vehicleState.car.z = DROWN_RESPAWN.z;
        vehicleState.car.h = DROWN_RESPAWN.h;
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
      checkCrashDebris(crashCooldown, d, { x: dx, z: dz }, { x: movement.x, z: movement.z }, Math.abs(car.current.speed), nextPos, car.current.h);
    }

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
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[save?.x ?? 0, RIDE_HEIGHT, save?.z ?? 0]}>
      {/* Dropped so the collider's BOTTOM face lands on the tyre contact patch
          rather than on the mesh origin. Centred, snapToGround parked the
          chassis at half the box height (0.65) and buried the car 0.33m. */}
      <CuboidCollider
        ref={colliderRef}
        args={[carBox.x / 2, carBox.y / 2, carBox.z / 2]}
        position={[0, carBox.y / 2 - RIDE_HEIGHT, 0]}
      />
      {/* keyed on the stolen paint so the mesh remounts when you take over a
          traffic car — CarMesh pins colour/style at mount (useState), so a
          prop change alone would not repaint an already-mounted body */}
      <group ref={meshRef}>
        <StolenAwareCarMesh />
      </group>
    </RigidBody>
  );
}

// Supercar paint options — deep metallics plus a few loud hero colours, the
// palette an exotic actually ships in, not the grey/navy fleet the old sedan
// silhouette used.
const SEDAN_COLORS = [
  "#d81f26", // rosso
  "#f2b100", // giallo
  "#1d5fd8", // blu
  "#16171b", // nero
  "#e8eaee", // bianco
  "#1f9e6e", // verde
  "#f26a1b", // arancio
  "#7b2ff2", // viola
  "#8f959f", // grigio
];

// The player's sedan wears whatever it was last stolen as (lib/steal.ts), so
// the car you drive away in looks like the one you walked up to. Held in the
// HUD store rather than a mutable singleton because a repaint is one of the
// few things here that legitimately wants a re-render — and it's isolated in
// this leaf so a steal never re-renders the drive rig above it.
function StolenAwareCarMesh() {
  const stolen = useHudStore((s) => s.stolenCar);
  return (
    <CarMesh
      key={stolen ? `${stolen.color}:${stolen.style}` : "own"}
      color={stolen?.color}
      style={stolen?.style}
    />
  );
}

// The whole silhouette now lives in components/SupercarBody.tsx (shared with
// PoliceCar.tsx); this just picks paint + roofline for one instance.
export function CarMesh({
  color,
  style,
  detail = "high",
}: { color?: string; style?: CarStyle; detail?: Detail } = {}) {
  // random-once-at-mount, not a memo: neither value changes after mount for
  // any given instance, and useState's lazy initializer is the sanctioned
  // place for a one-time impure value (Math.random) — a plain useMemo
  // re-running is not guaranteed not to happen more than once.
  // Both fall back to a roll only when the caller doesn't pin them; Traffic.tsx
  // and the stolen-car path below both pin, so their cars are stable.
  const [bodyColor] = useState(() => color ?? SEDAN_COLORS[Math.floor(Math.random() * SEDAN_COLORS.length)]);
  const [ownStyle] = useState(() => styleFor(Math.random() * 300));
  return <SupercarBody color={color ?? bodyColor} style={style ?? ownStyle} detail={detail} />;
}
