"use client";

import { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useKeyboard } from "@/lib/useKeyboard";
import { stepFlight, HELI_HANDLING, type FlightState } from "@/lib/flightPhysics";
import { useHudStore } from "@/lib/hudStore";
import { worldState } from "@/lib/worldState";
import { vehicleState } from "@/lib/vehicleState";
import { loadSave } from "@/lib/saveGame";
import { applyCameraRig } from "@/lib/cameraRig";

// Parked on REGIONAL AIRPORT's helipad (components/Airport.tsx), mounted by
// walking up + E — near-identical rig to Plane.tsx, sharing lib/flightPhysics.ts
// with HELI_HANDLING instead of PLANE_HANDLING (liftMinSpeed 0, so unlike the
// plane this one holds altitude with zero forward speed — true hover). Same
// control scheme as the plane: W/S throttle, A/D yaw, SPACE climb, SHIFT descend.
export function Helicopter() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const rotorRef = useRef<THREE.Group>(null);
  const tailRotorRef = useRef<THREE.Group>(null);
  const keys = useKeyboard();
  const { camera } = useThree();

  const [save] = useState(() => loadSave()?.vehicles.helicopter ?? null);
  const fs = useRef<FlightState>({ h: save?.h ?? vehicleState.helicopter.h, pitch: 0, roll: 0, speed: 0, vy: 0 });
  const pos = useRef({
    x: save?.x ?? vehicleState.helicopter.x,
    z: save?.z ?? vehicleState.helicopter.z,
    y: HELI_HANDLING.groundClearance,
  });
  const camPos = useRef(
    new THREE.Vector3((save?.x ?? vehicleState.helicopter.x) - 8, HELI_HANDLING.groundClearance + 5, (save?.z ?? vehicleState.helicopter.z) - 8)
  );
  const camLook = useRef(new THREE.Vector3());

  useFrame((state, dt) => {
    const body = bodyRef.current;
    if (!body) return;
    const d = Math.min(dt, 0.05);
    const isActive = useHudStore.getState().active === "helicopter";

    const k = keys.current;
    const yaw = isActive ? (k.right ? 1 : 0) - (k.left ? 1 : 0) : 0;
    const { dx, dz, y } = stepFlight(
      fs.current,
      { forward: isActive && k.forward, back: isActive && k.back, yaw, climb: isActive && k.handbrake, descend: isActive && k.boost },
      HELI_HANDLING,
      d,
      pos.current.y,
      0
    );
    pos.current.x += dx;
    pos.current.z += dz;
    pos.current.y = y;

    body.setNextKinematicTranslation({ x: pos.current.x, y: pos.current.y, z: pos.current.z });
    const q = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), fs.current.h)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), fs.current.pitch))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), fs.current.roll));
    body.setNextKinematicRotation(q);

    // main + tail rotor spin — always turning while airborne or active, idle
    // slower on the ground (engine-running look), cosmetic only
    const spinning = isActive || pos.current.y > HELI_HANDLING.groundClearance + 0.05;
    const rotorSpeed = spinning ? 14 : 0;
    if (rotorRef.current) rotorRef.current.rotation.y += rotorSpeed * d;
    if (tailRotorRef.current) tailRotorRef.current.rotation.x += rotorSpeed * 1.6 * d;

    vehicleState.helicopter.x = pos.current.x;
    vehicleState.helicopter.z = pos.current.z;
    vehicleState.helicopter.h = fs.current.h;

    if (!isActive) return;
    worldState.px = pos.current.x;
    worldState.pz = pos.current.z;
    worldState.heading = fs.current.h;

    applyCameraRig({
      camera,
      camPos: camPos.current,
      camLook: camLook.current,
      tx: pos.current.x,
      ty: pos.current.y,
      tz: pos.current.z,
      th: fs.current.h,
      isBike: false,
      camMode: useHudStore.getState().camMode,
      time: state.clock.elapsedTime,
      dt: d,
      speedMs: Math.abs(fs.current.speed),
    });

    const grounded = pos.current.y <= HELI_HANDLING.groundClearance + 0.02;
    useHudStore.getState().setHud(Math.round(Math.abs(fs.current.speed) * 3.6), grounded);
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[vehicleState.helicopter.x, HELI_HANDLING.groundClearance, vehicleState.helicopter.z]}
    >
      <HeliMesh rotorRef={rotorRef} tailRotorRef={tailRotorRef} />
    </RigidBody>
  );
}

