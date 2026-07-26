# Per-shop exterior decor (bank/pet shop/garage) instead of poster-only variety

**Date:** 2026-07-26

## Problem
Every retail-category shop in `components/City.tsx`'s `ShopBuilding` was the exact same box
+ storefront-glass structure, differentiated only by the baked poster texture (name + tiny
category icon). User wanted specific named shops to read as that business from the outside —
a pet shop with dogs/cages, a bank with a premium look, a repair shop with an actual garage —
not "all simple and the same buildings" with different text.

## Approach
1. Read `lib/buildings.ts` first (wrong file — that's an unrelated placeholder grid, not the
   real shop system). The real system is `components/City.tsx`'s `SHOP_TYPES` / `ShopBuilding` /
   `ShopSign` / `getPosterTexture`, found via `grep -rni "poster\|shop"`.
2. Kept the existing 3-category structural split (`retail`/`cafe`/`garage`) — garage already had
   a real open drive-in bay, which covers "repair shop should have a garage" as-is. Only added a
   `TireStack` (stacked torus geometries) for extra flavor, not a rebuild.
3. Added name-keyed decor (`isBank`, `isPetShop` checks on `name === "BANK"` / `"PET SHOP"`) layered
   on top of the existing category rendering, rather than inventing a 4th category or a generic
   per-shop decor registry — only 2 of the 20 `SHOP_TYPES` needed bespoke treatment, the rest
   already read fine off poster + category (cafe awning, garage bay).
4. Bank: swap `bodyMat` to a new `MARBLE_MAT`, add two columns (`CylinderGeometry`) flanking the
   entrance, a marble plinth, and a gold trim bar over the sign.
5. Pet shop: `Dog` (box-based figure, matching the existing low-poly `PersonFigure.tsx` style —
   body/head/ears/legs/tail as boxes) and `Cage` (a `wireframe: true` box mesh + a solid floor
   plate — cheap wire-cage look, no real bar lattice needed).
6. Verification was the hard part: this is a physically-simulated, proc-gen open world with no
   free-cam/teleport-to-address feature. Driving there in real time is impractical (shops are
   200-500 units from spawn, hashed off chunk RNG).
   - **Dead end:** tried a fresh `npm run dev` at a manually-invented port via a
     `.claude/launch.json` written *inside* the subproject dir. Wrong — `preview_start` only
     reads `.claude/launch.json` at the outer git-root working directory, not per-project. It
     silently matched a stale `neon-city-drive` entry there that pointed at a `python3 http.server`
     serving a `/tmp` directory (404s, not the app). Fix: use the *existing* `web-migration` entry
     already defined in the root `.claude/launch.json` (`autoPort: true`).
   - **Dead end:** dispatched synthetic `keydown`/`keyup` on `window` to drive there manually.
     Works (the game reads `e.code` off real listeners), but blind driving through open world with
     no minimap-to-world-coordinate mapping means you can't reliably arrive at one specific named
     shop out of hundreds.
   - **What worked:** replicated the exact chunk-generation RNG (`mulberry32`, `zoneFor`,
     `hash2`, the `spawnOne` rand()-call order: w, d, h, matIdx, colorIdx) in a standalone Node
     script to compute the world (x,z) of the nearest BANK/PET SHOP/AUTOSHOP without touching the
     browser at all. Then used the game's *existing* `lib/clubTeleport.ts` `requestTeleport`
     singleton (already built for the club-door mechanic) by temporarily exposing it on
     `window.__tp` from a debug `useEffect` in `Game.tsx`, teleported the car there, screenshotted,
     then reverted the debug exposure before finishing.
   - Gotcha discovered mid-verification: the sign/storefront only renders on the shop's `+z` face.
     Teleporting to `(shop_x, shop_z - 10)` faces the plain back wall (looks like a bug at first
     glance, isn't one) — the camera has to approach from `z = shop_z + 10` with `heading = Math.PI`
     to actually see the storefront.
   - Gotcha: after a code edit, Fast Refresh silently reset the read of `worldState` via
     `window.__ws` to look like nothing moved — but the *actual* car position was fine and had
     round-tripped through the game's own `saveGame`/`loadSave` (every 3s + `beforeunload`), which
     is why a full hard `navigate` reload (not just waiting) was needed to get a clean single
     module graph before trusting `window.__tp`/`window.__ws` readings.

## Why
Reusing `requestTeleport` instead of writing a new one-off teleport mechanism was the right call —
it's the exact tool the codebase already built for this exact need (moving the active vehicle to
an arbitrary world position instantly), just never exposed to the browser console. Building a
throwaway coordinate-jump feature from scratch would have duplicated logic that already handles
"whichever vehicle is active consumes this" correctly.

## Gotchas
- `preview_start({name})` resolves `.claude/launch.json` relative to the outer session cwd
  (the git root `neon-city-drive`), not the subproject folder — check the root file first before
  writing a new one.
- Shop storefronts/signs/decor only face `+z`; approach from higher z, heading `Math.PI`, to
  actually see them.
- The game persists vehicle position via `saveGame`/`loadSave` (interval + `beforeunload`), so a
  reload does NOT reset you to spawn — expect to resume wherever a prior debug teleport left you.
- Any debug `window.__x` exposure added to `Game.tsx` for verification must be reverted before
  reporting done; it's scratch, not part of the shipped diff.

## Reusable pattern
When a proc-gen/physics-driven scene needs visual verification at a specific named/hashed location
that isn't reachable by simple navigation: (1) replicate the exact seeded-RNG generation logic in
a standalone script to compute the target world coordinates deterministically, (2) look for an
existing one-shot teleport/warp singleton in the codebase before building a new one, (3) temporarily
expose it on `window` via a debug effect, verify, then strip the debug exposure from the diff.
