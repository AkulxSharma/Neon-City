import type { VehicleKind } from "@/lib/hudStore";

// Every vehicle's live x/z/h, always kept up to date (not just the active
// one) — same shared-mutable-singleton pattern as skyState/worldState, so
// saveGame.ts can snapshot all three without any vehicle needing to know
// about persistence itself.
export const vehicleState: Record<VehicleKind, { x: number; z: number; h: number }> = {
  car: { x: 0, z: 0, h: 0 },
  bike: { x: -20, z: 0, h: 0 },
  boat: { x: 595, z: 0, h: Math.PI }, // in the water off EAST MARINA, matches Boat.tsx's own default
  // parked in POLICE HARBOR STATION's fleet bay — see components/PoliceStation.tsx
  // (PX/PZ 490/90, bays run behind the building) and lib/landmarks.ts's POLICE HARBOR
  policeCar: { x: 482, z: 75, h: 0 },
  patrolBoat: { x: 592, z: 62, h: Math.PI / 2 },
};
