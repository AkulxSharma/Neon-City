"use client";

import * as THREE from "three";

export const WATER_LEVEL = 0.2;

// Ported from the original's seaMat/seaRippleTex (index.html ~3960-4009), same
// canvas-texture pattern as City.tsx's canvasTex() — built once at module scope.
const rippleCanvas = document.createElement("canvas");
rippleCanvas.width = rippleCanvas.height = 128;
const rg = rippleCanvas.getContext("2d")!;
rg.fillStyle = "#bcdcf0";
rg.fillRect(0, 0, 128, 128);
for (let i = 0; i < 40; i++) {
  const x = Math.random() * 128,
    y = Math.random() * 128,
    r = 6 + Math.random() * 18,
    bright = Math.random() < 0.5;
  const rad = rg.createRadialGradient(x, y, 1, x, y, r);
  rad.addColorStop(0, bright ? "rgba(255,255,255,.5)" : "rgba(20,60,90,.18)");
  rad.addColorStop(1, "rgba(0,0,0,0)");
  rg.fillStyle = rad;
  rg.fillRect(0, 0, 128, 128);
}
const seaRippleTex = new THREE.CanvasTexture(rippleCanvas);
seaRippleTex.colorSpace = THREE.SRGBColorSpace;
seaRippleTex.wrapS = seaRippleTex.wrapT = THREE.RepeatWrapping;
// Original repeats 120x120 over a 12000-unit plane (~100 units/tile) since its
// sea is a distant horizon slab. This plane is only 220x300 and the player
// drives right up next to it, so that density would look like a blurry smear
// up close — repeat tuned down to ~12-unit tiles instead (still "choppy open
// water" scale, just sized for a body the player actually gets close to).
seaRippleTex.repeat.set(18, 24);

// Deliberately rough/non-metallic and darker than a "real" sea blue, per the
// original's own reasoning: a smooth spec lobe on a big flat plane turns into
// one giant bloom-smeared highlight, and the scene's pale fog out-brightens a
// mid-blue surface, so the color has to sit darker than expected to still
// read as water at a distance.
export function Water() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[665, WATER_LEVEL - 0.02, 0]}>
      <planeGeometry args={[220, 300]} />
      <meshStandardMaterial
        color="#0a3a60"
        roughness={0.9}
        metalness={0}
        emissive="#0a2138"
        emissiveIntensity={0.04}
        map={seaRippleTex}
      />
    </mesh>
  );
}
