import {
  GOOGLE_ADS_PURCHASE_DESTINATION,
  GOOGLE_TAG_READY_EVENT,
  getGooglePageContext
} from "@/lib/google-tag";

type GoogleAdsPurchase = {
  send_to: typeof GOOGLE_ADS_PURCHASE_DESTINATION;
  value: number;
  currency: "BRL";
  transaction_id: string;
};

const trackedOrders = new Set<string>();

// Call only with the current successful response from the order API, never URL/cart data.
export function getGoogleAdsPurchase(order: unknown): GoogleAdsPurchase | null {
  if (!order || typeof order !== "object") return null;
  const data = order as Record<string, unknown>;
  if (
    data.paymentStatus !== "paid" ||
    typeof data.paidAt !== "string" ||
    !Number.isFinite(Date.parse(data.paidAt)) ||
    typeof data.totalCents !== "number" ||
    !Number.isSafeInteger(data.totalCents) ||
    data.totalCents <= 0 ||
    typeof data.orderNumber !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(data.orderNumber)
  ) {
    return null;
  }

  return {
    send_to: GOOGLE_ADS_PURCHASE_DESTINATION,
    value: data.totalCents / 100,
    currency: "BRL",
    transaction_id: data.orderNumber
  };
}

function sendPurchase(purchase: GoogleAdsPurchase) {
  if (
    typeof window === "undefined" ||
    !window.marjouxsGoogleTagReady ||
    typeof window.gtag !== "function"
  ) return false;

  const key = "marjouxs-google-ads-purchase:" + purchase.send_to + ":" + purchase.transaction_id;
  if (trackedOrders.has(key)) return true;
  try {
    if (window.localStorage.getItem(key) === "1") return true;
  } catch {
    // Memory covers rerenders; Google Ads deduplicates by transaction_id across reloads.
  }

  trackedOrders.add(key);
  try {
    window.gtag("event", "conversion", { ...purchase, ...getGooglePageContext() });
  } catch {
    trackedOrders.delete(key);
    return false;
  }

  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Storage is optional; it must never interrupt order confirmation.
  }
  return true;
}

// The disposer ties a delayed tag load to the current request/token lifecycle.
export function trackGoogleAdsPurchaseWhenReady(order: unknown): () => void {
  const purchase = getGoogleAdsPurchase(order);
  if (!purchase || typeof window === "undefined") return () => {};

  const stop = () => window.removeEventListener(GOOGLE_TAG_READY_EVENT, attempt);
  function attempt() {
    if (sendPurchase(purchase!)) stop();
  }
  window.addEventListener(GOOGLE_TAG_READY_EVENT, attempt);
  attempt();
  return stop;
}