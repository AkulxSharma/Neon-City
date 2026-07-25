"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useHudStore } from "@/lib/hudStore";
import { skyState } from "@/lib/skyState";
import { loadSave } from "@/lib/saveGame";

// Exact colors/values from the original index.html's updateDayNight() (~line
// 6993-7040) and its renderer/light setup (~line 3548-3582) — this file had
// drifted from those: a flat AmbientLight instead of the original's sky/
// ground HemisphereLight, no fillLight at all, a sun that never changes
// color, and toneMappingExposure left at the R3F default (1.0) instead of
// the original's always-boosted 1.08-1.26. That gap, not a deliberately
// different look, is why night driving reads near-black — this restores the
// original's actual numbers. (The original derives its dayK/nightK from a
// true sun-elevation angle; this still drives off the existing sine-phase
// dayK/nightK below rather than rebuilding that — same numbers, simpler
// driver, see SUMMARY.md for what's still worth tightening later.)
const DAY = new THREE.Color(0x7ec4f2);
const NIGHT = new THREE.Color(0x05070f);
const SUN_NIGHT = new THREE.Color(0x7d8fc8); // original's moonlight tint
const SUN_DAY = new THREE.Color().setHSL(0.1, 0.5, 0.75); // original's warm daylight tint

export function SkyCycle() {
  const { scene, gl } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  // start at night by default — the original's signature look, and the one
  // every screenshot in this migration has been judged against — unless a
  // save says otherwise
  const t = useRef(loadSave()?.dayPhase ?? -Math.PI / 2);

  // useFrame runs in three.js's render loop, outside React's render cycle —
  // imperatively mutating scene.background/fog here every frame is the
  // documented R3F pattern (see the library's own examples), not the kind of
  // render-impurity react-hooks/immutability is built to catch.
  // eslint-disable-next-line react-hooks/immutability
  useFrame((_, dt) => {
    t.current += dt * 0.015; // one full cycle every ~7 minutes
    skyState.phase = t.current;
    const dayK = (Math.sin(t.current) + 1) / 2;
    const nightK = 1 - dayK;
    skyState.nightK = nightK;
    // clock (matches the original's `(6 + dayT*24) % 24`): map the sine phase
    // directly onto a 24h face rather than running a second, separate timer
    const frac = (((t.current / (2 * Math.PI)) % 1) + 1) % 1;
    skyState.hour = (6 + frac * 24) % 24;
    const clockStr =
      String(Math.floor(skyState.hour)).padStart(2, "0") + ":" + String(Math.floor((skyState.hour % 1) * 60)).padStart(2, "0");
    if (clockStr !== useHudStore.getState().clock) useHudStore.getState().setClock(clockStr);
    const col = NIGHT.clone().lerp(DAY, dayK);
    if (!scene.background || !(scene.background as THREE.Color).equals) {
      // eslint-disable-next-line react-hooks/immutability -- see note above useFrame
      scene.background = col;
    } else {
      (scene.background as THREE.Color).copy(col);
    }
    if (!scene.fog) scene.fog = new THREE.Fog(col, 60, 260);
    (scene.fog as THREE.Fog).color.copy(col);
    if (sunRef.current) {
      sunRef.current.intensity = 0.15 + dayK * 1.1;
      sunRef.current.color.copy(SUN_NIGHT).lerp(SUN_DAY, dayK);
    }
    if (hemiRef.current) hemiRef.current.intensity = 0.18 + dayK * 0.5;
    // original's renderer.toneMappingExposure=1.08+nightK*0.18 — always above
    // 1.0, brightest at night to compensate for the dark night palette
    // eslint-disable-next-line react-hooks/immutability -- see note above useFrame
    gl.toneMappingExposure = 1.08 + nightK * 0.18;
  });

  return (
    <>
      {/* original's hemi: sky-color-from-above / ground-color-from-below,
          reads much richer than a flat ambient */}
      <hemisphereLight ref={hemiRef} color={0xc8e0ff} groundColor={0x3a3020} intensity={0.18} />
      {/* original's fixed-intensity fillLight, never modulated by day/night */}
      <directionalLight color={0x8ab4d8} intensity={0.25} position={[-60, 40, -30]} />
      <directionalLight ref={sunRef} position={[60, 80, 30]} castShadow intensity={0.15} />
    </>
  );
}
