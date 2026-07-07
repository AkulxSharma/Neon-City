# Neon City Drive

A GTA-inspired, single-player 3D driving game that runs entirely offline in your browser. No installs, no build step, no server, just one self-contained `index.html` powered by Three.js.

## Features

- **Endless procedural city.** A chunk-streamed road grid with real NYC building footprints woven into the layout.
- **Garage of vehicles.** Supercars, muscle cars, bikes, and emergency vehicles, each with its own paint, wheels, and lighting.
- **Police and emergency system.** Drive a police cruiser and flip on lights and siren with `L`. Nearby patrol cars fall in behind you in convoy formation, and civilian traffic pulls to the roadside to let you through.
- **Club Neon.** Walk through the door and the game switches to a dance-floor scene, complete with a procedurally generated Bollywood-style soundtrack and NPCs dancing in sync with it.
- **Day/night cycle** with dynamic headlights, traffic lights, pedestrians, and a persistent car showroom.
- **Mobile support.** A touch joystick and on-screen buttons appear automatically on iOS/Android browsers.
- **Autosave.** Progress saves to `localStorage` as you play, no account or server needed.

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

Three.js r128 is inlined directly into `index.html`, along with all textures (canvas-generated) and audio (Web Audio API oscillators). There are no external asset dependencies.

## Contributing

Pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, and note our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

If you discover a security vulnerability, please see [SECURITY.md](SECURITY.md) for how to report it responsibly.

## License

Released under the [MIT License](LICENSE).
