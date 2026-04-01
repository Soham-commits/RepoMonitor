"use client";

import { useEffect } from "react";
import { Geist_Mono, Playfair_Display } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const satoshi = localFont({
  src: [
    {
      path: "../satoshi/Satoshi-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../satoshi/Satoshi-Medium.otf",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["700"],
  display: "swap",
});

const instrumentSerif = localFont({
  src: "../InstrumentSerif-Italic.ttf",
  variable: "--font-instrument-serif",
  style: "normal",
  weight: "400",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    console.log(
      "%cIgnisTrack",
      "background:#1E2CFF;color:#FFFFFF;font-weight:700;padding:4px 10px;border-radius:9999px;"
    );
    console.log(
      "%cBuilt by Soham Chandratre · MIT-WPU · Ignisia 2026",
      "color:#B06CFF;"
    );
    console.log("%cgithub.com/Soham-commits", "color:#6A3DFF;");
  }, []);

  return (
    <html
      lang="en"
      className={`${satoshi.variable} ${geistMono.variable} ${playfair.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
