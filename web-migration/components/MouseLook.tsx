"use client";

import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  cameraLook,
  MAX_YAW,
  MAX_PITCH_UP,
  MAX_PITCH_DOWN,
  DEAD_ZONE,
  EASE,
} from "@/lib/cameraLook";
import { useHudStore } from "@/lib/hudStore";

// Hover look: just move the mouse over the canvas and the chase camera leans
// that way. No button, no dragging, no pointer lock.
//
// Position-mapped, not accumulated: where the cursor sits on screen IS the
// angle, so the screen centre is always neutral and the view can never wander
// somewhere you can't get back from. A dead zone through the middle keeps a
// resting or passing cursor from nudging anything.
//
// Deliberately additive — it only writes offsets that default to 0, so a
// player who leaves the mouse in the middle gets exactly the old camera.

// Maps one axis of cursor position (-1..1 from centre) through the dead zone
// onto a 0..1 strength, so the camera eases in from the edge of the dead zone
// rather than jumping the moment you cross it.
function ramp(n: number) {
  const a = Math.abs(n);
  if (a <= DEAD_ZONE) return 0;
  return Math.sign(n) * ((a - DEAD_ZONE) / (1 - DEAD_ZONE));
}

export function MouseLook() {
  const { gl } = useThree();

  useEffect(() => {
    const el = gl.domElement;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      const sx = ramp(nx);
      const sy = ramp(ny);
      // cursor right -> camera swings right, i.e. the world appears to swing left
      cameraLook.targetYaw = -sx * MAX_YAW;
      cameraLook.targetPitch = sy > 0 ? sy * MAX_PITCH_UP : sy * -MAX_PITCH_DOWN;
      cameraLook.active = sx !== 0 || sy !== 0;
    };

    // cursor off the canvas (or the tab loses focus mid-lean) — fall back to
    // neutral instead of freezing at whatever angle it was last at
    const onLeave = () => {
      cameraLook.targetYaw = 0;
      cameraLook.targetPitch = 0;
      cameraLook.active = false;
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    const k = 1 - Math.pow(EASE, d);
    cameraLook.yaw += (cameraLook.targetYaw - cameraLook.yaw) * k;
    cameraLook.pitch += (cameraLook.targetPitch - cameraLook.pitch) * k;
  });

  // The map is a full-screen overlay — moving the cursor across it to pick a
  // destination shouldn't be swinging the camera around behind it.
  const mapOpen = useHudStore((s) => s.mapOpen);
  useEffect(() => {
    if (mapOpen) {
      cameraLook.targetYaw = 0;
      cameraLook.targetPitch = 0;
      cameraLook.active = false;
    }
  }, [mapOpen]);

  return null;
}
