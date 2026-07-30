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
  // parked on INTERNATIONAL AIRPORT's apron / south helipad — see
  // lib/landmarks.ts (AX/AZ -300/100) and components/Airport.tsx's local
  // layout: the plane sits on open apron clear of the stands and the service-
  // vehicle loops, the helicopter on HELIPAD_ZS[0], the one pad Airport.tsx
  // deliberately leaves empty for it.
  plane: { x: -330, z: 40, h: Math.PI },
  helicopter: { x: -500, z: 190, h: 0 },
  // the three gate-parked wide-bodies — world coords = airport AX/AZ (-300/100)
  // + components/Airport.tsx's own GATE_XS=[-70,0,70]/GATE_Z=65 local offsets,
  // h=0 so the mounted rig's heading matches the parked (unrotated) visual
  // components/DrivableAirliner.tsx renders in its place. Nose-in toward the
  // terminal, same as a real gate — yaw turns in place fine at zero speed
  // (see lib/flightPhysics.ts's stepFlight), so taxiing out just means
  // pivoting toward the taxiway before throttling forward, no reverse needed.
  airliner1: { x: -370, z: 165, h: 0 },
  airliner2: { x: -300, z: 165, h: 0 },
  airliner3: { x: -230, z: 165, h: 0 },
  // freighter on the cargo apron — AX/AZ + Airport.tsx's CARGO_X/CARGO_Z(-195/10)
  // + the freighter's own local offset (+4/-78) and Math.PI/2 rotation
  airlinerCargo: { x: -491, z: 32, h: Math.PI / 2 },
};
