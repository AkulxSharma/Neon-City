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
// The plane is SIZE units square (below) and the ripple reads best at roughly
// 12-unit tiles — close enough to see chop when you're parked at the quay,
// not so fine it smears. Repeat is derived rather than hardcoded so resizing
// the sea can't silently change how coarse the water looks.
const TILE = 12;

// Deliberately rough/non-metallic and darker than a "real" sea blue, per the
// original's own reasoning: a smooth spec lobe on a big flat plane turns into
// one giant bloom-smeared highlight, and the scene's pale fog out-brightens a
// mid-blue surface, so the color has to sit darker than expected to still
// read as water at a distance.
// The sea used to be a 220x300 quad sitting just off the marina, which meant
// its far edge was visible as a hard diagonal seam against the sky — you could
// see the end of the ocean. Scene fog ends at 260 units (SkyCycle.tsx), so a
// plane big enough to push every edge well past that fades into the horizon
// instead, which is the same trick the original uses with its 12000-unit slab.
// Geometry cost is unchanged: a plane is two triangles at any size.
//
// It starts AT the shoreline and only extends east/north/south — it must never
// reach back over the city, because the water sits at WATER_LEVEL (above the
// road surface) and would flood the streets.
const SIZE = 6000;
const CENTER_X = 600 + SIZE / 2; // 600 = SHORE_X, so the near edge lands on the coast

seaRippleTex.repeat.set(SIZE / TILE, SIZE / TILE);

export function Water() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER_X, WATER_LEVEL - 0.02, 0]}>
      <planeGeometry args={[SIZE, SIZE]} />
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
