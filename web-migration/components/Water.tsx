"use client";

export const WATER_LEVEL = 0.2;

// Flat shaded plane for now — no shader, no reflections. The original game's
// water is a scrolling normal-map + emissive material; that's a visual-polish
// pass for later, not part of the physics validation this phase is about.
export function Water() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[110, WATER_LEVEL - 0.02, 0]}>
      <planeGeometry args={[220, 300]} />
      <meshStandardMaterial color="#1f5fa8" roughness={0.35} metalness={0.1} transparent opacity={0.9} />
    </mesh>
  );
}
