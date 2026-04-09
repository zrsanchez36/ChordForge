"use client";

import { useEffect, useRef } from "react";

const TWO_PI = Math.PI * 2;

function rgba({ r, g, b }, alpha) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function wrapPosition(value, max, padding = 0) {
  if (value < -padding) return max + padding;
  if (value > max + padding) return -padding;
  return value;
}

function createDustField(width, height, reducedMotion) {
  const count = clamp(
    Math.round((width * height) / (reducedMotion ? 30000 : 22000)),
    36,
    82,
  );
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: randomBetween(-0.18, 0.18),
    vy: randomBetween(-0.16, 0.16),
    size: randomBetween(0.45, 1.8),
    alpha: randomBetween(0.05, 0.22),
    pulse: randomBetween(0.004, 0.014),
    phase: randomBetween(0, TWO_PI),
    depth: randomBetween(0.55, 1.6),
  }));
}

function createGlowField(width, height) {
  return Array.from({ length: 12 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: randomBetween(-0.07, 0.07),
    vy: randomBetween(-0.05, 0.05),
    radius: randomBetween(80, 190),
    alpha: randomBetween(0.018, 0.05),
    pulse: randomBetween(0.0018, 0.0045),
    phase: randomBetween(0, TWO_PI),
  }));
}

function createStreakField(width, height, reducedMotion) {
  const count = reducedMotion ? 3 : 8;
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: randomBetween(-0.14, 0.14),
    vy: randomBetween(-0.48, -0.16),
    width: randomBetween(0.7, 1.6),
    length: randomBetween(26, 78),
    alpha: randomBetween(0.015, 0.055),
    pulse: randomBetween(0.006, 0.018),
    phase: randomBetween(0, TWO_PI),
  }));
}

