"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CuboidCollider, useRapier, type RapierRigidBody, type RapierCollider } from "@react-three/rapier";
import * as THREE from "three";
import { useKeyboard } from "@/lib/useKeyboard";
import { stepCarPhysics, DEFAULT_HANDLING, type CarState } from "@/lib/carPhysics";
import { useHudStore } from "@/lib/hudStore";
import type { KinematicCharacterController } from "@dimforge/rapier3d-compat";

const GRAVITY_PULL = -12; // m/s^2 fed into the character controller so it stays snapped to the ground

export function Car() {
  const { world } = useRapier();
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const keys = useKeyboard();
  const { camera } = useThree();

  // persistent car state across frames (heading/speed/vLat/steerAng) — mirrors the
  // original game's per-vehicle object, kept in a ref so updating it never re-renders
  const car = useRef<CarState>({ h: 0, speed: 0, vLat: 0, steerAng: 0 });
  const fallSpeed = useRef(0);
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

  const carBox = useMemo(() => new THREE.Vector3(1.9, 1.1, 4.2), []);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    const controller = controllerRef.current;
    const collider = colliderRef.current;
    if (!body || !controller || !collider) return;
    const d = Math.min(dt, 0.05); // clamp like the original tick() to avoid a tab-switch spike

    const isActive = useHudStore.getState().active === "car";
    const k = keys.current;
    const steer = isActive ? (k.left ? 1 : 0) - (k.right ? 1 : 0) : 0;

    const { dx, dz } = stepCarPhysics(
      car.current,
      {
        forward: isActive && k.forward,
        back: isActive && k.back,
        steer,
        handbrake: isActive && k.handbrake,
      },
      DEFAULT_HANDLING,
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

    if (!isActive) return;

    // chase camera — same lerp-follow shape as the original game's camPos/camLook
    const dir = new THREE.Vector3(Math.sin(car.current.h), 0, Math.cos(car.current.h));
    const targetCamPos = new THREE.Vector3(
      nextPos.x - dir.x * 8,
      nextPos.y + 3.5,
      nextPos.z - dir.z * 8
    );
    const targetLook = new THREE.Vector3(nextPos.x + dir.x * 4, nextPos.y + 1, nextPos.z + dir.z * 4);
    camPos.current.lerp(targetCamPos, Math.min(1, d * 4));
    camLook.current.lerp(targetLook, Math.min(1, d * 6));
    camera.position.copy(camPos.current);
    camera.lookAt(camLook.current);

    useHudStore.getState().setHud(Math.round(Math.abs(car.current.speed) * 3.6), grounded);
  });

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[0, 1, 0]}>
      <CuboidCollider ref={colliderRef} args={[carBox.x / 2, carBox.y / 2, carBox.z / 2]} />
      <mesh castShadow>
        <boxGeometry args={[carBox.x, carBox.y, carBox.z]} />
        <meshStandardMaterial color="#e0483c" />
      </mesh>
      {/* headlight stand-ins, just so heading is readable at a glance */}
      <mesh position={[0.6, 0, carBox.z / 2]}>
        <boxGeometry args={[0.25, 0.15, 0.05]} />
        <meshBasicMaterial color="#fff6d0" />
      </mesh>
      <mesh position={[-0.6, 0, carBox.z / 2]}>
        <boxGeometry args={[0.25, 0.15, 0.05]} />
        <meshBasicMaterial color="#fff6d0" />
      </mesh>
    </RigidBody>
  );
}
