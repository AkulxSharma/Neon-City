"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { SkyCycle } from "@/components/SkyCycle";
import { World } from "@/components/World";
import { Car } from "@/components/Car";
import { HUD } from "@/components/HUD";

export default function Game() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas shadows camera={{ fov: 65, near: 0.1, far: 1000 }}>
        <Suspense fallback={null}>
          <SkyCycle />
          <Physics gravity={[0, -9.81, 0]}>
            <World />
            <Car />
          </Physics>
        </Suspense>
      </Canvas>
      <HUD />
    </div>
  );
}
