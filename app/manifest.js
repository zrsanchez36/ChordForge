export default function manifest() {
  return {
    name: "ChordForge",
    short_name: "ChordForge",
    description:
      "ChordForge turns genre and mood into playable chord progressions with AI generation, browser playback, and saveable recall.",
    start_url: "/",
    display: "standalone",
    background_color: "#05060a",
    theme_color: "#eb7c33",
    icons: [
      {
        src: "/icons/192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
