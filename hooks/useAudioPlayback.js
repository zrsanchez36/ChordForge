"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizePitchClass } from "@/lib/chord-forge";

const NOTE_TO_SEMITONE = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

const OSCILLATOR_BY_GENRE = {
  Jazz: "triangle",
  Pop: "triangle",
  Rock: "square",
  Classical: "sine",
  "Lo-fi": "triangle",
  "R&B": "sine",
  Electronic: "sawtooth",
  Folk: "triangle",
  Blues: "triangle",
  Ambient: "sine",
};

function noteToMidi(note, floor) {
  const normalized = normalizePitchClass(note);
  const semitone = normalized ? NOTE_TO_SEMITONE[normalized] : undefined;

  if (semitone === undefined) {
    return null;
  }

  let midi = 48 + semitone;
  while (midi <= floor) {
    midi += 12;
  }

  return midi;
}

function chordToFrequencies(notes) {
  if (!Array.isArray(notes) || notes.length === 0) {
    return [261.63, 329.63, 392];
  }

  const midiNotes = [];
  let floor = 40;

  notes.slice(0, 5).forEach((note, index) => {
    const midi = noteToMidi(note, index === 0 ? floor : floor + 2);
    if (midi !== null) {
      midiNotes.push(midi);
      floor = midi;
    }
  });

  if (midiNotes.length === 0) {
    return [261.63, 329.63, 392];
  }

  const withBass = [Math.max(midiNotes[0] - 12, 28), ...midiNotes];
  return withBass.map((midi) => 440 * 2 ** ((midi - 69) / 12));
}

export function useAudioPlayback({ genre, progression, onError }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChordIndex, setCurrentChordIndex] = useState(-1);

  const audioContextRef = useRef(null);
  const activeNodesRef = useRef([]);
  const timeoutsRef = useRef([]);

  const stopPlayback = useCallback(() => {
    timeoutsRef.current.forEach((timer) => window.clearTimeout(timer));
    timeoutsRef.current = [];

    activeNodesRef.current.forEach((node) => {
      try {
        node.stop?.();
      } catch {}

      try {
        node.disconnect?.();
      } catch {}
    });

    activeNodesRef.current = [];
    setCurrentChordIndex(-1);
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      stopPlayback();

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stopPlayback]);

  const handlePlayback = useCallback(async () => {
    if (!progression?.chords?.length) {
      return;
    }

    if (isPlaying) {
      stopPlayback();
      return;
    }

    if (typeof window === "undefined" || typeof window.AudioContext === "undefined") {
      onError("Web Audio is not available in this browser.");
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    stopPlayback();
    setIsPlaying(true);

    const context = audioContextRef.current;
    const oscillatorType = OSCILLATOR_BY_GENRE[genre] || "triangle";
    const beatSeconds = 60 / Math.max(progression.tempoBpm || 96, 48);
    const startTime = context.currentTime + 0.05;
    let cursor = startTime;
    const scheduledNodes = [];
    const scheduledTimers = [];

    progression.chords.forEach((chord, index) => {
      const duration = Math.max(chord.beats * beatSeconds, 0.4);
      const frequencies = chordToFrequencies(chord.notes);

      scheduledTimers.push(
        window.setTimeout(() => {
          setCurrentChordIndex(index);
        }, Math.max(0, (cursor - context.currentTime) * 1000)),
      );

      frequencies.forEach((frequency, noteIndex) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = noteIndex === 0 ? "sine" : oscillatorType;
        oscillator.frequency.value = frequency;

        gain.gain.setValueAtTime(0.0001, cursor);
        gain.gain.exponentialRampToValueAtTime(
          noteIndex === 0 ? 0.085 : 0.048,
          cursor + 0.02,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, cursor + duration - 0.06);

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start(cursor);
        oscillator.stop(cursor + duration);

        scheduledNodes.push(oscillator, gain);
      });

      cursor += duration;
    });

    scheduledTimers.push(
      window.setTimeout(() => {
        setCurrentChordIndex(-1);
        setIsPlaying(false);
      }, Math.max(0, (cursor - context.currentTime) * 1000) + 120),
    );

    activeNodesRef.current = scheduledNodes;
    timeoutsRef.current = scheduledTimers;
  }, [genre, isPlaying, onError, progression, stopPlayback]);

  return { isPlaying, currentChordIndex, stopPlayback, handlePlayback };
}
