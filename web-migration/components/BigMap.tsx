"use client";

import { useEffect, useRef } from "react";
import { useHudStore } from "@/lib/hudStore";
import { worldState } from "@/lib/worldState";
import { LANDMARKS, type Landmark } from "@/lib/landmarks";

const SIZE = 460;
// fixed world-space bounds covering every landmark with margin — a full map,
// not a player-centred pannable one (the original's #bigmap is player-centred;
// simplified here since the destination list already covers selection)
const WX0 = -260, WX1 = 520, WZ0 = -320, WZ1 = 320;

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
      ctx.fillStyle = "#0a0c12";
      ctx.fillRect(0, 0, SIZE, SIZE);

      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      for (let x = Math.ceil(WX0 / 100) * 100; x < WX1; x += 100) {
        const [px] = toPx(x, 0);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, SIZE);
        ctx.stroke();
      }
      for (let z = Math.ceil(WZ0 / 100) * 100; z < WZ1; z += 100) {
        const [, pz] = toPx(0, z);
        ctx.beginPath();
        ctx.moveTo(0, pz);
        ctx.lineTo(SIZE, pz);
        ctx.stroke();
      }

      for (const l of LANDMARKS) {
        const [px, pz] = toPx(l.x, l.z);
        ctx.fillStyle = l.col;
        ctx.beginPath();
        ctx.arc(px, pz, l === navTarget ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
        if (l === navTarget) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(l.name, px, pz - 8);
      }

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
