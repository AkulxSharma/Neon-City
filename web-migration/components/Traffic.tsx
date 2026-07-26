"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { CarMesh } from "@/components/Car";
import { PoliceCarMesh } from "@/components/PoliceCar";
import { useHudStore } from "@/lib/hudStore";
import { worldState } from "@/lib/worldState";
import { vehicleState } from "@/lib/vehicleState";

// Basic traffic AI (Phase 3, part of Milestone 4): a handful of self-driving
// cars patrolling straight lanes. Deliberately not the original's full
// lane-grid/traffic-light/yield system — there's no road grid yet for that to
// follow (World.tsx is still placeholder geometry, see SUMMARY.md). This is
// the original's *other* update loop in miniature: traffic cars were never
// run through the player's collide()/character-controller physics block, they
// always had their own simpler position-driven loop — so skipping Rapier's
// character controller here isn't a shortcut, it's the same split the
// original makes (see updateBoatTraffic vs. the player drive branch, ported
// in Milestone 1/2's own comments).
interface Lane {
  axis: "x" | "z";
  lane: number; // fixed cross-axis position
  min: number;
  max: number;
  speed: number;
  color: string;
  police?: boolean;
}

// Lane cross-axis values must land on the real road grid. City.tsx bakes
// asphalt only in the outer 10 units of each chunk edge (buildTileTexture), so
// a road runs along every chunk boundary — coordinates ≡ 50 (mod 100), e.g.
// ±50, ±150. Chunk() now walls each chunk's interior off to Car/Bike/Traffic
// (VEHICLE_ONLY curb at cx±40, see lib/collisionGroups.ts), so a lane anywhere
// off that grid drives straight into a curb. `lane` (the fixed cross-axis
// value) is therefore always an odd multiple of 50.
const LANES: Lane[] = [
  { axis: "x", lane: 50, min: -85, max: 85, speed: 10, color: "#8b93a1" },
  { axis: "x", lane: -50, min: -85, max: 85, speed: 13, color: "#3a3f4a" },
  { axis: "z", lane: 50, min: -85, max: 85, speed: 9, color: "#1f4a7a" },
  { axis: "z", lane: -50, min: -85, max: 85, speed: 11, color: "#7a2020" },
  { axis: "x", lane: 150, min: -85, max: 85, speed: 8, color: "#2a5a3a" },
  // patrol the police-station neighborhood (lib/landmarks.ts POLICE HARBOR,
  // x:450 z:50) — recruit into a convoy behind the player whenever a police
  // vehicle (policeCar) is being driven nearby, ported from the original's
  // recruit-on-siren convoy system (index.html ~line 7365-7400), ~line
  // 7466's felony-stop boxing-in maneuver deliberately not ported — a
  // meaningfully bigger state machine than a straight follow, left for later.
  // Both lanes on the road intersection under the station (x=450, z=50, both
  // odd-50 road lines) after the shore restore moved it out to (450,50).
  { axis: "x", lane: 50, min: 380, max: 520, speed: 11, color: "#0c0c0e", police: true },
  { axis: "z", lane: 450, min: -30, max: 110, speed: 12, color: "#0c0c0e", police: true },

  // more NPC traffic — a couple more streets, plus a 2nd car on two of the
  // busiest existing ones (same lane spec, different seed stagger)
  { axis: "z", lane: 150, min: -85, max: 85, speed: 10, color: "#b33a3a" },
  { axis: "x", lane: -150, min: -85, max: 85, speed: 9, color: "#4a6a8a" },
  { axis: "z", lane: -150, min: -85, max: 85, speed: 12, color: "#8a7a3a" },
  { axis: "x", lane: 50, min: -85, max: 85, speed: 12, color: "#5a5a5a" },
  { axis: "z", lane: -50, min: -85, max: 85, speed: 9, color: "#3a5a5a" },

  // more patrol cars, out near spawn rather than only around the station,
  // so you actually run into one without driving out to POLICE HARBOR
  { axis: "x", lane: -50, min: -85, max: 85, speed: 10, color: "#0c0c0e", police: true },
  { axis: "z", lane: 50, min: -85, max: 85, speed: 10, color: "#0c0c0e", police: true },
];

// read by Minimap.tsx to draw traffic blips — same shared-singleton pattern as
// skyState/worldState, updated in place (not replaced) so it never allocates
export const trafficPositions: { x: number; z: number }[] = LANES.map(() => ({ x: 0, z: 0 }));

export function Traffic() {
  return (
    <>
      {LANES.map((lane, i) => (
        <TrafficCar key={i} lane={lane} seed={i} index={i} />
      ))}
    </>
  );
}

const RECRUIT_RADIUS2 = 70 * 70; // matches the original's d2<70*70 land-convoy recruit check

const STOP_DISTANCE = 7; // ahead-of-car braking gap — city sedan is 4.6 long, this clears it plus a margin
const LANE_HALF_WIDTH = 4.5; // covers either side of the centreline (±LANE_OFFSET) plus car width/slop
const LANE_OFFSET = 3; // sideways shift off the road centreline (road is 20 wide, this stays well inside it)

