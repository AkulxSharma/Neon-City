// Last line of defence against a vehicle ending up under the world.
//
// The chunk streamer builds ground a few chunks at a time, so there are
// windows — a page load, a long stall, a teleport to somewhere not yet
// streamed — where a kinematic body can step down through a gap. Once it is
// below the ground box the ground is ABOVE it, `computedGrounded()` never goes
// true again, and the constant gravity in each vehicle's loop just keeps
// integrating: the observed failure was y = -65,000 with the fall speed still
// climbing, i.e. the car was gone for good and only a reload brought it back.
//
// The ground plane sits at y=0 (a 1-unit box centred at -0.5), so anything
// this far under it is not "on a slope" or "in a dip", it is out of the world.
export const VOID_Y = -12;

/**
 * If `y` has dropped out of the world, returns the height to snap back to;
 * otherwise returns null and the caller carries on untouched.
 *
 * Deliberately preserves x/z — the car reappears on the road it fell through,
 * which is almost always where the player still is, rather than being yanked
 * to a spawn point across the city.
 */
export function fellOutOfWorld(y: number): boolean {
  return y < VOID_Y;
}
