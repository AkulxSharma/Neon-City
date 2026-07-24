# Neon City Drive — Web Migration

Rewriting the single-file `index.html` game (repo root) into a real web app:
Next.js + React Three Fiber (three.js for React) + Rapier (physics engine) +
zustand (HUD state). The original file is untouched and still fully playable —
this folder is a from-scratch parallel build, following the phased plan below.
Nothing here is wired back into the original game yet.

**Goal is full look-and-feel parity with the original**, not just matching
physics. "Feel" (Milestone 1) is done — the driving math is ported verbatim.
"Look" is in progress (Milestone 3) — bloom, exact colors, and real vehicle
silhouettes are in; the actual procedural city (buildings-as-real-shapes with
baked window textures, roads, landmarks, club interior, minimap, HUD chrome)
is not ported yet and is the bulk of what's left. Read each milestone below
for exactly what currently matches vs. what's still a placeholder.

## How to run

```bash
cd web-migration
npm install
npm run dev   # http://localhost:3000
```

WASD/arrows to drive, Space to handbrake, **B** to switch control between the
car and the boat. Flat test arena with a few boxes to crash into, plus a water
area the boat floats on — that's it so far (see Milestones).

## Migration phases

| Phase | What | Status |
|---|---|---|
| 0 | Next.js scaffold, full-viewport Canvas, day/night sky cycle, ground | ✅ done |
| 1 | Minimal driving arena (ground + boundary walls + a few static buildings as Rapier fixed colliders) — full chunk-streamed city comes later | ✅ done (minimal slice) |
| 2 | **Validation vehicle**: one car, arcade physics ported from the original game, collision via Rapier's `KinematicCharacterController` | ✅ done — feel holds up, see below |
| 3 | Remaining vehicle types (bikes, boats w/ buoyancy), traffic AI | ◐ boat done, bike + traffic AI next |
| 4 | HUD → real React components (speedo done as a proof of concept via zustand) | ◐ speedo only |
| 5 | Audio, save/load, club interior, police convoy, boat-swap, police station | ⏳ not started |
| 6 | Instance repeated props, perf pass, deploy | ⏳ not started |

## Milestone 1 — Phase 0–2: physics validation (2026-07-24)

**Goal:** prove the architecture before porting the other ~7,500 lines. The
real risk was always Phase 2 — does an arcade "feel" hand-tuned in raw
position-integration code survive a move to a real physics engine?

**Decision: kinematic body + Rapier's `KinematicCharacterController`, not a
dynamic rigid body.** The original plan said "apply forces to a dynamic rigid
body." In practice that means re-deriving the whole feel from scratch via
force/impulse tuning — high risk, high effort, and Rapier's dynamics are not
what a hand-tuned arcade racer wants anyway. Instead: `lib/carPhysics.ts` is
the *exact* velocity/steering math from the original `tick()` (steering ramp,
engine/drag, lateral grip), untouched. Each frame it produces a desired
`(dx, dz)`; Rapier's `KinematicCharacterController.computeColliderMovement()`
takes that desired move and returns a corrected one that slides along
obstacles instead of just stopping dead — a straight upgrade over the
original's hand-rolled AABB push-out, with zero risk to the feel. This is the
real "improved physics" the migration was asked for: not different-feeling
driving, but collision that works properly against real geometry (angles,
corners, stacked shapes) instead of axis-aligned boxes.

