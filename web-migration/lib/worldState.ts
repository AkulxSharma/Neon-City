// Shared per-frame player-position singleton, same pattern as skyState in
// SkyCycle.tsx — a plain mutable object, not React state, so the city
// chunk-streamer can read it every frame without subscribing/re-rendering.
// Whichever vehicle is active writes its own position here (mirrors the
// original's `player.veh ? player.veh.x : player.x`).
export const worldState = { px: 0, pz: 0, heading: 0 };
