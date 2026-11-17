import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const sql = readFileSync(new URL("../supabase/migrations/202611170001_checkout_recovery.sql", import.meta.url), "utf8");
const fixture = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE TABLE public.ecommerce_orders (
    id uuid PRIMARY KEY, order_number text, checkout_idempotency_key text UNIQUE,
    customer_phone text, payment_status text, order_status text, created_at timestamptz, store_id text
  );
  CREATE TABLE public.ecommerce_payment_attempts (order_id uuid, checkout_url text, provider_checkout_id text);
  CREATE TABLE public.ecommerce_integration_outbox (event_type text);
  ALTER TABLE ecommerce_orders ENABLE ROW LEVEL SECURITY;
  ALTER TABLE ecommerce_payment_attempts ENABLE ROW LEVEL SECURITY;
  GRANT SELECT ON ecommerce_orders, ecommerce_payment_attempts TO service_role;
`;
const requestId = "00000000-0000-4000-8000-000000000010";
const orderId = "00000000-0000-4000-8000-000000000011";
const phone = "11987654321";
const a = "a".repeat(64);
const b = "b".repeat(64);
const item = (quantity: number, stone: string, size: number) => ({
  productId: "qa", name: "QA", quantity, unitPriceCents: 16000,
  customization: { type: "ring_pair", stone_color: stone, ring1: { size, engraving: "QA" }, ring2: { size: 18 } }
});

it("guards install and enforces private, idempotent capture and read-only conversion", async () => {
  const db = new PGlite();
  try {
    await db.exec(fixture);
    await db.exec("ALTER TABLE ecommerce_orders DISABLE ROW LEVEL SECURITY;");
    await expect(db.exec(sql)).rejects.toThrow(/incompatible source ecommerce_orders/);
    await db.exec("ROLLBACK;");
    const installed = () => db.query("SELECT to_regclass('public.ecommerce_checkout_recovery') AS table_name");
    expect((await installed()).rows).toEqual([{ table_name: null }]);
    await db.exec("ALTER TABLE ecommerce_orders ENABLE ROW LEVEL SECURITY;");
    await db.exec("CREATE INDEX ecommerce_checkout_recovery_activity_idx ON ecommerce_orders (id);");
    await expect(db.exec(sql)).rejects.toThrow(/already exists/);
    await db.exec("ROLLBACK;");
    expect((await installed()).rows).toEqual([{ table_name: null }]);
    await db.exec("DROP INDEX ecommerce_checkout_recovery_activity_idx;");
    await db.exec(sql);
    await expect(db.exec(sql)).rejects.toThrow(/existing or partial installation/);
    await db.exec("ROLLBACK;");

    const privileges = await db.query(`
      SELECT role, has_table_privilege(role,'public.ecommerce_checkout_recovery_admin','SELECT') AS can_read,
      has_function_privilege(role,'public.ecommerce_record_checkout_recovery(text,bigint,text,text,boolean,text,jsonb,bigint,uuid)','EXECUTE') AS can_write
      FROM unnest(ARRAY['anon','authenticated','service_role']) AS role`);
    expect(privileges.rows).toEqual([
      { role: "anon", can_read: false, can_write: false }, { role: "authenticated", can_read: false, can_write: false },
      { role: "service_role", can_read: true, can_write: true }
    ]);
    const record = async (hash: string, rev: number, phoneValue: string, items: unknown[], id: string | null = null) => {
      await db.exec("SET ROLE service_role;");
      try {
        await db.query("SELECT public.ecommerce_record_checkout_recovery($1,$2,$3,'QA',true,'pickup',$4::jsonb,$5,$6)",
          [hash, rev, phoneValue, JSON.stringify(items), items.length ? 16000 : 0, id]);
      } finally { await db.exec("RESET ROLE;"); }
    };
    const privateRows = () => db.query("SELECT status,stage,phone_last4,order_id,contact_allowed,cart_items FROM ecommerce_checkout_recovery_admin ORDER BY status");
    const count = async () => (await db.query("SELECT count(*)::int AS count FROM ecommerce_checkout_recovery")).rows[0];
    await record(a, 1, phone, []);
    expect(await count()).toEqual({ count: 0 });
    await record(a, 1, phone, [item(1, "cristal", 15), item(1, "esmeralda", 16)]);
    await record(a, 2, phone, [item(1, "cristal", 15), item(1, "esmeralda", 16)]);
    expect(await count()).toEqual({ count: 1 });
    await record(a, 3, phone, [item(2, "esmeralda", 17)]);
    await record(a, 2, phone, [item(1, "cristal", 15)]);
    await record(a, 99, "21987654321", [item(3, "cristal", 20)]);
    expect((await privateRows()).rows[0]).toMatchObject({ status: "active", stage: "checkout_started",
      phone_last4: "4321", cart_items: [item(2, "esmeralda", 17)] });
    await record(a, 4, phone, [item(2, "esmeralda", 17)], requestId);
    await record(a, 5, phone, [item(2, "esmeralda", 17)], requestId);
    expect((await db.query("SELECT checkout_request_ids FROM ecommerce_checkout_recovery")).rows).toEqual([{ checkout_request_ids: [requestId] }]);
    await record(b, 1, "21987654321", [item(1, "cristal", 15)], requestId);
    await db.query("INSERT INTO ecommerce_orders VALUES($1,'MJ-000011',$2,$3,'pending','pending_payment',now(),'marjouxs')", [orderId, "checkout:" + requestId, phone]);
    await db.query("INSERT INTO ecommerce_payment_attempts VALUES($1,'https://example.test/fixture','fixture')", [orderId]);
    expect((await privateRows()).rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "active", stage: "payment_link", order_id: orderId }),
      expect.objectContaining({ status: "active", stage: "checkout_started", order_id: null })
    ]));
    await db.query("UPDATE ecommerce_checkout_recovery SET last_activity_at = now() - interval '61 minutes' WHERE token_hash = $1", [a]);
    expect((await privateRows()).rows[0]).toMatchObject({ status: "abandoned", stage: "payment_link" });
    await db.query("UPDATE ecommerce_orders SET payment_status = 'paid' WHERE id = $1", [orderId]);
    expect((await privateRows()).rows.filter(row => (row as { status: string }).status === "converted")).toHaveLength(1);
    expect((await db.query("SELECT count(*)::int AS count FROM ecommerce_integration_outbox")).rows).toEqual([{ count: 0 }]);
    await db.query("UPDATE ecommerce_checkout_recovery SET expires_at = now() WHERE token_hash = $1", [a]);
    expect((await privateRows()).rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "converted", phone_last4: null, cart_items: [], contact_allowed: false })
    ]));
    await record(b, 2, "21987654321", []);
    expect((await privateRows()).rows).toHaveLength(1);
  } finally { await db.close(); }
}, 90_000);
