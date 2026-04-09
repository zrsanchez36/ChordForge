import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const CHORDFORGE_SESSION_COOKIE = "chordforge_session";

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_TEXT = "5 m";
const RATE_LIMIT_MAX_REQUESTS = 12;
const PRUNE_INTERVAL_MS = 60 * 1000;

const globalStore = globalThis;
const memoryRateLimitStore =
  globalStore.__chordForgeRateLimitStore ||
  (globalStore.__chordForgeRateLimitStore = new Map());

let lastPruneAt = 0;
let persistentLimiter;

function getHost(headers) {
  return headers.get("x-forwarded-host") || headers.get("host") || "";
}

function hostMatches(urlLike, host) {
  if (!urlLike || !host) {
    return false;
  }

  try {
    return new URL(urlLike).host === host;
  } catch {
    return false;
  }
}

function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function pruneExpiredEntries(now) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) {
    return;
  }

  for (const [key, entry] of memoryRateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      memoryRateLimitStore.delete(key);
    }
  }

  lastPruneAt = now;
}

function getRedisCredentials() {
  return {
    url:
      process.env.UPSTASH_REDIS_REST_URL ||
      process.env.KV_REST_API_URL ||
      "",
    token:
      process.env.UPSTASH_REDIS_REST_TOKEN ||
      process.env.KV_REST_API_TOKEN ||
      "",
  };
}

function getPersistentLimiter() {
  if (persistentLimiter !== undefined) {
    return persistentLimiter;
  }

  const { url, token } = getRedisCredentials();
  if (!url || !token) {
    persistentLimiter = null;
    return persistentLimiter;
  }

  const redis = new Redis({ url, token });
  persistentLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_TEXT,
    ),
    analytics: false,
    prefix: "ratelimit:chordforge:generate",
  });

  return persistentLimiter;
}

function buildResult({
  allowed,
  limit = RATE_LIMIT_MAX_REQUESTS,
  remaining = 0,
  resetAt = Date.now() + RATE_LIMIT_WINDOW_MS,
  store = "memory",
  missingConfig = false,
  backendError = false,
}) {
  return {
    allowed,
    limit,
    remaining,
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
    store,
    missingConfig,
    backendError,
  };
}

function getMemoryRateLimitResult(request, sessionId) {
  const now = Date.now();
  pruneExpiredEntries(now);

  const key = `${getClientIp(request)}:${sessionId}`;
  const currentEntry = memoryRateLimitStore.get(key);

  if (!currentEntry || currentEntry.resetAt <= now) {
    const freshEntry = {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };

    memoryRateLimitStore.set(key, freshEntry);

    return buildResult({
      allowed: true,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: RATE_LIMIT_MAX_REQUESTS - freshEntry.count,
      resetAt: freshEntry.resetAt,
      store: "memory",
    });
  }

  if (currentEntry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return buildResult({
      allowed: false,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: 0,
      resetAt: currentEntry.resetAt,
      store: "memory",
    });
  }

  currentEntry.count += 1;
  memoryRateLimitStore.set(key, currentEntry);

  return buildResult({
    allowed: true,
    limit: RATE_LIMIT_MAX_REQUESTS,
    remaining: RATE_LIMIT_MAX_REQUESTS - currentEntry.count,
    resetAt: currentEntry.resetAt,
    store: "memory",
  });
}

export function hasTrustedOrigin(request) {
  const host = getHost(request.headers);
  if (!host) {
    return process.env.NODE_ENV !== "production";
  }

  const origin = request.headers.get("origin");
  if (origin) {
    return hostMatches(origin, host);
  }

  const referer = request.headers.get("referer");
  if (referer) {
    return hostMatches(referer, host);
  }

  return process.env.NODE_ENV !== "production";
}

export async function getRateLimitResult(request, sessionId) {
  const identifier = `${getClientIp(request)}:${sessionId}`;
  const limiter = getPersistentLimiter();

  if (limiter) {
    try {
      const result = await limiter.limit(identifier);

      return buildResult({
        allowed: result.success,
        limit: Number(result.limit) || RATE_LIMIT_MAX_REQUESTS,
        remaining: Number(result.remaining) || 0,
        resetAt: Number(result.reset) || Date.now() + RATE_LIMIT_WINDOW_MS,
        store: "upstash",
      });
    } catch {
      return buildResult({
        allowed: false,
        store: "upstash",
        backendError: true,
      });
    }
  }

  if (process.env.NODE_ENV === "production") {
    return buildResult({
      allowed: false,
      store: "unconfigured",
      missingConfig: true,
    });
  }

  return getMemoryRateLimitResult(request, sessionId);
}

export function buildRateLimitHeaders(result, { includeRetryAfter = false } = {}) {
  const headers = {
    "Cache-Control": "no-store",
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
    "X-RateLimit-Store": result.store,
  };

  if (includeRetryAfter) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }

  return headers;
}
