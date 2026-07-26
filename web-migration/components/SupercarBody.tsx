"use client";

import * as THREE from "three";

// Shared supercar bodywork, used by every four-wheeler in the game
// (components/Car.tsx's player sedan + Traffic.tsx's NPCs via CarMesh, and
// components/PoliceCar.tsx's interceptor). One wedge chassis, three roofline
// styles, so a street of traffic reads as different cars rather than the same
// box in different colours.
//
// Everything below is module-scope shared geometry + a per-colour material
// cache: with a dozen traffic cars on screen at ~40 meshes each, allocating a
// fresh material per mesh (what the old JSX-material-element approach did)
// meant hundreds of redundant GPU programs. Same "bake once, share
// everywhere" rule City.tsx follows for facades.

const paintCache = new Map<string, THREE.MeshStandardMaterial>();
function paint(color: string) {
  let m = paintCache.get(color);
  if (!m) {
    // high metalness + low roughness = clearcoat-ish supercar paint that
    // actually catches the neon/streetlight instead of reading as flat plastic
    m = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.25 });
    paintCache.set(color, m);
  }
  return m;
}

const CARBON = new THREE.MeshStandardMaterial({ color: "#0d0f13", metalness: 0.5, roughness: 0.42 });
const GLASS = new THREE.MeshStandardMaterial({
  color: "#16212e",
  metalness: 0.9,
  roughness: 0.04,
  transparent: true,
  opacity: 0.62,
});
const TIRE = new THREE.MeshStandardMaterial({ color: "#121316", roughness: 0.92 });
const RIM = new THREE.MeshStandardMaterial({ color: "#c2c7d0", metalness: 0.95, roughness: 0.2 });
const CALIPER = new THREE.MeshStandardMaterial({ color: "#d8451f", roughness: 0.45 });
const CHROME = new THREE.MeshStandardMaterial({ color: "#23262d", metalness: 0.95, roughness: 0.24 });
const HEADLIGHT = new THREE.MeshBasicMaterial({ color: "#eaf2ff" });
const TAILLIGHT = new THREE.MeshBasicMaterial({ color: "#ff2b2b" });
const SKIN = new THREE.MeshLambertMaterial({ color: "#d9a066" });

// Distance from the body group's origin DOWN to the tyre contact patch: the
// wheels hang at y = -0.62 with a 0.36 tyre radius. Nothing in the group is
// authored around a centred origin, so any consumer that wants the car to sit
// ON the road has to place the group this far above it — a collider centred on
// the origin instead buries the car by (RIDE_HEIGHT - halfHeight).
export const RIDE_HEIGHT = 0.98;

// wheel geometry is built once and pre-rotated onto the car's x (axle) axis,
// same trick City.tsx uses for HIP_ROOF_GEO
const TIRE_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 20).rotateZ(Math.PI / 2);
const RIM_GEO = new THREE.CylinderGeometry(0.235, 0.235, 0.31, 18).rotateZ(Math.PI / 2);
const HUB_GEO = new THREE.CylinderGeometry(0.08, 0.08, 0.33, 12).rotateZ(Math.PI / 2);
const SPOKE_GEO = new THREE.BoxGeometry(0.05, 0.42, 0.07);
const SPOKE_ANGLES = [0, 1, 2, 3, 4].map((i) => (i * Math.PI * 2) / 5);

// A real alloy: tire + dished rim + 5 spokes + a brake caliper peeking
// through. Skipped entirely at low detail (traffic cars are never seen close
// enough for a spoke to be more than a pixel).
function Wheel({ x, z, width, detail }: { x: number; z: number; width: number; detail: Detail }) {
  const sx = width / 0.3;
  return (
    <group position={[x, -0.62, z]}>
      <mesh geometry={TIRE_GEO} material={TIRE} scale={[sx, 1, 1]} castShadow />
      {detail === "high" && (
        <>
          <mesh geometry={RIM_GEO} material={RIM} scale={[sx, 1, 1]} />
          {SPOKE_ANGLES.map((a, i) => (
            <mesh key={i} geometry={SPOKE_GEO} material={RIM} rotation={[a, 0, 0]} scale={[sx, 1, 1]} />
          ))}
          <mesh geometry={HUB_GEO} material={CHROME} scale={[sx, 1, 1]} />
          <mesh position={[0, 0.16, 0.02]} material={CALIPER}>
            <boxGeometry args={[0.06, 0.15, 0.09]} />
          </mesh>
        </>
      )}
    </group>
  );
}

// Torso + head only — everything below the beltline sits under the dash and
// is never visible through the glass, so there is nothing to model there.
function Occupant({ x, shirt }: { x: number; shirt: string }) {
  return (
    <group position={[x, 0, -0.4]}>
      <mesh position={[0, -0.46, 0]} castShadow>
        <boxGeometry args={[0.34, 0.3, 0.3]} />
        <meshLambertMaterial color={shirt} />
      </mesh>
      <mesh position={[0, -0.19, 0.02]} material={SKIN} castShadow>
        <sphereGeometry args={[0.12, 12, 12]} />
      </mesh>
    </group>
  );
}

