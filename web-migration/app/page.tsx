"use client";

import dynamic from "next/dynamic";

// Canvas/WebGL/Rapier all need the browser — no server render for the game itself.
const Game = dynamic(() => import("@/components/Game"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#050814",
        color: "#fff",
        fontFamily: "monospace",
      }}
    >
      Loading Neon City Drive…
    </div>
  ),
});

export default function Home() {
  return <Game />;
}