**Bug hit and fixed:** the very first working build crashed on load with
`recursive use of an object detected which would lead to unsafe aliasing in
rust` / `null pointer passed to rust`, thrown from inside Rapier's WASM.
Ruled out, in order: React StrictMode (disabled it, still crashed — later
re-enabled once the real cause was found and confirmed it wasn't this),
Turbopack vs. webpack (tried both, same crash — not a bundler issue), a
duplicate nested `@dimforge/rapier3d-compat` install (real issue, fixed by
pinning the exact version `@react-three/rapier` expects so npm dedupes to one
copy — but not the crash's cause). Isolated it by building a bare test scene
and adding pieces back one at a time: `Physics` + static bodies alone → fine;
adding a kinematic body → fine; creating a `KinematicCharacterController` in
`useEffect` → fine; calling `body.collider(0)` **inside `useFrame`, every
frame** → crash, reproduced exactly. Querying a rigid body's collider by index
from inside the render loop re-enters Rapier's internal borrow while the
physics step (also running via `useFrame`) holds it. Fix: stop querying it —
render an explicit `<CuboidCollider ref={colliderRef}>` as a child of the
`RigidBody` (with `colliders={false}` on the body itself) and use that stable
ref every frame instead. No more dynamic lookups, no more crash, confirmed
stable with StrictMode back on.

**Files:**
- `lib/carPhysics.ts` — the ported arcade math, pure function, framework-agnostic
- `lib/useKeyboard.ts` — keyboard state in a ref (no re-renders)
- `lib/hudStore.ts` — zustand store for the speedo
- `components/Car.tsx` — kinematic RigidBody + character controller + chase camera
- `components/World.tsx` — ground, boundary walls, a handful of test buildings
- `components/SkyCycle.tsx` — day/night background + sun lerp
- `components/Game.tsx` / `components/HUD.tsx` — top-level wiring
- `app/page.tsx` — client-only dynamic import (Canvas/WASM can't SSR)

## Milestone 2 — Phase 3 (part 1): boat + vehicle switching (2026-07-24)

**Goal:** prove a second, physically-different vehicle type coexists with the
car in the same physics world, and that switching control between them is
clean — the next step toward the original game's full vehicle roster.

**Boat physics deliberately skips `KinematicCharacterController`.** A hull has
no floor to snap to, so there's nothing for a character controller to do —
it's built for walking on ground, not floating. `Boat.tsx` reuses the exact
same `stepCarPhysics` from Milestone 1 (that function is vehicle-agnostic; it
just turns input + handling constants into a velocity), but with a new
`BOAT_HANDLING` preset (low grip, wide turns — same numbers as the original
game's `BOAT_HANDLING`) and integrates position directly instead of going
through Rapier collision. Height is a simple `WATER_LEVEL + sin(...)` bob, no
physics involved, matching the original's idle-boat visual. It's still a
Rapier `kinematicPosition` RigidBody (not a bare mesh) with no collider
attached yet — so it's already a citizen of the physics world, ready for dock
collision later, without re-opening the `body.collider(0)`-in-`useFrame` trap
from Milestone 1 (this component never queries a collider at all, so that
whole bug class doesn't apply here).

**Vehicle switching (`B` key)** is one field in `hudStore` (`active: "car" |
"boat"`), read by both `Car.tsx` and `Boat.tsx` inside their own `useFrame` —
whichever isn't active still runs its physics step (with no input, so it
decelerates naturally instead of freezing mid-slide) but skips the camera
update. No shared "vehicle manager" component needed for two vehicles; if a
third and fourth show up in Phase 3 this should get promoted to a real
registry instead of copy-pasted `isActive` checks in every vehicle file.

**Files added/changed:**
- `lib/carPhysics.ts` — added `BOAT_HANDLING` (same function, new constants)
- `lib/hudStore.ts` — added `active`/`toggleActive`
- `components/Boat.tsx`, `components/Water.tsx` — new
- `components/Car.tsx` — gated input/camera on `active === "car"`
- `components/Game.tsx` — mounts `Water`/`Boat`, `B` keybind
- `components/HUD.tsx` — shows active vehicle + switch hint

**Known rough edge, not a bug:** the ground plane (Milestone 1) and the water
plane currently overlap in X — the original game has a hard `SHORE_X`
coastline boundary, this doesn't yet. Fine for a physics-validation slice,
worth fixing when `World.tsx` becomes the real chunk-streamed city.

## Milestone 3 — visual parity pass (2026-07-24)

**Goal:** the user asked explicitly for the web version to look and feel like
the original, not just drive like it. Everything up to Milestone 2 used
placeholder boxes on purpose (physics validation first). This milestone
brings the *existing* pieces (car, boat, sky, world) toward the original's
actual look before adding more scope on top of the wrong visuals.

**What now matches the original, specifically:**
- **Bloom**: `EffectComposer` + `Bloom` (luminance threshold 0.82, intensity
  0.9) — the exact numbers from the original's `UnrealBloomPass`. Only true
  emissive materials (headlights, taillights, boat nav light) cross that
  threshold and glow; body paint and lit building facades sit just under it,
  same split the original deliberately tunes for.
- **Sky colors**: `cDay`/`cNight` are now the original's literal hex values
  (`0x7ec4f2` / `0x05070f`), not approximations. Cycle now starts at night —
  the look every reference screenshot in this conversation has been.
- **Car silhouette**: real body-+ set-back-cabin stack instead of one box, on
  four wheel cylinders, randomized from the original's exact `sedanColors`
  array, emissive head/tail lights.
- **Boat**: blue-tinted mirrors (the literal fix from the original's own
  `attachMirrors` — same hex, `#1f6fe0`) and an emissive red bow light.
- **Buildings**: grey/glass color palette matching the original's
  `facadeMats`/`glassTowerMats` tones, and now fade in a warm emissive glow at
  night (`skyState.nightK`, a module-level value `SkyCycle` updates every
  frame so any component can read the current night factor without a
  re-render) — approximating "lit windows at night" without the original's
  baked canvas window texture.

**Still a placeholder, not yet matching:** the actual procedural city
generation (chunk streaming, real building shapes/textures, roads with lane
markings, sidewalks, trees, parks, landmarks, the club interior, AUTO YARD,
POLICE HARBOR STATION), pedestrians, traffic AI, the minimap/HUD chrome, and
audio. World.tsx is still 7 boxes in a field. This is the honest gap between
"looks like the original in the small" (true now) and "looks like the
original" (not yet) — closing it is most of what's left in Phase 3/5/6.

**New shared pattern:** `skyState` (a plain mutable object exported from
`SkyCycle.tsx`, not React state/context) is how per-frame environment values
get shared across components cheaply. Reach for this again for anything else
that changes every frame and many components need to read (time of day,
weather, siren-active) rather than adding it to `hudStore` (which is for
values the *UI* renders, and re-renders on).

**Files changed:** `components/Game.tsx` (bloom), `components/SkyCycle.tsx`
(exact colors, `skyState`), `components/Car.tsx` (real silhouette),
`components/Boat.tsx` (mirrors, nav light), `components/World.tsx`
(palette + night-emissive buildings).

## Next up

Two tracks from here, in order: (1) more of Phase 3 — a bike, then basic
traffic AI; (2) start on the real city generation in `World.tsx`, since that's
the single biggest remaining gap between this and "looks exactly like the
original." Will report back at the next milestone.
