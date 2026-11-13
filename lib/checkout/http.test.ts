import { afterEach, describe, expect, it, vi } from "vitest";
import { apiError, validationError } from "@/lib/checkout/http";

describe("safe checkout HTTP failures", () => {
  afterEach(() => vi.restoreAllMocks());
  it("never serializes arbitrary exception text to logs or the client", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const privateMessage = "fixture-secret qa@example.invalid SELECT private_table Authorization apikey";
    const response = apiError(new Error(privateMessage));
    expect(response.status).toBe(500);
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateMessage);
    expect(JSON.stringify(await response.json())).not.toMatch(/fixture-secret|qa@example|private_table|Authorization|apikey|stack/);
  });
  it("marks unexpected and validation errors private and non-cacheable", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const response of [apiError(new Error("synthetic")), validationError()]) {
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(response.headers.get("Cache-Control")).toContain("private");
    }
  });
});
