import { worldState } from "@/lib/worldState";
import { useHudStore, BOAT_KINDS } from "@/lib/hudStore";
import { requestTeleport } from "@/lib/clubTeleport";
import { requestPlayerTeleport } from "@/lib/playerTeleport";
import { startClubMusic, stopClubMusic } from "@/lib/audio";

// Exact coordinates from the original's CLUB/CLUB_IN — the interior is a real
// place in the world, built far south so it never meets the streamed city
// (see City.tsx's exemption), not an overlay scene.
export const CLUB = { cx: -50, cz: -50 };
export const CLUB_IN = { x: -50, z: -4050 };

const DOOR_OUT = { x: CLUB.cx, z: CLUB.cz + 15.5 }; // matches the VENU landmark spot
const DOOR_IN = { x: CLUB_IN.x, z: CLUB_IN.z + 13 };

let outPos = { x: CLUB.cx, z: CLUB.cz + 16, h: Math.PI };

// Car/Bike consume lib/clubTeleport's singleton, Player consumes its own
// (lib/playerTeleport) — route to whichever the currently-active mode polls.
function teleport(x: number, z: number, h: number) {
  if (useHudStore.getState().active === "foot") requestPlayerTeleport(x, z, h);
  else requestTeleport(x, z, h);
}

// Ported from the original's clubDoorAction() — same squared-distance
// thresholds. The original only lets you through the door on foot
// (player.onFoot); this build additionally allows driving straight in on
// any land vehicle (car/bike/police cruiser — an addition, not in the
// original) since the door was built before on-foot mode existed and
// there's no reason to take the shortcut away now. Hulls still excluded —
// no boat can reach the door.
export function clubDoorAction(): boolean {
  const hud = useHudStore.getState();
  if ((BOAT_KINDS as readonly string[]).includes(hud.active)) return false;
  if (hud.inClub) {
    const dx = worldState.px - DOOR_IN.x;
    const dz = worldState.pz - DOOR_IN.z;
    if (dx * dx + dz * dz >= 14) return false;
    hud.setInClub(false);
    stopClubMusic();
    teleport(outPos.x, outPos.z, outPos.h);
    hud.showMsg("BACK ON THE STREET");
    return true;
  }
  const dx = worldState.px - DOOR_OUT.x;
  const dz = worldState.pz - DOOR_OUT.z;
  if (dx * dx + dz * dz >= 22) return false;
  outPos = { x: worldState.px, z: worldState.pz + 1.5, h: worldState.heading };
  hud.setInClub(true);
  startClubMusic();
  teleport(CLUB_IN.x, CLUB_IN.z + 3, Math.PI);
  hud.showMsg("VENU — BOLLYWOOD NIGHT");
  return true;
}

/** Polled every frame by Club.tsx to drive the door hint — wider radius than
 * the action thresholds above so the hint shows up before you're close enough
 * to trigger it. */
export function clubHintText(): string | null {
  const hud = useHudStore.getState();
  if (hud.inClub) {
    const dx = worldState.px - DOOR_IN.x;
    const dz = worldState.pz - DOOR_IN.z;
    return dx * dx + dz * dz < 30 ? "Press E to exit VENU" : null;
  }
  const dx = worldState.px - DOOR_OUT.x;
  const dz = worldState.pz - DOOR_OUT.z;
  return dx * dx + dz * dz < 40 ? "Press E to enter VENU" : null;
}
