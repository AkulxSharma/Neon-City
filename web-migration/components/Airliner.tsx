"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { FUSELAGE_TEX, CARGO_TEX, BURNT_FUSELAGE_TEX, repeat } from "@/lib/airportTextures";

// Wide-body commercial jet — the "mad huge next to a human" aircraft parked
// at and flying out of INTERNATIONAL AIRPORT (components/Airport.tsx).
// Deliberately built at real-airliner scale: 58m nose-to-tail, 56m span, tail
// tip ~16m up, against a 1.8m pedestrian (components/PersonFigure.tsx) and a
// ~4m car — so standing under one reads as standing under a building.
//
// Convention matches components/Plane.tsx: the model's nose points +Z, so a
// heading of h=0 flies +Z and the same yaw quaternion math applies.
//
// Variants: `livery` recolours tail/cheatline/cowls, `cargo` swaps the cabin
// window row for a freighter's main-deck door, `broken` is the one permanently
// grounded airframe under repair (missing starboard wing + engine, scorched
// skin, tail canted, sat on jacks instead of its right main gear).

export const AIRLINER_GROUND_Y = 5.4; // fuselage-centre height with the gear on the tarmac
export const AIRLINER_LEN = 58;

const FUS_R = 3.1;
const FUS_LEN = 44;

const SKIN_MAT = new THREE.MeshStandardMaterial({ map: repeat(FUSELAGE_TEX, 5, 1), metalness: 0.45, roughness: 0.3 });
const CARGO_SKIN_MAT = new THREE.MeshStandardMaterial({ map: repeat(CARGO_TEX, 5, 1), metalness: 0.4, roughness: 0.35 });
const BURNT_SKIN_MAT = new THREE.MeshStandardMaterial({ map: repeat(BURNT_FUSELAGE_TEX, 5, 1), metalness: 0.25, roughness: 0.72 });
const WING_MAT = new THREE.MeshStandardMaterial({ color: "#dfe4ea", metalness: 0.6, roughness: 0.28 });
const WING_BURNT_MAT = new THREE.MeshStandardMaterial({ color: "#9a968e", metalness: 0.2, roughness: 0.8 });
const DARK_MAT = new THREE.MeshStandardMaterial({ color: "#1b1e24", metalness: 0.7, roughness: 0.35 });
const TIRE_MAT = new THREE.MeshStandardMaterial({ color: "#101215", roughness: 0.95 });
const CHROME_MAT = new THREE.MeshStandardMaterial({ color: "#b9c0c9", metalness: 0.95, roughness: 0.18 });
const COCKPIT_MAT = new THREE.MeshStandardMaterial({
  color: "#121b26",
  metalness: 0.9,
  roughness: 0.05,
  transparent: true,
  opacity: 0.72,
});
const NAV_RED = new THREE.MeshBasicMaterial({ color: "#ff2a2a" });
const NAV_GREEN = new THREE.MeshBasicMaterial({ color: "#25ff62" });
const NAV_WHITE = new THREE.MeshBasicMaterial({ color: "#ffffff" });
const SCORCH_MAT = new THREE.MeshStandardMaterial({ color: "#17181b", roughness: 1 });

const LIVERY_MATS = new Map<string, THREE.MeshStandardMaterial>();
function livery(color: string) {
  let m = LIVERY_MATS.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.35 });
    LIVERY_MATS.set(color, m);
  }
  return m;
}

export const LIVERIES = ["#1b4f9c", "#c1272d", "#0f8a5f", "#e0a51c", "#5b2d8e", "#0d7fa8"];

function Wing({ side, mat, tipMat }: { side: 1 | -1; mat: THREE.Material; tipMat: THREE.Material }) {
  // swept trapezoidal wing faked with a rotated, tapered box + a winglet —
  // same "slanted box beats a hand-built BufferGeometry" call the rest of the
  // airport makes (see components/Airport.tsx's hangar roof panels).
  return (
    <group position={[side * 3, -1.2, -1]} rotation={[0, side * -0.36, side * 0.06]}>
      <mesh position={[side * 12, 0, 0]} material={mat} castShadow>
        <boxGeometry args={[25, 1.0, 9]} />
      </mesh>
      {/* outboard taper */}
      <mesh position={[side * 22, 0.15, 1.6]} rotation={[0, side * 0.12, 0]} material={mat} castShadow>
        <boxGeometry args={[8, 0.7, 5]} />
      </mesh>
      {/* winglet */}
      <mesh position={[side * 25.6, 2.1, 2.2]} rotation={[0, 0, side * 0.25]} material={tipMat} castShadow>
        <boxGeometry args={[0.5, 4.6, 3.4]} />
      </mesh>
      {/* flap track fairings under the trailing edge */}
      {[7, 13, 19].map((d) => (
        <mesh key={d} position={[side * d, -0.7, -4.4]} material={DARK_MAT}>
          <boxGeometry args={[1.1, 0.9, 3.4]} />
        </mesh>
      ))}
      <mesh position={[side * 26.2, 0.1, 0]} material={side === 1 ? NAV_GREEN : NAV_RED}>
        <sphereGeometry args={[0.3, 8, 8]} />
      </mesh>
    </group>
  );
}

