"use client";

import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { CarMesh } from "@/components/Car";
import { RIDE_HEIGHT } from "@/components/SupercarBody";

// MIZU 21 — bespoke landmark modeled on a real reference photo (mountain-
// lodge restaurant: cross-gable roofline, stone entry tower, salmon lap
// siding, black steel canopy). Deliberately NOT neon — no bloom, no emissive
// signage — this building is matte/lit like a real storefront, unlike every
// other landmark in the city. Positioned at lib/landmarks.ts's MIZU 21
// coordinate; City.tsx's LANDMARK_CHUNKS exemption keeps random buildings
// off this spot the same way it does for PoliceStation/AutoYard.
const MX = 100;
const MZ = 0;
const FACING = -Math.PI / 2; // front (+local Z) points toward -world X, i.e. back toward spawn

// unit-sized front-facing gable roof (ridge runs front-to-back along local Z,
// so the triangular gable end faces +Z) — scaled per use like City.tsx's
// HIP_ROOF_GEO. DoubleSide on the material sidesteps winding guesswork on
// a hand-built prism.
const GABLE_ROOF_GEO = (() => {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array([
    -0.5, 0, -0.5, // 0 back-left base
    0.5, 0, -0.5, // 1 back-right base
    0.5, 0, 0.5, // 2 front-right base
    -0.5, 0, 0.5, // 3 front-left base
    0, 1, -0.5, // 4 ridge-back
    0, 1, 0.5, // 5 ridge-front
  ]);
  const idx = [0, 3, 5, 0, 5, 4, 2, 1, 4, 2, 4, 5, 1, 0, 4, 3, 2, 5];
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
})();

const SIDING_MAT = new THREE.MeshStandardMaterial({ color: "#c9836f", roughness: 0.88 });
const STONE_MAT = new THREE.MeshStandardMaterial({ color: "#a2907a", roughness: 0.95 });
const ROOF_MAT = new THREE.MeshStandardMaterial({ color: "#1b1d21", roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide });
const TRIM_MAT = new THREE.MeshStandardMaterial({ color: "#141519", roughness: 0.55, metalness: 0.35 });
const WINDOW_MAT = new THREE.MeshStandardMaterial({
  color: "#1a2530",
  roughness: 0.2,
  metalness: 0.3,
  emissive: new THREE.Color("#3a4a55"),
  emissiveIntensity: 0.15,
});
const GLASS_DOOR_MAT = new THREE.MeshStandardMaterial({ color: "#0d1218", roughness: 0.15, metalness: 0.4 });
const LAMP_MAT = new THREE.MeshStandardMaterial({ color: "#ffd9a0", emissive: new THREE.Color("#ffb862"), emissiveIntensity: 0.6 });
const SIGN_BOARD_MAT = new THREE.MeshStandardMaterial({ color: "#111114", roughness: 0.7 });
const ADA_MAT = new THREE.MeshStandardMaterial({ color: "#1f5fb0", roughness: 0.5 });
const ASPHALT_MAT = new THREE.MeshStandardMaterial({ color: "#2b2c30", roughness: 1 });
const STALL_LINE_MAT = new THREE.MeshBasicMaterial({ color: "#d8d8cc" });

// ---- neighbor fast-food building (TACO SPOT) — brick + purple band +
// stone corner pier + slat canopy, touching Mizu 21's right wing, sharing
// the same lot ----
const TACO_BRICK_MAT = new THREE.MeshStandardMaterial({ color: "#c2a97e", roughness: 0.85 });
const TACO_SLAT_MAT = new THREE.MeshStandardMaterial({ color: "#1c1d20", roughness: 0.5, metalness: 0.2 });
const TACO_BOLLARD_MAT = new THREE.MeshStandardMaterial({ color: "#f0c419", roughness: 0.5 });
const LANE_LINE_MAT = new THREE.MeshBasicMaterial({ color: "#e8e4d8" });

// a real striped row: perpendicular divider lines only (no end caps) — the
// same convention as an ordinary strip-mall lot, matches the reference photo
const STALL_W = 3;
const STALL_D = 6;
const STALL_COUNT = 8;
const STALL_START_X = -12;
const STALL_ROW_Z = 26;

function ParkingRow() {
  const dividers = Array.from({ length: STALL_COUNT + 1 }, (_, i) => STALL_START_X + i * STALL_W);
  return (
    <group>
      {dividers.map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.03, STALL_ROW_Z]} material={STALL_LINE_MAT}>
          <planeGeometry args={[0.12, STALL_D]} />
        </mesh>
      ))}
    </group>
  );
}

