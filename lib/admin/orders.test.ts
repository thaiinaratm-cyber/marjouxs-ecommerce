import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureOrder } from "@/lib/orders/fixture";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), admin: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin: mocks.auth }));
vi.mock("@/lib/checkout/supabase", () => ({ getSupabaseAdmin: mocks.admin }));
import { changeAdminOrderStatus, getAdminOrder, listAdminOrders } from "@/lib/admin/orders";

function query(data: unknown = [fixtureOrder()], count = 21, error: { code: string; message: string } | null = null) {
  const response = { data, error, count };
  const q = { select: vi.fn(), eq: vi.fn(), or: vi.fn(), order: vi.fn(), range: vi.fn(), update: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data: Array.isArray(data) ? data[0] : data, error })),
    then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve) };
  for (const method of [q.select, q.eq, q.or, q.order, q.range, q.update]) method.mockReturnValue(q);
  return q;
}
describe("admin: acesso e operações dos pedidos", () => {
  let q: ReturnType<typeof query>;
  beforeEach(() => {
    vi.clearAllMocks(); q = query(); mocks.auth.mockResolvedValue({ userId: "admin" });
    mocks.admin.mockReturnValue({ from: mocks.from }); mocks.from.mockReturnValue(q);
  });
  it("admin ativo lê pedidos e detalhe pelo snapshot", async () => {
    expect((await listAdminOrders({})).orders[0].order_number).toBe("MJ-000001");
    expect((await getAdminOrder(fixtureOrder().id))?.ecommerce_order_items[0].product_name).toBe("Alianças do pedido");
    expect(mocks.auth).toHaveBeenCalled();
  });
  it("lista vazia retorna estado vazio e cards zerados, sem erro", async () => {
    q = query([], 0); mocks.from.mockReturnValue(q);
    const result = await listAdminOrders({});
    expect(result.orders).toEqual([]); expect(result.count).toBe(0); expect(result.counts).toEqual([0, 0, 0, 0]);
  });
  it.each(["pickup", "shipping"] as const)("lista %s com opcionais null, sem attempts nem joins obrigatórios", async (delivery_method) => {
    q = query([fixtureOrder({ delivery_method, shipping_carrier: null, shipping_service: null, ecommerce_payment_attempts: [] })], 1);
    mocks.from.mockReturnValue(q);
    const result = await listAdminOrders({});
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].delivery_method).toBe(delivery_method);
    const selection = q.select.mock.calls[0][0] as string;
    expect(selection).not.toMatch(/ecommerce_payment_attempts|ecommerce_order_items|!inner|tracking|fulfillment/);
  });
  it("erro real da consulta preserva diagnóstico técnico sem PII nos logs", async () => {
    q = query(null, 0, { code: "42703", message: "column ecommerce_orders.missing_test_column does not exist" });
    mocks.from.mockReturnValue(q);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(listAdminOrders({ q: "cliente@example.invalid" })).rejects.toThrow("admin_orders_list_failed:42703:ecommerce_orders.missing_test_column");
      expect(log).toHaveBeenCalledWith("admin_orders_read_failure", { stage: "list", code: "42703", column: "ecommerce_orders.missing_test_column" });
      expect(JSON.stringify(log.mock.calls)).not.toContain("cliente@example.invalid");
    } finally { log.mockRestore(); }
  });
  it.each(["visitante", "não-admin", "admin inativo"])("bloqueia %s antes de obter cliente privilegiado", async () => {
    mocks.auth.mockRejectedValue(new Error("access_denied"));
    await expect(listAdminOrders({})).rejects.toThrow("access_denied");
    await expect(getAdminOrder(fixtureOrder().id)).rejects.toThrow("access_denied");
    await expect(changeAdminOrderStatus(fixtureOrder().id, "preparing", "paid")).rejects.toThrow("access_denied");
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("busca número/nome/telefone/e-mail e aplica filtros e paginação", async () => {
    await listAdminOrders({ q: "MJ-000001", status: "preparing", page: "2" });
    expect(q.or).toHaveBeenCalledWith(expect.stringContaining("order_number.ilike.%MJ-000001%"));
    expect(q.or).toHaveBeenCalledWith(expect.stringContaining("customer_email.ilike."));
    expect(q.or).toHaveBeenCalledWith(expect.stringContaining("customer_phone.ilike."));
    expect(q.eq).toHaveBeenCalledWith("order_status", "preparing");
    expect(q.range).toHaveBeenCalledWith(20, 39);
    expect(q.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
  it("cards contam somente pedidos efetivamente pagos", async () => {
    await listAdminOrders({});
    expect(q.eq.mock.calls.filter(([name, value]) => name === "payment_status" && value === "paid")).toHaveLength(4);
  });
  it("persiste somente order_status com controle de concorrência", async () => {
    q = query(fixtureOrder()); mocks.from.mockReturnValue(q);
    expect(await changeAdminOrderStatus(fixtureOrder().id, "preparing", "paid")).toBe("saved");
    expect(q.update).toHaveBeenCalledWith({ order_status: "preparing" });
    expect(q.eq).toHaveBeenCalledWith("payment_status", "paid");
    expect(q.eq).toHaveBeenCalledWith("order_status", "paid");
  });
  it("não promove pedido pendente a pago e não altera pedido concorrente", async () => {
    q = query(fixtureOrder({ payment_status: "pending", order_status: "pending_payment" })); mocks.from.mockReturnValue(q);
    expect(await changeAdminOrderStatus(fixtureOrder().id, "paid", "pending_payment")).toBe("invalid");
    expect(q.update).not.toHaveBeenCalled();
    q = query(fixtureOrder({ order_status: "completed" })); mocks.from.mockReturnValue(q);
    expect(await changeAdminOrderStatus(fixtureOrder().id, "preparing", "paid")).toBe("conflict");
    expect(q.update).not.toHaveBeenCalled();
  });
  it("uma nova leitura observa o status persistido no armazenamento simulado", async () => {
    let storedOrder = fixtureOrder();
    mocks.from.mockImplementation(() => {
      const request = query(storedOrder);
      request.update.mockImplementation((payload: { order_status: typeof storedOrder.order_status }) => {
        storedOrder = { ...storedOrder, ...payload };
        return query({ id: storedOrder.id });
      });
      return request;
    });
    expect(await changeAdminOrderStatus(storedOrder.id, "preparing", "paid")).toBe("saved");
    expect((await getAdminOrder(storedOrder.id))?.order_status).toBe("preparing");
    expect(storedOrder.payment_status).toBe("paid");
  });
});
