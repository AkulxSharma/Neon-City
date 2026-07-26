"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CuboidCollider, useRapier, type RapierRigidBody, type RapierCollider } from "@react-three/rapier";
import { PLAYER_GROUPS } from "@/lib/collisionGroups";
import * as THREE from "three";
import { useKeyboard } from "@/lib/useKeyboard";
import { useHudStore } from "@/lib/hudStore";
import { worldState } from "@/lib/worldState";
import { applyCameraRig } from "@/lib/cameraRig";
import { playerTeleport } from "@/lib/playerTeleport";
import { SHORE_X } from "@/lib/marina";
import type { KinematicCharacterController } from "@dimforge/rapier3d-compat";

const DROWN_LIMIT = 2; // seconds in open water before respawn

// Ported from the original's on-foot tick() block: turn 2.6 rad/s, walk 4.5
// m/s / sprint 9 m/s (SHIFT), accel/decel ramp (30 accelerating, 36 braking),
// jump vy=7.5 with asymmetric gravity (46 while rising and released early for
// a short hop, 20 otherwise) — same numbers, just fed through Rapier's
// KinematicCharacterController (same one Car/Bike use) instead of the
// original's own collide()/py ballistic tracking.
const TURN_RATE = 2.6;
const WALK_SPEED = 4.5;
const SPRINT_SPEED = 9;
const JUMP_VY = 7.5;
const GRAV_RISING_RELEASED = -46;
const GRAV_OTHER = -20;

const START = { x: -48, z: 20, h: Math.PI }; // near VENU, matches the original's player spawn