// three parked cars, sitting still in stalls 1/3/6 — reuses the same
// CarMesh the player drives, just mounted with no RigidBody/physics
const PARKED = [
  { stall: 1, color: "#e8eaee", style: "gt" as const },
  { stall: 3, color: "#16171b", style: "roadster" as const },
  { stall: 6, color: "#1d5fd8", style: "gt" as const },
];

function ParkedCars() {
  return (
    <>
      {PARKED.map(({ stall, color, style }) => (
        <group key={stall} position={[STALL_START_X + STALL_W * (stall + 0.5), RIDE_HEIGHT, STALL_ROW_Z]}>
          <CarMesh color={color} style={style} detail="low" />
        </group>
      ))}
    </>
  );
}

// window bank with black mullions between panes — the tower's 2nd-floor
// row in the reference photo
function WindowBank({ count, w, y, z }: { count: number; w: number; y: number; z: number }) {
  const paneW = (w / count) * 0.72;
  const step = w / count;
  return (
    <group position={[0, y, z]}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[-w / 2 + step * (i + 0.5), 0, 0]} material={WINDOW_MAT}>
          <boxGeometry args={[paneW, 1.15, 0.05]} />
        </mesh>
      ))}
    </group>
  );
}

// dark louvered vent set into the gable end, arched cap on top — the two
// peak vents from the reference photo
function GableVent({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x, y, 0.06]}>
      <mesh material={TRIM_MAT}>
        <boxGeometry args={[0.5, 0.7, 0.04]} />
      </mesh>
      <mesh position={[0, 0.35, 0]} material={TRIM_MAT}>
        <circleGeometry args={[0.25, 12, 0, Math.PI]} />
      </mesh>
    </group>
  );
}

function PendantLight({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 2.55, z]} material={LAMP_MAT}>
      <sphereGeometry args={[0.09, 8, 8]} />
    </mesh>
  );
}

// Pushed the whole building this far back from the road/entry side so the
// lot in front of it reads as a real "sidepath -> parking -> storefront"
// strip-mall lot. Also TACO SPOT's depth line below.
const BACK = -34; // true limit: 2 units clear of the actual road pavement (worldX 140), not just the aesthetic random-building margin

// TACO SPOT — touches Mizu 21's right wing edge (local x=18) with zero gap,
// same depth line as the wings (flush "end of sidewalk" front), shares the
// one shared lot pad above. Fictional name/signage, not a real chain's.
// Plain one-colour walls per feedback (no band/stone/slat-array mix reading
// as a busy texture) — just the brick body + a plain flat awning.
const TX = 27; // 18 (Mizu's right wing edge) + 9 (half of TW) = flush touch
const TZ = BACK;
const TW = 18,
  TD = 8,
  TH = 4.8;

function TacoSpot() {
  return (
    <group position={[TX, 0, TZ]}>
      <mesh castShadow receiveShadow position={[0, TH / 2, 0]} material={TACO_BRICK_MAT}>
        <boxGeometry args={[TW, TH, TD]} />
      </mesh>
      <mesh position={[0, TH + 0.15, 0]} material={ROOF_MAT} castShadow>
        <boxGeometry args={[TW + 0.6, 0.3, TD + 0.6]} />
      </mesh>
      {/* one flat awning over the storefront windows, not a slat array */}
      <mesh position={[0, TH - 0.9, TD / 2 + 0.5]} rotation={[0.15, 0, 0]} material={TACO_SLAT_MAT} castShadow>
        <boxGeometry args={[TW - 2, 0.1, 1.2]} />
      </mesh>
      <WindowBank count={4} w={TW * 0.7} y={2.4} z={TD / 2 + 0.03} />
      <mesh position={[TW / 2 - 3, 1.6, TD / 2 + 0.05]} material={GLASS_DOOR_MAT}>
        <boxGeometry args={[2, 3.2, 0.06]} />
      </mesh>
      <mesh position={[0, 3.4, TD / 2 + 0.08]} material={SIGN_BOARD_MAT}>
        <boxGeometry args={[4.2, 0.8, 0.06]} />
      </mesh>
      <Text position={[0, 3.4, TD / 2 + 0.12]} fontSize={0.42} color="#f0e8d8" anchorX="center" anchorY="middle">
        TACO SPOT
      </Text>
      <mesh position={[TW / 2 - 0.9, 0.45, TD / 2 + 0.9]} castShadow material={TACO_BOLLARD_MAT}>
        <cylinderGeometry args={[0.14, 0.16, 0.9, 10]} />
      </mesh>
    </group>
  );
}

