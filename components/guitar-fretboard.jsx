import { normalizePitchClass, sanitizeDisplayPitch } from "@/lib/chord-forge";

const STRING_TUNING = [
  { id: "low-e", label: "Low E", shortLabel: "E", pitch: "E" },
  { id: "a", label: "A", shortLabel: "A", pitch: "A" },
  { id: "d", label: "D", shortLabel: "D", pitch: "D" },
  { id: "g", label: "G", shortLabel: "G", pitch: "G" },
  { id: "b", label: "B", shortLabel: "B", pitch: "B" },
  { id: "high-e", label: "High E", shortLabel: "E", pitch: "E" },
];

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

const SEARCH_GROUPS = [
  [0, 1, 2, 3, 4, 5],
  [1, 2, 3, 4, 5],
  [0, 1, 2, 3, 4],
  [1, 2, 3, 4],
  [2, 3, 4, 5],
];

const MAX_SEARCH_FRET = 12;
const WINDOW_SIZE = 4;

const CANONICAL_TO_FLAT = {
  "A#": "Bb",
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
};

function transposePitch(pitch, frets) {
  const semitone = NOTE_TO_SEMITONE[pitch];
  if (semitone === undefined) {
    return pitch;
  }

  const nextSemitone = (semitone + frets) % 12;
  return Object.keys(NOTE_TO_SEMITONE).find(
    (key) => NOTE_TO_SEMITONE[key] === nextSemitone,
  );
}

function uniquePitchClasses(notes) {
  return Array.from(
    new Set(notes.map((note) => normalizePitchClass(note)).filter(Boolean)),
  );
}

function buildNoteLabelMap(notes) {
  return new Map(
    notes
      .map((note) => [normalizePitchClass(note), sanitizeDisplayPitch(note)])
      .filter(([pitchClass, label]) => pitchClass && label),
  );
}

function parseChordRoot(chord) {
  return sanitizeDisplayPitch(chord?.name) || sanitizeDisplayPitch(chord?.notes?.[0]);
}

function formatPitchClass(pitchClass, noteLabelByPitchClass) {
  return (
    noteLabelByPitchClass.get(pitchClass) ||
    CANONICAL_TO_FLAT[pitchClass] ||
    pitchClass
  );
}

function getPitchAtStringFret(stringIndex, fret) {
  return transposePitch(STRING_TUNING[stringIndex].pitch, fret);
}

function getCandidateFrets(stringIndex, chordPitchClasses, windowStart) {
  const allowOpen = windowStart <= 2;
  const frets = [];

  for (let fret = 0; fret <= MAX_SEARCH_FRET; fret += 1) {
    if (fret === 0 && !allowOpen) {
      continue;
    }

    if (fret !== 0 && (fret < windowStart || fret > windowStart + WINDOW_SIZE - 1)) {
      continue;
    }

    const pitchClass = getPitchAtStringFret(stringIndex, fret);
    if (chordPitchClasses.includes(pitchClass)) {
      frets.push(fret);
    }
  }

  return frets;
}

function scoreShape({
  positions,
  rootPitchClass,
  chordPitchClasses,
  extensionPitchClasses,
}) {
  const sounded = positions
    .map((position, stringIndex) =>
      typeof position === "number"
        ? {
            fret: position,
            stringIndex,
            pitchClass: getPitchAtStringFret(stringIndex, position),
          }
        : null,
    )
    .filter(Boolean);

  if (sounded.length < 3) {
    return null;
  }

  const uniqueNotes = Array.from(new Set(sounded.map((item) => item.pitchClass)));
  const minimumUnique = chordPitchClasses.length >= 4 ? 4 : Math.min(3, chordPitchClasses.length);
  if (uniqueNotes.length < minimumUnique) {
    return null;
  }

  if (!uniqueNotes.includes(rootPitchClass)) {
    return null;
  }

  const frettedNotes = sounded.filter((item) => item.fret > 0);
  const fretValues = frettedNotes.map((item) => item.fret);
  const minFret = fretValues.length ? Math.min(...fretValues) : 0;
  const maxFret = fretValues.length ? Math.max(...fretValues) : 0;
  const fretSpan = maxFret - minFret;

  if (fretSpan > WINDOW_SIZE) {
    return null;
  }

  const bass = sounded[0];
  const openCount = sounded.filter((item) => item.fret === 0).length;
  const muteCount = positions.filter((position) => position === "x").length;
  const extensionCount = uniqueNotes.filter((pitchClass) =>
    extensionPitchClasses.has(pitchClass),
  ).length;
  const omittedPitchClasses = chordPitchClasses.filter(
    (pitchClass) => !uniqueNotes.includes(pitchClass),
  );

  let score = uniqueNotes.length * 20;
  score += extensionCount * 13;
  score += bass.pitchClass === rootPitchClass ? 28 : 0;
  score += sounded.length >= 5 ? 10 : sounded.length >= 4 ? 5 : 0;
  score += openCount > 0 && minFret <= 2 ? 8 : 0;
  score -= muteCount * 4;
  score -= sounded.length - uniqueNotes.length;
  score -= (minFret || 0) * 1.35;
  score -= omittedPitchClasses.length * 6;

  return {
    positions,
    sounded,
    bass,
    openCount,
    minFret,
    maxFret,
    score,
    extensionCount,
    uniqueNotes,
    omittedPitchClasses,
  };
}

