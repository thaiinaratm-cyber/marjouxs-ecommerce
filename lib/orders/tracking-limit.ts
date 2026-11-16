const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;
const MAX_PER_ORDER = 6;

// Netlify limits callers across instances; this also caps bursts in each worker.
export function createOrderLookupLimiter(now = Date.now) {
  let resetAt = 0;
  let requests = 0;
  const byOrder = new Map<string, number>();

  return function consume(orderNumber?: string): number {
    const time = now();
    if (time >= resetAt) {
      resetAt = time + WINDOW_MS;
      requests = 0;
      byOrder.clear();
    }
    const retryAfter = Math.ceil((resetAt - time) / 1000);
    if (!orderNumber) {
      if (requests >= MAX_REQUESTS) return retryAfter;
      requests++;
      return 0;
    }
    const attempts = byOrder.get(orderNumber) ?? 0;
    if (attempts >= MAX_PER_ORDER) return retryAfter;
    byOrder.set(orderNumber, attempts + 1);
    return 0;
  };
}

export const consumeOrderLookup = createOrderLookupLimiter();
