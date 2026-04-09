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
    "Mood-shaped chord generation with Anthropic, browser playback, and saved session recall.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${monoFont.variable}`}>{children}</body>
    </html>
  );
}
