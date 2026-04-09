"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import GuitarFretboard from "@/components/guitar-fretboard";
import MiniKeyboard from "@/components/mini-keyboard";
import ParticleBackdrop from "@/components/particle-backdrop";
import {
  DEFAULT_MOODS,
  GENRES,
  MOOD_CONFIG,
  SHOWCASE_SESSION,
  clampMoodValue,
  describeComplexity,
  describeEmotion,
  describeEnergy,
  moodToRgb,
  toHex,
} from "@/lib/chord-forge";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useProgressionHistory } from "@/hooks/useProgressionHistory";

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}

function formatSessionDate(value) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Recent";
  }
}

function ForgeMark() {
  return (
    <svg className="forge-mark" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <circle cx="26" cy="26" r="25" className="forge-mark__ring" />
      <path
        d="M17 33V19.8C17 18.806 17.806 18 18.8 18H20.4C21.394 18 22.2 18.806 22.2 19.8V33"
        className="forge-mark__line"
      />
      <path
        d="M25.2 33V15.8C25.2 14.806 26.006 14 27 14H28.6C29.594 14 30.4 14.806 30.4 15.8V33"
        className="forge-mark__line"
      />
      <path
        d="M33.4 33V23.8C33.4 22.806 34.206 22 35.2 22H36.8C37.794 22 38.6 22.806 38.6 23.8V33"
        className="forge-mark__line"
      />
    </svg>
  );
}

function SliderRow({ config, value, onChange }) {
  return (
    <div className="slider-row">
      <div className="slider-row__header">
        <div>
          <p className="slider-row__label">{config.label}</p>
          <p className="slider-row__legend">
            {config.left} to {config.right}
          </p>
        </div>
        <span className="slider-row__value">{value}</span>
      </div>
      <div className="slider-row__track">
        <div className="slider-row__fill" style={{ width: `${value}%` }} />
        <input
          className="mood-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value={value}
          onChange={(event) => onChange(config.key, event.target.value)}
          aria-label={config.label}
        />
      </div>
      <div className="slider-row__endcaps">
        <span>{config.left}</span>
        <span>{config.right}</span>
      </div>
    </div>
  );
}

