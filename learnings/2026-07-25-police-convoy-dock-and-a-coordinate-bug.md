# Porting police/convoy/dock/boat-swap, a real coordinate bug, and a headless-sandbox fps trap

**Date:** 2026-07-25

## Problem

SUMMARY.md's "Next up" named police station/convoy/dock-collision/boat-swap
as the last big unbuilt piece. Unlike most of this migration, the target
wasn't speculative — a prior session had already built the real systems in
the original `index.html` (see
[boat-physics-and-police-harbor](2026-07-24-boat-physics-and-police-harbor.md)).
The job was porting four coupled systems onto an architecture (fixed one-
instance-per-`VehicleKind`, Rapier-based land collision, direct-integration
boats) that doesn't have an exact original-side equivalent for any of them.

## Approach

**Coordinate bug, found before writing any code.** `lib/landmarks.ts`'s
`POLICE HARBOR` was still `x:450` — the original's raw, un-rescaled
coordinate. Every *other* landmark had been converted to this build's
`CELL=100`/`SHORE_CI=1` compact world back in Milestone 8; this one was
missed, and at this scale `x:450` is deep inside open water (`ci>=1` is
sea), unreachable by land. Caught it by actually computing which chunk
`(0,50)` — the intended "one block inland of the marina" — falls into
under *this build's* chunk formula (`Math.round(x/CELL)`, not the
original's `(x-50)/CELL`+different `SHORE_X`) before placing anything.

**New vehicle kinds slot into the existing generic code for free.** Adding
`policeCar`/`patrolBoat` to `VehicleKind` required touching `hudStore.ts`
and `vehicleState.ts`, but `lib/player.ts`'s mount scan and `lib/hint.ts`'s
mount-hint both already iterate `Object.keys(vehicleState)` generically —
they needed zero changes. Confirms the design bet Milestone 10 made
(reuse `vehicleState` rather than build vehicle-specific proximity code)
paid off exactly as intended a second time.

**Dock collision split by what each vehicle type can already do.**
Car/Bike/Player use Rapier's `KinematicCharacterController`, so a normal
`RigidBody`+`CuboidCollider` on the dock deck is a straight win — they
climb onto it via existing autostep, no new code. Boats
(`Boat.tsx`/`PatrolBoat.tsx`) never query Rapier colliders at all
(Milestone 2's design), so the same deck collider is invisible to them —
ported the original's `pierPush()` verbatim (AABB push-out, `r=2.0`) and
called it from both boats' position-integration step specifically.

**Convoy AI extends `Traffic.tsx` in place rather than building a parallel
system** — two lane-patrol cars get `police: true` and a second movement
mode computed alongside (not instead of) their normal lane math, so
dropping out of a convoy resumes patrol from a live position instead of
snapping back. Felony-stop boxing-in (a real state machine in the
original) was named and explicitly not ported — a follow behavior and a
box-in-and-slow behavior are different enough in complexity that bolting
the second onto this pass would have doubled the scope for one line-item.

## Why

Fixing the landmark coordinate before building the station mattered
because building a real, solid, collidable structure at an unreachable
coordinate would have shipped a station nobody could ever find — the kind
of bug that's invisible in code review (the structure renders fine in
isolation) and only shows up by actually computing reachability.

Splitting dock collision by vehicle architecture (real collider for
land, `pierPush` for hulls) rather than trying to unify them was the
right call because unifying would have meant either giving Boat.tsx a
Rapier collider it doesn't otherwise need (reopening exactly the
`body.collider(0)`-in-`useFrame` risk class Milestone 1's own learnings
warned about) or building a second custom collision system for land
vehicles that already have a perfectly good one.

## Gotchas

- **A headless Chromium sandbox can render at single-digit FPS** (this
  one did, ~3fps, confirmed independently by the parallel City-fidelity
  agent as `SwiftShader` software rendering, no real GPU). Any physics
  code that clamps simulated `dt` per frame (`Math.min(dt, 0.05)`, the
  pattern every vehicle/player component in this codebase uses) will
  advance *simulated* time correctly but *real* elapsed distance only as
  fast as frames actually render — a player "walking" for 3 real seconds
  at only 3fps covers roughly 9 physics-frames' worth of distance, not
  3 seconds' worth. Don't debug "why isn't my character moving" by
  computing expected-distance-per-real-second in a headless test without
  first confirming the actual frame rate; it looks exactly like a stuck-
  on-collision bug otherwise. Where covering real distance in a
  reasonable wall-clock test window isn't practical, jumping state
  directly via a temporary exposed debug hook (removed before commit)
  still exercises every real component's reaction to that state change —
  it only skips the slow physical approach, not the logic under test.
- New `VehicleKind` values that aren't in `hudStore.ts`'s `CYCLE` array
  (policeCar/patrolBoat, like `"foot"` before them) can't be reached by
  `toggleActive()`'s cycle loop — any save-restore code that
  `while(active!==target) toggleActive()`s needs the same "is this even
  cyclable" guard added for every new kind outside `CYCLE`, not just the
  first one (`Game.tsx`'s restore effect needed a second fix here, having
  already been fixed once for `"foot"` in Milestone 10).
- This build's chunk-index formula (`Math.round(x/CELL)`, chunk *centers*
  on multiples of `CELL`) is not the original's (`Math.round((x-50)/CELL)`,
  chunk centers offset by half a cell) — never reuse an original-side
  chunk/coordinate calculation without re-deriving it against this
  build's own formula first.

## Reusable pattern

When porting a feature whose original implementation assumes an
architecture this build doesn't have (a large dynamic vehicle fleet, 2D
XZ-only collision), don't build the original's architecture just to host
the port — identify what each *existing* piece here can already do (Rapier
colliders for land actors, a generic `vehicleState` scan) and split the
feature along those lines instead, porting only the part that's genuinely
architecture-specific (here: `pierPush`, needed only because boats
specifically bypass Rapier collision).
