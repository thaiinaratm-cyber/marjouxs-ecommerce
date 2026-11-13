import { createHash } from "node:crypto";
import { canonicalCheckoutJson } from "@/lib/checkout/intent";

export function checkoutRequestHash(value: unknown) {
  return createHash("sha256").update(canonicalCheckoutJson(value), "utf8").digest("hex");
}

export function checkoutIdempotencyKey(requestId: string) {
  return `checkout:${requestId}`;
}
