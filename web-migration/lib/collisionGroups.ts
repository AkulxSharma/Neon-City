import { interactionGroups } from "@react-three/rapier";

// group 0 = Player (components/Player.tsx), group 1 = "vehicles only" world
// geometry. Car/Bike/Traffic never set collisionGroups, so they default to
// Rapier's membership-in/collide-with-everything — tagging a collider
// VEHICLE_ONLY blocks them while staying invisible to the player's group-0
// collider, which is how the shore wall (Marina.tsx) and sidewalk curbs
// (City.tsx) let the character walk through where cars can't drive.
export const PLAYER_GROUPS = interactionGroups([0]);
export const VEHICLE_ONLY = interactionGroups([1], [1]);
