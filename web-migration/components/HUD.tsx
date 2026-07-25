"use client";

import { useHudStore } from "@/lib/hudStore";

export function HUD() {
  const speedKmh = useHudStore((s) => s.speedKmh);
  const grounded = useHudStore((s) => s.grounded);
  const active = useHudStore((s) => s.active);

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
      <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1 }}>
        {active}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{speedKmh} km/h</div>
      <div style={{ fontSize: 11, opacity: 0.7 }}>
        {active === "boat" ? "afloat" : grounded ? "grounded" : "airborne"} — WASD/arrows to
        drive, Space to handbrake, B to cycle car/bike/boat
      </div>
    </div>
  );
}
