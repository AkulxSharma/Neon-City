import { create } from "zustand";
import { LANDMARKS, type Landmark } from "@/lib/landmarks";
import type { CarStyle } from "@/components/SupercarBody";

export type VehicleKind = "car" | "boat" | "bike" | "policeCar" | "patrolBoat";
export type ActiveMode = VehicleKind | "foot";
export const CAM_MODES = ["CHASE", "COCKPIT", "HOOD", "CINE"] as const;
export type CamMode = 0 | 1 | 2 | 3;

// B still only quick-switches the original 3 owned vehicles — policeCar/patrolBoat
// are parked at the station/marina and reached by walking up + E, same as any
// other vehicle (see lib/player.ts's mount scan, which is generic over VehicleKind)
const CYCLE: VehicleKind[] = ["car", "bike", "boat"];
export const VEHICLE_NAMES: Record<VehicleKind, string> = {
  car: "CITY SEDAN",
  bike: "STREET BIKE",
  boat: "SEA SPRITE",
  policeCar: "POLICE CRUISER",
  patrolBoat: "HARBOR PATROL",
};
// hulls — anything that floats, not just the original "boat". Used wherever a
// feature needs to exclude/include boats generically (club door, dock walking).
export const BOAT_KINDS: readonly VehicleKind[] = ["boat", "patrolBoat"];

let msgTimer: ReturnType<typeof setTimeout> | null = null;

interface HudState {
  speedKmh: number;
  grounded: boolean;
  active: ActiveMode;
  camMode: CamMode;
  hint: string | null;
  msg: string | null;
  nitroFuel: number; // 0..1
  nitroActive: boolean;
  clock: string;
  navTarget: Landmark | null;
  waypointDist: number;
  waypointDeg: number;
  mapOpen: boolean;
  inClub: boolean;
  // paint/roofline the player's sedan is currently wearing after a steal
  // (lib/steal.ts); null = its own factory colour. Consumed by Car.tsx.
  stolenCar: { color: string; style: CarStyle } | null;
  setHud: (speedKmh: number, grounded: boolean) => void;
  toggleActive: () => void;
  setActive: (m: ActiveMode) => void;
  setCamMode: (m: CamMode) => void;
  cycleCamMode: () => void;
  setHint: (h: string | null) => void;
  showMsg: (text: string) => void;
  setNitro: (fuel: number, active: boolean) => void;
  setClock: (c: string) => void;
  setWaypoint: (dist: number, deg: number) => void;
  setNavTarget: (l: Landmark) => void;
  setMapOpen: (open: boolean) => void;
  setInClub: (v: boolean) => void;
  setStolenCar: (v: { color: string; style: CarStyle } | null) => void;
  vehicleName: () => string;
}

// Per-frame vehicle telemetry, read by the HUD overlay. Kept out of React state on
// the vehicles themselves (that would re-render the whole scene every frame) — only
// the HUD component subscribes to speed/grounded, so only the HUD re-renders for
// those. `active`/`camMode` change rarely (a key press) so it's fine to read them
// in useFrame from vehicle components too.
export const useHudStore = create<HudState>((set, get) => ({
  speedKmh: 0,
  grounded: true,
  active: "car",
  camMode: 0,
  hint: null,
  msg: null,
  nitroFuel: 1,
  nitroActive: false,
  clock: "06:00",
  navTarget: LANDMARKS[0], // VENU, matches the original's default navTarget
  waypointDist: 0,
  waypointDeg: 0,
  mapOpen: false,
  inClub: false,
  setHud: (speedKmh, grounded) => set({ speedKmh, grounded }),
  // no-ops while on foot — B is this build's own quick-switch between owned
  // vehicles, not a thing while walking (mount via E near a vehicle instead)
  toggleActive: () =>
    set((s) => (s.active === "foot" ? s : { active: CYCLE[(CYCLE.indexOf(s.active) + 1) % CYCLE.length] })),
  setActive: (m) => set({ active: m }),
  setCamMode: (m) => set({ camMode: m }),
  cycleCamMode: () => set((s) => ({ camMode: (((s.camMode + 1) % 4) as CamMode) })),
  setHint: (h) => set({ hint: h }),
  showMsg: (text) => {
    set({ msg: text });
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(() => set({ msg: null }), 2200);
  },
  setNitro: (fuel, active) => set({ nitroFuel: fuel, nitroActive: active }),
  setClock: (c) => set({ clock: c }),
  setWaypoint: (dist, deg) => set({ waypointDist: dist, waypointDeg: deg }),
  setNavTarget: (l) => set({ navTarget: l, mapOpen: false }),
  setMapOpen: (open) => set({ mapOpen: open }),
  setInClub: (v) => set({ inClub: v }),
  vehicleName: () => {
    const a = get().active;
    return a === "foot" ? "ON FOOT" : VEHICLE_NAMES[a];
  },
}));
