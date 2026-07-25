# Porting on-foot mode onto the existing vehicle architecture, then actually verifying it

**Date:** 2026-07-24

## Problem

Milestone 9's club door mechanic was built without an on-foot player because
none existed in the web migration — explicitly flagged as the biggest gap
it left behind. The user then asked for real on-foot mode directly, calling
it "the whole purpose of the game." Needed: full walking player (not a
placeholder), mount/dismount into the three existing vehicles, and this
time an actual verification pass instead of "reasoned from the code."

## Approach

Reused Car.tsx/Bike.tsx's exact skeleton (kinematicPosition RigidBody +
`world.createCharacterController` + `CuboidCollider` ref, same
autostep/snapToGround/maxSlopeClimbAngle setup) rather than inventing a new
on-foot physics shape — the only genuinely new piece was jump, done as a
signed vertical velocity fed into `computeColliderMovement`'s y component
each frame (gravity flips between two constants depending on whether Space
is still held while rising, for the original's short-hop-on-early-release
feel), gated by `groundedRef` (previous frame's `computedGrounded()`, one
frame stale, imperceptible).

Mount/dismount needed the active vehicle's live position. `vehicleState`
already had it (every vehicle writes its own x/z/h every frame regardless
of whether it's active, a Milestone 7 pattern built for save/load) — so
"walk up to a parked car and press E" needed zero new position-tracking,
just a nearest-neighbor scan over three entries.

Teleporting the player (club door entry, or dismounting a vehicle) needed
the same cross-component-without-props problem Milestone 9 solved with
`lib/clubTeleport.ts`. Rather than reuse that singleton for the player too,
added a second one (`lib/playerTeleport.ts`, identical shape). Considered
merging them into one generic teleport-any-actor singleton; decided against
it because the two requests are only ever consumed by disjoint components
(Car/Bike vs. Player) and merging would just require a "which actor is
this for" tag on every request — more state to get wrong for no shared
behavior.

Two independent frame-loops (`Club.tsx`'s door hint, the new vehicle-mount
hint) both wanted to own `#hint`. Rather than let both call
`hud.setHint()` and hope render order works out, pulled both into one
priority function (`lib/hint.ts`) polled from the single place that was
already always-mounted (`Club.tsx`).

Verification: installed Playwright as an ungit-tracked local tool
(`npm install --no-save playwright`, confirmed `package.json`/
`package-lock.json` untouched via `git status` after) and drove a headless
Chromium against the already-running dev server — click, dismount, walk,
sprint+jump, mount-check — capturing screenshots and collecting
`console`/`pageerror` events instead of trusting a clean `tsc`/`eslint` pass
to mean the feature actually works.

## Why

Reusing `vehicleState` for mount/dismount instead of adding player-specific
proximity tracking meant the feature composed for free with things that
weren't built with it in mind: a car parked *inside* the club interior
(driven in through the door) is still just an entry in `vehicleState`, so
walking up to it on foot and pressing E already works with no special case.

The headless-browser verification mattered because compiling clean and
being *correct* are different claims — the previous two milestones both had
to admit "reasoned from the code, not confirmed with a screenshot" as an
open gap. Screenshots caught nothing broken here, but that's the point:
this is the first milestone in this project that can say "verified" instead
of "should work."

## Gotchas

- The save-restore loop in `Game.tsx` (`while (active !== save.active)
  toggleActive()`) would infinite-loop forever if a save's `active` were
  `"foot"`, because `toggleActive()` only cycles car/bike/boat and (by
  design) no-ops when already on foot. Any time a state gets a new member
  that an existing cycle-based function can't reach, audit every caller of
  that cycle function for an assumed-reachable loop, not just the function
  itself.
- `npm install --no-save` still writes to `node_modules/` — verify
  `package.json`/`package-lock.json` are actually untouched via `git
  status` rather than trusting the flag name; it does what it says, but
  worth checking on a repo you don't want to leave dirty.
- Rapier's `computedGrounded()` reflects the *previous* `computeColliderMovement()`
  call's result, not the current frame's outcome yet — reading it to gate a
  same-frame jump trigger is one frame stale by construction, not a bug to
  chase.

## Reusable pattern

When adding a new actor (here: the on-foot player) into a scene already
built around several independent actors sharing plain-mutable-singleton
state (`worldState`, `vehicleState`, `skyState`), check what the new actor
needs to *read* before adding any new tracking — the answer is often
"nothing new, an existing singleton already has it," and what it needs to
*write* (a teleport request, a hint) is safest as its own singleton only
when two writers could otherwise race on the same one.