// drive-thru lane along TACO SPOT's outer flank (opposite side from Mizu).
// Kept entirely within z=[-38,-20]: -38 matches the building's own back edge
// (worldX 138, the same 2-clear-of-the-road-at-140 limit BACK was tuned
// against) and -20 is well short of the road on the other side — the
// previous version reached back to z=-46 (worldX 146), landing ON the road.
const LANE_X = 38;
const LANE_FRONT = -20;
const LANE_BACK = -38;
function DriveThru() {
  const mid = (LANE_FRONT + LANE_BACK) / 2;
  const len = LANE_FRONT - LANE_BACK;
  return (
    <group>
      {[LANE_X - 1.5, LANE_X + 1.5].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.03, mid]} material={LANE_LINE_MAT}>
          <planeGeometry args={[0.12, len]} />
        </mesh>
      ))}
      {Array.from({ length: 4 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[LANE_X, 0.03, LANE_BACK + 2 + i * 4]} material={LANE_LINE_MAT}>
          <planeGeometry args={[0.1, 1.6]} />
        </mesh>
      ))}
      <Text position={[LANE_X, 0.5, LANE_FRONT - 2]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.1} color="#e8e4d8" anchorX="center" anchorY="middle">
        DRIVE-THRU
      </Text>
      {/* menu board on a post, near the back of the lane */}
      <mesh position={[LANE_X - 1.5, 1.1, LANE_BACK + 2]} material={TRIM_MAT}>
        <boxGeometry args={[0.1, 0.1, 1.3]} />
      </mesh>
      <mesh position={[LANE_X - 1.5, 1.9, LANE_BACK + 2]} material={SIGN_BOARD_MAT}>
        <boxGeometry args={[0.1, 1.4, 1.8]} />
      </mesh>
      {/* order + pickup windows on TACO SPOT's outer wall */}
      {[LANE_BACK + 3, LANE_BACK + 7].map((z) => (
        <mesh key={z} position={[TX + TW / 2 + 0.03, 1.6, z]} rotation={[0, Math.PI / 2, 0]} material={GLASS_DOOR_MAT}>
          <boxGeometry args={[TD * 0.9, 1.6, 0.06]} />
        </mesh>
      ))}
    </group>
  );
}

