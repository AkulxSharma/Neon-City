import * as THREE from "three";

// Ported directly from the original's camera block in tick() (camMode 0-3:
// chase/cockpit/hood/cinematic) — same distances, heights, and cinematic
// phase timings. Shared by Car/Bike/Boat so all three vehicles get all four
// modes instead of only the primary vehicle getting the full treatment.
export interface CameraRigArgs {
  camera: THREE.Camera;
  camPos: THREE.Vector3;
  camLook: THREE.Vector3;
  tx: number;
  ty: number;
  tz: number;
  th: number;
  isBike: boolean;
  camMode: 0 | 1 | 2 | 3;
  time: number;
  dt: number;
}

export function applyCameraRig({ camera, camPos, camLook, tx, ty, tz, th, isBike, camMode, time, dt }: CameraRigArgs) {
  const dx = Math.sin(th);
  const dz = Math.cos(th);

  if (camMode === 0) {
    // chase
    const dist = 9.5;
    const h = ty + 4.2;
    const want = new THREE.Vector3(tx - dx * dist, h, tz - dz * dist);
    const k = 1 - Math.pow(0.0015, dt);
    camPos.lerp(want, k);
    camera.position.copy(camPos);
    camLook.lerp(new THREE.Vector3(tx + dx * 4, ty + 1.6, tz + dz * 4), 1 - Math.pow(0.0005, dt));
    camera.lookAt(camLook);
  } else if (camMode === 1 || camMode === 2) {
    // cockpit / hood
    let ex: number, ey: number, ez: number, lookDrop = 2.2;
    if (camMode === 1 && !isBike) {
      ex = tx + Math.cos(th) * -0.35 + dx * 0.15;
      ez = tz - Math.sin(th) * -0.35 + dz * 0.15;
      ey = ty + 1.3;
      lookDrop = 0.9;
    } else if (camMode === 1) {
      ex = tx + dx * 0.2;
      ez = tz + dz * 0.2;
      ey = ty + 1.45;
    } else {
      ex = tx + dx * 1.9;
      ez = tz + dz * 1.9;
      ey = ty + 1.25;
    }
    camera.position.set(ex, ey, ez);
    camera.lookAt(ex + dx * 30, ey - lookDrop, ez + dz * 30);
    camPos.copy(camera.position);
    camLook.set(ex + dx * 30, ey - lookDrop, ez + dz * 30);
  } else {
    // cinematic — auto-cycling angles, same 4 phases/5s timings as the original
    const cT = time % 20;
    const phase = Math.floor(cT / 4);
    const ca = time * 0.18;
    let cx3: number, cy3: number, cz3: number, lx3: number, ly3: number, lz3: number;
    if (phase === 0) {
      cx3 = tx + Math.cos(ca) * 7.5; cy3 = ty + 0.42; cz3 = tz + Math.sin(ca) * 7.5;
      lx3 = tx; ly3 = ty + 0.45; lz3 = tz;
    } else if (phase === 1) {
      cx3 = tx + dx * 7 + dz * 5; cy3 = ty + 2.0; cz3 = tz + dz * 7 - dx * 5;
      lx3 = tx; ly3 = ty + 0.9; lz3 = tz;
    } else if (phase === 2) {
      cx3 = tx - dx * 9; cy3 = ty + 1.3; cz3 = tz - dz * 9;
      lx3 = tx + dx * 4; ly3 = ty + 0.7; lz3 = tz + dz * 4;
    } else if (phase === 3) {
      cx3 = tx + Math.cos(ca * 1.6) * 11; cy3 = ty + 4.5; cz3 = tz + Math.sin(ca * 1.6) * 11;
      lx3 = tx; ly3 = ty + 0.8; lz3 = tz;
    } else {
      cx3 = tx - dz * 6; cy3 = ty + 0.55; cz3 = tz + dx * 6;
      lx3 = tx; ly3 = ty + 0.6; lz3 = tz;
    }
    const k2 = 1 - Math.pow(0.004, dt);
    camPos.lerp(new THREE.Vector3(cx3, cy3, cz3), k2);
    camera.position.copy(camPos);
    camLook.lerp(new THREE.Vector3(lx3, ly3, lz3), k2);
    camera.lookAt(camLook);
  }
}