function Engine({ side, cowl }: { side: 1 | -1; cowl: THREE.Material }) {
  return (
    <group position={[side * 13.5, -3.6, 3.5]}>
      {/* pylon up to the wing */}
      <mesh position={[0, 2.2, -0.6]} material={WING_MAT}>
        <boxGeometry args={[0.8, 3.2, 5]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={CHROME_MAT} castShadow>
        <cylinderGeometry args={[2.35, 2.15, 9.5, 20]} />
      </mesh>
      {/* painted cowl ring + dark intake + fan face */}
      <mesh position={[0, 0, 4.5]} rotation={[Math.PI / 2, 0, 0]} material={cowl}>
        <cylinderGeometry args={[2.45, 2.4, 1.2, 20]} />
      </mesh>
      <mesh position={[0, 0, 4.0]} rotation={[Math.PI / 2, 0, 0]} material={DARK_MAT}>
        <cylinderGeometry args={[2.05, 2.05, 0.6, 20]} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[0, 0, 3.9]} rotation={[0, 0, (i * Math.PI) / 5]} material={CHROME_MAT}>
          <boxGeometry args={[0.22, 3.9, 0.1]} />
        </mesh>
      ))}
      {/* exhaust nozzle */}
      <mesh position={[0, 0, -5.1]} rotation={[Math.PI / 2, 0, 0]} material={DARK_MAT}>
        <cylinderGeometry args={[1.5, 1.7, 1.6, 18]} />
      </mesh>
    </group>
  );
}

// Main-gear bogie: strut + a 4-wheel truck, sized so the tyres come up past a
// pedestrian's waist — the detail that sells the scale from the ground.
function MainGear({ x }: { x: number }) {
  return (
    <group position={[x, 0, -3]}>
      <mesh position={[0, -(AIRLINER_GROUND_Y - 1.35) / 2 - 1.5, 0]} material={CHROME_MAT}>
        <cylinderGeometry args={[0.42, 0.5, AIRLINER_GROUND_Y - 1.35 + 1.4, 10]} />
      </mesh>
      {[1.6, -1.6].map((dz) =>
        [1, -1].map((s) => (
          <mesh
            key={`${dz}:${s}`}
            position={[s * 0.95, -AIRLINER_GROUND_Y + 1.35, dz]}
            rotation={[0, 0, Math.PI / 2]}
            material={TIRE_MAT}
            castShadow
          >
            <cylinderGeometry args={[1.35, 1.35, 0.62, 16]} />
          </mesh>
        ))
      )}
    </group>
  );
}

function NoseGear() {
  return (
    <group position={[0, 0, 15]}>
      <mesh position={[0, -(AIRLINER_GROUND_Y - 0.95) / 2 - 1.2, 0]} material={CHROME_MAT}>
        <cylinderGeometry args={[0.3, 0.36, AIRLINER_GROUND_Y - 0.95 + 1.2, 10]} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh
          key={s}
          position={[s * 0.55, -AIRLINER_GROUND_Y + 0.95, 0]}
          rotation={[0, 0, Math.PI / 2]}
          material={TIRE_MAT}
          castShadow
        >
          <cylinderGeometry args={[0.95, 0.95, 0.5, 14]} />
        </mesh>
      ))}
      <mesh position={[0, -AIRLINER_GROUND_Y + 1.6, 0.6]} material={NAV_WHITE}>
        <sphereGeometry args={[0.28, 8, 8]} />
      </mesh>
    </group>
  );
}

