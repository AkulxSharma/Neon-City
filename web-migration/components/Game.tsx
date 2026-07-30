"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import type { BloomEffect } from "postprocessing";
import { SkyCycle } from "@/components/SkyCycle";
import { skyState } from "@/lib/skyState";
import { Weather } from "@/components/Weather";
import { cycleWeather } from "@/lib/weatherState";
import { City } from "@/components/City";
import { Water } from "@/components/Water";
import { Car } from "@/components/Car";
import { Boat } from "@/components/Boat";
import { Bike } from "@/components/Bike";
import { Traffic } from "@/components/Traffic";
import { Pedestrians } from "@/components/Pedestrians";
import { Player } from "@/components/Player";
import { Club } from "@/components/Club";
import { ClubInterior } from "@/components/ClubInterior";
import { AudioEngine } from "@/components/AudioEngine";
import { NitroFX } from "@/components/NitroFX";
import { WaypointTracker } from "@/components/WaypointTracker";
import { HUD } from "@/components/HUD";
import { useHudStore, LIGHT_MODES } from "@/lib/hudStore";
import { initAudio, toggleMute, setMuted } from "@/lib/audio";
import { loadSave, saveGame } from "@/lib/saveGame";
import { clubDoorAction } from "@/lib/club";
import { toggleVehicleFoot } from "@/lib/player";
import { boatSwapAction } from "@/lib/boatSwap";
import { stealTrafficAction } from "@/lib/steal";
import { PoliceCar } from "@/components/PoliceCar";
import { PatrolBoat } from "@/components/PatrolBoat";
import { PoliceStation } from "@/components/PoliceStation";
import { MizuRestaurant } from "@/components/MizuRestaurant";
import { Marina } from "@/components/Marina";
import { Airport } from "@/components/Airport";
import { Plane } from "@/components/Plane";
import { Helicopter } from "@/components/Helicopter";
import { DrivableAirliner } from "@/components/DrivableAirliner";
import { LIVERIES } from "@/components/Airliner";
import { Props } from "@/components/Props";
import { Headlights } from "@/components/Headlights";
import { MouseLook } from "@/components/MouseLook";

const CYCLABLE = new Set(["car", "bike", "boat"]);

// original's exact per-frame rescale (updateDayNight ~line 7016): dim by day
// so daylight isn't blown out, full glow at night for the neon signs
function DynamicBloom() {
  const ref = useRef<BloomEffect>(null);
  useFrame(() => {
    if (ref.current) ref.current.intensity = 0.18 + skyState.nightK * 0.72;
  });
  return <Bloom ref={ref} luminanceThreshold={0.7} luminanceSmoothing={0.2} mipmapBlur />;
}

export default function Game() {
  // restore active vehicle/camera/mute once at mount — vehicle *positions*
  // are restored by each vehicle itself (Car/Bike/Boat read loadSave() in
  // their own lazy useState initializer, so there's no load-then-jump)
  useEffect(() => {
    const save = loadSave();
    if (!save) return;
    useHudStore.getState().setCamMode(save.camMode);
    useHudStore.getState().setLightMode(save.lightMode ?? 0);
    setMuted(save.muted);
    // don't restore `active` via toggleActive (cycles relative to current, and
    // can only ever reach car/bike/boat — see hudStore.toggleActive's no-op-on-foot
    // guard and its CYCLE array, which policeCar/patrolBoat/foot are deliberately
    // outside of); hudStore's default is "car", so only touch it if the save disagrees
    if (!CYCLABLE.has(save.active)) {
      useHudStore.getState().setActive(save.active);
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
        // owned vehicles win over hijacking a passing NPC, so the steal is last
        if (!clubDoorAction() && !boatSwapAction() && !toggleVehicleFoot()) stealTrafficAction();
      } else if (e.code === "KeyB") {
        hud.toggleActive();
        hud.showMsg("SWITCHED TO: " + hud.vehicleName());
      } else if (e.code === "KeyC") {
        hud.cycleCamMode();
      } else if (e.code === "KeyL") {
        hud.showMsg("HEADLIGHTS: " + LIGHT_MODES[hud.cycleLightMode()]);
      } else if (e.code === "KeyM") {
        hud.showMsg(toggleMute() ? "MUTED" : "UNMUTED");
      } else if (e.code === "KeyV") {
        hud.showMsg("WEATHER: " + cycleWeather().toUpperCase());
      } else if (e.code === "KeyG") {
        hud.setMapOpen(!hud.mapOpen);
      } else if (e.code === "KeyH") {
        hud.toggleControlsVisible();
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
      <Canvas shadows dpr={1} camera={{ fov: 65, near: 0.1, far: 1000 }} gl={{ toneMappingExposure: 1.5 }}>
        <Suspense fallback={null}>
          <SkyCycle />
          {/* runs after SkyCycle each frame (component render order = useFrame
              registration order) so it blends onto the SAME scene.fog SkyCycle
              already set this frame, rather than fighting it — see Weather.tsx */}
          <Weather />
          {/* outside <Physics> on purpose — lights have no bodies/colliders,
              and this one only reads worldState, which every vehicle writes */}
          <Headlights />
          <MouseLook />
          <AudioEngine />
          <NitroFX />
          <WaypointTracker />
          <Physics gravity={[0, -9.81, 0]}>
            <City />
            <Water />
            <Car />
            <Boat />
            <Bike />
            <PoliceCar />
            <PatrolBoat />
            <Plane />
            <Helicopter />
            {/* every parked wide-body is its own mountable vehicle — walk up
                + E at any gate/bay to fly it (see components/DrivableAirliner.tsx);
                the broken jet in the maintenance hangar is deliberately not
                one of these, it never flies */}
            <DrivableAirliner id="airliner1" liveryColor={LIVERIES[0]} />
            <DrivableAirliner id="airliner2" liveryColor={LIVERIES[1]} />
            <DrivableAirliner id="airliner3" liveryColor={LIVERIES[2]} />
            <DrivableAirliner id="airlinerCargo" liveryColor={LIVERIES[4]} cargo />
            <PoliceStation />
            <MizuRestaurant />
            <Marina />
            <Airport />
            <Props />
            <Traffic />
            <Pedestrians />
            <Player />
            <Club />
            <ClubInterior />
          </Physics>
          {/* threshold matches the original's UnrealBloomPass threshold (.82) — only
              true emissive neon blooms, not the lit ground/facades. Strength is NOT
              fixed in the original either: updateDayNight rescales
              bloomPass.strength=0.18+nightK*0.72 every frame (dim by day, full glow
              at night) — DynamicBloom below ports that same formula. */}
          <EffectComposer>
            <DynamicBloom />
          </EffectComposer>
        </Suspense>
      </Canvas>
      <HUD />
    </div>
  );
}
