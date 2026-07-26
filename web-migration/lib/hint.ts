import { worldState } from "@/lib/worldState";
import { vehicleState } from "@/lib/vehicleState";
import { useHudStore, VEHICLE_NAMES, type VehicleKind } from "@/lib/hudStore";
import { clubHintText } from "@/lib/club";

const MOUNT_HINT_RADIUS2 = 5 * 5; // slightly wider than the 4.5 mount action radius

/** Single source of truth for the #hint line, polled once per frame by
 * Club.tsx (always mounted). Club door takes priority over the vehicle-mount
 * hint, same order as the original's `if(!clubDoorAction()) toggleVehicle()`. */
export function computeHint(): string | null {
  const club = clubHintText();
  if (club) return club;

  const hud = useHudStore.getState();
  if (hud.active !== "foot") return null;

  let bestName: string | null = null;
  let bestD2 = MOUNT_HINT_RADIUS2;
  (Object.keys(vehicleState) as VehicleKind[]).forEach((k) => {
    const v = vehicleState[k];
    const dx = v.x - worldState.px;
    const dz = v.z - worldState.pz;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestName = VEHICLE_NAMES[k];
    }
  });
  if (bestName) return `Press E to drive — ${bestName}`;

  // nothing of his in range — offer the nearest NPC instead, same order as
  // Game.tsx's E chain (own vehicle first, steal as the fallback)
  const t = nearestStealable();
  return t ? `Press E to steal — ${t}` : null;
}

function nearestStealable(): string | null {
  let name: string | null = null;
  let bestD2 = MOUNT_HINT_RADIUS2;
  for (const t of trafficPositions) {
    if (t.stolen) continue;
    const dx = t.x - worldState.px;
    const dz = t.z - worldState.pz;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2) {
      bestD2 = d2;
      name = t.police ? VEHICLE_NAMES.policeCar : VEHICLE_NAMES.car;
    }
  }
  return name;
}
