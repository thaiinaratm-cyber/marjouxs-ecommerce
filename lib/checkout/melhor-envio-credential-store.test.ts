import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/checkout/supabase", () => ({
  getSupabaseAdmin: () => ({ rpc: mocks.rpc })
}));

import { createMelhorEnvioCredentialStore } from "@/lib/checkout/melhor-envio-token";

describe("Melhor Envio credential store", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it("repete somente a leitura quando a RPC falha transitoriamente", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: { code: "", message: "fetch failed" } })
      .mockResolvedValueOnce({
        data: [
          {
            access_token: "stored-access-token",
            expires_at: "2026-10-11T18:49:35.030346+00:00"
          }
        ],
        error: null
      });

    await expect(createMelhorEnvioCredentialStore().get()).resolves.toMatchObject({
      accessToken: "stored-access-token",
      expiresAt: "2026-10-11T18:49:35.030346+00:00"
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("classifica falha persistente da RPC como erro de integração", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST000", message: "unavailable" } });

    await expect(createMelhorEnvioCredentialStore().get()).rejects.toMatchObject({
      code: "melhor_envio_integration_error",
      status: 503
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(3);
  });
});
