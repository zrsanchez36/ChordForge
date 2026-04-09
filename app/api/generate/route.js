import { NextResponse } from "next/server";
import {
  DEFAULT_MOODS,
  buildGenerationPrompt,
  extractJsonObject,
  isValidGenre,
  normalizeProgression,
  sanitizeMoods,
} from "@/lib/chord-forge";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export async function POST(request) {
  try {
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
        { status: 503 },
      );
    }

    const upstreamResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        messages: [
          {
            role: "user",
            content: buildGenerationPrompt({ genre, moods }),
          },
        ],
      }),
    });

    const upstreamPayload = await upstreamResponse.json();

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          error:
            upstreamPayload?.error?.message ||
            "Anthropic returned an error while composing the progression.",
        },
        { status: upstreamResponse.status },
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
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Chord generation failed. Please try again.",
      },
      { status: 500 },
    );
  }
}
