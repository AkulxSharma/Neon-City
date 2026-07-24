"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const DAY = new THREE.Color("#8fd3ff");
const NIGHT = new THREE.Color("#050814");

// Minimal day/night cycle (Phase 0 parity item) — slow color lerp on the
// background/fog plus sun intensity. The original's full version also drove
// building emissive maps and a bloom pass; those come back once buildings do.
export function SkyCycle() {
  const { scene } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const t = useRef(0);

  useFrame((_, dt) => {
    t.current += dt * 0.02; // one full cycle every ~5 minutes
    const dayK = (Math.sin(t.current) + 1) / 2;
    const col = NIGHT.clone().lerp(DAY, dayK);
    if (!scene.background || !(scene.background as THREE.Color).equals) {
      scene.background = col;
    } else {
      (scene.background as THREE.Color).copy(col);
    }
    if (!scene.fog) scene.fog = new THREE.Fog(col, 60, 260);
    (scene.fog as THREE.Fog).color.copy(col);
    if (sunRef.current) sunRef.current.intensity = 0.15 + dayK * 1.1;
  });

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight ref={sunRef} position={[60, 80, 30]} castShadow intensity={0.6} />
    </>
  );
}
