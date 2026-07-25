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
//
// Milestone 11 (visual parity — real facades/roads/parks): ported the
// original's *technique*, not its exact code — baked canvas textures built
// ONCE at module scope and shared across every instance (materials for
// buildings, one tile texture for the ground), same trick the original uses
// for its facadeMats/glassTowerMats and its single repeating street tile.
// Cut vs. the original, deliberately (see SUMMARY.md Milestone 11): no
// per-building UV rescaling (original stretches its stone-facade texture to
// fit each building's exact size; here every building of a given material
// shares one fixed texture repeat — cheap, occasionally a little
// stretched/squashed on very large facades), no macro-district zoning
// (downtown/industrial/residential glass-chance bias), no building tiers/
// AC units/antennas, no bark/leaf textures on trees (flat-shaded cone/sphere-
// equivalent — cylinder trunk + sphere crown — instead), no fountains/
// benches/sports fields inside park chunks, no tree collision (visual
// dressing only, not obstacles).
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

// ---------- shared canvas-texture builders (called a fixed handful of times
// at module load, never per-instance — see the original's own canvasTex()) ----------
function canvasTex(size: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// baked window-grid + "lit at night" glow map, shared by every stone/concrete
// facade material (tinted per-material via `color`, same texture underneath —
// the original's per-wall-color facadeTexPair() bakes the tint INTO the
// texture instead; sharing one neutral texture and tinting via material color
// is cheaper and looks the same after the multiply).
function buildFacadeTextures() {
  const size = 256,
    rows = 10,
    cols = 7;
  const lit = Array.from({ length: rows * cols }, () => Math.random() < 0.5);
  const cw = size / cols,
    rh = size / rows;
  const grid = canvasTex(size, (g) => {
    g.fillStyle = "#d6d6d6";
    g.fillRect(0, 0, size, size);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * 0.12,
          y = r * rh + rh * 0.15,
          w = cw * 0.76,
          h = rh * 0.6;
        g.fillStyle = "#2a2e36";
        g.fillRect(x - 2, y - 2, w + 4, h + 4);
        g.fillStyle = "#7f92a6";
        g.fillRect(x, y, w, h);
      }
    }
  });
  const glow = canvasTex(size, (g) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, size, size);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!lit[r * cols + c]) continue;
        const x = c * cw + cw * 0.12,
          y = r * rh + rh * 0.15,
          w = cw * 0.76,
          h = rh * 0.6;
        g.fillStyle = "#ffdb8a";
        g.fillRect(x, y, w, h);
      }
    }
  });
  for (const t of [grid, glow]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 4);
  }
  return [grid, glow] as const;
}

// glass curtain-wall: mullion grid + a random scatter of lit panes, same
// fixed repeat(3,6) the original uses for its glassTowerMats (the original
// doesn't rescale UVs per-building for glass either — this one matches it
// exactly, not just approximates it).
function buildGlassTextures() {
  const size = 256,
    pane = 16;
  const grid = canvasTex(size, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, "#6f9cc4");
    grad.addColorStop(1, "#243c50");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    g.strokeStyle = "rgba(10,16,24,.85)";
    g.lineWidth = 2;
    for (let i = 0; i <= size; i += pane) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, size);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(size, i);
      g.stroke();
    }
  });
  const glow = canvasTex(size, (g) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += pane) {
      for (let x = 0; x < size; x += pane) {
        if (Math.random() < 0.35) {
          g.fillStyle = "#ffd27a";
          g.fillRect(x + 2, y + 2, pane - 4, pane - 4);
        }
      }
    }
  });
  for (const t of [grid, glow]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 6);
  }
  return [grid, glow] as const;
}

