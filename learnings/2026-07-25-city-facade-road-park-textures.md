# Real city facades/roads/parks via shared baked textures, not per-instance geometry

**Date:** 2026-07-25

## Problem

`web-migration/components/City.tsx` streamed real chunk geometry (roads,
seeded buildings) but everything was flat-colored boxes and color-strip
"roads" — flagged as the biggest remaining visual gap in both Milestone 3
and Milestone 5 of the migration. Asked to close it: real building
facades with baked window/night-glow, roads with lane markings, sidewalks,
and parks/trees — all while keeping the existing deterministic
`mulberry32`-per-chunk streaming intact and staying cheap enough for
`VIEW=2` continuous chunk streaming.

## Approach

Read the original's actual `buildChunk()` (7500-line single-file game,
`index.html`) in full before writing anything, filtering `awk
'length($0)<300'` first to dodge a giant inlined base64 texture blob that
otherwise buries every grep match. Two discoveries changed the plan:

1. The original's roads/sidewalks/curbs/lane-markings/crosswalks aren't
   per-chunk 3D geometry at all — they're one baked `canvasTex` (a 2D
   canvas drawn once, wrapped in `THREE.CanvasTexture`) tiled across a
   single giant ground plane. Curbs and lane lines are texture strokes,
   not raised meshes.
2. The original's building materials (`facadeMats`/`glassTowerMats`) are
   a small, fixed, module-level array of `MeshStandardMaterial`s — never
   created per-building — with a window-grid `map` and a lit-window `glow`
   `emissiveMap`, and `emissiveIntensity` (the night-glow amount) is set
   on those *shared* material objects once a frame in one central update
   loop, not per mesh.

Both patterns transplanted directly: `buildTileTexture()` builds one
canvas texture per ground variant (city/park) at module scope, mapped
straight onto each chunk's existing flat ground plane (`map=`) — no new
geometry, no new colliders, since the plane and its collider already
existed. `buildFacadeTextures()`/`buildGlassTextures()` build one
neutral window-grid + one warm glow texture each (module scope, called
once), and a small palette of tinted materials share those two textures
via `color` (multiply-tinted) instead of the original's per-tint baked
texture — cheaper, visually equivalent after the GPU's multiply. Night
glow moved from a per-`Building` `useFrame`+`ref` (O(buildings) every
frame) to one `useFrame` in the top-level `City()` component that walks
the ~10 shared materials (O(materials) every frame, regardless of how
many buildings are streamed in).

Parks/trees extended the *same* per-chunk `mulberry32` instance buildings
already used (deterministic, no `Math.random()`): `isPark` is drawn first
from that chunk's own PRNG (`rand() < 0.13`, the original's exact
constant), before the building-count draw, so it stays self-consistently
seeded per chunk without needing to match the original's exact draw order
— only its own internal order matters for determinism.

## Why

Reusing the original's own "bake once, reuse everywhere" trick rather than
inventing per-instance geometry/materials wasn't just fidelity — it's what
made this cheap enough to keep streaming at `VIEW=2` continuously. Per-
building UV-rescaling (what the original *does* do for its stone facades,
to avoid texture stretch) was the one piece deliberately left out: doing
it declaratively in R3F would mean hand-building `BufferGeometry` per
building instead of `<boxGeometry args={size}/>`, real added complexity
for a stretch artifact that's only visible on the largest facades — cut,
documented in `SUMMARY.md`, not silently dropped. Tree collision was cut
the same way: up to ~225 extra static `RigidBody`s live at once for pure
scenery didn't clear the "performance matters" bar for a "dressing, not a
hero asset" ask.

## Gotchas

- `index.html`'s inline base64 texture blob makes raw `grep -n` output
  unusable; always `awk 'length($0)<300' index.html | grep -n ...` first —
  called out already in this repo's own `AGENTS.md`/task instructions, and
  confirmed again here.
- Headless Chromium in this sandbox has no real GPU — `WEBGL_debug_renderer_info`
  reports `SwiftShader` (software Vulkan). A pre-existing rendering bug
  (Milestone 5's hard vertical canvas split) reproduced again here; probing
  `devicePixelRatio` and the canvas's actual buffer size directly (both
  correct, `1`/`1280×800`) ruled out Milestone 5's original dpr-mismatch
  theory. Given it's SwiftShader-only so far, the more likely explanation
  is a software-rasterizer/multi-render-target quirk with
  `EffectComposer`, not an app bug — but this still hasn't been checked on
  real hardware across three milestones now. Don't spend a fourth milestone
  guessing; get one real-GPU screenshot before touching this again.
- Playwright `page.keyboard.down("w")` held across long (~20-30s)
  `waitForTimeout` windows combined with a second held key (`Shift` or a
  turn key) intermittently produced a car stuck at 0 km/h for the entire
  window in this sandbox, while the exact same key held alone consistently
  worked and short (~1.5s) two-key holds also worked fine. Root cause not
  isolated (didn't reproduce with a controlled short two-key test) — noted
  as a flaky headless-automation quirk, not chased further since the
  short-hold sessions already gave clean, repeated, error-free
  verification of every new render path (roads, park chunks, streaming).

## Reusable pattern

When a game/sim file renders many instances of "the same kind of thing"
(buildings, road tiles) with per-instance visual variety, check whether
the *variety* is actually baked into a small fixed set of shared textures/
materials selected per-instance (module-scope, built once) before assuming
each instance needs its own material or geometry — search the source for
where its textures/materials are constructed (usually near the top, before
any per-instance spawn function) and count how many actually exist. If the
answer is "a handful, chosen from an array," that's the pattern to port,
not a per-instance one.
