import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createPostalCodeLookup } from "@/lib/checkout/postal-code-lookup";
import { normalizePostalCode, POSTAL_CODE_MESSAGES } from "@/lib/checkout/postal-code";
import { postalCodeSchema } from "@/lib/checkout/schemas";

const address = { cep: "07400-805", localidade: "Arujá", uf: "SP", logradouro: "", bairro: "" };
const json = (body: unknown) => new Response(JSON.stringify(body));

describe("server-side ViaCEP validation", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(["07400805", "07400-805", " 07400-805 "])("normaliza %s e aceita CEP existente sem rua/bairro", async (input) => {
    const fetchImplementation = vi.fn(async () => json(address));
    const lookup = createPostalCodeLookup({ fetchImplementation });
    await expect(lookup(input)).resolves.toEqual({ postalCode: "07400805", city: "Arujá", state: "SP", street: "", neighborhood: "" });
    expect(postalCodeSchema.parse(input)).toBe("07400805");
    expect(fetchImplementation).toHaveBeenCalledWith("https://viacep.com.br/ws/07400805/json/",
      expect.objectContaining({ cache: "no-store", redirect: "error", signal: expect.any(AbortSignal) }));
  });

  it.each(["", "07400", "abcdefgh", "07400-80x", "07400805x", "x07400805", "074008050", "074.00805", null, 7400805])(
    "rejeita %s antes da rede e sem remover letras", async (input) => {
      const fetchImplementation = vi.fn();
      await expect(createPostalCodeLookup({ fetchImplementation })(input)).rejects.toMatchObject({ code: "invalid_postal_code", status: 400 });
      expect(normalizePostalCode(input)).toBeNull();
      expect(postalCodeSchema.safeParse(input).success).toBe(false);
      expect(fetchImplementation).not.toHaveBeenCalled();
    }
  );

  it.each([true, "true"])("somente erro=%s comprova inexistência", async (erro) => {
    const fetchImplementation = vi.fn(async () => json({ erro }));
    const lookup = createPostalCodeLookup({ fetchImplementation });
    await expect(lookup("99999999")).rejects.toMatchObject({ code: "postal_code_not_found", status: 404, message: POSTAL_CODE_MESSAGES.notFound });
  });

  it.each([400, 403, 404, 429, 500, 503])("HTTP %s é indisponibilidade, não inexistência", async (status) => {
    const fetchImplementation = vi.fn(async () => new Response("provider detail must not escape", { status }));
    await expect(createPostalCodeLookup({ fetchImplementation })("07400805"))
      .rejects.toMatchObject({ code: "postal_code_service_unavailable", status: 503, message: POSTAL_CODE_MESSAGES.unavailable });
  });

  it.each([null, [], {}, { ...address, cep: "01001-000" }, { ...address, uf: "" }, { ...address, localidade: "" }])(
    "não aceita resposta incompleta ou de outro CEP: %j", async (body) => {
      await expect(createPostalCodeLookup({ fetchImplementation: vi.fn(async () => json(body)) })("07400805"))
        .rejects.toMatchObject({ code: "postal_code_service_unavailable" });
    }
  );

  it("trata JSON inválido e falha de rede sem vazar detalhe externo", async () => {
    for (const fetchImplementation of [
      vi.fn(async () => new Response("not JSON")),
      vi.fn().mockRejectedValue(new Error("token and private provider detail"))
    ]) {
      await expect(createPostalCodeLookup({ fetchImplementation })("07400805"))
        .rejects.toMatchObject({ message: POSTAL_CODE_MESSAGES.unavailable, code: "postal_code_service_unavailable" });
    }
  });

  it("interrompe consulta em cinco segundos e classifica timeout como temporário", async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fetchImplementation = vi.fn((_input, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    const request = createPostalCodeLookup({ fetchImplementation })("07400805");
    const rejected = expect(request).rejects.toMatchObject({ code: "postal_code_service_unavailable", message: POSTAL_CODE_MESSAGES.unavailable });
    expect(timeout).toHaveBeenCalledWith(5000);
    controller.abort(new DOMException("timeout", "TimeoutError"));
    await rejected;
  });

  it("reutiliza somente sucesso recente e retorna cópia dos dados", async () => {
    let now = 0;
    const fetchImplementation = vi.fn(async () => json(address));
    const lookup = createPostalCodeLookup({ fetchImplementation, now: () => now });
    const first = await lookup("07400805");
    first.city = "Changed by caller";
    now = 299999;
    expect((await lookup("07400-805")).city).toBe("Arujá");
    expect(fetchImplementation).toHaveBeenCalledOnce();
    now = 300000;
    await lookup("07400805");
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("compartilha uma consulta concorrente e não guarda falha temporária", async () => {
    let release!: (response: Response) => void;
    const fetchImplementation = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; }));
    const lookup = createPostalCodeLookup({ fetchImplementation });
    const first = lookup("07400805");
    const second = lookup("07400-805");
    expect(fetchImplementation).toHaveBeenCalledOnce();
    release(new Response("offline", { status: 503 }));
    await expect(first).rejects.toMatchObject({ code: "postal_code_service_unavailable" });
    await expect(second).rejects.toMatchObject({ code: "postal_code_service_unavailable" });
    const retry = lookup("07400805");
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    release(json(address));
    await expect(retry).resolves.toMatchObject({ city: "Arujá" });
  });

  it("limita o cache a cem CEPs", async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL) => {
      const cep = String(input).match(/\/ws\/(\d{8})\//)![1];
      return json({ ...address, cep });
    });
    const lookup = createPostalCodeLookup({ fetchImplementation });
    for (let i = 0; i <= 100; i++) await lookup(String(10000000 + i));
    await lookup("10000000");
    expect(fetchImplementation).toHaveBeenCalledTimes(102);
  });
});
