import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// cache limiters per bucket/tokens/window
const limCache = new Map<string, Ratelimit>();

function getLimiter(bucket: string, tokens: number, window: `${number} ${'s'|'m'|'h'|'d'}`) {
  if (!redis) return null;
  const key = `${bucket}:${tokens}:${window}`;
  if (!limCache.has(key)) {
    limCache.set(
      key,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(tokens, window),
        analytics: true,
        prefix: `rr:${bucket}`,
      })
    );
  }
  return limCache.get(key)!;
}

export function getClientIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for");
  return xf?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "0.0.0.0";
}

export async function enforceRateLimit(
  req: Request,
  bucket: string,
  identifier: string,
  tokens = 10,
  window: `${number} ${'s'|'m'|'h'|'d'}` = "1 m",
) {
  const lim = getLimiter(bucket, tokens, window);
  if (!lim) return { ok: true, headers: new Headers() }; // no Redis → no-op in dev

  const { success, reset, limit, remaining } = await lim.limit(identifier);
  const headers = new Headers({
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(reset),
  });
  if (!success) {
    throw new Response("Too Many Requests", { status: 429, headers });
  }
  return { ok: true, headers };
}
