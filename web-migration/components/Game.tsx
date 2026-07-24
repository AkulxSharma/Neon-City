"use client";

import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { SkyCycle } from "@/components/SkyCycle";
import { World } from "@/components/World";
import { Water } from "@/components/Water";
import { Car } from "@/components/Car";
import { Boat } from "@/components/Boat";
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
          </Physics>
        </Suspense>
      </Canvas>
      <HUD />
    </div>
  );
}