// one shared ground tile per chunk (asphalt road ring + concrete/grass
// interior + curb + dashed lane lines + corner crosswalks), baked once and
// reused by every chunk's ground plane — the same "one repeating street
// texture" trick the original's tileTex uses for its entire infinite ground,
// just one tile = one chunk instead of one tile repeated 16x16 under a giant
// plane (equivalent result, simpler to slot into per-chunk streaming).
function buildTileTexture(interiorFill: string) {
  const size = 384;
  const px = (u: number) => (u / 100) * size;
  return canvasTex(size, (g) => {
    g.fillStyle = interiorFill;
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
      g.fillRect(Math.random() * size, Math.random() * size, 3, 3);
    }
    // sidewalk slab joints (expansion lines across the concrete interior —
    // ported from the original's tileTex, index.html ~3706-3709)
    g.strokeStyle = "rgba(18,20,24,.3)";
    g.lineWidth = 0.7;
    for (let u = 15; u <= 85; u += 5) {
      g.beginPath();
      g.moveTo(px(u), 0);
      g.lineTo(px(u), size);
      g.stroke();
      g.beginPath();
      g.moveTo(0, px(u));
      g.lineTo(size, px(u));
      g.stroke();
    }
    const roadW = px(10);
    // asphalt road strips — patched blotches, aggregate speckle, wheel-path
    // polish, oil drip stains, hairline cracks (ported from the original's
    // road() helper, index.html ~3712-3731)
    const road = (x: number, y: number, w: number, h: number, horiz: boolean) => {
      g.fillStyle = "#23252a";
      g.fillRect(x, y, w, h);
      for (let i = 0; i < Math.max(6, ((w * h) / 1600) | 0); i++) {
        const bx = x + Math.random() * w,
          by = y + Math.random() * h,
          r = 3.75 + Math.random() * 11.25,
          dk = Math.random() < 0.6;
        const rad = g.createRadialGradient(bx, by, 1, bx, by, r);
        rad.addColorStop(0, `rgba(${dk ? 12 : 64},${dk ? 13 : 66},${dk ? 16 : 70},.22)`);
        rad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = rad;
        g.fillRect(x, y, w, h);
      }
      const n = ((w * h) / 22) | 0;
      for (let i = 0; i < n; i++) {
        const v = (26 + Math.random() * 74) | 0;
        g.fillStyle = `rgba(${v},${v},${v + 3},${0.3 + Math.random() * 0.45})`;
        g.fillRect(x + Math.random() * w, y + Math.random() * h, 1.5, 1.5);
      }
      g.fillStyle = "rgba(6,7,10,.26)";
      if (horiz) {
        g.fillRect(x, y + h * 0.26, w, h * 0.16);
        g.fillRect(x, y + h * 0.56, w, h * 0.16);
      } else {
        g.fillRect(x + w * 0.26, y, w * 0.16, h);
        g.fillRect(x + w * 0.56, y, w * 0.16, h);
      }
      for (let i = 0; i < 4; i++) {
        const ox = x + Math.random() * w,
          oy = y + Math.random() * h,
          r = 1.9 + Math.random() * 4.5;
        const rad = g.createRadialGradient(ox, oy, 1, ox, oy, r);
        rad.addColorStop(0, "rgba(0,0,0,.32)");
        rad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = rad;
        g.fillRect(ox - r, oy - r, r * 2, r * 2);
      }
      g.strokeStyle = "rgba(8,8,10,.5)";
      g.lineWidth = 0.5;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        let cx = x + Math.random() * w,
          cy = y + Math.random() * h;
        g.moveTo(cx, cy);
        for (let s = 0; s < 5; s++) {
          cx += (Math.random() - 0.5) * 15;
          cy += (Math.random() - 0.5) * 15;
          g.lineTo(cx, cy);
        }
        g.stroke();
      }
    };
    road(0, 0, roadW, size, false);
    road(size - roadW, 0, roadW, size, false);
    road(0, 0, size, roadW, true);
    road(0, size - roadW, size, roadW, true);
    // curb — a texture stripe, not raised geometry (the original's curb()
    // helper is the same: baked into the tile, no separate 3D mesh)
    g.fillStyle = "rgba(200,204,210,.5)";
    g.fillRect(roadW - 2, 0, 2, size);
    g.fillRect(size - roadW, 0, 2, size);
    g.fillRect(0, roadW - 2, size, 2);
    g.fillRect(0, size - roadW, size, 2);
    // dashed yellow centerline at the chunk edges (where this tile meets its
    // neighbour's — both draw the same pattern so it lines up seamlessly)
    g.strokeStyle = "rgba(206,172,64,.85)";
    g.lineWidth = px(0.5);
    g.setLineDash([px(4), px(4)]);
    for (const e of [0, size]) {
      g.beginPath();
      g.moveTo(e, 0);
      g.lineTo(e, size);
      g.stroke();
      g.beginPath();
      g.moveTo(0, e);
      g.lineTo(size, e);
      g.stroke();
    }
    g.setLineDash([]);
    g.strokeStyle = "rgba(224,226,230,.6)";
    g.lineWidth = px(0.35);
    for (const o of [8.5, 91.5]) {
      g.beginPath();
      g.moveTo(px(o), 0);
      g.lineTo(px(o), size);
      g.stroke();
      g.beginPath();
      g.moveTo(0, px(o));
      g.lineTo(size, px(o));
      g.stroke();
    }
    // crosswalk zebra bars at the four corners
    g.fillStyle = "rgba(226,228,232,.6)";
    for (const ex of [0, 100]) {
      for (const ez of [0, 100]) {
        for (let u = -6; u <= 6; u += 2.4) {
          const sx = ex + u,
            sz = ez + (ez === 0 ? 11 : -13.4);
          if (sx >= 0 && sx <= 100) g.fillRect(px(sx - 0.7), px(sz), px(1.4), px(2.4));
          const hx = ex + (ex === 0 ? 11 : -13.4),
            hz = ez + u;
          if (hz >= 0 && hz <= 100) g.fillRect(px(hx), px(hz - 0.7), px(2.4), px(1.4));
        }
      }
    }
    // manhole covers (ported from the original's manhole() helper,
    // index.html ~3777-3781) — 2 per tile, not the original's 4: this tile
    // is one chunk, not a 16x16-tiled giant plane, so 4 would crowd it
    const manhole = (u: number, v: number, r: number) => {
      g.fillStyle = "#1a1c21";
      g.beginPath();
      g.arc(px(u), px(v), px(r), 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#43464d";
      g.lineWidth = 0.9;
      g.beginPath();
      g.arc(px(u), px(v), px(r), 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = "rgba(92,96,102,.5)";
      g.lineWidth = 0.45;
      g.beginPath();
      g.arc(px(u), px(v), px(r * 0.68), 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = "rgba(70,74,80,.4)";
      g.lineWidth = 0.5;
      for (let a = 0; a < 8; a++) {
        const an = (a * Math.PI) / 4;
        g.beginPath();
        g.moveTo(px(u) + Math.cos(an) * px(r * 0.3), px(v) + Math.sin(an) * px(r * 0.3));
        g.lineTo(px(u) + Math.cos(an) * px(r * 0.62), px(v) + Math.sin(an) * px(r * 0.62));
        g.stroke();
      }
    };
    manhole(4.5, 38, 0.72);
    manhole(63, 95.5, 0.72);
  });
}

const [FACADE_GRID_TEX, FACADE_GLOW_TEX] = buildFacadeTextures();
const [GLASS_GRID_TEX, GLASS_GLOW_TEX] = buildGlassTextures();
const CITY_TILE_TEX = buildTileTexture("#82868d"); // concrete sidewalk
const PARK_TILE_TEX = buildTileTexture("#3f6b2f"); // park grass

// grey/tan stone-facade tints + the original's literal glassTowerMats blue
// hex values, each paired with the ONE shared grid/glow texture above.
const FACADE_TINTS = ["#b8b2a4", "#8c9098", "#9a5f48", "#7c8ea0", "#c2b79c", "#5a5e68", "#a89a86", "#6e7a86"];
const GLASS_TINTS = ["#8fb0c8", "#9aa8c4", "#7fa8be", "#a2bcd0"];
const ROOF_MAT = new THREE.MeshStandardMaterial({ color: "#15161c", roughness: 0.9 });
const FACADE_MATS = FACADE_TINTS.map(
  (color) =>
    new THREE.MeshStandardMaterial({
      map: FACADE_GRID_TEX,
      color,
      roughness: 0.82,
      metalness: 0.05,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: FACADE_GLOW_TEX,
      emissiveIntensity: 0,
    }),
);
const GLASS_MATS = GLASS_TINTS.map(
  (color) =>
    new THREE.MeshStandardMaterial({
      map: GLASS_GRID_TEX,
      color,
      roughness: 0.08,
      metalness: 1,
      envMapIntensity: 0.7,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: GLASS_GLOW_TEX,
      emissiveIntensity: 0,
    }),
);

// shared tree geometry/materials — flat-shaded cylinder trunk + sphere crown,
// no bark/leaf textures (dressing, not a hero asset, per the ask)
const TRUNK_GEO = new THREE.CylinderGeometry(0.15, 0.21, 1, 7);
const CROWN_GEO = new THREE.SphereGeometry(1, 8, 7);
const TRUNK_MAT = new THREE.MeshStandardMaterial({ color: "#5a4128", roughness: 1 });
const CROWN_MATS = ["#3f7d33", "#4f8d3a", "#35702e"].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));

