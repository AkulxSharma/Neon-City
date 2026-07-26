# Learnings Index

- [Boat dock physics + Police Harbor Station](2026-07-24-boat-physics-and-police-harbor.md) — solid dock for boats only, floating boat drivers, and a half-finished `pierPush()` found via a stale comment.
- [Club door mechanic without on-foot mode](2026-07-24-club-door-mechanic-without-on-foot-mode.md) — redefining a walk-in-required mechanic around vehicle proximity instead, and a one-shot teleport singleton pattern.
- [On-foot mode + headless verification](2026-07-24-on-foot-mode-and-headless-verification.md) — porting a real walking player onto the Car/Bike character-controller pattern, mount/dismount via the existing vehicleState singleton, and the first Playwright-verified milestone in this project.
- [Police/convoy/dock + a coordinate bug](2026-07-25-police-convoy-dock-and-a-coordinate-bug.md) — fixing an unreachable landmark coordinate, splitting dock collision by vehicle architecture, and a headless-sandbox low-fps trap that looks exactly like a stuck-on-collision bug.
- [City facade/road/park textures](2026-07-25-city-facade-road-park-textures.md) — porting the original's "bake once, share everywhere" canvas-texture trick for real building facades, roads/sidewalks, and parks in the chunk-streamed city.
- [Per-shop exterior decor](2026-07-26-per-shop-exterior-decor.md) — bank/pet-shop/garage-specific exteriors instead of poster-only variety, plus RNG-replication + teleport-singleton trick for verifying a proc-gen open world.
