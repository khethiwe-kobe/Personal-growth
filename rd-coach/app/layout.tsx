import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PasscodeGate } from "@/components/PasscodeGate";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "RD Coach",
  description: "Strength and conditioning coaching for RD preparation.",
};

export const viewport: Viewport = {
  themeColor: "#f3ede3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PasscodeGate>
          <Shell>{children}</Shell>
        </PasscodeGate>
      </body>
    </html>
  );
}
