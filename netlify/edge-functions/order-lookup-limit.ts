// Let Next.js handle the request after Netlify applies the per-client rate limit.
export default function orderLookupLimit() {}

export const config = {
  path: "/api/orders/lookup",
  method: "POST",
  rateLimit: {
    windowLimit: 8,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
