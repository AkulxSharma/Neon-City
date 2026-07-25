"use client";

import dynamic from "next/dynamic";

// Standalone preview for Buildings + Crowd — isolated from the main game route.
const CrowdScene = dynamic(() => import("@/components/CrowdScene"), { ssr: false });

export default function CrowdTestPage() {
  return <CrowdScene />;
}
