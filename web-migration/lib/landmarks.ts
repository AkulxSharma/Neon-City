// Exact positions/colors from the original's LANDMARKS array. The original
// builds a distinct structure per landmark (park, stadium, tower, plaza,
// club, marina, police station); this build marks each spot with a beacon +
// label for now and reserves the coordinates — the actual structures
// (club interior, police station, etc.) are later milestones that slot in
// at these same coordinates rather than picking new ones.
export interface Landmark {
  name: string;
  x: number;
  z: number;
  col: string;
}

export const LANDMARKS: Landmark[] = [
  { name: "VENU", x: 0, z: -84.5 }, // CLUB.cx=0, CLUB.cz=-100, door at z+15.5 (see lib/club.ts)
  { name: "AUTO YARD", x: -48, z: 20, col: "#00e5ff" },
  { name: "CENTRAL PARK", x: 150, z: 150, col: "#3fdd66" },
  { name: "NEON STADIUM", x: -150, z: 150, col: "#4fd8ff" },
  { name: "SKY TOWER", x: 150, z: -150, col: "#dfe4ff" },
  { name: "FOUNTAIN PLAZA", x: -150, z: -150, col: "#b06bff" },
  { name: "HARBOR LAKE", x: 50, z: -250, col: "#2fb8ff" },
  { name: "EAST MARINA", x: 566, z: 50, col: "#2fe8ff" }, // original: SHORE_X-34, SHORE_X=600
  // moved off the original's raw (450,50) — that point sits exactly on the
  // chunk-grid road intersection (both x=450 and z=50 are road centerlines,
  // see City.tsx's CELL/ROAD_W), so the station was literally built in the
  // middle of the road. (490,90) is the nearest fully-clear interior block —
  // same corner of the map, just off the pavement.
  { name: "POLICE HARBOR", x: 490, z: 90, col: "#2452ff" },
  { name: "MIZU 21", x: 100, z: 0, col: "#f4c430" },
  // chunk (-3,1) — round(-300/100)=-3, round(100/100)=1 — free: every other
  // landmark rounds to (0,-1)/(0,0)/(2,2)/(-2,2)/(2,-2)/(-2,-2)/(1,-3)/(6,1)/
  // (5,1)/(1,0), none of them (-3,1). See components/Airport.tsx for the
  // whole-chunk layout built around this coordinate.
  { name: "INTERNATIONAL AIRPORT", x: -300, z: 100, col: "#8fd6ff" },
].map((l) => ({ col: "#ff3fd6", ...l })) as Landmark[];
