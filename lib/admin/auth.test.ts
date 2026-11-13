import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), from: vi.fn(), admin: vi.fn(), eq: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
import { resolveAdminAccess } from "@/lib/admin/auth";

describe("admin authorization uses verified claims and active membership", () => {
  const client = { auth: { getClaims: mocks.claims }, from: mocks.from } as unknown as SupabaseClient;
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.claims.mockResolvedValue({ data: { claims: { sub: "synthetic-user" } }, error: null });
    const query = { eq: mocks.eq, maybeSingle: mocks.admin };
    mocks.eq.mockReturnValue(query);
    mocks.from.mockReturnValue({ select: () => query });
    mocks.admin.mockResolvedValue({ data: { is_active: true }, error: null });
  });
  it.each([null, { claims: {} }])("rejects missing identity before reading membership", async data => {
    mocks.claims.mockResolvedValue({ data, error: null });
    expect((await resolveAdminAccess(client)).status).toBe("unauthenticated");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects forged/expired claims even with a supplied sub", async () => {
    mocks.claims.mockResolvedValue({ data: { claims: { sub: "forged" } }, error: { message: "invalid signature" } });
    expect((await resolveAdminAccess(client)).status).not.toBe("authorized");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([null, { is_active: false }])("rejects non-admin or inactive admin %j", async data => {
    mocks.admin.mockResolvedValue({ data, error: null });
    expect((await resolveAdminAccess(client)).status).toBe("not_admin");
  });
  it("fails closed on membership read errors and never trusts the button visibility", async () => {
    mocks.admin.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect((await resolveAdminAccess(client)).status).toBe("verification_error");
  });
  it("accepts only the verified sub with active membership", async () => {
    expect(await resolveAdminAccess(client)).toEqual({ status: "authorized", userId: "synthetic-user" });
    expect(mocks.from).toHaveBeenCalledWith("ecommerce_admin_users");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "synthetic-user");
    expect(mocks.eq).toHaveBeenCalledWith("is_active", true);
  });
});
