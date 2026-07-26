// Dock/pier data shared between components/Marina.tsx (renders it, gives land
// traversal a normal solid RigidBody collider — see that file for why that's
// enough for Car/Bike/Player but not boats) and Boat.tsx/PatrolBoat.tsx (hulls
// need their own check, ported from the original's pierPush()/pierColliders,
// since Boat.tsx never queries Rapier colliders at all — Milestone 2).
export const SHORE_X = 600; // land/water edge near EAST MARINA — matches the original's raw SHORE_X (see lib/landmarks.ts)
export const PIER_LEN = 40;
export const PIER_Z = 50;

export const PIER_COLLIDERS: { x0: number; x1: number; z0: number; z1: number }[] = [
  { x0: SHORE_X - 2, x1: SHORE_X - 2 + PIER_LEN, z0: PIER_Z - 4.5, z1: PIER_Z + 4.5 },
];

/** Ported verbatim from the original's pierPush(x,z,r) — same AABB push-out
 * math as collide(), just against the dock's own footprint instead of the
 * general staticColliders/chunk list. Boat.tsx calls this every frame with
 * r=2.0 (matches the original) so a hull slides off the dock's edge instead
 * of ghosting through it. */
export function pierPush(x: number, z: number, r: number): { x: number; z: number; hit: boolean } {
  let hit = false;
  for (const c of PIER_COLLIDERS) {
    const nx = clamp(x, c.x0, c.x1);
    const nz = clamp(z, c.z0, c.z1);
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      const d = Math.sqrt(d2) || 0.001;
      x = nx + (dx / d) * r;
      z = nz + (dz / d) * r;
    }
  }
  return { x, z, hit };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
