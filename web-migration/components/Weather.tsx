"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useHudStore } from "@/lib/hudStore";
import { worldState } from "@/lib/worldState";
import { weatherState, pickWeather } from "@/lib/weatherState";

// Rendered after <SkyCycle/> in Game.tsx so this useFrame runs after its
// day/night one each frame: SkyCycle owns scene.fog's base color/near/far off
// day/night, this component blends weather on top of that SAME scene.fog
// object afterward (near/far target + a grey tint), rather than merging into
// SkyCycle — weather is an independent, randomly-timed system layered on a
// clock-driven one, and keeping them in separate files matches how the
// original also kept updateDayNight()/updateWeather() as two functions that
// both just happen to write the same scene.fog.

// original's rainTex: an 8x64 vertical soft gradient billboard (index.html ~3656)
const rainCanvas = document.createElement("canvas");
rainCanvas.width = 8;
rainCanvas.height = 64;
const rg = rainCanvas.getContext("2d")!;
const grad = rg.createLinearGradient(0, 0, 0, 64);
grad.addColorStop(0, "rgba(200,225,255,0)");
grad.addColorStop(0.5, "rgba(200,225,255,.9)");
grad.addColorStop(1, "rgba(200,225,255,0)");
rg.fillStyle = grad;
rg.fillRect(0, 0, 8, 64);
const rainTex = new THREE.CanvasTexture(rainCanvas);

const RAIN_N = 500;
const rainY = new Float32Array(RAIN_N);
// same imperative BufferGeometry-at-module-scope idiom as MizuRestaurant.tsx's
// GABLE_ROOF_GEO — plugged into <points geometry={...}> below rather than JSX
// bufferAttribute children
const rainGeo = (() => {
  const pos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    pos[i * 3] = (Math.random() * 2 - 1) * 55;
    pos[i * 3 + 1] = rainY[i] = Math.random() * 40;
    pos[i * 3 + 2] = (Math.random() * 2 - 1) * 55;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return g;
})();

const cGrey = new THREE.Color(0x8a94a0);
const tmpColor = new THREE.Color();

export function Weather() {
  const { scene } = useThree();
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);

  // imperatively mutating scene.fog/background/hemi here every frame is the
  // documented R3F pattern (see SkyCycle.tsx's own useFrame, same rationale)
  // eslint-disable-next-line react-hooks/immutability
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const mat = materialRef.current;
    const pts = pointsRef.current;
    if (!mat || !pts || !scene.fog) return;

    if (useHudStore.getState().inClub) {
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0, Math.min(1, dt * 3));
      weatherState.wetGrip = THREE.MathUtils.lerp(weatherState.wetGrip, 1, dt);
      return;
    }

    weatherState.timer -= dt;
    if (weatherState.timer <= 0) {
      const nw = pickWeather();
      if (nw !== weatherState.kind) {
        weatherState.kind = nw;
        useHudStore.getState().showMsg("WEATHER: " + weatherState.kind.toUpperCase());
      }
      weatherState.timer = 100 + Math.random() * 100;
    }

    const isRain = weatherState.kind === "rain";
    const isFog = weatherState.kind === "fog";
    const isOver = weatherState.kind === "overcast";

    const tgtNear = isFog ? 18 : isRain ? 55 : isOver ? 95 : 110;
    const tgtFar = isFog ? 95 : isRain ? 210 : isOver ? 320 : 430;
    const fog = scene.fog as THREE.Fog;
    // eslint-disable-next-line react-hooks/immutability -- see note above useFrame
    fog.near = THREE.MathUtils.lerp(fog.near, tgtNear, Math.min(1, dt * 0.5));
    fog.far = THREE.MathUtils.lerp(fog.far, tgtFar, Math.min(1, dt * 0.5));

    const greyK = isFog ? 0.55 : isRain ? 0.4 : isOver ? 0.3 : 0;
    if (greyK > 0) {
      tmpColor.copy(fog.color).lerp(cGrey, greyK * 0.5);
      fog.color.copy(tmpColor);
      if (scene.background instanceof THREE.Color) scene.background.copy(tmpColor);
      // hemi dimming matches the original's `hemi.intensity*=1-greyK*0.35`,
      // applied after SkyCycle's own per-frame hemi.intensity set — no ref
      // plumbing needed for a light SkyCycle already owns, a scene lookup for
      // the one hemisphere light is cheap and keeps the two files decoupled
      const hemi = scene.getObjectByProperty("type", "HemisphereLight") as THREE.HemisphereLight | undefined;
      if (hemi) hemi.intensity *= 1 - greyK * 0.35;
    }

    const rainTarget = isRain ? 0.55 : 0;
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, rainTarget, Math.min(1, dt * 3));
    if (mat.opacity > 0.01) {
      pts.position.set(worldState.px, 0, worldState.pz);
      const posAttr = pts.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < RAIN_N; i++) {
        rainY[i] -= dt * 48;
        if (rainY[i] < 0) rainY[i] += 40;
        posAttr.setY(i, rainY[i]);
      }
      posAttr.needsUpdate = true;
    }

    weatherState.wetGrip = THREE.MathUtils.lerp(weatherState.wetGrip, isRain ? 0.8 : 1, Math.min(1, dt * 0.8));
  });

  return (
    <points ref={pointsRef} geometry={rainGeo}>
      <pointsMaterial
        ref={materialRef}
        color={0xaad4ff}
        size={0.5}
        map={rainTex}
        transparent
        opacity={0}
        fog={false}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
