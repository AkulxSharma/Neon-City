"use client";

import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Billboard, Text } from "@react-three/drei";
import { useHudStore } from "@/lib/hudStore";
import { CLUB } from "@/lib/club";
import { computeHint } from "@/lib/hint";

// VENU exterior — direct port of the original's clubGrp (body/trim/sign/door),
// minus the three volumetric light-beam cones (pure decoration, cut for cost).
// Always mounted; owns the #hint line (via lib/hint.ts) since it's the only
// thing that needs to poll distance every frame regardless of active mode.
export function Club() {
  useFrame(() => {
    const hud = useHudStore.getState();
    const next = computeHint();
    if (hud.hint !== next) hud.setHint(next);
  });

  return (
    <group position={[CLUB.cx, 0, CLUB.cz]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[19, 7, 14]} position={[0, 7, 0]} />
      </RigidBody>
      <mesh castShadow receiveShadow position={[0, 7, 0]}>
        <boxGeometry args={[38, 14, 28]} />
        <meshStandardMaterial color="#17121f" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 13.8, 0]}>
        <boxGeometry args={[38.4, 0.8, 28.4]} />
        <meshBasicMaterial color="#ff2fd0" />
      </mesh>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[38.4, 0.8, 28.4]} />
        <meshBasicMaterial color="#28e8ff" />
      </mesh>
      <Billboard position={[0, 9.5, 14.2]}>
        <Text fontSize={3} color="#ff3fd6" outlineWidth={0.1} outlineColor="#05070f" anchorX="center" anchorY="middle">
          VENU
        </Text>
      </Billboard>
      <mesh position={[0, 2.5, 14.05]}>
        <planeGeometry args={[6, 5]} />
        <meshBasicMaterial color="#8f4fff" />
      </mesh>
      <pointLight color="#ff3fd6" intensity={2} distance={60} position={[-8, 10, 20]} />
      <pointLight color="#2fe9ff" intensity={2} distance={60} position={[8, 10, 20]} />
    </group>
  );
}