// which chunk each landmark sits in, so buildChunk (well, Chunk) forces it clear —
// same idea as the original's landmarkChunks map
const LANDMARK_CHUNKS = new Set(LANDMARKS.map((l) => `${Math.round(l.x / CELL)},${Math.round(l.z / CELL)}`));
// CLUB_IN sits far south, outside any real landmark chunk — exempt it too so
// no random building/park spawns inside/around the club interior room
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

  // night-window glow, updated on the shared materials ONCE per frame — same
  // spot the original does it (`for(const m of facadeMats) m.emissiveIntensity=...`),
  // cost is O(materials), not O(buildings on screen)
  useFrame(() => {
    const k = skyState.nightK;
    for (const m of FACADE_MATS) m.emissiveIntensity = k * 1.1;
    for (const m of GLASS_MATS) m.emissiveIntensity = k * 0.9;
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

type BuildingDesc = { pos: [number, number, number]; size: [number, number, number]; mat: THREE.Material[] };
type TreeDesc = { x: number; z: number; h: number; r: number; matIdx: number };

function Chunk({ ci, cj }: { ci: number; cj: number }) {
  const cx = ci * CELL;
  const cz = cj * CELL;
  // keep the spawn block and any landmark's block clear of random buildings/
  // parks, like the original's showroom/club/landmarkChunks exemptions
  const isExempt = (ci === 0 && cj === 0) || LANDMARK_CHUNKS.has(`${ci},${cj}`) || `${ci},${cj}` === CLUB_IN_CHUNK;

  const content = useMemo(() => {
    if (isExempt) return { buildings: [] as BuildingDesc[], trees: [] as TreeDesc[], isPark: false };
    const rand = mulberry32(((ci * 73856093) ^ (cj * 19349663) ^ 0x5bd1e995) >>> 0);
    const isPark = rand() < 0.13; // matches the original's isPark chance exactly
    const margin = ROAD_W / 2 + 6;

    const buildings: BuildingDesc[] = [];
    if (!isPark) {
      const count = rand() < 0.3 ? 0 : rand() < 0.7 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const w = 6 + rand() * 8;
        const d = 6 + rand() * 8;
        const h = 4 + rand() * 20;
        const bx = cx + (rand() * 2 - 1) * (CELL / 2 - margin - w / 2);
        const bz = cz + (rand() * 2 - 1) * (CELL / 2 - margin - d / 2);
        const pal = rand() < 0.3 ? GLASS_MATS : FACADE_MATS;
        const m = pal[Math.floor(rand() * pal.length)];
        buildings.push({ pos: [bx, h / 2, bz], size: [w, h, d], mat: [m, m, ROOF_MAT, ROOF_MAT, m, m] });
      }
    }

    const trees: TreeDesc[] = [];
    // 3 streetside trees, one of the 4 chunk edges each — same layout as the
    // original's per-chunk street trees
    for (let i = 0; i < 3; i++) {
      const side = Math.floor(rand() * 4);
      const u = (rand() * 2 - 1) * 34;
      const hs = 38.5;
      const x = cx + (side === 0 ? u : side === 1 ? hs : side === 2 ? u : -hs);
      const z = cz + (side === 0 ? -hs : side === 1 ? u : side === 2 ? hs : -u);
      trees.push({ x, z, h: 2.2 + rand() * 1.4, r: 1.3 + rand() * 0.9, matIdx: Math.floor(rand() * 3) });
    }
    if (isPark) {
      // a ring of extra trees around the park interior, like the original's
      // isPark tree loop — no fountain/benches/sports field (cut, see file header)
      for (let i = 0; i < 6; i++) {
        const a = rand() * Math.PI * 2;
        const rr = 15 + rand() * 19;
        trees.push({
          x: cx + Math.cos(a) * rr,
          z: cz + Math.sin(a) * rr,
          h: 2.4 + rand() * 1.6,
          r: 1.4 + rand(),
          matIdx: Math.floor(rand() * 3),
        });
      }
    }

    return { buildings, trees, isPark };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ci, cj]);

  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[cx, -0.5, cz]}>
          <boxGeometry args={[CELL, 1, CELL]} />
          <meshStandardMaterial map={content.isPark ? PARK_TILE_TEX : CITY_TILE_TEX} roughness={0.9} />
        </mesh>
      </RigidBody>
      {content.buildings.map((b, i) => (
        <Building key={i} pos={b.pos} size={b.size} mat={b.mat} />
      ))}
      {content.trees.map((t, i) => (
        <Tree key={i} x={t.x} z={t.z} h={t.h} r={t.r} matIdx={t.matIdx} />
      ))}
    </group>
  );
}

function Building({
  pos,
  size,
  mat,
}: {
  pos: [number, number, number];
  size: [number, number, number];
  mat: THREE.Material[];
}) {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh castShadow receiveShadow position={pos} material={mat}>
        <boxGeometry args={size} />
      </mesh>
    </RigidBody>
  );
}

// visual-only, no collider — dressing, not an obstacle (see file header cut list)
function Tree({ x, z, h, r, matIdx }: { x: number; z: number; h: number; r: number; matIdx: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow geometry={TRUNK_GEO} material={TRUNK_MAT} scale={[1, h, 1]} position={[0, h / 2, 0]} />
      <mesh castShadow geometry={CROWN_GEO} material={CROWN_MATS[matIdx]} scale={[r, r * 0.85, r]} position={[0, h + r * 0.5, 0]} />
    </group>
  );
}
