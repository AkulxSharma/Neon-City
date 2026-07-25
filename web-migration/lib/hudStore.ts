import { create } from "zustand";
import { LANDMARKS, type Landmark } from "@/lib/landmarks";

export type VehicleKind = "car" | "boat" | "bike";
export const CAM_MODES = ["CHASE", "COCKPIT", "HOOD", "CINE"] as const;
export type CamMode = 0 | 1 | 2 | 3;

const CYCLE: VehicleKind[] = ["car", "bike", "boat"];
const NAMES: Record<VehicleKind, string> = { car: "CITY SEDAN", bike: "STREET BIKE", boat: "SEA SPRITE" };

let msgTimer: ReturnType<typeof setTimeout> | null = null;

interface HudState {
  speedKmh: number;
  grounded: boolean;
  active: VehicleKind;
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
  setHud: (speedKmh: number, grounded: boolean) => void;
  toggleActive: () => void;
  setCamMode: (m: CamMode) => void;
  cycleCamMode: () => void;
  setHint: (h: string | null) => void;
  showMsg: (text: string) => void;
  setNitro: (fuel: number, active: boolean) => void;
  setClock: (c: string) => void;
  setWaypoint: (dist: number, deg: number) => void;
  setNavTarget: (l: Landmark) => void;
  setMapOpen: (open: boolean) => void;
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
  setHud: (speedKmh, grounded) => set({ speedKmh, grounded }),
  toggleActive: () =>
    set((s) => ({ active: CYCLE[(CYCLE.indexOf(s.active) + 1) % CYCLE.length] })),
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
  vehicleName: () => NAMES[get().active],
}));
