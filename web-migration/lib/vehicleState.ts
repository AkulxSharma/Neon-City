import type { VehicleKind } from "@/lib/hudStore";

// Every vehicle's live x/z/h, always kept up to date (not just the active
// one) — same shared-mutable-singleton pattern as skyState/worldState, so
// saveGame.ts can snapshot all three without any vehicle needing to know
// about persistence itself.
export const vehicleState: Record<VehicleKind, { x: number; z: number; h: number }> = {
  car: { x: 0, z: 0, h: 0 },
  bike: { x: -20, z: 0, h: 0 },
  boat: { x: 40, z: 0, h: Math.PI },
};
