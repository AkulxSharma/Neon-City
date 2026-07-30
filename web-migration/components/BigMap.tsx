"use client";

import { useEffect, useRef } from "react";
import { useHudStore } from "@/lib/hudStore";
import { worldState } from "@/lib/worldState";
import { LANDMARKS, type Landmark } from "@/lib/landmarks";
import { streetName } from "@/lib/streetNames";

const SIZE = 460;
// fixed world-space bounds covering every landmark with margin — a full map,
// not a player-centred pannable one (the original's #bigmap is player-centred;
// simplified here since the destination list already covers selection)
const WX0 = -260, WX1 = 620, WZ0 = -320, WZ1 = 320;
const CELL = 100; // City.tsx CELL
const ROAD_W = 20; // City.tsx ROAD_W
const SHORE_X = 600; // lib/marina.ts SHORE_X

// See Minimap.tsx: clamp a landmark to within ±20 of its block centre so the
// marker sits deep on the footpath, a clear 20 units off the nearest kerb —
// never on (or hugging) the drawn asphalt.
const BLOCK_SAFE = 20;
function offRoad(v: number) {
  const bc = Math.round(v / CELL) * CELL;
  return bc + Math.max(-BLOCK_SAFE, Math.min(BLOCK_SAFE, v - bc));
}

export function BigMap() {
  const open = useHudStore((s) => s.mapOpen);
  const setMapOpen = useHudStore((s) => s.setMapOpen);
  const navTarget = useHudStore((s) => s.navTarget);
  const setNavTarget = useHudStore((s) => s.setNavTarget);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sx = SIZE / (WX1 - WX0);
    const sz = SIZE / (WZ1 - WZ0);
    const toPx = (x: number, z: number) => [(x - WX0) * sx, (z - WZ0) * sz];

    const draw = () => {
      raf.current = requestAnimationFrame(draw);

      // concrete blocks as the base, water past the shore
      ctx.fillStyle = "#3a424d";
      ctx.fillRect(0, 0, SIZE, SIZE);
      const [wsx] = toPx(SHORE_X, 0);
      if (wsx < SIZE) {
        ctx.fillStyle = "#13527e";
        ctx.fillRect(wsx, 0, SIZE - wsx, SIZE);
      }

      // asphalt streets along every chunk boundary (≡ 50 mod 100)
      ctx.fillStyle = "#161922";
      for (let x = Math.ceil((WX0 - 50) / CELL) * CELL + 50; x < WX1; x += CELL) {
        const [cx] = toPx(x - ROAD_W / 2, 0);
        ctx.fillRect(cx, 0, ROAD_W * sx, SIZE);
      }
      for (let z = Math.ceil((WZ0 - 50) / CELL) * CELL + 50; z < WZ1; z += CELL) {
        const [, cz] = toPx(0, z - ROAD_W / 2);
        ctx.fillRect(0, cz, SIZE, ROAD_W * sz);
      }
      // dashed lane centre lines
      ctx.strokeStyle = "rgba(244,208,92,0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 6]);
      for (let x = Math.ceil((WX0 - 50) / CELL) * CELL + 50; x < WX1; x += CELL) {
        const [cx] = toPx(x, 0);
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, SIZE);
        ctx.stroke();
      }
      for (let z = Math.ceil((WZ0 - 50) / CELL) * CELL + 50; z < WZ1; z += CELL) {
        const [, cz] = toPx(0, z);
        ctx.beginPath();
        ctx.moveTo(0, cz);
        ctx.lineTo(SIZE, cz);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // street names — Minimap.tsx has to rotate its labels upright as the
      // player-centred radar spins with heading; this map is fixed north-up,
      // so every label just sits flat along its road, no angle math needed.
      // Reuses the exact same lib/streetNames.ts function Minimap.tsx does,
      // so a given road always shows the same name on both maps.
      ctx.font = "italic 600 11px system-ui, Arial, sans-serif";
      ctx.fillStyle = "rgba(226,230,238,0.85)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let x = Math.ceil((WX0 - 50) / CELL) * CELL + 50; x < WX1; x += CELL) {
        if (x >= SHORE_X) continue; // no street signs out in the water
        const [cx] = toPx(x, 0);
        ctx.save();
        ctx.translate(cx, 18);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(streetName(x, "x"), 0, 0);
        ctx.restore();
      }
      for (let z = Math.ceil((WZ0 - 50) / CELL) * CELL + 50; z < WZ1; z += CELL) {
        const [, cz] = toPx(0, z);
        ctx.fillText(streetName(z, "z"), 42, cz);
      }

      LANDMARKS.forEach((l, i) => {
        const [px, pz] = toPx(offRoad(l.x), offRoad(l.z));
        const r = l === navTarget ? 7 : 5;
        ctx.fillStyle = l.col;
        ctx.beginPath();
        ctx.arc(px, pz, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = l === navTarget ? "#fff" : "rgba(0,0,0,0.55)";
        ctx.stroke();
        // stagger label above/below by index so neighbouring pins (e.g. POLICE
        // HARBOR / EAST MARINA, both on the z=50 road near the water) don't collide
        ctx.font = "bold 12px system-ui, Arial";
        const above = i % 2 === 0;
        const half = ctx.measureText(l.name).width / 2 + 4;
        const lx = Math.max(half, Math.min(SIZE - half, px));
        ctx.textAlign = "center";
        ctx.textBaseline = above ? "bottom" : "top";
        ctx.lineJoin = "round";
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = "rgba(6,8,14,0.9)";
        const ly = above ? pz - r - 4 : pz + r + 4;
        ctx.strokeText(l.name, lx, ly);
        ctx.fillStyle = "#fff";
        ctx.fillText(l.name, lx, ly);
      });

      const [ppx, ppz] = toPx(worldState.px, worldState.pz);
      ctx.save();
      ctx.translate(ppx, ppz);
      ctx.rotate(-worldState.heading);
      ctx.fillStyle = "#ffd76a";
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4, 5);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    raf.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf.current);
  }, [open, navTarget]);

  if (!open) return null;

  const dist = (l: Landmark) => Math.round(Math.hypot(l.x - worldState.px, l.z - worldState.pz));

  return (
    <div id="mapscreen" onClick={() => setMapOpen(false)}>
      <div id="mapcard" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2>CITY MAP</h2>
          <canvas id="bigmap" ref={canvasRef} width={SIZE} height={SIZE} />
        </div>
        <div id="mapright">
          <h2>DESTINATIONS</h2>
          <div id="maplist">
            {[...LANDMARKS]
              .sort((a, b) => dist(a) - dist(b))
              .map((l) => (
                <button key={l.name} type="button" className={l === navTarget ? "active" : ""} onClick={() => setNavTarget(l)}>
                  <span className="dot" style={{ color: l.col, background: l.col }} />
                  <span className="nm">{l.name}</span>
                  <span className="km">{dist(l)}m</span>
                </button>
              ))}
          </div>
          <div id="mapclose" onClick={() => setMapOpen(false)}>
            CLOSE&nbsp;&nbsp;(ESC)
          </div>
        </div>
      </div>
    </div>
  );
}