export function AirlinerMesh({
  liveryColor = "#1b4f9c",
  cargo = false,
  broken = false,
}: {
  liveryColor?: string;
  cargo?: boolean;
  broken?: boolean;
}) {
  const fusGeo = useMemo(() => new THREE.CylinderGeometry(FUS_R, FUS_R, FUS_LEN, 22).rotateX(Math.PI / 2), []);
  const skin = broken ? BURNT_SKIN_MAT : cargo ? CARGO_SKIN_MAT : SKIN_MAT;
  const wingMat = broken ? WING_BURNT_MAT : WING_MAT;
  const paint = broken ? SCORCH_MAT : livery(liveryColor);

  return (
    <group>
      {/* fuselage barrel */}
      <mesh geometry={fusGeo} material={skin} castShadow receiveShadow />
      {/* nose */}
      <mesh position={[0, -0.15, 22]} scale={[1, 0.95, 2.1]} material={skin} castShadow>
        <sphereGeometry args={[FUS_R, 20, 14]} />
      </mesh>
      <mesh position={[0, 1.35, 24.2]} rotation={[0.22, 0, 0]} material={COCKPIT_MAT}>
        <boxGeometry args={[4.0, 1.5, 3.2]} />
      </mesh>
      {/* upswept tail cone */}
      <mesh position={[0, 1.5, -28]} rotation={[Math.PI / 2 - 0.1, 0, 0]} material={skin} castShadow>
        <cylinderGeometry args={[0.55, FUS_R, 14, 20]} />
      </mesh>
      {/* cheatline down the fuselage side */}
      {!broken &&
        [1, -1].map((s) => (
          <mesh key={s} position={[s * FUS_R * 0.98, -0.6, -2]} material={paint}>
            <boxGeometry args={[0.12, 1.5, 48]} />
          </mesh>
        ))}
      {/* belly fairing (wing box) */}
      <mesh position={[0, -2.7, -1]} material={wingMat} castShadow>
        <boxGeometry args={[6.6, 2.6, 22]} />
      </mesh>

      {/* wings + engines — the broken airframe is missing its starboard pair */}
      <Wing side={-1} mat={wingMat} tipMat={paint} />
      <Engine side={-1} cowl={paint} />
      {!broken && <Wing side={1} mat={wingMat} tipMat={paint} />}
      {!broken && <Engine side={1} cowl={paint} />}
      {broken && (
        <>
          {/* torn wing root stub + exposed spar where the wing came off */}
          <mesh position={[6.5, -1.4, -1]} rotation={[0, -0.3, 0.08]} material={WING_BURNT_MAT} castShadow>
            <boxGeometry args={[7, 0.9, 8.4]} />
          </mesh>
          {[-2.4, 0, 2.4].map((dz) => (
            <mesh key={dz} position={[10.6, -1.3, dz - 1]} material={DARK_MAT}>
              <boxGeometry args={[1.6, 0.5, 0.5]} />
            </mesh>
          ))}
          <mesh position={[9.5, -1.4, -1]} material={SCORCH_MAT}>
            <boxGeometry args={[0.4, 1.4, 8.6]} />
          </mesh>
        </>
      )}

      {/* empennage: fin + stabilizers (fin canted on the broken airframe) */}
      <group position={[0, 4.6, -25]} rotation={[0, 0, broken ? 0.22 : 0]}>
        <mesh position={[0, 5.4, -1.5]} rotation={[-0.42, 0, 0]} material={paint} castShadow>
          <boxGeometry args={[0.9, 13, 8]} />
        </mesh>
        <mesh position={[0, 11.4, -4.4]} material={NAV_WHITE}>
          <sphereGeometry args={[0.3, 8, 8]} />
        </mesh>
      </group>
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 6.5, 2.6, -27]} rotation={[0, s * -0.22, s * 0.05]} material={wingMat} castShadow>
          <boxGeometry args={[11, 0.6, 5.6]} />
        </mesh>
      ))}

      {/* gear — broken jet sits on a jack stand where its right bogie was */}
      <NoseGear />
      <MainGear x={-5.2} />
      {broken ? (
        <group position={[5.2, 0, -3]}>
          <mesh position={[0, -AIRLINER_GROUND_Y / 2, 0]} material={livery("#e0a51c")}>
            <cylinderGeometry args={[0.35, 1.5, AIRLINER_GROUND_Y, 8]} />
          </mesh>
        </group>
      ) : (
        <MainGear x={5.2} />
      )}

      {/* strobes/beacons */}
      <mesh position={[0, -FUS_R - 0.1, 6]} material={NAV_RED}>
        <sphereGeometry args={[0.28, 8, 8]} />
      </mesh>
      <mesh position={[0, FUS_R + 0.1, 4]} material={NAV_RED}>
        <sphereGeometry args={[0.28, 8, 8]} />
      </mesh>
    </group>
  );
}