export default function ParticleBackdrop({ accentRgb, energy }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const renderRef = useRef(() => {});
  const fieldsRef = useRef({ dust: [], glow: [], streaks: [] });
  const stateRef = useRef({
    accentRgb,
    energy,
    width: 0,
    height: 0,
    dpr: 1,
    reducedMotion: false,
  });

  useEffect(() => {
    stateRef.current = { ...stateRef.current, accentRgb, energy };
    if (stateRef.current.reducedMotion) renderRef.current();
  }, [accentRgb, energy]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext("2d");
    if (!context) return undefined;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncMotionPreference = () => {
      stateRef.current = { ...stateRef.current, reducedMotion: mediaQuery.matches };
    };
    syncMotionPreference();

    const initialize = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;

      // Guard: skip if canvas has no layout dimensions yet.
      // ResizeObserver will call us again once the element is sized.
      if (width === 0 || height === 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      stateRef.current = { ...stateRef.current, width, height, dpr };

      fieldsRef.current = {
        dust: createDustField(width, height, stateRef.current.reducedMotion),
        glow: createGlowField(width, height),
        streaks: createStreakField(width, height, stateRef.current.reducedMotion),
      };
    };

    const render = () => {
      const { accentRgb: color, energy: currentEnergy, width, height, dpr } = stateRef.current;

      // Guard: nothing to draw on a zero-dimension canvas — this is what
      // was silently erroring before and killing the animation loop.
      if (width === 0 || height === 0) return;

      const energyRatio = currentEnergy / 100;
      const baseSpeed = stateRef.current.reducedMotion
        ? 0.14 + energyRatio * 0.18
        : 0.36 + energyRatio * 1.08;
      const connectionDistance = 54 + energyRatio * 54;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const fieldGlow = context.createRadialGradient(
        width * 0.24, height * 0.22, 0,
        width * 0.24, height * 0.22, width * 0.44,
      );
      fieldGlow.addColorStop(0, rgba(color, 0.12 + energyRatio * 0.06));
      fieldGlow.addColorStop(0.45, rgba(color, 0.045));
      fieldGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = fieldGlow;
      context.fillRect(0, 0, width, height);

      const sideGlow = context.createRadialGradient(
        width * 0.82, height * 0.18, 0,
        width * 0.82, height * 0.18, width * 0.36,
      );
      sideGlow.addColorStop(0, rgba(color, 0.06 + energyRatio * 0.035));
      sideGlow.addColorStop(0.38, rgba(color, 0.025));
      sideGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = sideGlow;
      context.fillRect(0, 0, width, height);

      context.save();
      context.globalCompositeOperation = "screen";

      fieldsRef.current.glow.forEach((orb) => {
        orb.phase += orb.pulse;
        orb.x = wrapPosition(orb.x + orb.vx * baseSpeed, width, orb.radius);
        orb.y = wrapPosition(orb.y + orb.vy * baseSpeed, height, orb.radius);

        const alpha = orb.alpha * (0.72 + 0.28 * Math.sin(orb.phase));
        const gradient = context.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
        gradient.addColorStop(0, rgba(color, alpha));
        gradient.addColorStop(0.42, rgba(color, alpha * 0.28));
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

        context.fillStyle = gradient;
        context.beginPath();
        context.arc(orb.x, orb.y, orb.radius, 0, TWO_PI);
        context.fill();
      });

      context.restore();

      fieldsRef.current.dust.forEach((particle) => {
        particle.phase += particle.pulse;
        particle.x = wrapPosition(particle.x + particle.vx * baseSpeed * particle.depth, width);
        particle.y = wrapPosition(particle.y + particle.vy * baseSpeed * particle.depth, height);

        const alpha = particle.alpha * (0.62 + 0.38 * Math.sin(particle.phase));
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size * (0.92 + energyRatio * 0.26), 0, TWO_PI);
        context.fillStyle = rgba(color, alpha);
        context.fill();
      });

      const connectedDust = fieldsRef.current.dust.slice(0, 42);
      for (let i = 0; i < connectedDust.length; i++) {
        for (let j = i + 1; j < connectedDust.length; j++) {
          const start = connectedDust[i];
          const end = connectedDust[j];
          const dx = start.x - end.x;
          const dy = start.y - end.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            context.beginPath();
            context.moveTo(start.x, start.y);
            context.lineTo(end.x, end.y);
            context.strokeStyle = rgba(color, (1 - distance / connectionDistance) * (0.03 + energyRatio * 0.05));
            context.lineWidth = 0.45;
            context.stroke();
          }
        }
      }

      if (energyRatio > 0.16) {
        fieldsRef.current.streaks.forEach((streak) => {
          streak.phase += streak.pulse;
          streak.x = wrapPosition(streak.x + streak.vx * (0.9 + energyRatio * 2.2), width, streak.length);
          streak.y = wrapPosition(streak.y + streak.vy * (0.9 + energyRatio * 2.2), height, streak.length);

          const tailX = streak.x - streak.vx * streak.length * 5.5;
          const tailY = streak.y - streak.vy * streak.length * 5.5;
          const alpha = streak.alpha * energyRatio * (0.7 + 0.3 * Math.sin(streak.phase));
          const gradient = context.createLinearGradient(streak.x, streak.y, tailX, tailY);
          gradient.addColorStop(0, rgba(color, alpha));
          gradient.addColorStop(0.38, rgba(color, alpha * 0.28));
          gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

          context.beginPath();
          context.moveTo(streak.x, streak.y);
          context.lineTo(tailX, tailY);
          context.strokeStyle = gradient;
          context.lineWidth = streak.width;
          context.stroke();
        });
      }

      const vignette = context.createLinearGradient(0, 0, 0, height);
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(0.72, "rgba(0, 0, 0, 0.08)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.2)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);
    };

    const stopLoop = () => {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };

    const loop = () => {
      render();
      if (!stateRef.current.reducedMotion) {
        frameRef.current = window.requestAnimationFrame(loop);
      }
    };

    // ResizeObserver fires when the *element* changes size (including the
    // initial observation), catching the layout pass in Next.js App Router
    // where the canvas can be 0×0 at mount time.
    //
    // Critically: always stop-then-restart the loop here rather than gating
    // on `frameRef.current === 0`. The previous approach let the loop start
    // early (before initialize() succeeded), leaving frameRef non-zero even
    // though fieldsRef was still empty — so the guard never fired and the
    // loop ran forever drawing nothing.
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width === 0 || rect.height === 0) return;

      initialize();
      stopLoop(); // cancel any previous loop, even a dead/stale one
      render();

      if (!stateRef.current.reducedMotion) {
        frameRef.current = window.requestAnimationFrame(loop);
      }
    });
    ro.observe(canvas);

    const handleMotionChange = () => {
      syncMotionPreference();
      stopLoop();
      initialize();
      render();
      if (!stateRef.current.reducedMotion) {
        frameRef.current = window.requestAnimationFrame(loop);
      }
    };

    renderRef.current = render;
    initialize();

    // Only start the loop here if initialize() succeeded (canvas already had
    // layout dimensions). If it returned early, frameRef stays 0 and the
    // ResizeObserver above will start the loop once dimensions arrive.
    if (stateRef.current.width > 0) {
      render();
      if (!stateRef.current.reducedMotion) {
        frameRef.current = window.requestAnimationFrame(loop);
      }
    }

    mediaQuery.addEventListener("change", handleMotionChange);

    return () => {
      ro.disconnect(); // replaces window.removeEventListener("resize", ...)
      mediaQuery.removeEventListener("change", handleMotionChange);
      stopLoop();
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-backdrop" aria-hidden="true" />;
}
