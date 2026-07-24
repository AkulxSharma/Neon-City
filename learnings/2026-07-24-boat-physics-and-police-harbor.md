# Boat dock physics + Police Harbor Station

**Date:** 2026-07-24

## Problem
A cluster of related complaints from one play session: (1) cars appearing to drive in the
open sea, (2) no police boat findable, wanted a police station near the marina with boats,
cars, and bikes, (3) boat mirrors should be blue, (4) boat drivers floating half in the air
instead of sitting, (5) mid-session follow-up: make the dock solid for boats but keep it
climbable for land vehicles, and let the player swap boats instead of just bouncing off /
being ejected into the water.

## Approach
Read before writing: grepped the whole 7500-line single-file game for `boat|water|ocean|dock`
and `police|siren` before touching anything, using `awk 'length($0)<300'` to filter out a
giant inlined base64 texture blob that otherwise flooded grep output.

Found that most of the "sea" protections already existed and were solid: `trafficRespawn`
already refuses to spawn traffic in the sea, the lane-AI already U-turns 28m before the
shoreline, and `updateSinking` actively pulls any car that ends up in the sea underwater
within ~2s. Concluded the reported "cars in the sea" were likely distant boats/scenery
misread at night, not a live traffic bug — but added a cheap symmetric fix anyway (the boat
physics already hard-clamps `v.x<SHORE_X+1.5`; added the mirror-image clamp
`!v.isBoat&&v.x>SHORE_X-1.5` for whichever vehicle the player is driving, since that's the
only vehicle type whose position isn't already fully guarded).

Found a half-finished feature via a stale comment: the shore-building code said "Boats get
their own dedicated check instead: pierPush(), called only from the boat physics branch
below" — but `pierPush` didn't exist anywhere in the file. Implemented it for real: a
`pierColliders` array (separate from the general `staticColliders`/`cols` used by
`collide()`, which is shared by land vehicles AND the player's feet) populated with each
pier deck's AABB, plus a `pierPush(x,z,r)` function mirroring `collide()`'s push-out math,
called only when `v.isBoat`. This keeps the dock solid for hulls without walling out land
vehicles or the on-foot player, who still needs to walk up onto the same deck.

For the floating boat drivers: `attachDriver()` hardcoded `x=-0.36, z=-0.15` for every
vehicle type, which is correct for a car's left-hand seat but wrong for every boat helm
(all centered at x=0, with cabin/console/bridge at wildly different z per boat type — jetski
saddle, cruiser console, cargo bridge, pirate stern). Generalized `attachDriver` to read
optional `userData.seatX`/`seatZ` (falling back to the car defaults), then set those plus a
small chair mesh per boat type, computed from each type's actual deck/console/bridge-floor
height already in scope in that code block (not guessed).

For the mid-session boat-swap request: found the single-vehicle physics block only runs for
`player.veh` (AI traffic and AI boats each have their own separate, simpler update loops), so
a `nearBoatToBoard` flag set during the existing vehicle-vs-vehicle collision loop (only when
`v.isBoat && o.isBoat && v===player.veh`) was enough — no new collision system needed. Wired
it into the existing `toggleVehicle()` (E key) ahead of the normal enter/exit logic, and
excluded `bothBoats` from the existing eject-into-water condition.

## Why
The user's mid-turn follow-up claimed "I made that dock hard... but now my tractor can't
climb it" — but no dock collision code existed yet (still mid-investigation) and no tractor
vehicle exists anywhere in this codebase. Rather than build against that false premise,
verified both claims by grep first, then proceeded anyway because the *end state* they
wanted (dock solid for boats, climbable for land vehicles) was unambiguous and vehicle-type-
agnostic — gating the new pier collision on `v.isBoat` satisfies it regardless of what land
vehicle they meant.

## Gotchas
- This file has a multi-megabyte base64 texture/NYC-building blob inline; any `grep -n` over
  the whole file without a length filter buries real matches under garbage. Always
  `awk 'length($0)<300'` first.
- `collide()`/`cols`/`staticColliders` are shared by every vehicle type AND the on-foot
  player (for walking up onto pier decks) — never push dock/pier geometry into that list, or
  it walls out the player's feet along with boats. Boat-only collision needs its own list.
- The single "physics" block with steering/engine/collide/eject only ever runs for
  `player.veh` — AI traffic cars and AI boats are driven by two entirely separate, simpler
  loops (`t.axis/lane/pos` lane-following, and `updateBoatTraffic`'s straight lane-runner).
  Don't assume a fix in one loop covers all three.
- `node --check` on the concatenated inline `<script>` blocks (extracted via a small regex,
  skipping `src=` script tags) is a cheap way to catch syntax errors in this file without a
  browser — no build step exists otherwise.
- New chunk-exclusion flags (like the existing `isShowroom`) need to be threaded through
  every one of its ~6 usage sites in `buildChunk` (park chance, generic building placement,
  traffic light, stop sign, street lamp, trees) or the new landmark gets city furniture
  spawned through it.

## Reusable pattern
When a game/sim file has "X does Y, see Z()" comments pointing at a function that doesn't
exist, that's a half-finished feature, not documentation of current behavior — grep for the
referenced name before trusting the comment, and implement it for real using whatever
adjacent pattern (here, `collide()`) the comment implies.
