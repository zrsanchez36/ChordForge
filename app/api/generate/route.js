import { NextResponse } from "next/server";
import {
  DEFAULT_MOODS,
  buildGenerationPrompt,
  extractJsonObject,
  isValidGenre,
  normalizeProgression,
  sanitizeMoods,
} from "@/lib/chord-forge";
import {
  buildRateLimitHeaders,
  CHORDFORGE_SESSION_COOKIE,
  getRateLimitResult,
  hasTrustedOrigin,
} from "@/lib/api-security";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const ANTHROPIC_TIMEOUT_MS = 15_000;

async function fetchAnthropicWithTimeout(payload, apiKey) {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ANTHROPIC_TIMEOUT_MS);

  try {
    return await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error(
        "Anthropic took too long to respond. Please try again.",
      );
      timeoutError.name = "AnthropicTimeoutError";
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request) {
  try {
    if (!hasTrustedOrigin(request)) {
      return NextResponse.json(
        {
          error:
            "Chord generation requests must come from this ChordForge session.",
        },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const sessionId = request.cookies.get(CHORDFORGE_SESSION_COOKIE)?.value;
    if (!sessionId) {
      return NextResponse.json(
        {
          error:
            "Refresh ChordForge and try again so a browser session can be established.",
        },
        { status: 428, headers: { "Cache-Control": "no-store" } },
      );
    }

    const rateLimit = await getRateLimitResult(request, sessionId);
    if (rateLimit.missingConfig) {
      return NextResponse.json(
        {
          error:
            "Persistent rate limiting is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN before deploying live generation.",
        },
        { status: 503, headers: buildRateLimitHeaders(rateLimit) },
      );
    }

    if (rateLimit.backendError) {
      return NextResponse.json(
        {
          error:
            "Rate limiting is temporarily unavailable. Please try again in a moment.",
        },
        {
          status: 503,
          headers: buildRateLimitHeaders(rateLimit, { includeRetryAfter: true }),
        },
      );
    }

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Rate limit reached for chord generation. Please wait a minute before trying again.",
        },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimit, { includeRetryAfter: true }),
        },
      );
    }

    const body = await request.json();
    const genre = isValidGenre(body?.genre) ? body.genre : "Jazz";
    const moods = sanitizeMoods(body?.moods ?? DEFAULT_MOODS);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "ANTHROPIC_API_KEY is not configured. Add it to `.env.local` to enable live generation.",
        },
        { status: 503, headers: buildRateLimitHeaders(rateLimit) },
      );
    }

    const upstreamResponse = await fetchAnthropicWithTimeout(
      {
        model,
        max_tokens: 900,
        messages: [
          {
            role: "user",
            content: buildGenerationPrompt({ genre, moods }),
          },
        ],
      },
      apiKey,
    );

    const upstreamPayload = await upstreamResponse.json();

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          error:
            upstreamPayload?.error?.message ||
            "Anthropic returned an error while composing the progression.",
        },
        {
          status: upstreamResponse.status,
          headers: buildRateLimitHeaders(rateLimit),
        },
      );
    }

    const rawText =
      upstreamPayload?.content?.find((block) => block?.type === "text")?.text || "";
    const progression = normalizeProgression(
      JSON.parse(extractJsonObject(rawText)),
    );

    return NextResponse.json({
      progression,
      meta: {
        provider: "Anthropic",
        model,
      },
    }, { headers: buildRateLimitHeaders(rateLimit) });
  } catch (error) {
    if (error instanceof Error && error.name === "AnthropicTimeoutError") {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 504, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Chord generation failed. Please try again.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
