# ChordForge

ChordForge is a Next.js App Router app that turns mood controls into playable chord progressions. It keeps Anthropic requests on the server, adds browser-based playback with the Web Audio API, and stores recent sessions in `localStorage` for quick recall.

## What is included

- A premium single-page studio UI based on the original `chord-forge.jsx` prototype
- Mood-driven accent color and animated particle backdrop
- `/api/generate` server route that proxies Anthropic Messages API calls
- Structured JSON prompting and normalization of model output
- Browser playback for generated chords
- Local session history with versioned `localStorage` persistence
- A built-in preview progression so the UI can be explored before the API key is configured

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Create a local env file:

```bash
cp .env.example .env.local
```

3. Add your Anthropic key to `.env.local`:

```bash
ANTHROPIC_API_KEY=your_key_here
```

4. Start the app:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Notes

- Live generation requires `ANTHROPIC_API_KEY`.
- Playback uses the Web Audio API, so the first play action may prompt the browser to resume audio after a click.
- Recent sessions are stored only in the browser for now. This keeps the history feature lightweight until a database layer is added.
