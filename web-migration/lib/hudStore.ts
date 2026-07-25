import { create } from "zustand";

export type VehicleKind = "car" | "boat" | "bike";

const CYCLE: VehicleKind[] = ["car", "bike", "boat"];

interface HudState {
  speedKmh: number;
  grounded: boolean;
  active: VehicleKind;
  setHud: (speedKmh: number, grounded: boolean) => void;
  toggleActive: () => void;
}

// Per-frame vehicle telemetry, read by the HUD overlay. Kept out of React state on
// the vehicles themselves (that would re-render the whole scene every frame) — only
// the HUD component subscribes to speed/grounded, so only the HUD re-renders for
// those. `active` changes rarely (a key press) so it's fine to read it in useFrame.
export const useHudStore = create<HudState>((set) => ({
  speedKmh: 0,
  grounded: true,
  active: "car",
  setHud: (speedKmh, grounded) => set({ speedKmh, grounded }),
  toggleActive: () =>
    set((s) => ({ active: CYCLE[(CYCLE.indexOf(s.active) + 1) % CYCLE.length] })),
}));
