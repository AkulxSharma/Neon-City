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
  { name: "VENU", x: -50, z: -34.5 }, // CLUB.cx=-50, CLUB.cz=-50, z+15.5
  { name: "AUTO YARD", x: -48, z: 20, col: "#00e5ff" },
  { name: "CENTRAL PARK", x: 150, z: 150, col: "#3fdd66" },
  { name: "NEON STADIUM", x: -150, z: 150, col: "#4fd8ff" },
  { name: "SKY TOWER", x: 150, z: -150, col: "#dfe4ff" },
  { name: "FOUNTAIN PLAZA", x: -150, z: -150, col: "#b06bff" },
  { name: "HARBOR LAKE", x: 50, z: -250, col: "#2fb8ff" },
  { name: "EAST MARINA", x: 66, z: 50, col: "#2fe8ff" }, // original: SHORE_X-34, SHORE_X=100 here (see City.tsx SHORE_CI)
  { name: "POLICE HARBOR", x: 450, z: 50, col: "#2452ff" },
].map((l) => ({ col: "#ff3fd6", ...l })) as Landmark[];