const BODY_MAT = new THREE.MeshStandardMaterial({ color: "#c7451f", metalness: 0.45, roughness: 0.32 });
const TRIM_MAT = new THREE.MeshStandardMaterial({ color: "#1e2126", metalness: 0.75, roughness: 0.32 });
const CHROME_MAT = new THREE.MeshStandardMaterial({ color: "#c2c7d0", metalness: 0.95, roughness: 0.2 });
// glass cockpit bubble — same idiom as SupercarBody.tsx's GLASS
const GLASS_MAT = new THREE.MeshStandardMaterial({
  color: "#16212e",
  metalness: 0.9,
  roughness: 0.05,
  transparent: true,
  opacity: 0.55,
});
const BLADE_MAT = new THREE.MeshStandardMaterial({ color: "#26292e", metalness: 0.6, roughness: 0.35 });
const SKID_MAT = new THREE.MeshStandardMaterial({ color: "#101216", roughness: 0.7, metalness: 0.2 });

export function HeliMesh({
  rotorRef,
  tailRotorRef,
}: {
  rotorRef: React.RefObject<THREE.Group | null>;
  tailRotorRef: React.RefObject<THREE.Group | null>;
}) {
  return (
    <group>
      {/* cabin: lower painted shell + upper glass bubble */}
      <mesh position={[0, -0.15, 0.3]} scale={[1.15, 0.85, 1.7]} material={BODY_MAT} castShadow>
        <sphereGeometry args={[0.75, 14, 12]} />
      </mesh>
      <mesh position={[0, 0.22, 0.75]} scale={[1.0, 0.75, 1.15]} material={GLASS_MAT} castShadow>
        <sphereGeometry args={[0.62, 14, 12]} />
      </mesh>

      {/* tail boom + fin */}
      <mesh position={[0, 0.1, -1.9]} rotation={[Math.PI / 2, 0, 0]} material={TRIM_MAT} castShadow>
        <cylinderGeometry args={[0.16, 0.08, 3.0, 12]} />
      </mesh>
      <mesh position={[0, 0.42, -3.35]} material={BODY_MAT} castShadow>
        <boxGeometry args={[0.06, 0.55, 0.5]} />
      </mesh>

      {/* tail rotor */}
      <group ref={tailRotorRef} position={[0.12, 0.42, -3.4]}>
        {[0, Math.PI / 2].map((a) => (
          <mesh key={a} rotation={[a, 0, 0]} material={BLADE_MAT}>
            <boxGeometry args={[0.03, 0.55, 0.08]} />
          </mesh>
        ))}
      </group>

      {/* main rotor mast + 2 long blades */}
      <mesh position={[0, 0.85, 0]} material={CHROME_MAT} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.5, 10]} />
      </mesh>
      <group ref={rotorRef} position={[0, 1.12, 0]}>
        <mesh material={CHROME_MAT}>
          <cylinderGeometry args={[0.09, 0.09, 0.12, 10]} />
        </mesh>
        {[0, Math.PI / 2].map((a) => (
          <mesh key={a} rotation={[0, a, 0]} material={BLADE_MAT}>
            <boxGeometry args={[4.6, 0.05, 0.16]} />
          </mesh>
        ))}
      </group>

      {/* skids: two parallel bars + struts */}
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.6, -0.78, 0.2]} rotation={[Math.PI / 2, 0, 0]} material={SKID_MAT} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 2.4, 8]} />
          </mesh>
          {[0.7, -0.5].map((z) => (
            <mesh key={z} position={[s * 0.6, -0.45, z]} material={TRIM_MAT}>
              <boxGeometry args={[0.05, 0.5, 0.05]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* nav lights: red/green, port/starboard */}
      <mesh position={[-0.85, -0.1, 0.1]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshBasicMaterial color="#ff2020" />
      </mesh>
      <mesh position={[0.85, -0.1, 0.1]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshBasicMaterial color="#20ff60" />
      </mesh>
    </group>
  );
}
