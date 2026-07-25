"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { useHudStore } from "@/lib/hudStore";
import { CLUB_IN } from "@/lib/club";

const W = 44;
const D = 30;
const H = 7;

const CROWD_COLORS = ["#ff2f8a", "#2fe9ff", "#ffd12f", "#b06bff", "#2fff8a", "#ff8a2f", "#8affd1"];

// ponytail: the original's ~40 individually-rigged (arms/legs/torso) dancers
// are cut to a small set of bobbing/swaying blobs — reads as a crowd from
// driving distance without per-limb IK. Upgrade to real rigs if an on-foot
// mode ever gets close enough to notice.
const CROWD = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const r = i < 6 ? 3 + (i % 2) * 1.5 : 7.5 + (i % 3);
  return {
    x: Math.cos(a) * r,
    z: 1 + Math.sin(a) * r,
    color: CROWD_COLORS[i % CROWD_COLORS.length],
    ph: i * 0.9,
  };
});

const SPOT_COLORS = [0xff3fd6, 0x2fe9ff, 0xb06bff];

// VENU interior — a real place in the world at CLUB_IN, not an overlay scene
// (see lib/club.ts). Rendered only while inClub so it costs nothing outside
// the club. Geometry is a trimmed port of the original's interior group:
// floor/walls/stage/DJ booth/disco ball/spotlights/lasers/crowd, minus the
// bar/bottle-shelf/VIP-couch/pole-dancer set dressing (visual-only detail,
// cut for scope — see SUMMARY.md).
export function ClubInterior() {
  const inClub = useHudStore((s) => s.inClub);
  const discoRef = useRef<THREE.Mesh>(null);
  const floorMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const spotRefs = useRef<(THREE.PointLight | null)[]>([]);
  const laserRefs = useRef<(THREE.Mesh | null)[]>([]);
  const crowdRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((state, dt) => {
    if (!inClub) return;
    const time = state.clock.elapsedTime;
    const bps = 130 / 60;
    const beat = Math.pow(Math.max(0, Math.sin(time * Math.PI * 2 * bps)), 8);

    if (discoRef.current) discoRef.current.rotation.y += dt * 2.4;
    if (floorMatRef.current) floorMatRef.current.emissiveIntensity = 0.5 + 0.5 * Math.sin(time * 7) + beat * 1.5;

    spotRefs.current.forEach((L, i) => {
      if (!L) return;
      const a = time * 2 + i * 2.09;
      L.position.set(Math.cos(a) * 11, 4.8, 1 + Math.sin(a * 1.3) * 6.5);
      L.intensity = 1.8 + Math.sin(time * 9 + i) * 0.8 + beat * 1.2;
      L.color.setHSL((time * 0.15 + i * 0.34) % 1, 0.9, 0.55);
    });
    laserRefs.current.forEach((b, i) => {
      if (!b) return;
      b.rotation.z = Math.sin(time * 2.3 + i * 1.3) * 1.2;
      b.rotation.x = Math.cos(time * 1.8 + i) * 0.75;
      (b.material as THREE.MeshBasicMaterial).opacity = 0.14 + 0.16 * Math.sin(time * 12 + i * 2) + beat * 0.18;
    });
    crowdRefs.current.forEach((g, i) => {
      if (!g) return;
      const t2 = time * bps * Math.PI * 2 + CROWD[i].ph;
      g.position.y = Math.abs(Math.sin(t2)) * 0.15 + beat * 0.05;
      g.rotation.y = Math.sin(t2 * 0.5) * 0.6;
    });
  });

  if (!inClub) return null;

  const IN = CLUB_IN;
  const wallMat = <meshStandardMaterial color="#181022" roughness={0.8} />;

  return (
    <group position={[IN.x, 0, IN.z]}>
      {/* floor + walls + ceiling, walls solid so driving can't clip through */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#0e0c14" roughness={0.25} metalness={0.5} />
      </mesh>
      <mesh position={[0, H + 0.25, 0]}>
        <boxGeometry args={[W, 0.5, D]} />
        {wallMat}
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2, H / 2, 0.5]} position={[0, H / 2, -D / 2]} />
        <CuboidCollider args={[W / 2, H / 2, 0.5]} position={[0, H / 2, D / 2]} />
        <CuboidCollider args={[0.5, H / 2, D / 2]} position={[-W / 2, H / 2, 0]} />
        <CuboidCollider args={[0.5, H / 2, D / 2]} position={[W / 2, H / 2, 0]} />
      </RigidBody>
      {[
        [W, H, 1, 0, H / 2, -D / 2],
        [W, H, 1, 0, H / 2, D / 2],
        [1, H, D, -W / 2, H / 2, 0],
        [1, H, D, W / 2, H / 2, 0],
      ].map((p, i) => (
        <mesh key={i} position={[p[3], p[4], p[5]]} castShadow receiveShadow>
          <boxGeometry args={[p[0], p[1], p[2]]} />
          {wallMat}
        </mesh>
      ))}

      {/* lit checker dance floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 1]}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial
          ref={floorMatRef}
          color="#222222"
          emissive={new THREE.Color("#ffffff")}
          emissiveIntensity={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* stage + DJ booth */}
      <mesh position={[0, 0.45, -D / 2 + 3]} castShadow>
        <boxGeometry args={[13, 0.9, 5]} />
        <meshStandardMaterial color="#241a30" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.92, -D / 2 + 3]}>
        <boxGeometry args={[13.2, 0.1, 5.2]} />
        <meshBasicMaterial color="#ff3fd6" />
      </mesh>
      <mesh position={[-9, 0.65, -D / 2 + 4]} castShadow>
        <boxGeometry args={[3, 1.3, 1.6]} />
        <meshStandardMaterial color="#101018" roughness={0.4} emissive="#2fe9ff" emissiveIntensity={0.15} />
      </mesh>

      {/* disco ball + moving spotlights + lasers */}
      <mesh ref={discoRef} position={[0, 5.6, 1]}>
        <sphereGeometry args={[0.9, 18, 14]} />
        <meshStandardMaterial color="#eeeeff" metalness={1} roughness={0.08} />
      </mesh>
      {SPOT_COLORS.map((col, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            spotRefs.current[i] = el;
          }}
          color={col}
          intensity={1.6}
          distance={34}
          position={[0, 5, 0]}
        />
      ))}
      <pointLight color="#8a6aff" intensity={0.6} distance={50} position={[0, 4, 6]} />
      {[-9, -6, -3, 0, 3, 6, 9, -1].map((ox, i) => (
        <mesh
          key={i}
          ref={(el) => {
            laserRefs.current[i] = el;
          }}
          position={[ox, 6.4, 1]}
        >
          <coneGeometry args={[0.9, 9, 10, 1, true]} />
          <meshBasicMaterial
            color={["#ff3fd6", "#2fe9ff", "#2fff8a", "#b06bff", "#ff8a2f", "#8affd1", "#ffd12f", "#ff2f8a"][i]}
            transparent
            opacity={0.2}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* crowd */}
      {CROWD.map((p, i) => (
        <group
          key={i}
          ref={(el) => {
            crowdRefs.current[i] = el;
          }}
          position={[p.x, 0, p.z]}
        >
          <mesh position={[0, 0.55, 0]} castShadow={false}>
            <capsuleGeometry args={[0.18, 0.7, 4, 8]} />
            <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={0.25} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.05, 0]}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial color="#d9a066" roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* exit door + sign */}
      <mesh position={[0, 2.2, D / 2 - 0.55]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[3, 4.4]} />
        <meshBasicMaterial color="#9a4fff" />
      </mesh>
      <mesh position={[0, 5, D / 2 - 0.56]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2, 1]} />
        <meshBasicMaterial color="#12aa44" />
      </mesh>
    </group>
  );
}
