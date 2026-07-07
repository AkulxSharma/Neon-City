# Neon City Drive

A GTA-inspired, single-player 3D open-world driving game that runs entirely offline in your browser. No installs, no build step, no server — just one self-contained `index.html` powered by Three.js.

## Features

- **Endless procedural city** — chunk-streamed road grid with real NYC building footprints woven in
- **Garage of vehicles** — supercars, muscle cars, bikes, and emergency vehicles, each with realistic paint, wheels, and lighting
- **Police & emergency system** — drive a police cruiser, flip on lights and siren (`L`), and nearby patrol cars will fall in behind you in convoy formation while civilian traffic yields and pulls to the roadside
- **Club Neon** — walk into the club and the game switches to a full dance-floor scene with a procedurally generated Bollywood-style soundtrack and synced NPC choreography
- **Day/night cycle**, dynamic headlights, traffic lights, pedestrians, and a persistent showroom
- **Mobile-friendly** — touch joystick and on-screen controls for iOS/Android browsers
- **Autosave** — progress is saved to `localStorage` as you play

## Getting Started

No build tools required.

```bash
git clone https://github.com/ma67-ex/Neon-City.git
cd Neon-City
open neon-city-drive/index.html   # macOS
# or just double-click the file, or serve it locally:
python3 -m http.server 8000
```

Then visit `http://localhost:8000/neon-city-drive/` if serving locally.

## Controls

| Key | Action |
|---|---|
| `W A S D` / Arrow keys | Move / drive |
| `Space` | Jump / handbrake |
| `2× Space` | Sprint (or hold `Shift`) |
| `E` | Enter/exit vehicle, open club door |
| `C` | Cycle camera view |
| `L` | Headlights auto/on/off (lights & siren in a police vehicle) |
| `N` | Toggle day / night |
| `G` | Open map / directions |
| `M` | Mute engine audio |
| `Q` | Cycle graphics quality |

On mobile, a virtual joystick and on-screen buttons appear automatically.

## Tech

Three.js r128 is inlined directly into `index.html`, along with all textures (canvas-generated) and audio (Web Audio API oscillators) — there are no external asset dependencies.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and note our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

If you discover a security vulnerability, please see [SECURITY.md](SECURITY.md) for how to report it responsibly.

## License

Released under the [MIT License](LICENSE).