function buildCandidateShapes({
  chordPitchClasses,
  rootPitchClass,
  extensionPitchClasses,
}) {
  const candidates = new Map();

  SEARCH_GROUPS.forEach((group) => {
    for (let windowStart = 0; windowStart <= MAX_SEARCH_FRET - WINDOW_SIZE; windowStart += 1) {
      const candidateFretsByString = STRING_TUNING.map((_, stringIndex) =>
        group.includes(stringIndex)
          ? getCandidateFrets(stringIndex, chordPitchClasses, windowStart)
          : [],
      );

      const choosePositions = (index, positions, soundedCount) => {
        if (index === group.length) {
          const key = positions.join("|");
          const nextCandidate = scoreShape({
            positions,
            rootPitchClass,
            chordPitchClasses,
            extensionPitchClasses,
          });

          if (!nextCandidate) {
            return;
          }

          const previousCandidate = candidates.get(key);
          if (!previousCandidate || nextCandidate.score > previousCandidate.score) {
            candidates.set(key, nextCandidate);
          }

          return;
        }

        const stringIndex = group[index];
        const remainingStrings = group.length - index - 1;
        const canMute = soundedCount + remainingStrings >= 3;

        if (canMute) {
          const mutedPositions = [...positions];
          mutedPositions[stringIndex] = "x";
          choosePositions(index + 1, mutedPositions, soundedCount);
        }

        candidateFretsByString[stringIndex].forEach((fret) => {
          const nextPositions = [...positions];
          nextPositions[stringIndex] = fret;
          choosePositions(index + 1, nextPositions, soundedCount + 1);
        });
      };

      choosePositions(0, Array(STRING_TUNING.length).fill("x"), 0);
    }
  });

  return Array.from(candidates.values()).sort((a, b) => b.score - a.score);
}

function describeShape({ shape, rootPitchClass, noteLabelByPitchClass, chordPitchClasses }) {
  const includedLabels = shape.uniqueNotes.map((pitchClass) =>
    formatPitchClass(pitchClass, noteLabelByPitchClass),
  );
  const omittedLabels = shape.omittedPitchClasses.map((pitchClass) =>
    formatPitchClass(pitchClass, noteLabelByPitchClass),
  );
  const bassLabel = formatPitchClass(shape.bass.pitchClass, noteLabelByPitchClass);
  const bassString = STRING_TUNING[shape.bass.stringIndex].label;

  let label = "Playable voicing";
  if (shape.extensionCount >= 2) {
    label = "Extended voicing";
  } else if (shape.openCount > 0 && shape.minFret <= 2) {
    label = "Open-position grip";
  } else if (shape.bass.pitchClass === rootPitchClass) {
    label = "Rooted voicing";
  } else if (shape.sounded.length <= 4) {
    label = "Compact shell";
  }

  const positionLabel =
    shape.openCount > 0 && shape.minFret <= 2
      ? "Open to 4th fret"
      : shape.minFret && shape.maxFret > shape.minFret
        ? `Frets ${shape.minFret}-${shape.maxFret}`
        : shape.minFret
          ? `Around fret ${shape.minFret}`
          : "Open position";

  const copy = omittedLabels.length
    ? `Uses ${includedLabels.join(", ")} with ${bassLabel} on the ${bassString} string, leaving out ${omittedLabels.join(", ")} for a tighter guitar grip.`
    : `Covers every chord tone with ${bassLabel} in the bass, keeping the voicing inside a playable fret span.`;

  return {
    ...shape,
    rootPitchClass,
    label,
    positionLabel,
    copy,
    compact: shape.positions.map((position) => position).join("-"),
    markerLabels: shape.positions.map((position, stringIndex) =>
      typeof position === "number"
        ? formatPitchClass(
            getPitchAtStringFret(stringIndex, position),
            noteLabelByPitchClass,
          )
        : null,
    ),
    displayedNotes: chordPitchClasses.map((pitchClass) =>
      formatPitchClass(pitchClass, noteLabelByPitchClass),
    ),
  };
}

function buildShapeSuggestions(chord) {
  const displayNotes = chord?.notes?.filter(Boolean) ?? [];
  const chordPitchClasses = uniquePitchClasses(displayNotes);
  const rootPitchClass = normalizePitchClass(parseChordRoot(chord));

  if (!chordPitchClasses.length || !rootPitchClass) {
    return [];
  }

  const noteLabelByPitchClass = buildNoteLabelMap(displayNotes);
  const extensionPitchClasses = new Set(chordPitchClasses.slice(3));
  const rawCandidates = buildCandidateShapes({
    chordPitchClasses,
    rootPitchClass,
    extensionPitchClasses,
  });

  const suggestions = [];
  rawCandidates.forEach((candidate) => {
    if (suggestions.length >= 3) {
      return;
    }

    const tooSimilar = suggestions.some((existing) => {
      let sharedPositions = 0;

      candidate.positions.forEach((position, index) => {
        if (existing.positions[index] === position) {
          sharedPositions += 1;
        }
      });

      return sharedPositions >= 5;
    });

    if (!tooSimilar) {
      suggestions.push(
        describeShape({
          shape: candidate,
          rootPitchClass,
          noteLabelByPitchClass,
          chordPitchClasses,
        }),
      );
    }
  });

  return suggestions;
}