export function Player() {
  const { world } = useRapier();
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const groupRef = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const keys = useKeyboard();
  const { camera } = useThree();

  const foot = useRef({ h: START.h, speed: 0, vy: 0 });
  const walkPhase = useRef(0);
  const spaceWasDown = useRef(false);
  const groundedRef = useRef(true);
  const drownTime = useRef(0);
  const camPos = useRef(new THREE.Vector3(0, 3, -6));
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

  useFrame((state, dt) => {
    const body = bodyRef.current;
    const controller = controllerRef.current;
    const collider = colliderRef.current;
    if (!body || !controller || !collider || !groupRef.current) return;
    const isActive = useHudStore.getState().active === "foot";
    groupRef.current.visible = isActive;

    // vehicle dismount teleport (lib/player.ts) or club-door teleport (lib/club.ts)
    if (playerTeleport.pending) {
      playerTeleport.pending = false;
      body.setTranslation({ x: playerTeleport.x, y: 1, z: playerTeleport.z }, true);
      foot.current.h = playerTeleport.h;
      foot.current.speed = 0;
      foot.current.vy = 0;
      worldState.px = playerTeleport.x;
      worldState.pz = playerTeleport.z;
      worldState.heading = playerTeleport.h;
    }

    // Take the walking collider OUT of the world while riding. It used to stay
    // behind as an invisible obstacle standing wherever you mounted — mostly
    // unnoticed, because you approach a parked car from the side and end up
    // outside its 1.85x4.6 box. lib/steal.ts breaks that assumption: it moves
    // the car so its CENTRE lands on the NPC's, and the natural way to steal is
    // to stand in the lane and let the car brake for you, so the collider ends
    // up INSIDE the car. A character controller that begins a step already
    // penetrating resolves to ~zero movement — the car simply won't drive.
    // Dismount re-enables it, and player.ts's teleport has already placed the
    // body beside the vehicle by then.
    if (collider.isEnabled() !== isActive) collider.setEnabled(isActive);

    if (!isActive) return;
    const d = Math.min(dt, 0.05);
    const k = keys.current;

    if (k.left) foot.current.h += TURN_RATE * d;
    if (k.right) foot.current.h -= TURN_RATE * d;

    const move = k.forward ? 1 : k.back ? -0.6 : 0;
    const sprint = k.boost;
    const sp = sprint ? SPRINT_SPEED : WALK_SPEED;
    const moveStep = (move !== 0 ? 30 : 36) * d;
    foot.current.speed += clamp(move * sp - foot.current.speed, -moveStep, moveStep);

    // jump: Space edge-triggers, only from the ground; holding it through the
    // rise keeps full gravity (long jump), releasing early steepens it (short hop)
    const spaceDown = k.handbrake;
    if (spaceDown && !spaceWasDown.current && groundedRef.current) foot.current.vy = JUMP_VY;
    spaceWasDown.current = spaceDown;
    const gravity = foot.current.vy > 0 && !spaceDown ? GRAV_RISING_RELEASED : GRAV_OTHER;
    foot.current.vy = Math.max(foot.current.vy + gravity * d, -16);

    const dx = Math.sin(foot.current.h) * foot.current.speed * d;
    const dz = Math.cos(foot.current.h) * foot.current.speed * d;
    controller.computeColliderMovement(collider, { x: dx, y: foot.current.vy * d, z: dz });
    const grounded = controller.computedGrounded();
    groundedRef.current = grounded;
    if (grounded && foot.current.vy <= 0) foot.current.vy = 0;
    const movement = controller.computedMovement();

    const t = body.translation();
    const nextPos = { x: t.x + movement.x, y: t.y + movement.y, z: t.z + movement.z };

    // drowning: stuck in open water (no ground under it, see Marina.tsx's shore
    // wall which normally keeps you out) past DROWN_LIMIT respawns you at START,
    // same fix the original applies via its own onFoot water check
    if (nextPos.x >= SHORE_X) {
      drownTime.current += d;
      if (drownTime.current > DROWN_LIMIT) {
        drownTime.current = 0;
        body.setTranslation({ x: START.x, y: 1, z: START.z }, true);
        foot.current.h = START.h;
        foot.current.speed = 0;
        foot.current.vy = 0;
        worldState.px = START.x;
        worldState.pz = START.z;
        worldState.heading = START.h;
        return;
      }
    } else {
      drownTime.current = 0;
    }

    body.setNextKinematicTranslation(nextPos);

    groupRef.current.rotation.y = foot.current.h; // group is a child of the RigidBody, which already tracks nextPos — no position update needed here

    worldState.px = nextPos.x;
    worldState.pz = nextPos.z;
    worldState.heading = foot.current.h;

    // limb animation — walk cycle, mid-air tuck, or (inClub, standing still) the
    // original's bollywood dance emote
    const hud = useHudStore.getState();
    const moving = Math.abs(foot.current.speed) > 0.15;
    walkPhase.current += d * (moving ? (sprint ? 13 : 8) : 0);
    const sw = Math.sin(walkPhase.current) * (moving ? clamp(Math.abs(foot.current.speed) / sp, 0, 1) * 0.6 : 0);
    if (legL.current && legR.current && armL.current && armR.current) {
      if (!grounded) {
        legL.current.rotation.set(0.55, 0, 0);
        legR.current.rotation.set(-0.25, 0, 0);
        armL.current.rotation.set(-0.9, 0, 0);
        armR.current.rotation.set(-0.9, 0, 0);
      } else if (hud.inClub && move === 0) {
        const t2 = state.clock.elapsedTime * (130 / 60) * Math.PI * 2;
        armL.current.rotation.set(Math.PI + Math.sin(t2) * 1.0, 0, 0.4 + Math.sin(t2 * 0.5) * 0.5);
        armR.current.rotation.set(Math.PI + Math.cos(t2 * 1.05) * 1.0, 0, -0.4 - Math.sin(t2 * 0.5) * 0.5);
        legL.current.rotation.set(Math.max(0, Math.sin(t2)) * 0.35, 0, 0);
        legR.current.rotation.set(Math.max(0, -Math.sin(t2)) * 0.35, 0, 0);
      } else {
        legL.current.rotation.set(sw, 0, 0);
        legR.current.rotation.set(-sw, 0, 0);
        armL.current.rotation.set(-sw * 0.7, 0, 0);
        armR.current.rotation.set(sw * 0.7, 0, 0);
      }
    }

    applyCameraRig({
      camera,
      camPos: camPos.current,
      camLook: camLook.current,
      tx: nextPos.x,
      ty: nextPos.y,
      tz: nextPos.z,
      th: foot.current.h,
      isBike: false,
      camMode: hud.camMode,
      time: state.clock.elapsedTime,
      dt: d,
    });
  });

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[START.x, 1, START.z]}>
      <CuboidCollider ref={colliderRef} args={[0.3, 0.75, 0.3]} collisionGroups={PLAYER_GROUPS} />
      <group ref={groupRef} position={[0, -0.75, 0]}>
        <PersonMesh legL={legL} legR={legR} armL={armL} armR={armR} />
      </group>
    </RigidBody>
  );
}

