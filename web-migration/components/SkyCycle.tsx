"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Exact colors from the original index.html (`cDay`/`cNight`/`cDusk`, tick()'s
// updateDayNight). Kept as a module-level mutable object (not React state) so
// other components — buildings, neon signs, headlights — can read the current
// night factor inside their own useFrame without subscribing/re-rendering.
const DAY = new THREE.Color(0x7ec4f2);
const NIGHT = new THREE.Color(0x05070f);

export const skyState = { nightK: 1 };

export function SkyCycle() {
  const { scene } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  // start at night — the original's signature look, and the one every
  // screenshot in this migration has been judged against
  const t = useRef(-Math.PI / 2);

  useFrame((_, dt) => {
    t.current += dt * 0.015; // one full cycle every ~7 minutes
    const dayK = (Math.sin(t.current) + 1) / 2;
    skyState.nightK = 1 - dayK;
    const col = NIGHT.clone().lerp(DAY, dayK);
    if (!scene.background || !(scene.background as THREE.Color).equals) {
      scene.background = col;
    } else {
      (scene.background as THREE.Color).copy(col);
    }
    if (!scene.fog) scene.fog = new THREE.Fog(col, 60, 260);
    (scene.fog as THREE.Fog).color.copy(col);
    if (sunRef.current) sunRef.current.intensity = 0.15 + dayK * 1.1;
    if (ambientRef.current) ambientRef.current.intensity = 0.18 + dayK * 0.5;
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.18} />
      <directionalLight ref={sunRef} position={[60, 80, 30]} castShadow intensity={0.15} />
    </>
  );
}
