"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

// POLICE HARBOR STATION — direct port of the original's station-house group
// (index.html ~line 5931-5972: pad, house, trim, door, sign, flanking
// beacon poles, painted parking bays), positioned at lib/landmarks.ts's
// corrected POLICE HARBOR coordinate (see that file's Milestone 11 comment
// for why it moved off the original's raw, unconverted x:450). Always
// mounted — City.tsx's LANDMARK_CHUNKS exemption already keeps random
// buildings off this spot automatically, same mechanism as every other
// landmark, now that the coordinate is a real on-land chunk.
const PX = 0;
const PZ = 50;
const PW = 64;
const PD = 40;

export function PoliceStation() {
  const beaconA = useRef<THREE.PointLight>(null);
  const beaconB = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const flashRed = Math.floor(state.clock.elapsedTime * 5) % 2 === 0;
    if (beaconA.current) beaconA.current.color.set(flashRed ? "#ff1818" : "#100000");
    if (beaconB.current) beaconB.current.color.set(flashRed ? "#0a1030" : "#2452ff");
  });

  return (
    <group position={[PX, 0, PZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <planeGeometry args={[PW, PD]} />
        <meshStandardMaterial color="#1a1c22" roughness={0.9} />
      </mesh>

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[13, 4.5, 8]} position={[0, 4.5, -11]} />
      </RigidBody>
      <mesh castShadow receiveShadow position={[0, 4.5, -11]}>
        <boxGeometry args={[26, 9, 16]} />
        <meshStandardMaterial color="#2a2e3a" roughness={0.7} />
      </mesh>
      <mesh position={[0, 8.9, -11]}>
        <boxGeometry args={[26.4, 0.6, 16.4]} />
        <meshBasicMaterial color="#2452ff" />
      </mesh>
      <mesh position={[0, 2.75, -2.95]}>
        <boxGeometry args={[4.2, 5.5, 0.2]} />
        <meshStandardMaterial color="#0c0e14" roughness={0.4} metalness={0.3} />
      </mesh>

      <Billboard position={[0, 10.6, -2.95]}>
        <Text fontSize={1.9} color="#4d78ff" outlineWidth={0.06} outlineColor="#07080c" anchorX="center" anchorY="middle">
          POLICE HARBOR STATION
        </Text>
      </Billboard>

      {/* flanking beacon poles — flash the same red/blue rig as PoliceCar's light bar */}
      {[-1, 1].map((sgn) => (
        <group key={sgn} position={[sgn * 6.5, 0, -2.9]}>
          <mesh position={[0, 2, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.15, 4, 8]} />
            <meshStandardMaterial color="#2a2d34" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 4.1, 0]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshBasicMaterial color="#ff1818" />
          </mesh>
          <mesh position={[0, 3.7, 0]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshBasicMaterial color="#2452ff" />
          </mesh>
          <pointLight ref={sgn === -1 ? beaconA : beaconB} position={[0, 3.9, 0]} intensity={1.4} distance={18} />
        </group>
      ))}

      {/* painted parking bays for the fleet */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-PW / 2 + 6 + i * ((PW - 12) / 6), 0.05, PD / 2 - 6]}>
          <planeGeometry args={[0.16, 7]} />
          <meshBasicMaterial color="#f4e39a" />
        </mesh>
      ))}
    </group>
  );
}
