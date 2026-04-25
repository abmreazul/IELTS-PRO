import { headers } from "next/headers";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __ieltsRateLimitStore: Map<string, RateLimitEntry> | undefined;
}

function getStore() {
  if (!globalThis.__ieltsRateLimitStore) {
    globalThis.__ieltsRateLimitStore = new Map<string, RateLimitEntry>();
  }
  return globalThis.__ieltsRateLimitStore;
}

async function getRequestIp() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const realIp = requestHeaders.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || realIp || "unknown";
}

export async function enforceActionRateLimit(input: {
  action: string;
  subject?: string | null;
  limit: number;
  windowMs: number;
}) {
  const store = getStore();
  const now = Date.now();
  const subject = (input.subject?.trim() || `ip:${await getRequestIp()}`).slice(0, 180);
  const key = `${input.action}:${subject}`;
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + input.windowMs });
    return;
  }

  if (existing.count >= input.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    throw new Error(`Too many requests. Please wait ${retryAfterSeconds}s and try again.`);
  }

  existing.count += 1;
  store.set(key, existing);
}
