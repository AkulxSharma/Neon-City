# Neon City Drive

![Framework](https://img.shields.io/badge/framework-Next.js%2016-000000)
![Renderer](https://img.shields.io/badge/renderer-React%20Three%20Fiber-blue)
![Physics](https://img.shields.io/badge/physics-Rapier-orange)
![License](https://img.shields.io/badge/license-MIT-green)

A GTA-inspired, single-player 3D driving game in the browser. Drive, ride, sail
and walk around an endlessly streaming neon city, steal traffic cars, outrun a
police convoy, and duck into a nightclub — all rendered in WebGL with real
physics.

The game lives in [`web-migration/`](web-migration/). The original single-file
version at the repo root is **deprecated** and kept for reference only — see
[Legacy build](#legacy-build-indexhtml) below.

## Run it

```bash
git clone https://github.com/ma67-ex/Neon-City.git
cd Neon-City/web-migration
npm install
npm run dev          # http://localhost:3000
```

Production build: `npm run build && npm run start`.

## Controls

| Key | Action |
|---|---|
| `W A S D` / Arrow keys | Move / drive |
| `Space` | Handbrake (driving) · Jump (on foot) |
| `Shift` | Nitro (cars only) |
| `E` | Enter/exit vehicle · open club door · steal the car you're standing next to |
| `B` | Switch vehicle — car / bike / boat |
| `C` | Cycle camera — chase / cockpit / hood / cinematic |
| `G` | Open the map and set a destination |
| `M` | Mute engine audio |

On-screen buttons mirror the camera and map controls.

## What's in it

- **Chunk-streamed city.** Roads with lane markings and sidewalks, zoned
  districts drawing from 8 building archetypes, parks and trees, road-name
  signage, posters and graffiti — all streamed in and out as you drive.
- **Real physics.** Rapier dynamics throughout: vehicle collisions, tree
  collision, buoyancy for boats, and a character controller for on-foot mode.
  The arcade driving feel is ported verbatim from the original's hand-tuned
  math rather than re-derived from forces.
- **Three vehicle classes.** Cars, bikes, and boats, each with its own handling
  model. Nitro on cars, buoyancy and heel on boats.
- **Steal any car.** Walk up to a traffic car and press `E` to take it — paint
  and silhouette carry over, and a black-and-white hands you the police
  cruiser with its siren and convoy rig.
- **Traffic and pedestrians.** Lane-running traffic with collision avoidance
  that brakes for you on foot, plus crowds walking the sidewalks.
- **Police.** A police station, patrol cars that fall in behind you in convoy
  formation, and patrol boats out on the water.
- **Coast and marina.** The city ends at a shoreline; beyond it is open water
  with a marina, piers, and drowning physics for anything that isn't a hull.
- **Club interior.** Walk through the door and the scene switches to a dance
  floor with its own crowd.
- **Navigation.** 9 landmarks at the original game's exact coordinates, a
  minimap, a full-screen map with routing, and a waypoint arrow.
- **Day/night cycle**, dynamic headlights, HUD with speedo and nitro gauge,
  procedural audio, and autosave to `localStorage`.

Per-milestone detail — including what is real versus what is still a documented
simplification — is in [`web-migration/SUMMARY.md`](web-migration/SUMMARY.md).

## Repo layout

| Path | What |
|---|---|
| `web-migration/` | **The game.** Next.js 16 + React Three Fiber + Rapier + zustand. |
| `web-migration/SUMMARY.md` | Migration log, milestone by milestone. |
| `web-migration/AGENTS.md`, `CLAUDE.md` | Instructions for AI coding agents working in this repo. `CLAUDE.md` just imports `AGENTS.md` so every agent reads the same rules. |
| `index.html` | Legacy single-file build. Deprecated, unmaintained. |
| `learnings/` | Notes written while building — physics gotchas, coordinate bugs, rendering traps. |

## Legacy build (`index.html`)

⚠️ **Deprecated and no longer maintained.** It is kept because it still runs and
because the migration targets parity with it. New features go into
`web-migration/` only.

It is one self-contained 3.6 MB `index.html` with Three.js r128 inlined, every
texture generated on a canvas and every sound synthesised with the Web Audio
API — no build step, no server, no external assets. Open the file, or serve it:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000/
```

What it has that the port hasn't reached yet:

- **Real NYC building footprints** woven into the procedural grid.
- **Weather system** (`V`) and **graphics-quality cycling** (`Q`).
- **Day/night toggle** (`N`) and headlight modes / police siren (`L`).
- **Car showroom** and a wider garage, including a Porsche 918 mesh.
- **Cheat codes** — type `porche` (or `porsche`) to spawn a 918 in front of
  you, or `boat` to spawn a boat in the nearest water.
- **Mobile support** — a touch joystick and on-screen buttons appear
  automatically on iOS/Android.
- **Club Neon** with a procedurally generated soundtrack and NPCs dancing in
  time with it.

Its controls follow the same scheme as above, plus `2×Space` to sprint on foot,
and `H` to hide the in-game help panel.

## Contributing

Pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, and
note the [Code of Conduct](CODE_OF_CONDUCT.md). New work belongs in
`web-migration/`.

## Security

If you discover a security vulnerability, see [SECURITY.md](SECURITY.md) for how
to report it responsibly.

## License

Released under the [MIT License](LICENSE).
