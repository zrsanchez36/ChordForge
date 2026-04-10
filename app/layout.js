import { IBM_Plex_Mono, Syne } from "next/font/google";
import "./globals.css";

const displayFont = Syne({
  subsets: ["latin"],
  variable: "--font-display",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata = {
  title: "ChordForge",
  description:
    "ChordForge turns genre and mood into playable chord progressions with AI generation, live browser playback, session recall, and instrument-friendly voicing previews.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ChordForge",
  },
};

export const viewport = {
  themeColor: "#eb7c33",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${monoFont.variable}`}>{children}</body>
    </html>
  );
}
