export const GENRES = [
  "Jazz",
  "Pop",
  "Rock",
  "Classical",
  "Lo-fi",
  "R&B",
  "Electronic",
  "Folk",
  "Blues",
  "Ambient",
];

export const MOOD_CONFIG = [
  { key: "energy", label: "Energy", left: "Calm", right: "Intense" },
  { key: "emotion", label: "Emotion", left: "Dark", right: "Bright" },
  { key: "complexity", label: "Complexity", left: "Simple", right: "Complex" },
];

export const DEFAULT_MOODS = {
  energy: 55,
  emotion: 42,
  complexity: 38,
};

export const HISTORY_KEY = "chord-forge-history";
export const HISTORY_LIMIT = 12;
export const HISTORY_SCHEMA_VERSION = 1;

export function readHistory() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (
      parsed?.version !== HISTORY_SCHEMA_VERSION ||
      !Array.isArray(parsed?.entries)
    ) {
      return [];
    }

    return parsed.entries.filter(
      (entry) =>
        entry?.id &&
        entry?.createdAt &&
        entry?.genre &&
        entry?.progression &&
        Array.isArray(entry?.progression?.chords),
    );
  } catch {
    return [];
  }
}

export function writeHistory(entries) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify({
      version: HISTORY_SCHEMA_VERSION,
      entries,
    }),
  );
}

