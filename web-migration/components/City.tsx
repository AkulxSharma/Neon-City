"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { skyState } from "@/lib/skyState";
import { worldState } from "@/lib/worldState";
import { LANDMARKS } from "@/lib/landmarks";
import { CLUB_IN } from "@/lib/club";

// Real chunk-streamed city (Milestone 5), replacing the placeholder 7-box
// arena from Phase 1. Same constants and the same seeded-PRNG-per-chunk
// approach as the original's buildChunk()/ensureChunks() — CELL/ROAD_W/mulberry32
// are the identical numbers/algorithm, just re-typed in TS. Chunks are plain
// React state (a list of "ci,cj" keys); mounting/unmounting a <Chunk> is how
// Rapier RigidBodies get created/freed — no manual scene.add/remove bookkeeping
// needed the way the original's raw three.js version required.
const CELL = 100;
const ROAD_W = 20;
const VIEW = 2; // chunk radius kept alive around the player
const SHORE_CI = 1; // chunks at/after this ci are open water (Water.tsx covers it) — see SUMMARY.md

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FACADE_COLORS = ["#8a94a0", "#7fa8be", "#9aa8c4", "#6c7686", "#8b93a1"];

// which chunk each landmark sits in, so buildChunk (well, Chunk) forces it clear —
// same idea as the original's landmarkChunks map
const LANDMARK_CHUNKS = new Set(LANDMARKS.map((l) => `${Math.round(l.x / CELL)},${Math.round(l.z / CELL)}`));
// CLUB_IN sits far south, outside any real landmark chunk — exempt it too so
// no random building spawns inside/around the club interior room
const CLUB_IN_CHUNK = `${Math.round(CLUB_IN.x / CELL)},${Math.round(CLUB_IN.z / CELL)}`;

export function City() {
  const [chunks, setChunks] = useState<string[]>(() => initialChunks());
  const last = useRef({ ci: 999, cj: 999 });

  useFrame(() => {
    const ci = Math.round(worldState.px / CELL);
    const cj = Math.round(worldState.pz / CELL);
    if (ci === last.current.ci && cj === last.current.cj) return;
    last.current = { ci, cj };

    const next: string[] = [];
    for (let di = -VIEW; di <= VIEW; di++) {
      for (let dj = -VIEW; dj <= VIEW; dj++) {
        next.push(`${ci + di},${cj + dj}`);
      }
    }
    setChunks(next);
  });

  return (
    <>
      {chunks.map((key) => {
        const [ci, cj] = key.split(",").map(Number);
        if (ci >= SHORE_CI) return null; // open water — Water.tsx already covers this area
        return <Chunk key={key} ci={ci} cj={cj} />;
      })}
    </>
  );
}

function initialChunks() {
  const out: string[] = [];
  for (let di = -VIEW; di <= VIEW; di++) {
    for (let dj = -VIEW; dj <= VIEW; dj++) out.push(`${di},${dj}`);
  }
  return out;
}

function Chunk({ ci, cj }: { ci: number; cj: number }) {
  const cx = ci * CELL;
  const cz = cj * CELL;
  // keep the spawn block and any landmark's block clear of random buildings,
  // like the original's showroom/club/landmarkChunks exemptions
  const isExempt = (ci === 0 && cj === 0) || LANDMARK_CHUNKS.has(`${ci},${cj}`) || `${ci},${cj}` === CLUB_IN_CHUNK;

  const buildings = useMemo(() => {
    if (isExempt) return [];
    const rand = mulberry32(((ci * 73856093) ^ (cj * 19349663) ^ 0x5bd1e995) >>> 0);
    const count = rand() < 0.3 ? 0 : rand() < 0.7 ? 1 : 2;
    const margin = ROAD_W / 2 + 6;
    const out: Array<{ pos: [number, number, number]; size: [number, number, number]; color: string }> = [];
    for (let i = 0; i < count; i++) {
      const w = 6 + rand() * 8;
      const d = 6 + rand() * 8;
      const h = 4 + rand() * 20;
      const bx = cx + (rand() * 2 - 1) * (CELL / 2 - margin - w / 2);
      const bz = cz + (rand() * 2 - 1) * (CELL / 2 - margin - d / 2);
      out.push({ pos: [bx, h / 2, bz], size: [w, h, d], color: FACADE_COLORS[Math.floor(rand() * FACADE_COLORS.length)] });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ci, cj]);

  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[cx, -0.5, cz]}>
          <boxGeometry args={[CELL, 1, CELL]} />
          <meshStandardMaterial color="#14161a" roughness={0.95} />
        </mesh>
      </RigidBody>
      {/* road-edge kerb strips, purely visual — the flat ground plane above is
          already the collider for the whole block, road markings don't need their own */}
      {[
        [cx, cz - CELL / 2 + ROAD_W / 2, CELL, ROAD_W] as const,
        [cx, cz + CELL / 2 - ROAD_W / 2, CELL, ROAD_W] as const,
      ].map(([x, z, w, d], i) => (
        <mesh key={`rz-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, z]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#1f2128" roughness={0.9} />
        </mesh>
      ))}
      {[
        [cx - CELL / 2 + ROAD_W / 2, cz, ROAD_W, CELL] as const,
        [cx + CELL / 2 - ROAD_W / 2, cz, ROAD_W, CELL] as const,
      ].map(([x, z, w, d], i) => (
        <mesh key={`rx-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, z]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#1f2128" roughness={0.9} />
        </mesh>
      ))}
      {buildings.map((b, i) => (
        <Building key={i} pos={b.pos} size={b.size} color={b.color} />
      ))}
    </group>
  );
}

function Building({
  pos,
  size,
  color,
}: {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (matRef.current) matRef.current.emissiveIntensity = skyState.nightK * 0.55;
  });
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh castShadow receiveShadow position={pos}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={new THREE.Color("#ffe6a8")}
          emissiveIntensity={0}
          roughness={0.6}
          metalness={0.15}
        />
      </mesh>
    </RigidBody>
  );
}
