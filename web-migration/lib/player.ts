import { worldState } from "@/lib/worldState";
import { vehicleState } from "@/lib/vehicleState";
import { useHudStore, type VehicleKind } from "@/lib/hudStore";
import { requestPlayerTeleport } from "@/lib/playerTeleport";

const MOUNT_RADIUS2 = 4.5 * 4.5; // same threshold as the original's nearestVehicle(player.x,player.z,4.5)

/** Ported from the original's toggleVehicle(): mount the nearest vehicle in
 * range when on foot, or dismount the current one back to on-foot. The
 * original's "steal a traffic car" branch lives in lib/steal.ts instead —
 * traffic here isn't drivable, so hijacking one works the other way round.
 *
 * Returns false only when on foot with nothing OWNED in range, which is what
 * lets Game.tsx fall through to the steal attempt. */
export function toggleVehicleFoot(): boolean {
  const hud = useHudStore.getState();
  if (hud.active === "foot") {
    let best: VehicleKind | null = null;
    let bestD2 = MOUNT_RADIUS2;
    (Object.keys(vehicleState) as VehicleKind[]).forEach((k) => {
      const v = vehicleState[k];
      const dx = v.x - worldState.px;
      const dz = v.z - worldState.pz;
      // real 3D distance, not just ground-plane — without the y term, a
      // plane or helicopter passing overhead reads as "in range, press E"
      // from directly underneath on the ground. `v.y` is only ever set by
      // Plane.tsx/Helicopter.tsx; every other vehicle stays near enough to
      // ground/water level that treating a missing `y` as 0 is correct.
      const dy = (v.y ?? 0) - worldState.py;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = k;
      }
    });
    if (!best) return false;
    hud.setActive(best);
    hud.showMsg("DRIVE: " + useHudStore.getState().vehicleName());
    return true;
  } else {
    const v = vehicleState[hud.active as VehicleKind];
    const sx = v.x + Math.cos(v.h) * 2.4;
    const sz = v.z - Math.sin(v.h) * 2.4;
    requestPlayerTeleport(sx, sz, v.h);
    hud.setActive("foot");
    hud.showMsg("ON FOOT");
    return true;
  }
}