// Exact geometry/pivots ported from the original's pMesh construction
// (jacket/vest/tie suit) — legL/legR/armL/armR are the meshes themselves
// (not wrapper groups), matching how the original rotates them directly
// around their own box centers, not a hip/shoulder joint.
function PersonMesh({
  legL,
  legR,
  armL,
  armR,
}: {
  legL: React.RefObject<THREE.Mesh | null>;
  legR: React.RefObject<THREE.Mesh | null>;
  armL: React.RefObject<THREE.Mesh | null>;
  armR: React.RefObject<THREE.Mesh | null>;
}) {
  const jacket = <meshLambertMaterial color="#1c2230" />;
  const trouser = <meshLambertMaterial color="#161b26" />;
  const white = <meshLambertMaterial color="#f2f2f4" />;
  const vest = <meshLambertMaterial color="#39415a" />;
  const tie = <meshLambertMaterial color="#7a1626" />;
  const skin = <meshLambertMaterial color="#d9a066" />;
  const shoe = <meshStandardMaterial color="#0a0a0c" roughness={0.25} metalness={0.4} />;
  return (
    <group>
      <mesh position={[-0.11, 0.045, 0.04]} castShadow>
        <boxGeometry args={[0.17, 0.09, 0.3]} />
        {shoe}
      </mesh>
      <mesh position={[0.11, 0.045, 0.04]} castShadow>
        <boxGeometry args={[0.17, 0.09, 0.3]} />
        {shoe}
      </mesh>
      <mesh ref={legL} position={[-0.11, 0.34, 0]} castShadow>
        <boxGeometry args={[0.17, 0.5, 0.17]} />
        {trouser}
      </mesh>
      <mesh ref={legR} position={[0.11, 0.34, 0]} castShadow>
        <boxGeometry args={[0.17, 0.5, 0.17]} />
        {trouser}
      </mesh>
      <mesh position={[0, 0.92, 0]} castShadow>
        <boxGeometry args={[0.48, 0.6, 0.28]} />
        {jacket}
      </mesh>
      <mesh position={[0, 0.88, 0.155]}>
        <boxGeometry args={[0.3, 0.44, 0.04]} />
        {vest}
      </mesh>
      <mesh position={[0, 1.08, 0.165]}>
        <boxGeometry args={[0.17, 0.18, 0.035]} />
        {white}
      </mesh>
      <mesh position={[0, 0.98, 0.18]}>
        <boxGeometry args={[0.07, 0.3, 0.03]} />
        {tie}
      </mesh>
      <mesh ref={armL} position={[-0.32, 0.9, 0]} castShadow>
        <boxGeometry args={[0.13, 0.52, 0.13]} />
        {jacket}
      </mesh>
      <mesh ref={armR} position={[0.32, 0.9, 0]} castShadow>
        <boxGeometry args={[0.13, 0.52, 0.13]} />
        {jacket}
      </mesh>
      <mesh position={[-0.32, 0.63, 0]}>
        <boxGeometry args={[0.135, 0.06, 0.135]} />
        {white}
      </mesh>
      <mesh position={[0.32, 0.63, 0]}>
        <boxGeometry args={[0.135, 0.06, 0.135]} />
        {white}
      </mesh>
      <mesh position={[-0.32, 0.56, 0]}>
        <boxGeometry args={[0.1, 0.09, 0.1]} />
        {skin}
      </mesh>
      <mesh position={[0.32, 0.56, 0]}>
        <boxGeometry args={[0.1, 0.09, 0.1]} />
        {skin}
      </mesh>
      <mesh position={[0, 1.38, 0]} castShadow>
        <sphereGeometry args={[0.16, 12, 12]} />
        {skin}
      </mesh>
      <mesh position={[0, 1.5, -0.02]}>
        <boxGeometry args={[0.3, 0.1, 0.3]} />
        <meshLambertMaterial color="#201812" />
      </mesh>
    </group>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