function ToneMapFallback({ notes }) {
  const displayNotes = notes.filter(Boolean);
  const rootPitchClass = normalizePitchClass(displayNotes[0]);
  const noteLabelByPitchClass = buildNoteLabelMap(displayNotes);
  const activePitchClasses = new Set(noteLabelByPitchClass.keys());
  const frets = [0, 1, 2, 3, 4, 5];

  return (
    <div className="guitar-fretboard__fallback">
      <p className="guitar-fretboard__fallback-copy">
        No compact guitar grip was found for this voicing, so here is a tone map
        of the chord on the first five frets.
      </p>
      <div className="guitar-fretboard__header">
        <span className="guitar-fretboard__header-spacer" />
        {frets.map((fret) => (
          <span key={fret} className="guitar-fretboard__fret-label">
            {fret === 0 ? "Open" : fret}
          </span>
        ))}
      </div>

      <div className="guitar-fretboard__rows">
        {STRING_TUNING.map((string, stringIndex) => (
          <div key={string.id} className="guitar-fretboard__row">
            <span className="guitar-fretboard__string-label">{string.shortLabel}</span>
            {frets.map((fret) => {
              const pitchClass = getPitchAtStringFret(stringIndex, fret);
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

function ShapeDiagram({ shape }) {
  const diagramStart = shape.minFret > 1 ? shape.minFret : 1;
  const diagramFrets = Array.from({ length: 4 }, (_, index) => diagramStart + index);

  return (
    <div className="guitar-shape-card">
      <div className="guitar-shape-card__header">
        <div>
          <p className="guitar-shape-card__eyebrow">{shape.label}</p>
          <strong>{shape.positionLabel}</strong>
        </div>
        <code>{shape.compact}</code>
      </div>

      <div className="guitar-shape-diagram" role="img" aria-label={`${shape.label} ${shape.compact}`}>
        <div className="guitar-shape-diagram__top">
          <span className="guitar-shape-diagram__corner" />
          {STRING_TUNING.map((string, stringIndex) => {
            const position = shape.positions[stringIndex];
            const state = position === "x" ? "x" : position === 0 ? "o" : "";

            return (
              <div key={string.id} className="guitar-shape-diagram__string-top">
                <span className="guitar-shape-diagram__string-label">{string.shortLabel}</span>
                <span className="guitar-shape-diagram__string-state">{state}</span>
              </div>
            );
          })}
        </div>

        <div className="guitar-shape-diagram__grid">
          {diagramFrets.map((fret) => (
            <div key={fret} className="guitar-shape-diagram__row">
              <span className="guitar-shape-diagram__fret-number">{fret}</span>
              {STRING_TUNING.map((string, stringIndex) => {
                const position = shape.positions[stringIndex];
                const isActive = position === fret;
                const isRoot =
                  isActive &&
                  normalizePitchClass(shape.markerLabels[stringIndex]) ===
                    shape.rootPitchClass;

                return (
                  <div
                    key={`${string.id}-${fret}`}
                    className={`guitar-shape-diagram__cell ${
                      fret === diagramStart && diagramStart > 1 ? "has-start-fret" : ""
                    } ${isActive ? "is-active" : ""} ${isRoot ? "is-root" : ""}`}
                  >
                    {isActive ? (
                      <span className="guitar-shape-diagram__dot">
                        {shape.markerLabels[stringIndex]}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="guitar-shape-card__copy">{shape.copy}</p>

      <div className="guitar-shape-card__notes">
        {shape.displayedNotes.map((note) => (
          <span key={`${shape.compact}-${note}`} className="guitar-shape-card__note">
            {note}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function GuitarFretboard({ chord, notes = [] }) {
  const resolvedChord =
    chord && Array.isArray(chord.notes) ? chord : { name: "", notes };
  const displayNotes = resolvedChord.notes?.filter(Boolean) ?? [];
  const shapeSuggestions = buildShapeSuggestions(resolvedChord);

  return (
    <div
      className="guitar-fretboard"
      aria-label={`Guitar chord-shape suggestions for ${resolvedChord.name || "selected chord"}`}
    >
      {shapeSuggestions.length ? (
        <div className="guitar-shape-list">
          {shapeSuggestions.map((shape) => (
            <ShapeDiagram key={`${resolvedChord.name}-${shape.compact}`} shape={shape} />
          ))}
        </div>
      ) : (
        <ToneMapFallback notes={displayNotes} />
      )}
    </div>
  );
}
