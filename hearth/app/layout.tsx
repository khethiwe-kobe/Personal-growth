import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AppProvider } from "@/lib/store";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Hearth",
  description: "Shared household budget for Khethiwe and KB",
};

const themeScript = `
try {
  if (localStorage.getItem('hearth-theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${manrope.variable} font-sans`}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
