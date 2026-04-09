import { normalizePitchClass } from "@/lib/chord-forge";

const WHITE_KEYS = ["C", "D", "E", "F", "G", "A", "B"];
const BLACK_KEYS = [
  { note: "C#", sharpLabel: "C#", flatLabel: "Db", left: "12.5%" },
  { note: "D#", sharpLabel: "D#", flatLabel: "Eb", left: "27.4%" },
  { note: "F#", sharpLabel: "F#", flatLabel: "Gb", left: "56.6%" },
  { note: "G#", sharpLabel: "G#", flatLabel: "Ab", left: "71.2%" },
  { note: "A#", sharpLabel: "A#", flatLabel: "Bb", left: "85.8%" },
];

export default function MiniKeyboard({ notes = [] }) {
  const activeNotes = new Set(notes.map((note) => normalizePitchClass(note)).filter(Boolean));
  const preferFlatLabels =
    notes.some((note) => String(note).includes("b")) &&
    !notes.some((note) => String(note).includes("#"));

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
        {BLACK_KEYS.map(({ note, sharpLabel, flatLabel, left }) => (
          <div
            key={note}
            className={`mini-key mini-key--black ${activeNotes.has(note) ? "is-active" : ""}`}
            style={{ left }}
          >
            <span>{preferFlatLabels ? flatLabel : sharpLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
