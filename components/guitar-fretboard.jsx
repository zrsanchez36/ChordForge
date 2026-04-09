import { normalizePitchClass } from "@/lib/chord-forge";

const STRING_TUNING = [
  { id: "high-e", label: "E", pitch: "E" },
  { id: "b", label: "B", pitch: "B" },
  { id: "g", label: "G", pitch: "G" },
  { id: "d", label: "D", pitch: "D" },
  { id: "a", label: "A", pitch: "A" },
  { id: "low-e", label: "E", pitch: "E" },
];

const FRETS = [0, 1, 2, 3, 4, 5];
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

const SEMITONE_TO_PITCH = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

function transposePitch(pitch, frets) {
  const semitone = NOTE_TO_SEMITONE[pitch];
  if (semitone === undefined) {
    return pitch;
  }

  return SEMITONE_TO_PITCH[(semitone + frets) % 12];
}

export default function GuitarFretboard({ notes = [] }) {
  const displayNotes = notes.filter(Boolean);
  const rootPitchClass = normalizePitchClass(displayNotes[0]);
  const noteLabelByPitchClass = new Map(
    displayNotes.map((note) => [normalizePitchClass(note), note]),
  );
  const activePitchClasses = new Set(noteLabelByPitchClass.keys());

  return (
    <div className="guitar-fretboard" aria-label="Guitar fretboard preview">
      <div className="guitar-fretboard__header">
        <span className="guitar-fretboard__header-spacer" />
        {FRETS.map((fret) => (
          <span key={fret} className="guitar-fretboard__fret-label">
            {fret === 0 ? "Open" : fret}
          </span>
        ))}
      </div>

      <div className="guitar-fretboard__rows">
        {STRING_TUNING.map((string) => (
          <div key={string.id} className="guitar-fretboard__row">
            <span className="guitar-fretboard__string-label">{string.label}</span>
            {FRETS.map((fret) => {
              const pitchClass = transposePitch(string.pitch, fret);
              const isActive = activePitchClasses.has(pitchClass);
              const isRoot = pitchClass === rootPitchClass;
              const markerLabel = noteLabelByPitchClass.get(pitchClass) || pitchClass;

              return (
                <div
                  key={`${string.id}-${fret}`}
                  className={`guitar-fretboard__cell ${
                    fret === 0 ? "is-open" : ""
                  } ${isActive ? "is-active" : ""} ${isRoot ? "is-root" : ""}`}
                >
                  {isActive ? (
                    <span className="guitar-fretboard__marker">{markerLabel}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
