"use client";

import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { SkyCycle } from "@/components/SkyCycle";
import { World } from "@/components/World";
import { Water } from "@/components/Water";
import { Car } from "@/components/Car";
import { Boat } from "@/components/Boat";
import { Bike } from "@/components/Bike";
import { Traffic } from "@/components/Traffic";
import { HUD } from "@/components/HUD";
import { useHudStore } from "@/lib/hudStore";

export default function Game() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyB") useHudStore.getState().toggleActive();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas shadows camera={{ fov: 65, near: 0.1, far: 1000 }}>
        <Suspense fallback={null}>
          <SkyCycle />
          <Physics gravity={[0, -9.81, 0]}>
            <World />
            <Water />
            <Car />
            <Boat />
            <Bike />
            <Traffic />
          </Physics>
          {/* threshold-gated like the original's UnrealBloomPass(strength .9, threshold
              .82) — only true emissive neon blooms, not the lit ground/facades */}
          <EffectComposer>
            <Bloom intensity={0.9} luminanceThreshold={0.82} luminanceSmoothing={0.2} mipmapBlur />
          </EffectComposer>
        </Suspense>
      </Canvas>
      <HUD />
    </div>
  );
}
