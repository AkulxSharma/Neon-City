"use client";

import { useEffect, useRef } from "react";

export interface KeyState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
  boost: boolean;
}

const CODE_MAP: Record<string, keyof KeyState> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "handbrake",
  ShiftLeft: "boost",
  ShiftRight: "boost",
};

/** Live keyboard state in a ref — read inside useFrame, never triggers a re-render. */
export function useKeyboard() {
  const state = useRef<KeyState>({
    forward: false,
    back: false,
    left: false,
    right: false,
    handbrake: false,
    boost: false,
  });

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const k = CODE_MAP[e.code];
      if (k) {
        state.current[k] = true;
        if (k === "handbrake") e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const k = CODE_MAP[e.code];
      if (k) state.current[k] = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  return state;
}
