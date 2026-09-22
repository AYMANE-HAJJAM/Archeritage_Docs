import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";

import "./globals.css";

const ui = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const display = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "ARCHERITAGE Docs", template: "%s · ARCHERITAGE Docs" },
  description: "Bibliothèque documentaire privée ARCHERITAGE",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${ui.variable} ${display.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
