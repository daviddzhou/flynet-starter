import "./globals.css";
import "leaflet/dist/leaflet.css";
// The Flynet component theme. Import it once, at the root.
import "@flynetdev/react/styles.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { DevDrawer } from "../components/dev-drawer";
import { env } from "../lib/env";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Passport Quest",
  description: "A consumer discovery quest demo built on Flynet.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        {/* Developer onboarding drawer — dev builds only, never shipped to prod. */}
        {env.NODE_ENV !== "production" ? <DevDrawer /> : null}
      </body>
    </html>
  );
}
