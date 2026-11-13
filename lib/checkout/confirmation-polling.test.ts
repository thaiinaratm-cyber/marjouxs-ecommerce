import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startConfirmationPolling, CONFIRMATION_POLL_LIMIT_MS, CONFIRMATION_REQUEST_TIMEOUT_MS,
  type ConfirmationState } from "@/lib/checkout/confirmation-polling";
import { confirmationFixture } from "@/lib/checkout/confirmation.fixture";

const token = "00000000-0000-4000-8000-000000000099";
describe("bounded read-only post-payment observer (no real network)", () => {
  let stop: () => void;
  let states: ConfirmationState[];
  let http: ReturnType<typeof vi.fn>;
  function start(otherToken = token) {
    stop = startConfirmationPolling({ token: otherToken, onState: value => states.push(value),
      fetchImplementation: http, now: () => Date.now() });
  }
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
    states = []; stop = () => {};
    http = vi.fn(async () => Response.json(confirmationFixture()));
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Real network forbidden"); }));
  });
  afterEach(() => { stop(); expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("loading never claims paid before the authoritative response", async () => {
    start(); expect(states[0]).toEqual({ phase: "loading", order: null, refreshing: true });
    await vi.advanceTimersByTimeAsync(0); expect(states.at(-1)).toMatchObject({ phase: "ready", order: { paymentStatus: "pending" } });
  });
  it.each(["paid", "requires_review", "failed"] as const)("%s stops polling immediately", async paymentStatus => {
    http.mockImplementation(async () => Response.json(confirmationFixture({ paymentStatus,
      paidAt: paymentStatus === "paid" ? "2026-11-04T12:01:00Z" : null })));
    start(); await vi.advanceTimersByTimeAsync(5 * CONFIRMATION_POLL_LIMIT_MS);
    expect(http).toHaveBeenCalledOnce(); expect(states.at(-1)).toMatchObject({ phase: "ready", order: { paymentStatus } });
  });
  it("pending becomes paid and no subsequent read/checkout/provider call is made", async () => {
    http.mockImplementationOnce(async () => Response.json(confirmationFixture()))
      .mockImplementation(async () => Response.json(confirmationFixture({ paymentStatus: "paid", paidAt: "2026-11-04T12:01:00Z" })));
    start(); await vi.advanceTimersByTimeAsync(30_000);
    expect(http).toHaveBeenCalledTimes(2); expect(states.at(-1)?.order?.paymentStatus).toBe("paid");
    for (const [url, options] of http.mock.calls) {
      expect(url).toBe(`/api/orders/${token}`); expect(options.method).toBeUndefined();
      expect(options.cache).toBe("no-store"); expect(options.referrerPolicy).toBe("no-referrer");
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["requires_review", "failed"] as const)("pending transitions to %s and stops", async paymentStatus => {
    http.mockImplementationOnce(async () => Response.json(confirmationFixture()))
      .mockImplementation(async () => Response.json(confirmationFixture({ paymentStatus })));
    start(); await vi.advanceTimersByTimeAsync(30_000);
    expect(http).toHaveBeenCalledTimes(2); expect(states.at(-1)?.order?.paymentStatus).toBe(paymentStatus);
  });
  it("pending polling ends after two minutes without changing financial status", async () => {
    start(); await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_LIMIT_MS + 60_000);
    expect(states.at(-1)).toMatchObject({ phase: "pending_timeout", order: { paymentStatus: "pending" } });
    expect(http.mock.calls.length).toBeLessThan(25); expect(http.mock.calls.length).toBeGreaterThan(5);
    const count = http.mock.calls.length; await vi.advanceTimersByTimeAsync(60_000); expect(http).toHaveBeenCalledTimes(count);
  });
  it.each(["", "1", "invalid", "MJ-000123"])("malformed reference %s is generic and never queried", value => {
    start(value); expect(states.at(-1)).toEqual({ phase: "invalid", order: null, refreshing: false }); expect(http).not.toHaveBeenCalled();
  });
  it.each([404, 410])("HTTP %s stops without revealing existence or raw response", async status => {
    http.mockResolvedValue(new Response('private-token customer@example.invalid', { status }));
    start(); await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_LIMIT_MS);
    expect(http).toHaveBeenCalledOnce(); expect(states.at(-1)).toEqual({ phase: "invalid", order: null, refreshing: false });
  });
  it.each([500, 503])("HTTP %s is a temporary query error, not failed payment", async status => {
    http.mockImplementation(async () => new Response("private error", { status }));
    start(); await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_LIMIT_MS);
    expect(states.at(-1)).toEqual({ phase: "temporary_error", order: null, refreshing: false });
    expect(JSON.stringify(states)).not.toContain("private error"); expect(http.mock.calls.length).toBeLessThan(15);
  });
  it.each(["offline", "AbortError"])("%s stays neutral and can be consulted again manually", async name => {
    http.mockRejectedValue(new DOMException("secret customer@example.invalid", name));
    start(); await vi.advanceTimersByTimeAsync(0);
    expect(states.at(-1)?.phase).toBe("temporary_error"); stop();
    http.mockImplementation(async () => Response.json(confirmationFixture())); start();
    await vi.advanceTimersByTimeAsync(0); expect(states.at(-1)?.order?.paymentStatus).toBe("pending");
    expect(JSON.stringify(states)).not.toMatch(/secret|customer@/);
  });
  it("ten-second timeout aborts a stuck request; hard deadline still stops every timer", async () => {
    http.mockImplementation(() => new Promise(() => {})); start();
    await vi.advanceTimersByTimeAsync(CONFIRMATION_REQUEST_TIMEOUT_MS);
    expect(http.mock.calls[0][1].signal.aborted).toBe(true); expect(states.at(-1)?.phase).toBe("temporary_error");
    await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_LIMIT_MS); expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps the last known pending state on network errors", async () => {
    http.mockImplementationOnce(async () => Response.json(confirmationFixture())).mockRejectedValue(new Error("offline"));
    start(); await vi.advanceTimersByTimeAsync(4000);
    expect(states.at(-1)).toMatchObject({ phase: "temporary_error", order: { paymentStatus: "pending" } });
  });
  it("invalid JSON and invalid public contracts never become a paid confirmation", async () => {
    for (const body of ["not JSON", JSON.stringify({ paymentStatus: "paid" })]) {
      states = []; http.mockImplementation(async () => new Response(body)); start();
      await vi.advanceTimersByTimeAsync(0); expect(states.at(-1)?.phase).toBe("temporary_error"); expect(states.at(-1)?.order).toBeNull(); stop();
    }
  });
  it("refresh/back/close aborts stale reads; reopening consults by token without browser storage", async () => {
    let resolve!: (response: Response) => void;
    http.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
    start(); const before = states.length; stop();
    resolve(Response.json(confirmationFixture({ paymentStatus: "paid", paidAt: "2026-11-04T12:01:00Z" })));
    await vi.advanceTimersByTimeAsync(0); expect(states).toHaveLength(before);
    http.mockImplementation(async () => Response.json(confirmationFixture({ paymentStatus: "paid", paidAt: "2026-11-04T12:01:00Z" })));
    start(); await vi.advanceTimersByTimeAsync(0); expect(states.at(-1)?.order?.paymentStatus).toBe("paid");
  });
  it("two independent tabs can see paid, with only read requests and no financial side effects", async () => {
    const a: ConfirmationState[] = [], b: ConfirmationState[] = [];
    http.mockImplementation(async () => Response.json(confirmationFixture({ paymentStatus: "paid", paidAt: "2026-11-04T12:01:00Z" })));
    const stopA = startConfirmationPolling({ token, onState: value => a.push(value), fetchImplementation: http });
    const stopB = startConfirmationPolling({ token, onState: value => b.push(value), fetchImplementation: http });
    await vi.advanceTimersByTimeAsync(0); stopA(); stopB();
    expect(a.at(-1)?.order?.paymentStatus).toBe("paid"); expect(b.at(-1)?.order?.paymentStatus).toBe("paid");
    expect(http).toHaveBeenCalledTimes(2); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["paid", "pending", "requires_review", "failed"] as const)("refresh/reopen of %s only repeats the authoritative read", async paymentStatus => {
    http.mockImplementation(async () => Response.json(confirmationFixture({ paymentStatus,
      paidAt: paymentStatus === "paid" ? "2026-11-04T12:01:00Z" : null })));
    for (let refresh = 0; refresh < 3; refresh++) {
      start(); await vi.advanceTimersByTimeAsync(0);
      expect(states.at(-1)?.order?.paymentStatus).toBe(paymentStatus); stop();
    }
    expect(http).toHaveBeenCalledTimes(3); expect(fetch).not.toHaveBeenCalled();
  });
  it("manual consultation after the polling limit gets a new bounded read cycle, not a new order", async () => {
    start(); await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_LIMIT_MS);
    expect(states.at(-1)?.phase).toBe("pending_timeout"); stop();
    start(); await vi.advanceTimersByTimeAsync(0);
    expect(states.at(-1)).toMatchObject({ phase: "ready", order: { paymentStatus: "pending" } });
    await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_LIMIT_MS); expect(vi.getTimerCount()).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("a temporary network failure can later reflect paid without changing status locally", async () => {
    http.mockRejectedValueOnce(new Error("offline")).mockImplementation(async () =>
      Response.json(confirmationFixture({ paymentStatus: "paid", paidAt: "2026-11-04T12:01:00Z" })));
    start(); await vi.advanceTimersByTimeAsync(0); expect(states.at(-1)?.phase).toBe("temporary_error");
    await vi.advanceTimersByTimeAsync(6000); expect(states.at(-1)?.order?.paymentStatus).toBe("paid");
    expect(http).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0);
  });
});
