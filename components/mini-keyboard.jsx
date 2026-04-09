import { normalizePitchClass } from "@/lib/chord-forge";

const WHITE_KEYS = ["C", "D", "E", "F", "G", "A", "B"];
const BLACK_KEYS = [
  { note: "C#", left: "12.5%" },
  { note: "D#", left: "27.4%" },
  { note: "F#", left: "56.6%" },
  { note: "G#", left: "71.2%" },
  { note: "A#", left: "85.8%" },
];

export default function MiniKeyboard({ notes = [] }) {
  const activeNotes = new Set(notes.map((note) => normalizePitchClass(note)).filter(Boolean));

  return (
    <div className="mini-keyboard" aria-label="Chord voicing preview">
      <div className="mini-keyboard__white">
        {WHITE_KEYS.map((note) => (
          <div
            key={note}
            className={`mini-key mini-key--white ${activeNotes.has(note) ? "is-active" : ""}`}
          >
            <span>{note}</span>
          </div>
        ))}
      </div>
      <div className="mini-keyboard__black">
        {BLACK_KEYS.map(({ note, left }) => (
          <div
            key={note}
            className={`mini-key mini-key--black ${activeNotes.has(note) ? "is-active" : ""}`}
            style={{ left }}
          >
            <span>{note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
