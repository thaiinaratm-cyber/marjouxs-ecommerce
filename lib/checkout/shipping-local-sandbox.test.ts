import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/checkout/postal-code-lookup", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/checkout/postal-code-lookup")>(),
  lookupPostalCode: vi.fn(async (postalCode: string) => ({ postalCode, city: "Arujá", state: "SP", street: "", neighborhood: "" }))
}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/checkout/supabase", () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc }) }));

import { getLocalMelhorEnvioSandboxAccessToken } from "@/lib/checkout/melhor-envio-local-sandbox";
import { quoteShipping } from "@/lib/checkout/shipping";

const sandbox = "https://sandbox.melhorenvio.com.br";
const token = "local-qa-secret-fixture";
const configuration = {
  baseUrl: sandbox, userAgent: "Marjouxs QA", allowedServiceIds: ["1"], originZip: "07400610",
  package: { weightKg: 0.3, lengthCm: 16, widthCm: 12, heightCm: 6 }
};
const validResponse = [{ id: 1, name: "PAC", company: { name: "Correios" }, price: "19.90", delivery_time: 5 }];
const successfulFetch = () => vi.fn(async () => new Response(JSON.stringify(validResponse)));

describe("isolated local Melhor Envio Sandbox token", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MELHOR_ENVIO_BASE_URL", sandbox);
    vi.stubEnv("MELHOR_ENVIO_LOCAL_SANDBOX_ACCESS_TOKEN", token);
    mocks.rpc.mockReset().mockResolvedValue({
      data: [{ access_token: "vault-fixture", expires_at: new Date(Date.now() + 3600000).toISOString() }], error: null
    });
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("dev + Sandbox usa token local sem nenhuma leitura ou escrita RPC", async () => {
    const fetchImplementation = successfulFetch();
    await expect(quoteShipping("07400805", 10000, { configuration, fetchImplementation })).resolves.toHaveLength(1);
    expect(fetchImplementation).toHaveBeenCalledWith(`${sandbox}/api/v2/me/shipment/calculate`,
      expect.objectContaining({ redirect: "error", headers: expect.objectContaining({ Authorization: `Bearer ${token}` }) }));
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith("shipping_quote", {
      token_source: "local_sandbox", environment: "sandbox", http_status: 200
    });
  });

  it("sem token local mantém leitura do Vault", async () => {
    vi.stubEnv("MELHOR_ENVIO_LOCAL_SANDBOX_ACCESS_TOKEN", "  ");
    const fetchImplementation = successfulFetch();
    await quoteShipping("07400805", 10000, { configuration, fetchImplementation });
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("ecommerce_get_melhor_envio_oauth", undefined);
    expect(fetchImplementation).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer vault-fixture" }) }));
  });

  it("production ignora token local e mantém fluxo normal via Vault", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchImplementation = successfulFetch();
    await quoteShipping("07400805", 10000, { configuration, fetchImplementation });
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(JSON.stringify(fetchImplementation.mock.calls)).not.toContain(token);
    expect(console.info).not.toHaveBeenCalled();
  });

  it.each(["https://melhorenvio.com.br", `${sandbox}/`, `${sandbox}.example.com`, "", " https://sandbox.melhorenvio.com.br"])(
    "base env %s não habilita token local", async (baseUrl) => {
      vi.stubEnv("MELHOR_ENVIO_BASE_URL", baseUrl);
      const fetchImplementation = successfulFetch();
      await quoteShipping("07400805", 10000, { configuration, fetchImplementation });
      expect(mocks.rpc).toHaveBeenCalledOnce();
      expect(JSON.stringify(fetchImplementation.mock.calls)).not.toContain(token);
    }
  );

  it("nunca envia token local para uma base efetiva diferente do Sandbox", async () => {
    const fetchImplementation = successfulFetch();
    await quoteShipping("07400805", 10000, {
      configuration: { ...configuration, baseUrl: "https://melhorenvio.com.br" }, fetchImplementation
    });
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(JSON.stringify(fetchImplementation.mock.calls)).not.toContain(token);
  });

  it("não disponibiliza token em execução de browser", () => {
    vi.stubGlobal("window", {});
    expect(getLocalMelhorEnvioSandboxAccessToken(sandbox)).toBeNull();
  });

  it("continua bloqueando cotação normal sem allowlist aprovada", async () => {
    vi.stubEnv("MELHOR_ENVIO_ALLOWED_JEWELRY_SERVICE_IDS", "");
    const fetchImplementation = successfulFetch();
    await expect(quoteShipping("07400805", 10000, { fetchImplementation }))
      .rejects.toMatchObject({ code: "shipping_allowlist_empty" });
    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([401, 403])("token local inválido/expirado HTTP %s não aciona OAuth ou Vault", async (status) => {
    const fetchImplementation = vi.fn(async () => new Response(`echo ${token}`, { status }));
    const error = await quoteShipping("07400805", 10000, { configuration, fetchImplementation }).catch((value) => value);
    expect(error).toMatchObject({ code: "melhor_envio_local_sandbox_token_invalid", status: 503 });
    expect(`${error.message} ${JSON.stringify(error)} ${JSON.stringify(vi.mocked(console.info).mock.calls)}`).not.toContain(token);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect(fetchImplementation.mock.calls[0]).not.toContain("/oauth/token");
  });

  it("erro de rede não revela segredo nem tenta fallback/refresh", async () => {
    const error = await quoteShipping("07400805", 10000, {
      configuration, fetchImplementation: vi.fn().mockRejectedValue(new Error(`Bearer ${token}`))
    }).catch((value) => value);
    expect(error.code).toBe("shipping_provider_unreachable");
    expect(`${error.message} ${JSON.stringify(vi.mocked(console.info).mock.calls)}`).not.toContain(token);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("diagnóstico não serializa token ou texto livre de erro do provedor", async () => {
    const onDiagnostics = vi.fn();
    await expect(quoteShipping("07400805", 10000, {
      configuration, onDiagnostics,
      fetchImplementation: vi.fn(async () => new Response(JSON.stringify([
        ...validResponse,
        { id: 2, name: `echo ${token}`, company: { name: `Bearer ${token}` }, error: `secret ${token} cliente@example.com` }
      ])))
    })).resolves.toHaveLength(1);
    const serialized = JSON.stringify([onDiagnostics.mock.calls, vi.mocked(console.info).mock.calls]);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain("cliente@example.com");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("não devolve segredo ecoado em um campo público do serviço", async () => {
    const result = await quoteShipping("07400805", 10000, {
      configuration,
      fetchImplementation: vi.fn(async () => new Response(JSON.stringify([
        { ...validResponse[0], name: `echo ${token}` }, ...validResponse
      ])))
    });
    expect(result).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
