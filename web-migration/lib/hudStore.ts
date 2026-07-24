import { create } from "zustand";

interface HudState {
  speedKmh: number;
  grounded: boolean;
  setHud: (speedKmh: number, grounded: boolean) => void;
}

// Per-frame car telemetry, read by the HUD overlay. Kept out of React state on the
// car itself (that would re-render the whole scene every frame) — only the HUD
// component subscribes to this store, so only the HUD re-renders.
export const useHudStore = create<HudState>((set) => ({
  speedKmh: 0,
  grounded: true,
  setHud: (speedKmh, grounded) => set({ speedKmh, grounded }),
}));
