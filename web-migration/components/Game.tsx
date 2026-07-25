"use client";

import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { SkyCycle } from "@/components/SkyCycle";
import { City } from "@/components/City";
import { Water } from "@/components/Water";
import { Car } from "@/components/Car";
import { Boat } from "@/components/Boat";
import { Bike } from "@/components/Bike";
import { Traffic } from "@/components/Traffic";
import { Player } from "@/components/Player";
import { Club } from "@/components/Club";
import { ClubInterior } from "@/components/ClubInterior";
import { AudioEngine } from "@/components/AudioEngine";
import { LandmarkMarkers } from "@/components/LandmarkMarkers";
import { WaypointTracker } from "@/components/WaypointTracker";
import { HUD } from "@/components/HUD";
import { useHudStore } from "@/lib/hudStore";
import { initAudio, toggleMute, setMuted } from "@/lib/audio";
import { loadSave, saveGame } from "@/lib/saveGame";
import { clubDoorAction } from "@/lib/club";
import { toggleVehicleFoot } from "@/lib/player";

export default function Game() {
  // restore active vehicle/camera/mute once at mount — vehicle *positions*
  // are restored by each vehicle itself (Car/Bike/Boat read loadSave() in
  // their own lazy useState initializer, so there's no load-then-jump)
  useEffect(() => {
    const save = loadSave();
    if (!save) return;
    useHudStore.getState().setCamMode(save.camMode);
    setMuted(save.muted);
    // don't restore `active` via toggleActive (cycles relative to current, and
    // can't reach "foot" at all — see hudStore.toggleActive's no-op-on-foot
    // guard); hudStore's default is "car", so only touch it if the save disagrees
    if (save.active === "foot") {
      useHudStore.getState().setActive("foot");
    } else if (save.active !== "car") {
      while (useHudStore.getState().active !== save.active) useHudStore.getState().toggleActive();
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(saveGame, 3000);
    window.addEventListener("beforeunload", saveGame);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", saveGame);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      initAudio(); // no-ops once already initialized; needs a real user gesture, so first key does it
      const hud = useHudStore.getState();
      if (e.code === "KeyE") {
        if (!clubDoorAction()) toggleVehicleFoot();
      } else if (e.code === "KeyB") {
        hud.toggleActive();
        hud.showMsg("SWITCHED TO: " + hud.vehicleName());
      } else if (e.code === "KeyC") {
        hud.cycleCamMode();
      } else if (e.code === "KeyM") {
        hud.showMsg(toggleMute() ? "MUTED" : "UNMUTED");
      } else if (e.code === "KeyG") {
        hud.setMapOpen(!hud.mapOpen);
      } else if (e.code === "Escape") {
        hud.setMapOpen(false);
      }
    };
    const onClick = () => initAudio();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onClick, { once: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onClick);
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas shadows dpr={1} camera={{ fov: 65, near: 0.1, far: 1000 }}>
        <Suspense fallback={null}>
          <SkyCycle />
          <AudioEngine />
          <WaypointTracker />
          <LandmarkMarkers />
          <Physics gravity={[0, -9.81, 0]}>
            <City />
            <Water />
            <Car />
            <Boat />
            <Bike />
            <Traffic />
            <Player />
            <Club />
            <ClubInterior />
          </Physics>
          {/* threshold-gated like the original's UnrealBloomPass(strength .9, threshold
              .82) — only true emissive neon blooms, not the lit ground/facades */}
          <EffectComposer>
            <Bloom intensity={0.9} luminanceThreshold={0.82} luminanceSmoothing={0.2} mipmapBlur />
          </EffectComposer>
        </Suspense>
      </Canvas>
      <HUD />
    </div>
  );
}
