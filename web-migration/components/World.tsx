"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { skyState } from "@/components/SkyCycle";

// Phase 1 slice, deliberately minimal: a flat ground plus a handful of fixed
// boxes to drive into. This exists to give the Phase-2 vehicle something to
// collide with — it is not the full chunk-streamed city (that's a later phase;
// the original's buildChunk()/ensureChunks() logic still applies almost
// unchanged, it just becomes an imperative R3F component instead of a raw
// three.js scene.add() call).
const BUILDING_COLORS = ["#8a94a0", "#7fa8be", "#9aa8c4", "#6c7686"];

const BUILDINGS: Array<{ pos: [number, number, number]; size: [number, number, number] }> = [
  { pos: [10, 2, -10], size: [6, 4, 6] },
  { pos: [-14, 3, -6], size: [5, 6, 5] },
  { pos: [18, 1.5, 12], size: [4, 3, 10] },
  { pos: [-8, 2.5, 18], size: [8, 5, 4] },
  { pos: [0, 2, 30], size: [20, 4, 4] },
  { pos: [-20, 6, -20], size: [7, 12, 7] },
  { pos: [22, 8, -22], size: [6, 16, 6] },
];

export function World() {
  return (
    <>
      {/* ground — dark asphalt, matches the original's road/ground palette */}
      <RigidBody type="fixed" colliders="cuboid" friction={1}>
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[400, 1, 400]} />
          <meshStandardMaterial color="#14161a" roughness={0.95} />
        </mesh>
      </RigidBody>

      {/* boundary walls so the test arena has an edge */}
      {[
        { pos: [0, 2, -100] as [number, number, number], size: [400, 4, 2] as [number, number, number] },
        { pos: [0, 2, 100] as [number, number, number], size: [400, 4, 2] as [number, number, number] },
        { pos: [-100, 2, 0] as [number, number, number], size: [2, 4, 400] as [number, number, number] },
        { pos: [100, 2, 0] as [number, number, number], size: [2, 4, 400] as [number, number, number] },
      ].map((wall, i) => (
        <RigidBody key={`wall-${i}`} type="fixed" colliders="cuboid">
          <mesh position={wall.pos}>
            <boxGeometry args={wall.size} />
            <meshStandardMaterial color="#1a1c22" />
          </mesh>
        </RigidBody>
      ))}

      {BUILDINGS.map((b, i) => (
        <Building key={`bld-${i}`} pos={b.pos} size={b.size} color={BUILDING_COLORS[i % BUILDING_COLORS.length]} />
      ))}
    </>
  );
}

// Windows-lit-at-night is the original city's signature look. The real game
// bakes an actual window pattern into a canvas texture; this is the cheap
// approximation — a soft emissive tint on the whole facade that fades in with
// skyState.nightK, tuned to sit just under the bloom threshold at night so it
// reads as "lit windows glowing", not a flat glowing box.
function Building({
  pos,
  size,
  color,
}: {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (matRef.current) matRef.current.emissiveIntensity = skyState.nightK * 0.55;
  });

  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh castShadow receiveShadow position={pos}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={new THREE.Color("#ffe6a8")}
          emissiveIntensity={0}
          roughness={0.6}
          metalness={0.15}
        />
      </mesh>
    </RigidBody>
  );
}
