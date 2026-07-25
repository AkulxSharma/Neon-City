"use client";

import { useHudStore, CAM_MODES, type CamMode } from "@/lib/hudStore";
import { Minimap } from "@/components/Minimap";

// DOM/CSS structure ported 1:1 from the original index.html's HUD (#hud,
// #speedo, #nitrobar, #hint, #msg, #camsel, #controls, #vig, #minimap — see
// app/globals.css for the matching styles, copied from the original's <style>
// block). Not yet ported: #waypoint/#mapscreen (need a landmark system that
// doesn't exist yet) and #touch-controls (mobile — desktop parity first).
export function HUD() {
  const speedKmh = useHudStore((s) => s.speedKmh);
  const active = useHudStore((s) => s.active);
  const clock = useHudStore((s) => s.clock);
  const hint = useHudStore((s) => s.hint);
  const msg = useHudStore((s) => s.msg);
  const nitroFuel = useHudStore((s) => s.nitroFuel);
  const nitroActive = useHudStore((s) => s.nitroActive);
  const camMode = useHudStore((s) => s.camMode);
  const setCamMode = useHudStore((s) => s.setCamMode);
  const vehicleName = useHudStore((s) => s.vehicleName());

  return (
    <>
      <div id="hud">
        <div className="title">NEON CITY DRIVE</div>
        <div id="clock">{clock}</div>
      </div>

      <div id="speedo" style={{ display: "block" }}>
        <div className="num">{speedKmh}</div>
        <div className="unit">KM/H</div>
        <div className="veh">{vehicleName}</div>
      </div>

      {active === "car" && (
        <div id="nitrobar" className={nitroActive ? "active" : ""} style={{ display: "block" }}>
          <div className="nlabel">
            NITRO <span className="nhint">(SHIFT)</span>
          </div>
          <div className="ntrack">
            <div className="nfill" style={{ width: `${(nitroFuel * 100).toFixed(1)}%` }} />
          </div>
        </div>
      )}

      {hint && (
        <div id="hint" style={{ display: "block" }}>
          {hint}
        </div>
      )}

      <div id="msg" className={msg ? "show" : ""}>
        {msg}
      </div>

      <div id="camsel">
        {CAM_MODES.map((name, i) => (
          <button
            key={name}
            type="button"
            className={camMode === i ? "on" : ""}
            onClick={() => setCamMode(i as CamMode)}
          >
            {name}
          </button>
        ))}
      </div>

      <div id="controls">
        <b>W A S D</b> move / drive
        <br />
        <b>SPACE</b> handbrake
        <br />
        <b>SHIFT</b> nitro (car)
        <br />
        <b>B</b> switch vehicle
        <br />
        <b>C</b> camera view
      </div>

      <div id="vig" />
      <Minimap />
    </>
  );
}