const NOTE_ALIASES = {
  Bb: "A#",
  Cb: "B",
  Db: "C#",
  Eb: "D#",
  Fb: "E",
  "E#": "F",
  Gb: "F#",
  Ab: "G#",
  "B#": "C",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function ensureText(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function extractTempoValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  const matches = String(value ?? "").match(/\d+/g);
  if (!matches?.length) {
    return null;
  }

  if (matches.length === 1) {
    return Number(matches[0]);
  }

  return Math.round((Number(matches[0]) + Number(matches[1])) / 2);
}

function normalizeChord(rawChord, index) {
  if (!rawChord || typeof rawChord !== "object") {
    throw new Error("Each generated chord must be an object.");
  }

  const notes = Array.isArray(rawChord.notes)
    ? rawChord.notes
        .map((note) => normalizePitchClass(note))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  return {
    id: `${ensureText(rawChord.name, `Chord ${index + 1}`)}-${index}`,
    name: ensureText(rawChord.name, `Chord ${index + 1}`),
    romanNumeral: ensureText(rawChord.romanNumeral, "?"),
    function: ensureText(rawChord.function, "Color"),
    beats: Math.round(clamp(Number(rawChord.beats) || 4, 1, 8)),
    notes,
  };
}

export function clampMoodValue(value) {
  return clamp(Number(value) || 0, 0, 100);
}

export function sanitizeMoods(moods) {
  return {
    energy: clampMoodValue(moods?.energy ?? DEFAULT_MOODS.energy),
    emotion: clampMoodValue(moods?.emotion ?? DEFAULT_MOODS.emotion),
    complexity: clampMoodValue(moods?.complexity ?? DEFAULT_MOODS.complexity),
  };
}

export function isValidGenre(genre) {
  return GENRES.includes(genre);
}

export function moodToRgb(emotion, energy) {
  const emotionRatio = clamp(emotion / 100, 0, 1);
  const energyLift = (clamp(energy / 100, 0, 1) - 0.5) * 42;

  let rgb;
  if (emotionRatio < 0.33) {
    rgb = {
      r: lerp(56, 127, emotionRatio / 0.33),
      g: lerp(138, 95, emotionRatio / 0.33),
      b: lerp(221, 210, emotionRatio / 0.33),
    };
  } else if (emotionRatio < 0.66) {
    rgb = {
      r: lerp(127, 212, (emotionRatio - 0.33) / 0.33),
      g: lerp(95, 83, (emotionRatio - 0.33) / 0.33),
      b: lerp(210, 150, (emotionRatio - 0.33) / 0.33),
    };
  } else {
    rgb = {
      r: lerp(212, 239, (emotionRatio - 0.66) / 0.34),
      g: lerp(83, 130, (emotionRatio - 0.66) / 0.34),
      b: lerp(150, 50, (emotionRatio - 0.66) / 0.34),
    };
  }

  return {
    r: clamp(rgb.r + energyLift * 0.22, 0, 255),
    g: clamp(rgb.g + energyLift * 0.12, 0, 255),
    b: clamp(rgb.b + energyLift * 0.08, 0, 255),
  };
}

export function toHex({ r, g, b }) {
  const hex = (value) =>
    Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");

  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function rgba({ r, g, b }, alpha) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

export function normalizePitchClass(note) {
  const cleaned = String(note ?? "")
    .trim()
    .replace(/[0-9]/g, "")
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/[^A-Ga-g#b]/g, "");

  if (!cleaned) {
    return null;
  }

  const canonical =
    cleaned[0].toUpperCase() + cleaned.slice(1).replace(/#/g, "#").replace(/b/g, "b");

  return NOTE_ALIASES[canonical] || canonical;
}

export function describeEnergy(energy) {
  if (energy < 25) return "hushed";
  if (energy < 45) return "steady";
  if (energy < 65) return "driving";
  if (energy < 82) return "urgent";
  return "volatile";
}

export function describeEmotion(emotion) {
  if (emotion < 20) return "shadowed";
  if (emotion < 40) return "brooding";
  if (emotion < 60) return "balanced";
  if (emotion < 80) return "luminous";
  return "euphoric";
}

export function describeComplexity(complexity) {
  if (complexity < 25) return "plainspoken";
  if (complexity < 45) return "grounded";
  if (complexity < 65) return "layered";
  if (complexity < 82) return "harmonically rich";
  return "ornate";
}

export function describeTempoLabel(tempoBpm) {
  if (tempoBpm < 72) return "slow bloom";
  if (tempoBpm < 95) return "laid-back pocket";
  if (tempoBpm < 116) return "steady lift";
  if (tempoBpm < 136) return "forward pulse";
  return "high-wire push";
}

export function buildGenerationPrompt({ genre, moods }) {
  const safeMoods = sanitizeMoods(moods);

  const energyPrompt =
    safeMoods.energy < 30
      ? "calm, minimal movement"
      : safeMoods.energy < 55
        ? "moderate pulse"
        : safeMoods.energy < 78
          ? "energetic forward motion"
          : "high-intensity momentum";

  const emotionPrompt =
    safeMoods.emotion < 25
      ? "dark and melancholic"
      : safeMoods.emotion < 45
        ? "somber and introspective"
        : safeMoods.emotion < 62
          ? "balanced and neutral"
          : safeMoods.emotion < 80
            ? "warm and uplifting"
            : "bright and euphoric";

  const complexityPrompt =
    safeMoods.complexity < 30
      ? "simple triads and restrained harmony"
      : safeMoods.complexity < 55
        ? "occasional sevenths with clear functional harmony"
        : safeMoods.complexity < 75
          ? "lush extensions, ninths, and tasteful color"
          : "complex, advanced voicings with altered tension where appropriate";

  return `You are an elite arranger and music theory specialist.
Generate one chord progression for this genre and mood:
- Genre: ${genre}
- Energy: ${energyPrompt}
- Emotion: ${emotionPrompt}
- Complexity: ${complexityPrompt}

Return ONLY valid JSON with this exact top-level shape:
{
  "key": "D minor",
  "tempoBpm": 96,
  "tempoLabel": "laid-back pocket",
  "feel": "smoke trails and late-night lift",
  "playingTip": "Voice the top note smoothly across the cadence.",
  "chords": [
    {
      "name": "Dm9",
      "romanNumeral": "i9",
      "function": "Tonic",
      "beats": 4,
      "notes": ["D", "F", "A", "C", "E"]
    }
  ]
}

Rules:
- 4 to 6 chords total
- Make the harmony stylistically credible for ${genre}
- Keep each chord's note list musically correct for the chord symbol
- Use concise, musician-friendly chord names and harmonic functions
- "tempoBpm" must be an integer between 60 and 170
- "feel" should be a short evocative phrase
- "playingTip" should be one actionable sentence
- No markdown, no code fences, no extra commentary`;
}

export function extractJsonObject(text) {
  const cleaned = String(text ?? "").replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("The model response did not include a valid JSON object.");
  }

  return cleaned.slice(start, end + 1);
}

export function normalizeProgression(rawProgression) {
  if (!rawProgression || typeof rawProgression !== "object") {
    throw new Error("The generated progression payload was empty.");
  }

  const tempoBpm = clamp(
    extractTempoValue(rawProgression.tempoBpm ?? rawProgression.tempo ?? rawProgression.bpm) ||
      96,
    60,
    170,
  );

  const chords = Array.isArray(rawProgression.chords)
    ? rawProgression.chords.slice(0, 6).map(normalizeChord)
    : [];

  if (chords.length < 4) {
    throw new Error("The generated progression did not include enough chords.");
  }

  return {
    key: ensureText(rawProgression.key, "C major"),
    tempoBpm,
    tempoLabel: ensureText(
      rawProgression.tempoLabel ?? rawProgression.tempo,
      describeTempoLabel(tempoBpm),
    ),
    feel: ensureText(rawProgression.feel, "A focused harmonic sketch"),
    playingTip: ensureText(
      rawProgression.playingTip,
      "Keep the top voice legato so the progression feels connected.",
    ),
    chords,
  };
}

export const SHOWCASE_SESSION = {
  id: "showcase-jazz-dusk",
  source: "preview",
  genre: "Jazz",
  moods: DEFAULT_MOODS,
  progression: normalizeProgression({
    key: "D minor",
    tempoBpm: 96,
    tempoLabel: "late-night swing",
    feel: "smoke trails, velvet lift, and a little unresolved heat",
    playingTip:
      "Let the top note ring across the dominant chord so the return to Dm9 feels inevitable.",
    chords: [
      {
        name: "Dm9",
        romanNumeral: "i9",
        function: "Tonic color",
        beats: 4,
        notes: ["D", "F", "A", "C", "E"],
      },
      {
        name: "G13",
        romanNumeral: "IV13",
        function: "Subdominant lift",
        beats: 4,
        notes: ["G", "B", "D", "F", "E"],
      },
      {
        name: "Cmaj9",
        romanNumeral: "bVIImaj9",
        function: "Color release",
        beats: 4,
        notes: ["C", "E", "G", "B", "D"],
      },
      {
        name: "A7alt",
        romanNumeral: "V7alt",
        function: "Dominant tension",
        beats: 4,
        notes: ["A", "C#", "G", "A#", "F"],
      },
      {
        name: "Dm9",
        romanNumeral: "i9",
        function: "Resolution",
        beats: 4,
        notes: ["D", "F", "A", "C", "E"],
      },
    ],
  }),
};
