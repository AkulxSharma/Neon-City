// Dock/pier data shared between components/Marina.tsx (renders it, gives land
// traversal a normal solid RigidBody collider — see that file for why that's
// enough for Car/Bike/Player but not boats) and Boat.tsx/PatrolBoat.tsx (hulls
// need their own check, ported from the original's pierPush()/pierColliders,
// since Boat.tsx never queries Rapier colliders at all — Milestone 2).
export const SHORE_X = 600; // land/water edge near EAST MARINA — matches the original's raw SHORE_X (see lib/landmarks.ts)
// True edge of the last solid city chunk (City.tsx: CELL=100, SHORE_CI=6 —
// chunks at/after ci=6 render no ground). The shore wall/dock MUST start
// here, not further out at SHORE_X: a car reaching x=550 with nothing to
// stand on falls before it ever travels the remaining ~49 units to a wall
// planted near SHORE_X, sinking under the wall's collision height on the way
// down and drowning forever — this was the actual cause of the drowning bug.
export const LAND_EDGE_X = 550;
export const PIER_LEN = 90; // bridges the gap from LAND_EDGE_X straight out over the water
export const PIER_Z = 50;

export const PIER_COLLIDERS: { x0: number; x1: number; z0: number; z1: number }[] = [
  { x0: LAND_EDGE_X, x1: LAND_EDGE_X + PIER_LEN, z0: PIER_Z - 4.5, z1: PIER_Z + 4.5 },
];

// Where a vehicle that somehow ends up drowning respawns — same clear spot
// policeCar already parks at (lib/vehicleState.ts), reused so Car.tsx/Bike.tsx
// don't need their own separate safe-spot check.
export const DROWN_RESPAWN = { x: 482, z: 75, h: 0 };

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
