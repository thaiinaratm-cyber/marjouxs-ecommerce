import { describe, expect, it } from "vitest";
import { classifyAdminAccess } from "@/lib/admin/access";

describe("classifyAdminAccess", () => {
  it("nega visitante sem sessão", () => {
    expect(classifyAdminAccess({})).toEqual({ status: "unauthenticated", userId: null });
  });

  it("nega usuário autenticado que não é admin ativo", () => {
    expect(classifyAdminAccess({ userId: "user-id", isActiveAdmin: false })).toEqual({
      status: "not_admin",
      userId: "user-id"
    });
  });

  it("autoriza somente admin ativo", () => {
    expect(classifyAdminAccess({ userId: "admin-id", isActiveAdmin: true })).toEqual({
      status: "authorized",
      userId: "admin-id"
    });
  });

  it("falha fechada quando a verificação do banco falha", () => {
    expect(classifyAdminAccess({ userId: "user-id", adminCheckFailed: true })).toEqual({
      status: "verification_error",
      userId: "user-id"
    });
  });
});
