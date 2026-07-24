"use client";

import { RigidBody } from "@react-three/rapier";

// Phase 1 slice, deliberately minimal: a flat ground plus a handful of fixed
// boxes to drive into. This exists to give the Phase-2 vehicle something to
// collide with — it is not the full chunk-streamed city (that's a later phase;
// the original's buildChunk()/ensureChunks() logic still applies almost
// unchanged, it just becomes an imperative R3F component instead of a raw
// three.js scene.add() call).
const BUILDINGS: Array<{ pos: [number, number, number]; size: [number, number, number] }> = [
  { pos: [10, 2, -10], size: [6, 4, 6] },
  { pos: [-14, 3, -6], size: [5, 6, 5] },
  { pos: [18, 1.5, 12], size: [4, 3, 10] },
  { pos: [-8, 2.5, 18], size: [8, 5, 4] },
  { pos: [0, 2, 30], size: [20, 4, 4] },
];

export function World() {
  return (
    <>
      {/* ground */}
      <RigidBody type="fixed" colliders="cuboid" friction={1}>
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[400, 1, 400]} />
          <meshStandardMaterial color="#2a2e38" />
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
        <RigidBody key={`bld-${i}`} type="fixed" colliders="cuboid">
          <mesh castShadow receiveShadow position={b.pos}>
            <boxGeometry args={b.size} />
            <meshStandardMaterial color="#4a5266" />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}
