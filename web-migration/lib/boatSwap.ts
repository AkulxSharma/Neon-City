import { worldState } from "@/lib/worldState";
import { vehicleState } from "@/lib/vehicleState";
import { useHudStore, BOAT_KINDS, type VehicleKind } from "@/lib/hudStore";

const SWAP_RADIUS2 = 6 * 6;

/** Ported from the original's nearBoatToBoard/E-to-swap: if you're already in
 * a boat and alongside another hull, E swaps straight into it instead of the
 * normal dismount-to-foot. Only two hulls exist in this build (boat,
 * patrolBoat) so "the other one" needs no search — a third hull would need
 * a nearest-of-the-rest scan like lib/player.ts's mount check. */
export function boatSwapAction(): boolean {
  const hud = useHudStore.getState();
  if (!(BOAT_KINDS as readonly string[]).includes(hud.active)) return false;
  const other = BOAT_KINDS.find((k) => k !== hud.active) as VehicleKind | undefined;
  if (!other) return false;
  const v = vehicleState[other];
  const dx = v.x - worldState.px;
  const dz = v.z - worldState.pz;
  if (dx * dx + dz * dz >= SWAP_RADIUS2) return false;
  hud.setActive(other);
  hud.showMsg("SWITCHED TO: " + useHudStore.getState().vehicleName());
  return true;
}
