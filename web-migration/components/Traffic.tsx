"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { CarMesh } from "@/components/Car";
import { useHudStore } from "@/lib/hudStore";
import { worldState } from "@/lib/worldState";

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

const LANES: Lane[] = [
  { axis: "x", lane: -30, min: -85, max: 85, speed: 10, color: "#8b93a1" },
  { axis: "x", lane: 34, min: -85, max: 85, speed: 13, color: "#3a3f4a" },
  { axis: "z", lane: 46, min: -85, max: 85, speed: 9, color: "#1f4a7a" },
  { axis: "z", lane: -50, min: -85, max: 85, speed: 11, color: "#7a2020" },
  { axis: "x", lane: 0, min: -85, max: 85, speed: 8, color: "#2a5a3a" },
  // patrol the police-station neighborhood (lib/landmarks.ts POLICE HARBOR ~
  // (0,50)) — recruit into a convoy behind the player whenever a police
  // vehicle (policeCar) is being driven nearby, ported from the original's
  // recruit-on-siren convoy system (index.html ~line 7365-7400), ~line
  // 7466's felony-stop boxing-in maneuver deliberately not ported — a
  // meaningfully bigger state machine than a straight follow, left for later
  { axis: "x", lane: 20, min: -70, max: 70, speed: 11, color: "#0c0c0e", police: true },
  { axis: "z", lane: 30, min: -70, max: 70, speed: 12, color: "#0c0c0e", police: true },
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
    // teleporting back to wherever the lane loop was left off
    pos.current += lane.speed * dir.current * d;
    if (pos.current > lane.max) {
      pos.current = lane.max;
      dir.current = -1;
    } else if (pos.current < lane.min) {
      pos.current = lane.min;
      dir.current = 1;
    }

    const laneX = lane.axis === "x" ? pos.current : lane.lane;
    const laneZ = lane.axis === "x" ? lane.lane : pos.current;
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

    body.setNextKinematicTranslation({ x, y: 0.85, z });
    body.setNextKinematicRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading));
    trafficPositions[index].x = x;
    trafficPositions[index].z = z;
  });

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[0, 0.85, 0]}>
      <CarMesh color={lane.color} />
      {lane.police && (
        <>
          <mesh position={[-0.35, 0.86, -0.3]}>
            <boxGeometry args={[0.6, 0.15, 0.3]} />
            <meshBasicMaterial ref={(el) => (lightRefs.current[0] = el)} color="#ff2020" />
          </mesh>
          <mesh position={[0.35, 0.86, -0.3]}>
            <boxGeometry args={[0.6, 0.15, 0.3]} />
            <meshBasicMaterial ref={(el) => (lightRefs.current[1] = el)} color="#2040ff" />
          </mesh>
        </>
      )}
    </RigidBody>
  );
}
