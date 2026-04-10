# ChordForge

ChordForge is a Next.js App Router app that turns mood controls into playable chord progressions. It keeps Anthropic requests on the server, adds browser-based playback with the Web Audio API, and stores recent sessions in `localStorage` for quick recall.

## What is included

- A premium single-page studio UI based on the original `chord-forge.jsx` prototype
- Mood-driven accent color and animated particle backdrop
- `/api/generate` server route that proxies Anthropic Messages API calls
- Persistent production rate limiting backed by Upstash Redis
- Structured JSON prompting and normalization of model output
- Browser playback for generated chords
- Piano preview and playable guitar chord-shape suggestions for the selected chord
- Local session history with versioned `localStorage` persistence
- Browser/app icons plus a web app manifest for install-ready branding
- Native desktop icon outputs for macOS (`.icns`) and Windows/browser (`.ico`)
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

4. For production deployments, also add Upstash Redis credentials for the persistent limiter:

```bash
UPSTASH_REDIS_REST_URL=your_upstash_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
```

5. Start the app:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Icon assets

- Source artwork lives in `assets/icons/chordforge-app-icon.svg`
- Generated native icons are written to `assets/native-icons/`
- Run `npm run icons:generate` to regenerate:
  - `assets/native-icons/ChordForge.icns`
  - `assets/native-icons/ChordForge.ico`
  - `assets/native-icons/ChordForge.png`
  - `app/favicon.ico`

## Notes

- Live generation requires `ANTHROPIC_API_KEY`.
- In local development, the rate limiter falls back to in-memory storage if Upstash is not configured. In production, set the Upstash Redis env vars before exposing live generation publicly.
- Playback uses the Web Audio API, so the first play action may prompt the browser to resume audio after a click.
- Recent sessions are stored only in the browser for now. This keeps the history feature lightweight until a database layer is added.
