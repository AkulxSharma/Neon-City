import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neon City Drive",
  description: "Web rewrite — Next.js + React Three Fiber + Rapier physics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
