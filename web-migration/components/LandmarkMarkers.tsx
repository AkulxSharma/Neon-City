"use client";

import { Billboard, Text } from "@react-three/drei";
import { LANDMARKS } from "@/lib/landmarks";

// Always rendered, not tied to chunk streaming — same as the original's
// floating landmark signs, which are a persistent top-level group, not part
// of buildChunk()'s per-chunk logic. Visible from a distance regardless of
// whether the ground/buildings around them have streamed in yet.
export function LandmarkMarkers() {
  return (
    <>
      {LANDMARKS.map((l) => (
        <group key={l.name} position={[l.x, 0, l.z]}>
          <mesh position={[0, 8, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 16, 6]} />
            <meshBasicMaterial color={l.col} transparent opacity={0.85} />
          </mesh>
          <pointLight color={l.col} intensity={2} distance={20} position={[0, 3, 0]} />
          <Billboard position={[0, 17, 0]}>
            <Text fontSize={2.4} color={l.col} outlineWidth={0.08} outlineColor="#05070f" anchorX="center" anchorY="middle">
              {l.name}
            </Text>
          </Billboard>
        </group>
      ))}
    </>
  );
}