// Real vehicle world positions to treat as obstacles — vehicleState.car/bike/
// policeCar are kept live every frame by their own components regardless of
// which one is actually active (a parked-and-abandoned car still updates
// its own x/z), so this also works if the player gets out and walks away.
function laneBlocked(lane: Lane, nextPos: number, dir: number): boolean {
  for (const v of [vehicleState.car, vehicleState.bike, vehicleState.policeCar]) {
    const along = lane.axis === "x" ? v.x : v.z;
    const across = lane.axis === "x" ? v.z : v.x;
    if (Math.abs(across - lane.lane) > LANE_HALF_WIDTH) continue; // not in this lane
    const gap = along - nextPos; // signed distance from where we're about to be
    if (gap * dir > 0 && Math.abs(gap) < STOP_DISTANCE) return true; // only stop for what's ahead, not what's already behind
  }
  return false;
}

function TrafficCar({ lane, seed, index }: { lane: Lane; seed: number; index: number }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const pos = useRef((lane.min + lane.max) / 2 + seed * 7);
  const dir = useRef(seed % 2 === 0 ? 1 : -1);
  const recruited = useRef(false);
  const convoyPos = useRef<{ x: number; z: number } | null>(null);
  const lightRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  useFrame((state, dt) => {
    const body = bodyRef.current;
    if (!body) return;
    const d = Math.min(dt, 0.05);

    // background lane math always advances, even while convoying, so dropping
    // out of the convoy resumes patrol from a live position instead of
    // teleporting back to wherever the lane loop was left off — UNLESS a real
    // vehicle (parked or otherwise) is sitting in the way: traffic cars are
    // kinematic and driven purely by this scripted position, with no
    // collider (Rapier never resolves kinematic-vs-kinematic overlap), so
    // without this check they'd drive straight through a parked car instead
    // of stopping short of it.
    const nextPos = pos.current + lane.speed * dir.current * d;
    if (!laneBlocked(lane, nextPos, dir.current)) {
      pos.current = nextPos;
      if (pos.current > lane.max) {
        pos.current = lane.max;
        dir.current = -1;
      } else if (pos.current < lane.min) {
        pos.current = lane.min;
        dir.current = 1;
      }
    }

    // right-hand-traffic offset: the ping-pong lane reverses direction at
    // each end instead of running two separate one-way lanes, so a car
    // travelling +dir and one travelling -dir need to sit on opposite sides
    // of the centreline (not glued to it) to read as "in a lane" instead of
    // driving straight down the middle/through oncoming traffic.
    const side = dir.current > 0 ? LANE_OFFSET : -LANE_OFFSET;
    const laneX = lane.axis === "x" ? pos.current : lane.lane + side;
    const laneZ = lane.axis === "x" ? lane.lane + side : pos.current;
    const laneHeading =
      lane.axis === "x" ? (dir.current > 0 ? Math.PI / 2 : -Math.PI / 2) : dir.current > 0 ? 0 : Math.PI;

    let x = laneX;
    let z = laneZ;
    let heading = laneHeading;

    if (lane.police) {
      const sirenOn = useHudStore.getState().active === "policeCar";
      if (!sirenOn) {
        recruited.current = false;
      } else if (!recruited.current) {
        const dx = laneX - worldState.px;
        const dz = laneZ - worldState.pz;
        if (dx * dx + dz * dz < RECRUIT_RADIUS2) recruited.current = true;
      }
      if (recruited.current) {
        // slot-based follow formation, same numbers as the original's land
        // convoy (dist=slot*10+8, lateral alternates by slot parity*2.8)
        const slot = index + 1;
        const dist = slot * 10 + 8;
        const lat = (slot % 2 === 0 ? 1 : -1) * 2.8;
        const fx = Math.sin(worldState.heading);
        const fz = Math.cos(worldState.heading);
        const rx = fz;
        const rz = -fx;
        const targetX = worldState.px - fx * dist + rx * lat;
        const targetZ = worldState.pz - fz * dist + rz * lat;
        const cx = convoyPos.current?.x ?? targetX;
        const cz = convoyPos.current?.z ?? targetZ;
        const ddx = targetX - cx;
        const ddz = targetZ - cz;
        const dd = Math.hypot(ddx, ddz) || 1;
        const step = Math.min(dd, 16 * d); // 16 m/s convoy chase speed
        const nx = cx + (ddx / dd) * step;
        const nz = cz + (ddz / dd) * step;
        convoyPos.current = { x: nx, z: nz };
        x = nx;
        z = nz;
        heading = dd > 0.5 ? Math.atan2(ddx, ddz) : worldState.heading;
      } else {
        convoyPos.current = { x: laneX, z: laneZ };
      }

      const flashRed = Math.floor(state.clock.elapsedTime * 5) % 2 === 0;
      if (lightRefs.current[0]) lightRefs.current[0].color.set(flashRed ? "#ff2020" : "#160000");
      if (lightRefs.current[1]) lightRefs.current[1].color.set(flashRed ? "#0a1030" : "#2040ff");
    }

    body.setNextKinematicTranslation({ x, y: RIDE_HEIGHT, z });
    body.setNextKinematicRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading));
    trafficPositions[index].x = x;
    trafficPositions[index].z = z;
  });

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[0, 0.98, 0]}>
      {/* detail="low" — a dozen NPC cars are never seen close enough for
          spokes/mirrors/occupants to be more than a pixel, and skipping them
          keeps the draw-call count from tripling as traffic density grew */}
      {lane.police ? (
        <PoliceCarMesh lightRefs={lightRefs} detail="low" />
      ) : (
        <CarMesh color={lane.color} detail="low" />
      )}
    </RigidBody>
  );
}