export type CarStyle = "gt" | "hyper" | "roadster";
export type Detail = "high" | "low";

// Deterministic style pick so a given traffic lane always renders the same
// car rather than reshuffling on every remount.
export function styleFor(seed: number): CarStyle {
  return (["gt", "hyper", "roadster"] as const)[Math.abs(Math.round(seed)) % 3];
}

export function SupercarBody({
  color,
  style = "gt",
  detail = "high",
  children,
}: {
  color: string;
  style?: CarStyle;
  detail?: Detail;
  children?: React.ReactNode;
}) {
  const body = paint(color);
  const high = detail === "high";
  const open = style === "roadster"; // no fixed roof / rear glass

  return (
    <group>
      {/* ---- lower chassis: one low wide tub, the car's real mass ---- */}
      <mesh position={[0, -0.6, 0]} material={body} castShadow receiveShadow>
        <boxGeometry args={[1.78, 0.3, 3.5]} />
      </mesh>
      {/* rocker/side skirts — carbon, and what makes the car read as LOW */}
      <mesh position={[0, -0.84, -0.1]} material={CARBON} castShadow>
        <boxGeometry args={[1.9, 0.1, 2.2]} />
      </mesh>

      {/* ---- front: dropped wedge nose + splitter ---- */}
      <mesh position={[0, -0.66, 1.72]} rotation={[-0.09, 0, 0]} material={body} castShadow>
        <boxGeometry args={[1.7, 0.26, 1.55]} />
      </mesh>
      <mesh position={[0, -0.87, 2.16]} material={CARBON} castShadow>
        <boxGeometry args={[1.8, 0.05, 0.62]} />
      </mesh>
      {high && (
        // hood vent — the gap between nose and cowl, blacked out
        <mesh position={[0, -0.51, 1.55]} material={CARBON}>
          <boxGeometry args={[0.92, 0.03, 0.55]} />
        </mesh>
      )}

      {/* ---- cowl rising into the cabin ---- */}
      <mesh position={[0, -0.38, 0.6]} material={body} castShadow>
        <boxGeometry args={[1.62, 0.24, 1.35]} />
      </mesh>

      {/* ---- rear haunches: widest point of the car, over the back wheels ---- */}
      <mesh position={[0, -0.46, -1.25]} material={body} castShadow>
        <boxGeometry args={[1.86, 0.36, 1.55]} />
      </mesh>
      {/* engine cover / rear deck */}
      <mesh position={[0, -0.27, -1.15]} material={CARBON} castShadow>
        <boxGeometry args={[1.5, 0.1, 1.0]} />
      </mesh>

      {/* ---- fender flares over each wheel ---- */}
      {[1, -1].map((s) => (
        <group key={`fl-${s}`}>
          <mesh position={[s * 0.87, -0.55, 1.55]} material={body} castShadow>
            <boxGeometry args={[0.16, 0.3, 1.05]} />
          </mesh>
          <mesh position={[s * 0.91, -0.5, -1.5]} material={body} castShadow>
            <boxGeometry args={[0.16, 0.34, 1.15]} />
          </mesh>
          {/* side intake ahead of the rear wheel — the signature mid-engine cue */}
          <mesh position={[s * 0.87, -0.44, -0.5]} material={CARBON} castShadow>
            <boxGeometry args={[0.14, 0.26, 0.72]} />
          </mesh>
          <mesh position={[s * 0.79, -0.44, -0.5]} material={body}>
            <boxGeometry args={[0.06, 0.2, 0.52]} />
          </mesh>
        </group>
      ))}

      {/* ---- glasshouse ---- */}
      {!open && (
        <>
          <mesh position={[0, -0.16, -0.18]} material={body} castShadow>
            <boxGeometry args={[1.42, 0.26, 1.3]} />
          </mesh>
          <mesh position={[0, -0.02, -0.34]} material={body} castShadow>
            <boxGeometry args={[1.16, 0.07, 0.98]} />
          </mesh>
          <mesh position={[0, -0.14, -0.92]} rotation={[-0.7, 0, 0]} material={GLASS}>
            <boxGeometry args={[1.16, 0.36, 0.04]} />
          </mesh>
          {[0.72, -0.72].map((x) => (
            <mesh key={`sg${x}`} position={[x, -0.14, -0.25]} material={GLASS}>
              <boxGeometry args={[0.03, 0.22, 1.1]} />
            </mesh>
          ))}
        </>
      )}
      {open && (
        // roadster: twin roll hoops instead of a roof
        <>
          {[0.42, -0.42].map((x) => (
            <mesh key={`rh${x}`} position={[x, -0.16, -0.62]} material={CHROME} castShadow>
              <boxGeometry args={[0.12, 0.34, 0.12]} />
            </mesh>
          ))}
        </>
      )}
      {/* raked windshield — present on every style */}
      <mesh position={[0, -0.17, 0.56]} rotation={[0.75, 0, 0]} material={GLASS}>
        <boxGeometry args={[1.28, 0.54, 0.05]} />
      </mesh>

      {/* ---- aero: style-specific rear ---- */}
      {style === "hyper" && (
        <>
          {[0.62, -0.62].map((x) => (
            <mesh key={`wu${x}`} position={[x, -0.12, -2.02]} material={CARBON} castShadow>
              <boxGeometry args={[0.06, 0.32, 0.18]} />
            </mesh>
          ))}
          <mesh position={[0, 0.06, -2.06]} rotation={[0.13, 0, 0]} material={CARBON} castShadow>
            <boxGeometry args={[1.56, 0.05, 0.38]} />
          </mesh>
        </>
      )}
      {style === "gt" && (
        <mesh position={[0, -0.22, -1.92]} rotation={[0.2, 0, 0]} material={body} castShadow>
          <boxGeometry args={[1.62, 0.07, 0.34]} />
        </mesh>
      )}

      {/* ---- rear diffuser + quad exhaust ---- */}
      <mesh position={[0, -0.79, -2.02]} material={CARBON} castShadow>
        <boxGeometry args={[1.62, 0.26, 0.5]} />
      </mesh>
      {high &&
        [-0.5, -0.17, 0.17, 0.5].map((x) => (
          <mesh key={`df${x}`} position={[x, -0.8, -2.16]} material={CHROME}>
            <boxGeometry args={[0.04, 0.22, 0.3]} />
          </mesh>
        ))}
      {[0.26, -0.26].map((x) => (
        <mesh key={`ex${x}`} position={[x, -0.66, -2.24]} rotation={[Math.PI / 2, 0, 0]} material={CHROME}>
          <cylinderGeometry args={[0.075, 0.075, 0.18, 10]} />
        </mesh>
      ))}

      {/* ---- lighting: slim angled LED strips, full-width tail bar ---- */}
      {[1, -1].map((s) => (
        <mesh key={`hl${s}`} position={[s * 0.55, -0.55, 2.32]} rotation={[0, 0, s * 0.14]} material={HEADLIGHT}>
          <boxGeometry args={[0.46, 0.075, 0.06]} />
        </mesh>
      ))}
      <mesh position={[0, -0.4, -2.2]} material={TAILLIGHT}>
        <boxGeometry args={[1.46, 0.07, 0.05]} />
      </mesh>
      {high &&
        [1, -1].map((s) => (
          <mesh key={`bl${s}`} position={[s * 0.5, -0.55, -2.18]} material={TAILLIGHT}>
            <boxGeometry args={[0.22, 0.06, 0.04]} />
          </mesh>
        ))}

      {/* ---- mirrors, door cut, interior ---- */}
      {high &&
        [1, -1].map((s) => (
          <group key={`mir${s}`}>
            <mesh position={[s * 0.86, -0.18, 0.6]} material={CARBON}>
              <boxGeometry args={[0.16, 0.03, 0.03]} />
            </mesh>
            <mesh position={[s * 0.95, -0.17, 0.6]} material={CHROME} castShadow>
              <boxGeometry args={[0.05, 0.11, 0.15]} />
            </mesh>
            {/* scissor-door cut line, raked forward like the real thing */}
            <mesh position={[s * 0.94, -0.4, 0.08]} rotation={[0, 0, 0.22]} material={CARBON}>
              <boxGeometry args={[0.02, 0.5, 0.04]} />
            </mesh>
            <mesh position={[s * 0.95, -0.3, -0.45]} material={CHROME}>
              <boxGeometry args={[0.04, 0.05, 0.22]} />
            </mesh>
          </group>
        ))}
      {high && (
        <>
          <mesh position={[0, -0.34, 0.5]} material={CARBON}>
            <boxGeometry args={[1.3, 0.12, 0.34]} />
          </mesh>
          <mesh position={[0.38, -0.29, 0.3]} rotation={[Math.PI / 2 + 0.32, 0, 0]} material={CHROME}>
            <torusGeometry args={[0.14, 0.022, 8, 16]} />
          </mesh>
          {[0.38, -0.38].map((x) => (
            <mesh key={`seat${x}`} position={[x, -0.44, -0.62]} material={CARBON} castShadow>
              <boxGeometry args={[0.38, 0.36, 0.08]} />
            </mesh>
          ))}
          <Occupant x={0.38} shirt="#232a3a" />
          <Occupant x={-0.38} shirt="#5a2a30" />
        </>
      )}

      <Wheel x={0.8} z={1.55} width={0.28} detail={detail} />
      <Wheel x={-0.8} z={1.55} width={0.28} detail={detail} />
      <Wheel x={0.8} z={-1.55} width={0.34} detail={detail} />
      <Wheel x={-0.8} z={-1.55} width={0.34} detail={detail} />

      {children}
    </group>
  );
}
