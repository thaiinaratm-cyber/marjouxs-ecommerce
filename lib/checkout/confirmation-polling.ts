import { parseConfirmationOrder } from "@/lib/checkout/confirmation";
import type { PublicOrder } from "@/types/checkout";

export const CONFIRMATION_POLL_LIMIT_MS = 120_000;
export const CONFIRMATION_REQUEST_TIMEOUT_MS = 10_000;
export type ConfirmationState = {
  phase: "loading" | "ready" | "invalid" | "temporary_error" | "pending_timeout";
  order: PublicOrder | null;
  refreshing: boolean;
};
export const initialConfirmationState: ConfirmationState = { phase: "loading", order: null, refreshing: true };

// Read-only observer. Financial transitions and event creation never originate here.
export function startConfirmationPolling({ token, onState, initialOrder = null, fetchImplementation = fetch,
  now = () => performance.now() }: {
  token: string; onState: (state: ConfirmationState) => void; initialOrder?: PublicOrder | null;
  fetchImplementation?: typeof fetch; now?: () => number;
}) {
  let stopped = false;
  let order = initialOrder;
  let failures = 0;
  let nextTimer: ReturnType<typeof setTimeout> | undefined;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  let cancelRequest: (() => void) | undefined;
  const startedAt = now();
  const emit = (phase: ConfirmationState["phase"], refreshing = false) => onState({ phase, order, refreshing });
  function stop() {
    stopped = true; clearTimeout(nextTimer); clearTimeout(deadlineTimer); cancelRequest?.();
  }
  function finish(phase: ConfirmationState["phase"]) { stop(); emit(phase); }
  const remaining = () => CONFIRMATION_POLL_LIMIT_MS - (now() - startedAt);

  async function load() {
    if (stopped) return;
    if (remaining() <= 0) { finish(order?.paymentStatus === "pending" ? "pending_timeout" : "temporary_error"); return; }
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const interrupted = new Promise<never>((_resolve, reject) => {
      cancelRequest = () => { controller.abort(); reject(new Error("confirmation_read_interrupted")); };
      timeoutId = setTimeout(cancelRequest, Math.min(CONFIRMATION_REQUEST_TIMEOUT_MS, remaining()));
    });
    try {
      const response = await Promise.race([
        fetchImplementation(`/api/orders/${encodeURIComponent(token)}`, {
          cache: "no-store", referrerPolicy: "no-referrer", signal: controller.signal
        }), interrupted
      ]);
      if (stopped) return;
      if (response.status === 404 || response.status === 410) { order = null; finish("invalid"); return; }
      if (!response.ok) throw new Error("confirmation_read_unavailable");
      const body: unknown = await Promise.race([response.json(), interrupted]);
      if (stopped) return;
      const parsed = parseConfirmationOrder(body);
      if (!parsed) throw new Error("confirmation_response_invalid");
      order = parsed; failures = 0;
      if (order.paymentStatus !== "pending") { finish("ready"); return; }
      emit("ready");
    } catch {
      if (stopped) return;
      failures += 1;
      emit("temporary_error");
    } finally {
      clearTimeout(timeoutId); cancelRequest = undefined;
    }
    if (!stopped) {
      const delay = failures ? Math.min(3000 * 2 ** Math.min(failures, 3), 15_000)
        : now() - startedAt < 30_000 ? 3000 : 10_000;
      nextTimer = setTimeout(() => { void load(); }, Math.min(delay, Math.max(0, remaining())));
    }
  }
  if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(token)) {
    order = null; finish("invalid"); return stop;
  }
  emit("loading", true);
  deadlineTimer = setTimeout(() => {
    if (!stopped) finish(order?.paymentStatus === "pending" ? "pending_timeout" : "temporary_error");
  }, CONFIRMATION_POLL_LIMIT_MS);
  void load();
  return stop;
}
