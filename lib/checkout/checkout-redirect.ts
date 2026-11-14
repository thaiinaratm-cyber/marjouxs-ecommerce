export type CheckoutIdentity = { requestId: string; orderNumber: string };
type ExpectedCheckout = { requestId: string; totalCents: number };

const providerHosts = new Set(["checkout.infinitepay.io", "checkout.infinitepay.com.br", "buy.infinitepay.io"]);

function currentOrder(body: unknown, expected: ExpectedCheckout): (Record<string, unknown> & { orderNumber: string }) | null {
  if (!body || typeof body !== "object") return null;
  const result = body as Record<string, unknown>;
  if (result.requestId !== expected.requestId || result.totalCents !== expected.totalCents ||
      typeof result.orderNumber !== "string" || !/^MJ-\d{6,12}$/.test(result.orderNumber)) return null;
  return { ...result, orderNumber: result.orderNumber };
}

export function checkoutResumeRequired(status: number, body: unknown, expected: ExpectedCheckout): CheckoutIdentity | null {
  if (status !== 409) return null;
  const result = currentOrder(body, expected);
  if (result?.code !== "checkout_resume_required") return null;
  return { requestId: expected.requestId, orderNumber: result.orderNumber };
}

export function checkoutRedirect(
  response: Pick<Response, "ok">,
  body: unknown,
  expected: ExpectedCheckout & { origin: string; resume: CheckoutIdentity | null }
) {
  if (!response.ok) return null;
  const result = currentOrder(body, expected);
  if (!result || typeof result.checkoutUrl !== "string" || typeof result.alreadyPaid !== "boolean" ||
      typeof result.reusedLink !== "boolean" || (result.reusedLink && !expected.resume) ||
      (expected.resume && (expected.resume.requestId !== expected.requestId ||
        expected.resume.orderNumber !== result.orderNumber))) return null;

  let destination: URL;
  try { destination = new URL(result.checkoutUrl); } catch { return null; }
  if (destination.username || destination.password) return null;

  if (result.alreadyPaid) {
    if (result.reusedLink || destination.origin !== expected.origin ||
        destination.pathname !== "/pedido/confirmacao" || !destination.searchParams.get("token")) return null;
  } else {
    if (destination.protocol !== "https:" || destination.port || !providerHosts.has(destination.hostname)) return null;
    if (expected.resume && !result.reusedLink) return null;
  }
  return destination.href;
}
