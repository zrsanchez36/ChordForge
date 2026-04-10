import { ImageResponse } from "next/og";

const BACKGROUND = "linear-gradient(145deg, #05060a 0%, #0f131d 58%, #1a2232 100%)";
const ACCENT = "#eb7c33";
const ACCENT_SOFT = "rgba(235, 124, 51, 0.24)";
const BLUE_SOFT = "rgba(103, 162, 255, 0.14)";

export function ChordForgeIcon({ size }) {
  const ringSize = Math.round(size * 0.64);
  const barGap = Math.round(size * 0.056);
  const barWidth = Math.round(size * 0.09);
  const borderSize = Math.max(Math.round(size * 0.016), 6);

  const barBaseStyle = {
    width: `${barWidth}px`,
    borderRadius: `${Math.round(size * 0.05)}px`,
    background: `linear-gradient(180deg, rgba(255, 213, 181, 0.98) 0%, ${ACCENT} 100%)`,
    boxShadow: `0 0 ${Math.round(size * 0.1)}px rgba(235, 124, 51, 0.22)`,
  };

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: `${Math.round(size * 0.24)}px`,
        background: BACKGROUND,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: `${Math.round(size * 0.08)}px`,
          borderRadius: `${Math.round(size * 0.18)}px`,
          background: `radial-gradient(circle at 28% 24%, ${ACCENT_SOFT}, transparent 34%), radial-gradient(circle at 74% 76%, ${BLUE_SOFT}, transparent 32%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          width: `${ringSize}px`,
          height: `${ringSize}px`,
          borderRadius: "999px",
          border: `${borderSize}px solid rgba(235, 124, 51, 0.92)`,
          boxShadow: `0 0 ${Math.round(size * 0.12)}px rgba(235, 124, 51, 0.18)`,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: `${barGap}px`,
          position: "relative",
        }}
      >
        <div
          style={{
            ...barBaseStyle,
            height: `${Math.round(size * 0.27)}px`,
            transform: `translateY(${Math.round(size * 0.04)}px)`,
          }}
        />
        <div
          style={{
            ...barBaseStyle,
            height: `${Math.round(size * 0.42)}px`,
            transform: `translateY(${Math.round(size * -0.01)}px)`,
          }}
        />
        <div
          style={{
            ...barBaseStyle,
            height: `${Math.round(size * 0.2)}px`,
            transform: `translateY(${Math.round(size * 0.06)}px)`,
          }}
        />
      </div>
    </div>
  );
}

export function createIconResponse(size) {
  return new ImageResponse(<ChordForgeIcon size={size} />, {
    width: size,
    height: size,
  });
}