function ChordCard({ chord, visible, active, onClick }) {
  return (
    <button
      type="button"
      className={`chord-card ${visible ? "is-visible" : ""} ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      <div className="chord-card__top">
        <div>
          <p className="chord-card__name">{chord.name}</p>
          <p className="chord-card__function">{chord.function}</p>
        </div>
        <span className="chord-card__roman">{chord.romanNumeral}</span>
      </div>
      <div className="chord-card__notes">
        {chord.notes.map((note, index) => (
          <span key={`${note}-${index}`} className="chord-card__note">
            {note}
          </span>
        ))}
      </div>
      <p className="chord-card__beats">
        {chord.beats} {chord.beats === 1 ? "beat" : "beats"}
      </p>
    </button>
  );
}

function SessionRow({ session, active, onLoad }) {
  return (
    <button
      type="button"
      className={`session-row ${active ? "is-active" : ""}`}
      onClick={() => onLoad(session)}
    >
      <div className="session-row__top">
        <span>{session.genre}</span>
        <span>{formatSessionDate(session.createdAt)}</span>
      </div>
      <p className="session-row__title">{session.progression.key}</p>
      <p className="session-row__summary">{session.progression.feel}</p>
    </button>
  );
}

export default function ChordForgeStudio({
  initialSession = SHOWCASE_SESSION,
}) {
  const [genre, setGenre] = useState(initialSession.genre ?? "Jazz");
  const [moods, setMoods] = useState(initialSession.moods ?? DEFAULT_MOODS);
  const [progression, setProgression] = useState(initialSession.progression ?? null);
  const [progressionSource, setProgressionSource] = useState(
    initialSession.source ?? "preview",
  );
  const [engineMeta, setEngineMeta] = useState({
    provider: initialSession.source === "preview" ? "Preview" : "Anthropic",
  });
  const [visibleCards, setVisibleCards] = useState([]);
  const [focusedChordIndex, setFocusedChordIndex] = useState(0);
  const [instrumentView, setInstrumentView] = useState("piano");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const requestAbortRef = useRef(null);

  const { isPlaying, currentChordIndex, stopPlayback, handlePlayback } = useAudioPlayback({
    genre,
    progression,
    onError: setError,
  });

  const accentRgb = moodToRgb(moods.emotion, moods.energy);
  const accent = toHex(accentRgb);
  const inspectedChordIndex =
    currentChordIndex >= 0 ? currentChordIndex : focusedChordIndex;
  const inspectedChord =
    progression?.chords?.[inspectedChordIndex] ?? progression?.chords?.[0] ?? null;

  // Stable callback so the history hook's handleLoadHistory doesn't re-create on every render
  const handleSessionLoad = useCallback((session) => {
    setGenre(session.genre);
    setMoods(session.moods);
    setProgression(session.progression);
    setProgressionSource(session.source ?? "history");
    setEngineMeta({ provider: "History recall" });
    setError("");
  }, []);

  const {
    history,
    activeHistoryId,
    addToHistory,
    handleLoadHistory,
    handleClearHistory,
  } = useProgressionHistory({
    onStopPlayback: stopPlayback,
    onLoadSession: handleSessionLoad,
  });

  useEffect(() => {
    setFocusedChordIndex(0);
    setVisibleCards([]);

    if (!progression?.chords?.length) {
      return undefined;
    }

    const timers = progression.chords.map((_, index) =>
      window.setTimeout(() => {
        setVisibleCards((previous) =>
          previous.includes(index) ? previous : [...previous, index],
        );
      }, 100 + index * 90),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [progression]);

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
    };
  }, []);

  const handleMoodChange = (key, value) => {
    setMoods((previous) => ({
      ...previous,
      [key]: clampMoodValue(value),
    }));
  };

  const handleGenerate = async () => {
    stopPlayback();
    requestAbortRef.current?.abort();

    const controller = new AbortController();
    requestAbortRef.current = controller;

    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ genre, moods }),
        signal: controller.signal,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error || "Chord generation failed. Please try again.",
        );
      }

      const nextProgression = payload.progression;
      const nextHistoryEntry = {
        id: createSessionId(),
        createdAt: new Date().toISOString(),
        genre,
        moods,
        source: "anthropic",
        progression: nextProgression,
      };

      startTransition(() => {
        setProgression(nextProgression);
        setProgressionSource("anthropic");
        setEngineMeta(payload.meta ?? { provider: "Anthropic" });
        addToHistory(nextHistoryEntry);
      });
    } catch (generationError) {
      if (generationError?.name !== "AbortError") {
        setError(
          generationError instanceof Error
            ? generationError.message
            : "Chord generation failed. Please try again.",
        );
      }
    } finally {
      if (requestAbortRef.current === controller) {
        requestAbortRef.current = null;
      }

      setIsGenerating(false);
    }
  };

  return (
    <section
      className="studio"
      style={{
        "--accent": accent,
        "--accent-rgb": `${Math.round(accentRgb.r)}, ${Math.round(accentRgb.g)}, ${Math.round(
          accentRgb.b,
        )}`,
      }}
    >
      <ParticleBackdrop accentRgb={accentRgb} energy={moods.energy} />
      <div className="studio__noise" aria-hidden="true" />

      <div className="studio__content">
        <header className="studio__header">
          <div className="studio__brand">
            <ForgeMark />
            <div>
              <p className="eyebrow">Adaptive harmony instrument</p>
              <h1>ChordForge</h1>
              <p className="studio__lede">
                Shape the mood vector, generate a progression, and audition it
                instantly in the browser.
              </p>
            </div>
          </div>

          <div className="studio__readouts">
            <div className="readout">
              <span>Accent</span>
              <strong>{accent}</strong>
            </div>
            <div className="readout">
              <span>Engine</span>
              <strong>
                {progressionSource === "preview"
                  ? "Preview session"
                  : engineMeta?.provider || "Anthropic"}
              </strong>
            </div>
          </div>
        </header>

        <div className="studio__grid">
          <aside className="panel panel--controls">
            <section className="panel-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Genre</p>
                  <h2>Choose the frame</h2>
                </div>
              </div>

              <div className="genre-grid">
                {GENRES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`genre-chip ${genre === item ? "is-active" : ""}`}
                    onClick={() => setGenre(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="panel-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Mood Vector</p>
                  <h2>Energy moves the air. Emotion paints it.</h2>
                </div>
              </div>

              <div className="mood-copy">
                <span>{describeEnergy(moods.energy)}</span>
                <span>{describeEmotion(moods.emotion)}</span>
                <span>{describeComplexity(moods.complexity)}</span>
              </div>

              <div className="slider-stack">
                {MOOD_CONFIG.map((config) => (
                  <SliderRow
                    key={config.key}
                    config={config}
                    value={moods[config.key]}
                    onChange={handleMoodChange}
                  />
                ))}
              </div>
            </section>

            <section className="panel-section panel-section--cta">
              <button
                type="button"
                className="primary-button"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? "Composing progression..." : "Generate progression"}
              </button>

              <p className="support-copy">
                Requests are routed through <code>/api/generate</code>, so the
                Anthropic key stays server-side.
              </p>

              {error ? <p className="status status--error">{error}</p> : null}
            </section>
          </aside>

          <main className="panel panel--stage">
            <div className="stage__header">
              <div>
                <p className="eyebrow">Composition Window</p>
                <h2>
                  {progression?.feel ||
                    "Set a mood and let the harmony engine sketch the contour."}
                </h2>
              </div>

              {progression ? (
                <div className="meta-grid">
                  <div className="meta-stat">
                    <span>Key</span>
                    <strong>{progression.key}</strong>
                  </div>
                  <div className="meta-stat">
                    <span>Tempo</span>
                    <strong>{progression.tempoBpm} BPM</strong>
                  </div>
                  <div className="meta-stat">
                    <span>Feel</span>
                    <strong>{progression.tempoLabel}</strong>
                  </div>
                </div>
              ) : null}
            </div>

            <p className="stage__tip">
              {progression?.playingTip ||
                "The built-in preview session is loaded so playback and voicing inspection work before the API key is wired in."}
            </p>

            {progression?.chords?.length ? (
              <div className="chord-grid">
                {progression.chords.map((chord, index) => (
                  <ChordCard
                    key={chord.id || `${chord.name}-${index}`}
                    chord={chord}
                    visible={visibleCards.includes(index)}
                    active={index === inspectedChordIndex}
                    onClick={() => setFocusedChordIndex(index)}
                  />
                ))}
              </div>
            ) : (
              <div className="stage__empty">
                <p>No progression loaded yet.</p>
              </div>
            )}
          </main>

          <aside className="panel panel--utility">
            <section className="panel-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Transport</p>
                  <h2>
                    {isPlaying && inspectedChord
                      ? `Now sounding ${inspectedChord.name}`
                      : "Audition the progression"}
                  </h2>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handlePlayback}
                  disabled={!progression?.chords?.length || isGenerating}
                >
                  {isPlaying ? "Stop" : "Play"}
                </button>
              </div>

              {inspectedChord ? (
                <>
                  <div className="transport-callout">
                    <span>{inspectedChord.romanNumeral}</span>
                    <strong>{inspectedChord.name}</strong>
                    <p>
                      {inspectedChord.function} · {inspectedChord.beats}{" "}
                      {inspectedChord.beats === 1 ? "beat" : "beats"}
                    </p>
                  </div>
                  <div className="instrument-toggle" role="tablist" aria-label="Instrument view">
                    {[
                      { id: "piano", label: "Piano" },
                      { id: "guitar", label: "Guitar" },
                    ].map((view) => (
                      <button
                        key={view.id}
                        type="button"
                        role="tab"
                        aria-selected={instrumentView === view.id}
                        className={`instrument-toggle__button ${
                          instrumentView === view.id ? "is-active" : ""
                        }`}
                        onClick={() => setInstrumentView(view.id)}
                      >
                        {view.label}
                      </button>
                    ))}
                  </div>
                  <p className="instrument-hint">
                    {instrumentView === "piano"
                      ? "Keyboard voicing map for the selected chord."
                      : "First-position fretboard map using the chord's spelled notes."}
                  </p>
                  {instrumentView === "piano" ? (
                    <MiniKeyboard notes={inspectedChord.notes} />
                  ) : (
                    <GuitarFretboard notes={inspectedChord.notes} />
                  )}
                </>
              ) : (
                <p className="support-copy">
                  Generate a progression to unlock transport and voicing preview.
                </p>
              )}
            </section>

            <section className="panel-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Session Memory</p>
                  <h2>Recent takes</h2>
                </div>
                {history.length ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleClearHistory}
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              {history.length ? (
                <div className="history-list">
                  {history.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      active={activeHistoryId === session.id}
                      onLoad={handleLoadHistory}
                    />
                  ))}
                </div>
              ) : (
                <p className="support-copy">
                  Generated sessions stay in this browser so you can recall a take
                  quickly without wiring a database yet.
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}
