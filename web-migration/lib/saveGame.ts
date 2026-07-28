import { vehicleState } from "@/lib/vehicleState";
import { skyState } from "@/lib/skyState";
import { useHudStore, type ActiveMode, type CamMode, type LightMode } from "@/lib/hudStore";
import { isMuted } from "@/lib/audio";

const SAVE_KEY = "ncd_web_save_v1";

interface SaveData {
  active: ActiveMode;
  camMode: CamMode;
  // optional: saves written before headlights existed won't have it, and the
  // loader falls back to AUTO rather than crashing on an older save
  lightMode?: LightMode;
  muted: boolean;
  dayPhase: number;
  vehicles: typeof vehicleState;
}

/** Reads the save synchronously — safe to call during a lazy useState/useRef
 * initializer so a vehicle spawns in its saved spot on the very first frame,
 * no load-then-jump. Returns null if there's nothing saved (or SSR). */
export function loadSave(): SaveData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

export function saveGame() {
  if (typeof window === "undefined") return;
  try {
    const hud = useHudStore.getState();
    const data: SaveData = {
      active: hud.active,
      camMode: hud.camMode,
      lightMode: hud.lightMode,
      muted: isMuted(),
      dayPhase: skyState.phase,
      vehicles: vehicleState,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // storage full/unavailable — not worth surfacing to the player
  }
}