export function MizuRestaurant() {
  // --- center entrance tower: 2-story, stone base, front gable, window bank ---
  const tw = 11,
    td = 11,
    th = 7.5,
    tz = 3 + BACK;
  const stoneH = 3.2;

  // --- left wing: single story, small front gable, covered walkway ---
  const lw = 9,
    ld = 8,
    lh = 4.6,
    lx = -9,
    lz = 0 + BACK;

  // --- right wing: longer single story, flat roof + dark fascia ---
  const rw = 17,
    rd = 8,
    rh2 = 4.8,
    rx = 9.5,
    rz = 0 + BACK;

  return (
    <group position={[MX, 0, MZ]} rotation={[0, FACING, 0]}>
      {/* parking lot pad + entry apron — stretched back to reach the
          relocated building with no gap, and widened to also cover TACO
          SPOT's frontage so the two buildings share one lot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[13, 0.02, 2.5]} receiveShadow material={ASPHALT_MAT}>
        <planeGeometry args={[60, 73]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, tz + td / 2 + 3]} receiveShadow>
        <planeGeometry args={[10, 6]} />
        <meshStandardMaterial color="#8a8a86" roughness={0.9} />
      </mesh>
      <ParkingRow />
      <ParkedCars />
      {/* two ADA spots, matching the reference photo's marked accessible parking */}
      {[-6, 6].map((sx) => (
        <group key={sx} position={[sx, 0, tz + td / 2 + 9]}>
          <mesh position={[0, 1.1, 0]} material={ADA_MAT}>
            <boxGeometry args={[0.5, 0.7, 0.04]} />
          </mesh>
          <mesh position={[0, 0.55, 0]} material={TRIM_MAT}>
            <cylinderGeometry args={[0.06, 0.06, 1.1, 6]} />
          </mesh>
        </group>
      ))}

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[tw / 2, th / 2, td / 2]} position={[0, th / 2, tz]} />
        <CuboidCollider args={[lw / 2, lh / 2, ld / 2]} position={[lx, lh / 2, lz]} />
        <CuboidCollider args={[rw / 2, rh2 / 2, rd / 2]} position={[rx, rh2 / 2, rz]} />
        <CuboidCollider args={[TW / 2, TH / 2, TD / 2]} position={[TX, TH / 2, TZ]} />
      </RigidBody>

      {/* ---------- center tower ---------- */}
      <group position={[0, 0, tz]}>
        <mesh castShadow receiveShadow position={[0, stoneH / 2, 0]} material={STONE_MAT}>
          <boxGeometry args={[tw, stoneH, td]} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, stoneH + (th - stoneH) / 2, 0]} material={SIDING_MAT}>
          <boxGeometry args={[tw, th - stoneH, td]} />
        </mesh>
        <mesh position={[0, th, 0]} geometry={GABLE_ROOF_GEO} material={ROOF_MAT} scale={[tw + 1, 5, td + 1]} castShadow />
        <GableVent x={-1.7} y={th + 1.6} />
        <GableVent x={1.7} y={th + 1.6} />

        <WindowBank count={6} w={tw * 0.82} y={5.6} z={td / 2 + 0.03} />

        {/* stone-tower glass double door + canopy + sign board */}
        <mesh position={[0, 1.6, td / 2 + 0.05]} material={GLASS_DOOR_MAT}>
          <boxGeometry args={[2.4, 3.2, 0.06]} />
        </mesh>
        <mesh position={[0, 3.35, td / 2 + 0.5]} material={TRIM_MAT} castShadow>
          <boxGeometry args={[3.4, 0.12, 1]} />
        </mesh>
        <mesh position={[0, 2.5, td / 2 + 0.08]} material={SIGN_BOARD_MAT}>
          <boxGeometry args={[3.6, 0.9, 0.06]} />
        </mesh>
        <Text position={[0, 2.5, td / 2 + 0.12]} fontSize={0.5} color="#f2c230" anchorX="center" anchorY="middle">
          MIZU 21
        </Text>
        {[-1.5, 1.5].map((sx) => (
          <group key={sx} position={[sx, 0, td / 2]}>
            <mesh position={[0, 2.2, 0.1]} material={TRIM_MAT}>
              <cylinderGeometry args={[0.03, 0.03, 0.3, 6]} />
            </mesh>
            <mesh position={[0, 2.05, 0.2]} material={LAMP_MAT}>
              <sphereGeometry args={[0.07, 8, 8]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ---------- left wing + covered walkway ---------- */}
      <group position={[lx, 0, lz]}>
        <mesh castShadow receiveShadow position={[0, lh / 2, 0]} material={SIDING_MAT}>
          <boxGeometry args={[lw, lh, ld]} />
        </mesh>
        <mesh position={[0, 0.15, 0]} material={STONE_MAT}>
          <boxGeometry args={[lw + 0.05, 0.3, ld + 0.05]} />
        </mesh>
        <mesh position={[0, lh, 0]} geometry={GABLE_ROOF_GEO} material={ROOF_MAT} scale={[lw + 0.8, 2.6, ld + 0.8]} castShadow />
        <WindowBank count={2} w={lw * 0.7} y={2.6} z={ld / 2 + 0.03} />
      </group>
      {/* canopy walkway running from the left wing toward the tower */}
      <mesh position={[-3.5, 2.7, lz + ld / 2 + 1.6]} material={TRIM_MAT} castShadow>
        <boxGeometry args={[12, 0.1, 3]} />
      </mesh>
      {[-8.5, -5.5, -2.5, 0.5].map((px) => (
        <mesh key={px} position={[px, 1.35, lz + ld / 2 + 2.9]} material={TRIM_MAT}>
          <cylinderGeometry args={[0.07, 0.07, 2.7, 6]} />
        </mesh>
      ))}
      {[-8, -5.5, -3, -0.5].map((px) => (
        <PendantLight key={px} x={px} z={lz + ld / 2 + 1.6} />
      ))}

      {/* ---------- right wing ---------- */}
      <group position={[rx, 0, rz]}>
        <mesh castShadow receiveShadow position={[0, rh2 / 2, 0]} material={SIDING_MAT}>
          <boxGeometry args={[rw, rh2, rd]} />
        </mesh>
        <mesh position={[0, 0.2, 0]} material={STONE_MAT}>
          <boxGeometry args={[rw + 0.05, 0.4, rd + 0.05]} />
        </mesh>
        {/* flat roof + dark fascia band, not a full gable — matches the low
            roofline along this wing in the reference photo */}
        <mesh position={[0, rh2 + 0.15, 0]} material={ROOF_MAT} castShadow>
          <boxGeometry args={[rw + 0.6, 0.3, rd + 0.6]} />
        </mesh>
        <WindowBank count={5} w={rw * 0.85} y={2.9} z={rd / 2 + 0.03} />
      </group>

      <TacoSpot />
      <DriveThru />
    </group>
  );
}
