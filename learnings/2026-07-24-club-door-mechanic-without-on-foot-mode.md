# Porting a door-proximity mechanic when the walking system it depends on doesn't exist

**Date:** 2026-07-24

## Problem

SUMMARY.md's "Next up" called for porting the original game's nightclub
(VENU): a real interior room, entered/exited via a door-proximity + E-key
mechanic. The original's `clubDoorAction()` gates entry on `player.onFoot`
— but the web migration (`web-migration/`) has never built an on-foot
player mode at all; you're always in a car, bike, or boat.

## Approach

Considered building a minimal on-foot mode first (exit vehicle, spawn a
capsule character controller, walk to the door) so the port could be
faithful. Rejected: that's a whole new player-control system (input
remapping, a new physics body, camera mode, re-enter-vehicle logic) just to
gate one door — disproportionate to what was asked, and it would still need
redoing properly whenever a real on-foot mode gets built for its own sake.

Instead redefined the trigger: proximity to the door while driving car or
bike (not on foot), using the same squared-distance thresholds as the
original. Boat is explicitly excluded rather than silently allowed, because
of the next problem below.

Teleporting the active vehicle into the interior needed a way for
`lib/club.ts` (plain logic, not a component) to reach into whichever
vehicle component currently owns the RigidBody. Following the codebase's
existing `worldState`/`skyState` mutable-singleton pattern, added
`lib/clubTeleport.ts`: a one-shot `{pending, x, z, h}` object that
`Car.tsx`/`Bike.tsx` poll once per frame in their own `useFrame` and
consume via `body.setTranslation()` when they're the active vehicle.

## Why

The mutable-singleton pattern was already established for exactly this kind
of "many components need to read one per-frame value without re-rendering"
problem (`skyState.nightK`, `worldState.px/pz`) — reusing it for a
one-shot request instead of a continuous value was a small, obvious
extension rather than a new mechanism.

Boat exclusion had to happen at the *request* site (`clubDoorAction()`
returns `false` early for boat), not just by Boat.tsx never polling the
singleton — the door proximity check would still succeed if a boat somehow
got close to a door position that's actually 4000 units inland, silently
flip `hud.inClub` to true, and queue a teleport nothing ever consumes,
leaving state permanently inconsistent (`inClub: true` with the boat still
outside). Guarding at the source keeps the invariant "a pending teleport
always has exactly one consumer" true by construction.

## Gotchas

- `body.setTranslation(pos, true)` works for teleporting a
  `kinematicPosition` RigidBody immediately — don't reach for
  `setNextKinematicTranslation` for a teleport, that's for the normal
  per-step movement queue and won't jump the body this frame.
- When a shared singleton has exactly one intended consumer per "kind"
  (car vs bike vs boat), guard eligibility where the request is created, not
  by trusting that ineligible consumers simply won't poll — an unconsumed
  pending request is a silent stuck state, not a no-op.
- Cutting an elaborate original feature (here: ~40 individually-rigged
  dancers) down to a cheap approximation (16 bobbing capsule blobs driven by
  the same beat-timing math) is worth doing explicitly and documenting in
  SUMMARY.md/ponytail-style comments — the beat-sync math is what makes it
  still *read* as the original's dance floor despite dropping the limb rigs.

## Reusable pattern

When a ported mechanic depends on a system that doesn't exist yet in the
migration (here: on-foot mode), don't build the missing system as a side
effect of the mechanic that happens to need it — redefine the mechanic's
trigger around what *does* exist (vehicle proximity instead of player
proximity), explicitly exclude the cases that don't fit (boat), and name the
missing system as its own future item rather than half-building it inline.
