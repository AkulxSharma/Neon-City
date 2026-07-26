"use client";

import { useEffect, useRef } from "react";
import { worldState } from "@/lib/worldState";
import { trafficPositions } from "@/components/Traffic";
import { LANDMARKS } from "@/lib/landmarks";
import { useHudStore } from "@/lib/hudStore";

// Player-centred, player-up street radar. Streets and landmarks are drawn from
// the SAME numbers the city is generated with (City.tsx CELL/ROAD_W): asphalt
// runs along every chunk boundary (world coords ≡ 50 mod 100), blocks/footpaths
// fill the interiors. The old version drew its grid at multiples of 100 (chunk
// CENTRES) — half a block off from the real roads — which is why landmarks
// looked like they sat on the streets.
const CSS = 180; // on-screen size, matches #minimap in globals.css
const DPR = 2; // supersample so labels stay crisp when scaled down to CSS px
const R = CSS * DPR;
const C = R / 2;
const RADIUS_W = 150; // world units from centre to edge (~3 streets each way)
const S = C / RADIUS_W; // world → canvas-px scale
const CELL = 100; // City.tsx CELL
const ROAD_W = 20; // City.tsx ROAD_W
const SHORE_X = 600; // lib/marina.ts SHORE_X

// Pull a landmark toward its block centre so the marker always sits deep on the
// footpath, never on (or hugging) the asphalt. A block's footpath spans ±40 of
// its centre and the road band starts at ±40; clamping to ±20 keeps every pin a
// clear 20 units off the nearest kerb, even for landmarks placed dead on a road
// line in-game (VENU at x=-50, the intersection landmarks, etc.).
const BLOCK_SAFE = 20;
function offRoad(v: number) {
  const bc = Math.round(v / CELL) * CELL;
  return bc + Math.max(-BLOCK_SAFE, Math.min(BLOCK_SAFE, v - bc));
}
const MARKS = LANDMARKS.map((l) => ({ ...l, mx: offRoad(l.x), mz: offRoad(l.z) }));

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      raf.current = requestAnimationFrame(draw);
      const { px, pz, heading } = worldState;
      const nav = useHudStore.getState().navTarget;

      // world → screen for the unrotated overlay (labels/dots): apply the same
      // −heading rotation the world layer uses, but resolve to plain canvas px
      const cos = Math.cos(-heading);
      const sin = Math.sin(-heading);
      const toScreen = (wx: number, wz: number): [number, number] => {
        const dx = wx - px;
        const dz = wz - pz;
        return [C + (dx * cos - dz * sin) * S, C + (dx * sin + dz * cos) * S];
      };

      // ---- ground: concrete blocks ----
      ctx.clearRect(0, 0, R, R);
      ctx.fillStyle = "#444d5a";
      ctx.fillRect(0, 0, R, R);

      // ---- rotated world layer: water, asphalt, lane lines, traffic ----
      ctx.save();
      ctx.translate(C, C);
      ctx.rotate(-heading);
      ctx.scale(S, S);
      ctx.translate(-px, -pz);
      const reach = RADIUS_W + 60; // draw a little past the rim so nothing pops at the edge

      if (px + reach >= SHORE_X) {
        ctx.fillStyle = "#13527e";
        ctx.fillRect(SHORE_X, pz - reach, 5000, 2 * reach);
      }

      const first = (base: number) => Math.floor((base - reach - 50) / CELL) * CELL + 50;
      ctx.fillStyle = "#161922";
      for (let x = first(px); x <= px + reach; x += CELL) ctx.fillRect(x - ROAD_W / 2, pz - reach, ROAD_W, 2 * reach);
      for (let z = first(pz); z <= pz + reach; z += CELL) ctx.fillRect(px - reach, z - ROAD_W / 2, 2 * reach, ROAD_W);

      ctx.strokeStyle = "rgba(244,208,92,0.55)";
      ctx.lineWidth = 1.4 / S;
      ctx.setLineDash([6 / S, 7 / S]);
      for (let x = first(px); x <= px + reach; x += CELL) {
        ctx.beginPath();
        ctx.moveTo(x, pz - reach);
        ctx.lineTo(x, pz + reach);
        ctx.stroke();
      }
      for (let z = first(pz); z <= pz + reach; z += CELL) {
        ctx.beginPath();
        ctx.moveTo(px - reach, z);
        ctx.lineTo(px + reach, z);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      ctx.fillStyle = "#ff6a4a";
      for (const t of trafficPositions) {
        ctx.beginPath();
        ctx.arc(t.x, t.z, 3.4 / S, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // ---- landmarks: dots + labels, drawn upright over the rotated map ----
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.font = `700 ${10 * DPR}px system-ui, Arial, sans-serif`;
      ctx.lineJoin = "round";
      const rim = C - 7 * DPR;
      const labelZone = C * 0.72; // only label markers comfortably inside — keeps the rim uncrowded
      for (const m of MARKS) {
        const isNav = !!nav && nav.name === m.name;
        let [sx, sy] = toScreen(m.mx, m.mz);
        const inView = sx >= 6 && sx <= R - 6 && sy >= 6 && sy <= R - 6;
        if (!inView) {
          // off-screen: clamp a small direction dot to the rim (label only the
          // active destination, so the radar doesn't get crowded)
          const ang = Math.atan2(sy - C, sx - C);
          sx = C + Math.cos(ang) * rim;
          sy = C + Math.sin(ang) * rim;
        }
        const rad = (isNav ? 5 : inView ? 4 : 3) * DPR;
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fillStyle = m.col;
        ctx.fill();
        ctx.lineWidth = 1.5 * DPR;
        ctx.strokeStyle = isNav ? "#ffffff" : "rgba(0,0,0,0.55)";
        ctx.stroke();
        // label the active destination always, plus any marker sitting well
        // inside the dial; place it below the dot near the top edge so it never
        // clips, and clamp x so long names stay on-canvas. Skip labels sitting
        // right under the player marker (you're parked on the landmark).
        const dist = Math.hypot(sx - C, sy - C);
        if (dist > 16 * DPR && (isNav || (inView && dist < labelZone))) {
          const half = ctx.measureText(m.name).width / 2 + 3 * DPR;
          const lx = Math.max(half, Math.min(R - half, sx));
          const above = sy - rad - 3 * DPR > 12 * DPR;
          const ly = above ? sy - rad - 3 * DPR : sy + rad + 12 * DPR;
          ctx.textBaseline = above ? "bottom" : "top";
          ctx.lineWidth = 3 * DPR;
          ctx.strokeStyle = "rgba(6,8,14,0.9)";
          ctx.strokeText(m.name, lx, ly);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(m.name, lx, ly);
        }
      }

      // ---- player marker: fixed at centre, always pointing up ----
      ctx.save();
      ctx.translate(C, C);
      ctx.beginPath();
      ctx.moveTo(0, -8 * DPR);
      ctx.lineTo(6 * DPR, 7 * DPR);
      ctx.lineTo(0, 4 * DPR);
      ctx.lineTo(-6 * DPR, 7 * DPR);
      ctx.closePath();
      ctx.fillStyle = "#ffe14a";
      ctx.fill();
      ctx.lineWidth = 1.5 * DPR;
      ctx.strokeStyle = "rgba(6,8,14,0.9)";
      ctx.stroke();
      ctx.restore();
    };
    raf.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return <canvas id="minimap" ref={ref} width={R} height={R} />;
}
