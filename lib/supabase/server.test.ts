import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ cookies: vi.fn(), create: vi.fn(), set: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }));
vi.mock("@/lib/supabase/config", () => ({ getSupabasePublicConfig: () => ({ url: "https://example.invalid", anonKey: "qa-public-key" }) }));
import { createSupabaseServerClient } from "@/lib/supabase/server";

describe("Next 15 async cookies compatibility", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.cookies.mockResolvedValue({ getAll: () => [{ name: "qa", value: "synthetic" }], set: mocks.set });
    mocks.create.mockReturnValue({ kind: "synthetic-server-client" });
  });
  it("awaits cookies and keeps the SSR session adapter contract", async () => {
    expect(await createSupabaseServerClient()).toEqual({ kind: "synthetic-server-client" });
    const adapter = mocks.create.mock.calls[0][2].cookies;
    expect(adapter.getAll()).toEqual([{ name: "qa", value: "synthetic" }]);
    adapter.setAll([{ name: "qa", value: "updated", options: { sameSite: "lax" } }]);
    expect(mocks.set).toHaveBeenCalledWith("qa", "updated", { sameSite: "lax" });
  });
  it("preserves read-only Server Component handling when cookies cannot be written", async () => {
    mocks.set.mockImplementation(() => { throw new Error("Read-only render context"); });
    await createSupabaseServerClient();
    expect(() => mocks.create.mock.calls[0][2].cookies.setAll([{ name: "qa", value: "updated", options: {} }])).not.toThrow();
  });
});
