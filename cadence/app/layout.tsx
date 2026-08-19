import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";

const ui = Instrument_Sans({ subsets: ["latin"], variable: "--font-ui" });
const display = Fraunces({
  subsets: ["latin"], variable: "--font-display", weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: { default: "Cadence", template: "%s · Cadence" },
  description:
    "A private accountability and productivity app for three friends — plan the day, keep the goals, see the growth.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#191917" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const appearance = user?.appearance ?? "system";
  const themeAttr = appearance === "system" ? undefined : appearance;
  return (
    <html lang="en" data-theme={themeAttr} suppressHydrationWarning>
      <head>
        {appearance === "system" && (
          <script
            // Resolve system appearance before paint; keeps in sync live.
            dangerouslySetInnerHTML={{
              __html: `(function(){var m=window.matchMedia('(prefers-color-scheme: dark)');function a(){document.documentElement.dataset.theme=m.matches?'dark':'light'}a();m.addEventListener('change',a);})();`,
            }}
          />
        )}
      </head>
      <body className={`${ui.variable} ${display.variable} min-h-dvh`}>{children}</body>
    </html>
  );
}
