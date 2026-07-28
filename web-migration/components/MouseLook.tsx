"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { cameraLook, PITCH_MIN, PITCH_MAX, YAW_SENS, PITCH_SENS, RECENTRE } from "@/lib/cameraLook";
import { worldState } from "@/lib/worldState";
import { useHudStore } from "@/lib/hudStore";

// Drag anywhere on the canvas to swing the chase camera around — left or right
// button, no pointer lock (locking the cursor would fight the HUD's map and
// camera buttons, which are ordinary DOM overlays).
//
// Deliberately additive: it only writes offsets that default to 0, so a player
// who never touches the mouse gets exactly the old camera.

export function MouseLook() {
  const { gl } = useThree();
  const last = useRef<{ x: number; y: number } | null>(null);
  const prevPos = useRef({ x: 0, z: 0 });

  useEffect(() => {
    const el = gl.domElement;

    const onDown = (e: PointerEvent) => {
      // ignore anything that isn't a primary/secondary mouse button (e.g. the
      // browser's back/forward side buttons)
      if (e.button !== 0 && e.button !== 2) return;
      cameraLook.dragging = true;
      last.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!cameraLook.dragging || !last.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      // drag right -> camera swings right, i.e. the world appears to swing left
      cameraLook.yaw -= dx * YAW_SENS;
      cameraLook.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, cameraLook.pitch + dy * PITCH_SENS));
    };

    const onUp = (e: PointerEvent) => {
      cameraLook.dragging = false;
      last.current = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    // right-drag would otherwise open the context menu mid-swing
    const onContext = (e: Event) => e.preventDefault();

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("contextmenu", onContext);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("contextmenu", onContext);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    // Recentre only while actually travelling — measured off worldState rather
    // than plumbed through from five vehicle components, and it means standing
    // still lets you hold an angle and look around.
    const moved = Math.hypot(worldState.px - prevPos.current.x, worldState.pz - prevPos.current.z);
    prevPos.current = { x: worldState.px, z: worldState.pz };
    if (cameraLook.dragging) return;
    // metres this frame -> m/s; below walking pace counts as standing still
    if (moved / d < 1.5) return;
    const k = Math.pow(RECENTRE, d);
    cameraLook.yaw *= k;
    cameraLook.pitch *= k;
  });

  // The map is a full-screen overlay; a drag started before opening it would
  // otherwise stay "held" behind it.
  const mapOpen = useHudStore((s) => s.mapOpen);
  useEffect(() => {
    if (mapOpen) cameraLook.dragging = false;
  }, [mapOpen]);

  return null;
}
