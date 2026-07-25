"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { CarMesh } from "@/components/Car";

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
}

const LANES: Lane[] = [
  { axis: "x", lane: -30, min: -85, max: 85, speed: 10, color: "#8b93a1" },
  { axis: "x", lane: 34, min: -85, max: 85, speed: 13, color: "#3a3f4a" },
  { axis: "z", lane: 46, min: -85, max: 85, speed: 9, color: "#1f4a7a" },
  { axis: "z", lane: -50, min: -85, max: 85, speed: 11, color: "#7a2020" },
  { axis: "x", lane: 0, min: -85, max: 85, speed: 8, color: "#2a5a3a" },
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

function TrafficCar({ lane, seed, index }: { lane: Lane; seed: number; index: number }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const pos = useRef((lane.min + lane.max) / 2 + seed * 7);
  const dir = useRef(seed % 2 === 0 ? 1 : -1);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body) return;
    const d = Math.min(dt, 0.05);

    pos.current += lane.speed * dir.current * d;
    if (pos.current > lane.max) {
      pos.current = lane.max;
      dir.current = -1;
    } else if (pos.current < lane.min) {
      pos.current = lane.min;
      dir.current = 1;
    }

    const x = lane.axis === "x" ? pos.current : lane.lane;
    const z = lane.axis === "x" ? lane.lane : pos.current;
    const heading =
      lane.axis === "x" ? (dir.current > 0 ? Math.PI / 2 : -Math.PI / 2) : dir.current > 0 ? 0 : Math.PI;

    body.setNextKinematicTranslation({ x, y: 0.85, z });
    body.setNextKinematicRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading));
    trafficPositions[index].x = x;
    trafficPositions[index].z = z;
  });

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[0, 0.85, 0]}>
      <CarMesh color={lane.color} />
    </RigidBody>
  );
}
