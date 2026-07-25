"use client";

import { useEffect, useRef } from "react";
import { worldState } from "@/lib/worldState";
import { trafficPositions } from "@/components/Traffic";

// Player-centred, player-up radar — same convention as the original's
// #minimap canvas (rotate the world by -heading so "up" is always forward).
const R = 180;
const RANGE = 120; // world units shown edge-to-edge

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = R / RANGE;
    const C = R / 2;

    const draw = () => {
      raf.current = requestAnimationFrame(draw);
      const { px, pz, heading } = worldState;

      ctx.clearRect(0, 0, R, R);
      ctx.fillStyle = "#0a0c12";
      ctx.fillRect(0, 0, R, R);

      ctx.save();
      ctx.translate(C, C);
      ctx.rotate(-heading);
      ctx.translate(-px * S, -pz * S);

      // faint road grid, matches City.tsx's CELL=100
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      const startX = Math.floor((px - RANGE) / 100) * 100;
      const startZ = Math.floor((pz - RANGE) / 100) * 100;
      for (let x = startX; x < px + RANGE; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x * S, (pz - RANGE) * S);
        ctx.lineTo(x * S, (pz + RANGE) * S);
        ctx.stroke();
      }
      for (let z = startZ; z < pz + RANGE; z += 100) {
        ctx.beginPath();
        ctx.moveTo((px - RANGE) * S, z * S);
        ctx.lineTo((px + RANGE) * S, z * S);
        ctx.stroke();
      }

      // traffic blips
      ctx.fillStyle = "#ff5a5a";
      for (const t of trafficPositions) {
        ctx.beginPath();
        ctx.arc(t.x * S, t.z * S, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // player marker — fixed at center, always pointing "up" (rotated with the world instead)
      ctx.save();
      ctx.translate(C, C);
      ctx.fillStyle = "#ffd76a";
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    raf.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return <canvas id="minimap" ref={ref} width={R} height={R} />;
}
