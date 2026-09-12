import { describe, expect, it, vi } from "vitest";
import {
  getValidMelhorEnvioAccessToken,
  type MelhorEnvioCredentialStore
} from "@/lib/checkout/melhor-envio-token";
import { MelhorEnvioOAuthError } from "@/lib/checkout/melhor-envio-oauth";

const NOW = Date.parse("2026-09-11T12:00:00.000Z");
const oldCredential = {
  accessToken: "old-access",
  expiresAt: new Date(NOW + 4 * 60 * 1000).toISOString()
};
const freshCredential = {
  accessToken: "fresh-access",
  expiresAt: new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString()
};
const refreshedTokens = {
  accessToken: "fresh-access",
  refreshToken: "rotated-refresh",
  expiresIn: 2_592_000
};

function store(overrides: Partial<MelhorEnvioCredentialStore> = {}): MelhorEnvioCredentialStore {
  return {
    get: vi.fn().mockResolvedValue(oldCredential),
    claim: vi.fn().mockResolvedValue({
      claimed: true,
      lockToken: "00000000-0000-4000-8000-000000000001",
      refreshToken: "current-refresh",
      expiresAt: oldCredential.expiresAt
    }),
    complete: vi.fn().mockResolvedValue(true),
    release: vi.fn().mockResolvedValue(true),
    ...overrides
  };
}

describe("Melhor Envio token manager", () => {
  it("informa com segurança quando ainda não existe autorização", async () => {
    const credentialStore = store({ get: vi.fn().mockResolvedValue(null) });

    await expect(
      getValidMelhorEnvioAccessToken({ store: credentialStore, now: () => NOW })
    ).rejects.toMatchObject({ code: "melhor_envio_authorization_required", status: 503 });
  });

  it("reutiliza um access token válido por mais de cinco minutos", async () => {
    const credentialStore = store({ get: vi.fn().mockResolvedValue(freshCredential) });
    const refreshToken = vi.fn();

    await expect(
      getValidMelhorEnvioAccessToken({ store: credentialStore, refreshToken, now: () => NOW })
    ).resolves.toBe("fresh-access");
    expect(credentialStore.claim).not.toHaveBeenCalled();
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it("renova perto da expiração e persiste também o refresh token rotacionado", async () => {
    const credentialStore = store();
    const refreshToken = vi.fn().mockResolvedValue(refreshedTokens);

    await expect(
      getValidMelhorEnvioAccessToken({ store: credentialStore, refreshToken, now: () => NOW })
    ).resolves.toBe("fresh-access");
    expect(refreshToken).toHaveBeenCalledWith("current-refresh");
    expect(credentialStore.complete).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      refreshedTokens
    );
    expect(credentialStore.release).not.toHaveBeenCalled();
  });

  it("libera o lock quando o provedor rejeita o refresh", async () => {
    const credentialStore = store();
    const failure = new MelhorEnvioOAuthError("Falha segura.", "refresh_failed", 502);

    await expect(
      getValidMelhorEnvioAccessToken({
        store: credentialStore,
        refreshToken: vi.fn().mockRejectedValue(failure),
        now: () => NOW
      })
    ).rejects.toBe(failure);
    expect(credentialStore.release).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
    expect(credentialStore.complete).not.toHaveBeenCalled();
  });

  it("repete uma gravação transitória sem liberar o refresh token já rotacionado", async () => {
    const complete = vi.fn().mockRejectedValueOnce(new Error("temporary")).mockResolvedValueOnce(true);
    const credentialStore = store({ complete });
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      getValidMelhorEnvioAccessToken({
        store: credentialStore,
        refreshToken: vi.fn().mockResolvedValue(refreshedTokens),
        now: () => NOW,
        sleep
      })
    ).resolves.toBe("fresh-access");
    expect(complete).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(100);
    expect(credentialStore.release).not.toHaveBeenCalled();
  });

  it("coordena duas instâncias e faz somente uma renovação", async () => {
    let current = oldCredential;
    let claimed = false;
    const credentialStore: MelhorEnvioCredentialStore = {
      get: vi.fn(async () => current),
      claim: vi.fn(async () => {
        if (claimed) {
          return { claimed: false, lockToken: null, refreshToken: null, expiresAt: current.expiresAt };
        }
        claimed = true;
        return {
          claimed: true,
          lockToken: "00000000-0000-4000-8000-000000000001",
          refreshToken: "current-refresh",
          expiresAt: current.expiresAt
        };
      }),
      complete: vi.fn(async (_lockToken, tokens) => {
        current = {
          accessToken: tokens.accessToken,
          expiresAt: new Date(NOW + tokens.expiresIn * 1000).toISOString()
        };
        return true;
      }),
      release: vi.fn().mockResolvedValue(true)
    };
    const refreshToken = vi.fn().mockResolvedValue(refreshedTokens);
    const options = {
      store: credentialStore,
      refreshToken,
      now: () => NOW,
      sleep: async () => undefined,
      waitAttempts: 2,
      waitIntervalMs: 0
    };

    const [first, second] = await Promise.all([
      getValidMelhorEnvioAccessToken(options),
      getValidMelhorEnvioAccessToken(options)
    ]);

    expect(first).toBe("fresh-access");
    expect(second).toBe("fresh-access");
    expect(refreshToken).toHaveBeenCalledOnce();
    expect(credentialStore.complete).toHaveBeenCalledOnce();
  });

  it("não reutiliza refresh antigo quando a gravação após rotação falha", async () => {
    const credentialStore = store({
      complete: vi.fn().mockRejectedValue(new Error("database unavailable")),
      get: vi
        .fn()
        .mockResolvedValueOnce(oldCredential)
        .mockRejectedValueOnce(new Error("database unavailable"))
    });

    await expect(
      getValidMelhorEnvioAccessToken({
        store: credentialStore,
        refreshToken: vi.fn().mockResolvedValue(refreshedTokens),
        now: () => NOW
      })
    ).rejects.toMatchObject({ code: "melhor_envio_integration_error" });
    expect(credentialStore.release).not.toHaveBeenCalled();
  });
});
