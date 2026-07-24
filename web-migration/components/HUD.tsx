"use client";

import { useHudStore } from "@/lib/hudStore";

export function HUD() {
  const speedKmh = useHudStore((s) => s.speedKmh);
  const grounded = useHudStore((s) => s.grounded);

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        color: "#fff",
        fontFamily: "monospace",
        background: "rgba(0,0,0,0.45)",
        padding: "10px 14px",
        borderRadius: 8,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700 }}>{speedKmh} km/h</div>
      <div style={{ fontSize: 11, opacity: 0.7 }}>
        {grounded ? "grounded" : "airborne"} — WASD/arrows to drive, Space to handbrake
      </div>
    </div>
  );
}
