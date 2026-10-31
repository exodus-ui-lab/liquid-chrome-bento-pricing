// Fixed-window counter per client key. All keys share one window, so expiry is a single Map.clear()
// and memory stays bounded by the number of distinct clients seen within one window.
export function rateLimit({ limit, windowMs, keyOf, onLimited, now = Date.now }) {
  const hits = new Map();
  let windowEndsAt = 0;

  return async function rateLimitMiddleware(c, next) {
    const time = now();
    if (time >= windowEndsAt) {
      hits.clear();
      windowEndsAt = time + windowMs;
    }

    const key = keyOf(c);
    const count = (hits.get(key) ?? 0) + 1;
    hits.set(key, count);

    if (count > limit) return onLimited(c);
    await next();
  };
}
