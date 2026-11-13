import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureOrder } from "@/lib/orders/fixture";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/checkout/supabase", () => ({ getSupabaseAdmin: () => mocks }));
import { ensurePaidOrderEvent, reconcilePaidOrderEvents, sendOrderPaidEmail, type PaidEvent } from "@/lib/notifications/order-paid";
import { processEcommerceOutbox } from "@/lib/checkout/outbox";

function chain(data: unknown, error: { code: string } | null = null) {
  const response = { data, error };
  const q = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), is: vi.fn(),
    maybeSingle: async () => response,
    then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve) };
  for (const method of [q.select, q.eq, q.order, q.limit]) method.mockReturnValue(q);
  q.is.mockImplementation(() => { response.data = []; return q; });
  return q;
}
const now = Date.parse("2026-10-17T13:00:00Z");
const event: PaidEvent = { result_id: "event-id", result_order_id: fixtureOrder().id, result_lock_token: "lock", result_payload: { order_id: fixtureOrder().id } };

describe("order.paid: evento, envio e retry", () => {
  let order: ReturnType<typeof fixtureOrder> | null;
  let stored: { order_id: string; event_type: string; payload: Record<string, unknown> } | null;
  let frozenPayload: Record<string, unknown> | undefined;
  let insertError: { code: string } | null;
  let upsert: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.clearAllMocks(); order = fixtureOrder(); stored = null; frozenPayload = undefined; insertError = null;
    vi.stubEnv("ORDER_NOTIFICATIONS_ENABLED", "true"); vi.stubEnv("RESEND_API_KEY", "fake-server-key");
    vi.stubEnv("ORDER_NOTIFICATION_FROM", "Marjouxs <loja@example.invalid>");
    vi.stubEnv("ORDER_NOTIFICATION_EMAIL", "equipe@example.invalid");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://marjouxsjoias.com.br");
    upsert = vi.fn(async (body: NonNullable<typeof stored>) => {
      if (!stored && !insertError) stored = body;
      return { data: null, error: insertError };
    });
    update = vi.fn((body: { payload: Record<string, unknown> }) => { frozenPayload = body.payload; return chain({ id: event.result_id }); });
    mocks.from.mockImplementation((table: string) => table === "ecommerce_orders"
      ? { ...chain(order), is: () => chain([]) }
      : { upsert, update, ...chain(stored ? { id: event.result_id } : null) });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
  });
  it("não cria evento se o pedido ainda não está pago", async () => {
    order = null;
    expect(await ensurePaidOrderEvent(event.result_order_id)).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });
  it("usa UNIQUE sem sobrescrever evento existente, status ou payload", async () => {
    await ensurePaidOrderEvent(event.result_order_id);
    const first = stored;
    await ensurePaidOrderEvent(event.result_order_id);
    expect(stored).toBe(first);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ event_type: "order.paid", payload: expect.objectContaining({ total_cents: 350000, customer_name: "Cliente de teste", paid_at: expect.any(String) }) }), { onConflict: "order_id,event_type", ignoreDuplicates: true });
    expect(JSON.stringify(stored)).not.toContain("CPF-NAO-INCLUIR");
  });
  it("congela itens, gravacoes e entrega no enqueue sem depender de futuras edicoes", async () => {
    await ensurePaidOrderEvent(event.result_order_id);
    const payload = structuredClone(stored!.payload);
    expect(payload.snapshot_version).toBe(1);
    expect(JSON.stringify(payload)).toContain("João ♥ Ana");
    expect(payload).not.toHaveProperty("customer_cpf");
    order = fixtureOrder({ customer_name: "Nome alterado depois", total_cents: 1,
      delivery_method: "shipping", shipping_city: "Cidade alterada", ecommerce_order_items: [] });
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "mail1" })));
    await sendOrderPaidEmail({ ...event, result_payload: payload }, fetcher, now);
    const message = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(message.text).toContain("Cliente de teste");
    expect(message.text).toContain("Alianças do pedido");
    expect(message.text).toContain("João ♥ Ana");
    expect(message.text).toContain("Retirada na loja");
    expect(message.text).not.toContain("Nome alterado depois");
    expect(message.text).not.toContain("Cidade alterada");
  });
  it("snapshot versionado invalido nao e substituido silenciosamente nem enviado", async () => {
    const fetcher = vi.fn();
    await expect(sendOrderPaidEmail({ ...event, result_payload: { snapshot_version: 1 } }, fetcher, now))
      .rejects.toThrow("notification_order_snapshot_invalid");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("evento congelado nao envia se o pedido nao estiver mais pago", async () => {
    await ensurePaidOrderEvent(event.result_order_id);
    const payload = structuredClone(stored!.payload);
    order = null;
    const fetcher = vi.fn();
    await expect(sendOrderPaidEmail({ ...event, result_payload: payload }, fetcher, now))
      .rejects.toThrow("notification_paid_order_unavailable");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("23505 só é idempotente quando o evento já existe", async () => {
    await ensurePaidOrderEvent(event.result_order_id); insertError = { code: "23505" };
    await expect(ensurePaidOrderEvent(event.result_order_id)).resolves.toBe(true);
    stored = null;
    await expect(ensurePaidOrderEvent(event.result_order_id)).rejects.toThrow("notification_event_write_failed");
  });
  it("disabled não consulta pedidos nem envia", async () => {
    vi.stubEnv("ORDER_NOTIFICATIONS_ENABLED", "false"); const fetcher = vi.fn();
    expect(await sendOrderPaidEmail(event, fetcher)).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("congela conteúdo antes do envio e repete a mesma chave e mensagem após timeout", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("ambiguous timeout")).mockResolvedValue(new Response(JSON.stringify({ id: "mail1" }), { status: 200 }));
    await expect(sendOrderPaidEmail(event, fetcher, now)).rejects.toThrow("notification_provider_unavailable");
    expect(frozenPayload).toBeDefined(); expect(update).toHaveBeenCalledTimes(1);
    vi.stubEnv("ORDER_NOTIFICATION_EMAIL", "nova-equipe@example.invalid");
    const restoredPayload = structuredClone(frozenPayload!);
    const notification = restoredPayload.notification as { message: { from: string; to: string[]; subject: string; html: string; text: string } };
    const message = notification.message;
    notification.message = { text: message.text, html: message.html, subject: message.subject, to: message.to, from: message.from };
    await expect(sendOrderPaidEmail({ ...event, result_payload: restoredPayload }, fetcher, now + 1000)).resolves.toBe(true);
    const first = fetcher.mock.calls[0][1]; const second = fetcher.mock.calls[1][1];
    expect(first.body).toBe(second.body); expect(first.headers["Idempotency-Key"]).toBe(second.headers["Idempotency-Key"]);
    expect(first.headers["Idempotency-Key"]).toBe("marjouxs/order.paid/event-id");
    expect(order?.payment_status).toBe("paid");
  });
  it("não reenvia automaticamente depois da janela idempotente", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "mail1" })));
    await sendOrderPaidEmail(event, fetcher, now);
    await expect(sendOrderPaidEmail({ ...event, result_payload: frozenPayload! }, fetcher, now + 23 * 3600000)).rejects.toThrow("notification_retry_review_required");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("falha do provedor preserva pedido e snapshot para retry", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("secret-provider-error", { status: 503 }));
    await expect(sendOrderPaidEmail(event, fetcher, now)).rejects.toThrow("notification_provider_http_503");
    expect(order?.payment_status).toBe("paid"); expect(frozenPayload?.notification).toBeDefined();
  });
  it("worker completa sucesso com RPC existente e não modifica pedidos", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "mail1" })));
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "ecommerce_claim_outbox" ? [{ ...event, result_event_type: "order.paid", result_attempt_count: 1 }] : true, error: null }));
    try {
      expect(await processEcommerceOutbox()).toEqual({ claimed: 1, processed: 1, failed: 0 });
      expect(mocks.rpc).toHaveBeenCalledWith("ecommerce_complete_outbox", { p_event_id: event.result_id, p_lock_token: "lock" });
      expect(order?.payment_status).toBe("paid");
    } finally { vi.restoreAllMocks(); }
  });
  it("worker usa fail/retry existente sem logar dados pessoais", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("customer@example.invalid secret"));
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "ecommerce_claim_outbox" ? [{ ...event, result_event_type: "order.paid", result_attempt_count: 1 }] : true, error: null }));
    try {
      expect(await processEcommerceOutbox()).toEqual({ claimed: 1, processed: 0, failed: 1 });
      expect(mocks.rpc).toHaveBeenCalledWith("ecommerce_fail_outbox", { p_event_id: event.result_id, p_lock_token: "lock", p_error: "notification_provider_unavailable" });
      expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain("customer@example.invalid"); expect(order?.payment_status).toBe("paid");
    } finally { vi.restoreAllMocks(); }
  });
  it("worker disabled não reivindica eventos de email", async () => {
    vi.stubEnv("ORDER_NOTIFICATIONS_ENABLED", "false"); mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await processEcommerceOutbox()).toEqual({ claimed: 0, processed: 0, failed: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith("ecommerce_claim_outbox", { p_event_types: ["ga4_purchase"], p_limit: 5 });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("worker marca failed e o retry processa a mesma mensagem sem regredir o pedido pago", async () => {
    let status = "pending";
    let attempts = 0;
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("private-provider-body", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "mail1" })));
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "ecommerce_claim_outbox") {
        status = "processing"; attempts += 1;
        return { data: [{ ...event, result_payload: frozenPayload ?? event.result_payload, result_event_type: "order.paid", result_attempt_count: attempts }], error: null };
      }
      status = name === "ecommerce_fail_outbox" ? "failed" : "processed";
      return { data: true, error: null };
    });
    try {
      expect(await processEcommerceOutbox()).toEqual({ claimed: 1, processed: 0, failed: 1 });
      expect(status).toBe("failed");
      expect(order?.payment_status).toBe("paid"); expect(order?.order_status).toBe("paid");
      expect(mocks.rpc).toHaveBeenCalledWith("ecommerce_fail_outbox", expect.objectContaining({ p_error: "notification_provider_http_503" }));
      expect(await processEcommerceOutbox()).toEqual({ claimed: 1, processed: 1, failed: 0 });
      expect(status).toBe("processed"); expect(attempts).toBe(2);
      const first = fetcher.mock.calls[0][1]!; const second = fetcher.mock.calls[1][1]!;
      expect(first.body === second.body).toBe(true);
      expect(new Headers(first.headers).get("Idempotency-Key") === new Headers(second.headers).get("Idempotency-Key")).toBe(true);
      expect(order?.payment_status).toBe("paid"); expect(order?.order_status).toBe("paid");
      expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain("private-provider-body");
    } finally { vi.restoreAllMocks(); }
  });
  it("apos 23h o worker deixa failed para revisao sem chamar Resend", async () => {
    let status = "processing";
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "mail1" })));
    try {
      await sendOrderPaidEmail(event, globalThis.fetch, now);
      fetcher.mockClear();
      vi.spyOn(Date, "now").mockReturnValue(now + 23 * 3600000);
      mocks.rpc.mockImplementation(async (name: string) => {
        if (name === "ecommerce_claim_outbox") return { data: [{ ...event, result_payload: frozenPayload!, result_event_type: "order.paid", result_attempt_count: 2 }], error: null };
        status = name === "ecommerce_fail_outbox" ? "failed" : "processed";
        return { data: true, error: null };
      });
      expect(await processEcommerceOutbox()).toEqual({ claimed: 1, processed: 0, failed: 1 });
      expect(status).toBe("failed"); expect(fetcher).not.toHaveBeenCalled();
      expect(mocks.rpc).toHaveBeenCalledWith("ecommerce_fail_outbox", expect.objectContaining({ p_error: "notification_retry_review_required" }));
      expect(order?.payment_status).toBe("paid");
    } finally { vi.restoreAllMocks(); }
  });
  it("reconcilia somente pagos sem evento, por anti-join e lote limitado", async () => {
    const q = chain([]); mocks.from.mockReturnValue(q);
    await reconcilePaidOrderEvents(20);
    expect(q.eq).toHaveBeenCalledWith("payment_status", "paid");
    expect(q.eq).toHaveBeenCalledWith("ecommerce_integration_outbox.event_type", "order.paid");
    expect(q.is).toHaveBeenCalledWith("ecommerce_integration_outbox", null);
    expect(q.limit).toHaveBeenCalledWith(20);
  });
});
