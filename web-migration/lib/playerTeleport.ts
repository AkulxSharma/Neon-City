// One-shot teleport request consumed only by Player.tsx — mirrors
// lib/clubTeleport.ts (which Car/Bike consume) but kept separate since the
// two are never meant to serve the same frame's request: club-door entry
// targets whichever of {car,bike,foot} is currently active, dismounting a
// vehicle always targets the player.
export const playerTeleport = { pending: false, x: 0, z: 0, h: 0 };

export function requestPlayerTeleport(x: number, z: number, h: number) {
  playerTeleport.pending = true;
  playerTeleport.x = x;
  playerTeleport.z = z;
  playerTeleport.h = h;
}
