import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/address/lookup/route";

function request(postalCode: unknown) {
  return new Request("https://marjouxsjoias.com.br/api/address/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postalCode })
  });
}

describe("consulta de CEP", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normaliza o CEP e devolve os campos do endereço", async () => {
    const providerFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          cep: "07400-610",
          logradouro: "Avenida João Manoel",
          bairro: "Centro",
          localidade: "Arujá",
          uf: "SP"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", providerFetch);

    const response = await POST(request("07400-610"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      address: {
        postalCode: "07400610",
        street: "Avenida João Manoel",
        neighborhood: "Centro",
        city: "Arujá",
        state: "SP"
      }
    });
    expect(providerFetch).toHaveBeenCalledWith(
      "https://viacep.com.br/ws/07400610/json/",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("rejeita CEP incompleto sem consultar o provedor", async () => {
    const providerFetch = vi.fn();
    vi.stubGlobal("fetch", providerFetch);

    const response = await POST(request("07400"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "invalid_postal_code" });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("distingue CEP inexistente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ erro: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    const response = await POST(request("00000000"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: "postal_code_not_found" });
  });

  it("permite preenchimento manual quando o serviço falha", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network unavailable"))));

    const response = await POST(request("07400610"));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("postal_code_service_unavailable");
    expect(body.error).toContain("preenchendo o endereço manualmente");
    expect(JSON.stringify(body)).not.toContain("network unavailable");
  });
});
