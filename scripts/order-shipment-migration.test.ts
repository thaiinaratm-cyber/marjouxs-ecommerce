import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migration = readFileSync(new URL(
  "../supabase/migrations/202611160002_order_shipment_tracking.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fixture = readFileSync(new URL("fixtures/order-shipment-schema.sql", import.meta.url), "utf8");
const signature = "public.ecommerce_update_order_shipment(uuid,timestamptz,text,text,text,text,boolean)";
const reviewedSha256 = "0bb9aff12281f67026fe52da4ffd1b1357ab8994b3be35c2ea937bcf6667b746";
const timeout = 60_000;

it("matches the reviewed release SQL (line endings normalized)", () => {
  expect(createHash("sha256").update(migration).digest("hex")).toBe(reviewedSha256);
});

describe("shipment migration on isolated PostgreSQL", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(fixture);
  }, timeout);
  afterAll(async () => { await db?.close(); }, timeout);

  const schemaState = async () => (await db.query(`
    SELECT
      to_regprocedure($1) IS NOT NULL AS rpc,
      (SELECT count(*)::int FROM pg_attribute
        WHERE attrelid = 'public.ecommerce_orders'::regclass AND NOT attisdropped
          AND attname IN ('dispatch_carrier','tracking_code','tracking_url','shipping_status',
            'shipped_at','in_transit_at','delivered_at')) AS columns,
      (SELECT count(*)::int FROM pg_constraint
        WHERE conrelid = 'public.ecommerce_orders'::regclass
          AND conname IN ('ecommerce_orders_tracking_format_ck','ecommerce_orders_shipping_status_ck',
            'ecommerce_orders_shipment_scope_ck')) AS constraints
  `, [signature])).rows[0];

  async function rejectMigration(setup: string, probe: "reject_ddl" | "fail_after_alter", error: RegExp) {
    const before = await schemaState();
    // An outer test transaction also rolls back the synthetic schema drift.
    await db.exec("BEGIN;");
    try {
      if (setup) await db.exec(setup);
      await db.exec(`SET LOCAL fixture.shipment_probe = '${probe}';`);
      await expect(db.exec(migration)).rejects.toThrow(error);
    } finally {
      await db.exec("ROLLBACK;");
    }
    expect(await schemaState()).toEqual(before);
  }

  it.each<[string, string, RegExp]>([
    ["wrong executor", "SET LOCAL ROLE authenticated;", /run as postgres/],
    ["table missing", "ALTER TABLE ecommerce_orders RENAME TO fixture_orders;", /does not exist/],
    ["owner mismatch", "ALTER TABLE ecommerce_orders OWNER TO authenticated;", /expected orders owned by postgres/],
    ["missing base column", "ALTER TABLE ecommerce_orders DROP COLUMN updated_at;", /missing\/incompatible orders columns: updated_at/],
    ["wrong base type", "ALTER TABLE ecommerce_orders ALTER COLUMN shipping_carrier TYPE integer USING NULL::integer;", /missing\/incompatible orders columns: shipping_carrier/],
    ["RLS disabled", "ALTER TABLE ecommerce_orders DISABLE ROW LEVEL SECURITY;", /RLS enabled/],
    ["existing policy", "CREATE POLICY fixture_read ON ecommerce_orders FOR SELECT TO authenticated USING (true);", /no policies/],
    ["partial install", "ALTER TABLE ecommerce_orders ADD COLUMN tracking_url text;", /full or partial installation/],
    ["existing RPC", "CREATE FUNCTION public.ecommerce_update_order_shipment(uuid,timestamptz,text,text,text,text,boolean) RETURNS text LANGUAGE sql AS $$ SELECT 'fixture'::text $$;", /full or partial installation/],
    ["existing constraint", "ALTER TABLE ecommerce_orders ADD CONSTRAINT ecommerce_orders_shipment_scope_ck CHECK (true);", /full or partial installation/],
    ["unreviewed UPDATE trigger", "CREATE TRIGGER fixture_touch BEFORE UPDATE ON ecommerce_orders FOR EACH ROW EXECUTE FUNCTION public.fixture_touch_order();", /review existing UPDATE triggers.*fixture_touch/],
    ["incompatible service role", "ALTER ROLE service_role NOBYPASSRLS;", /service_role or inherited/],
    ["inherited application access", "GRANT service_role TO authenticated;", /service_role or inherited/]
  ])("rejects %s before any DDL", async (_name, setup, error) => {
    await rejectMigration(setup, "reject_ddl", error);
  }, timeout);

  it("rolls back columns and constraints when the RPC creation fails after ALTER TABLE", async () => {
    await rejectMigration("", "fail_after_alter", /Fixture: abort after ALTER TABLE/);
    expect(await schemaState()).toEqual({ rpc: false, columns: 0, constraints: 0 });
  }, timeout);

  it("installs on the expected schema and preserves the existing RPC behavior and grants", async () => {
    await db.exec("SET fixture.shipment_probe = 'check_lock';");
    try { await db.exec(migration); } finally { await db.exec("RESET fixture.shipment_probe;"); }
    expect(await schemaState()).toEqual({ rpc: true, columns: 7, constraints: 3 });
    const { rows } = await db.query(`
      SELECT pg_get_userbyid(proowner) AS owner, pg_get_function_result(oid) AS result,
        prosecdef AS security_definer, proconfig AS config,
        has_function_privilege('service_role', oid, 'EXECUTE') AS service_execute,
        has_function_privilege('anon', oid, 'EXECUTE') AS anon_execute,
        has_function_privilege('authenticated', oid, 'EXECUTE') AS authenticated_execute
      FROM pg_proc WHERE oid = to_regprocedure($1)
    `, [signature]);
    expect(rows).toEqual([{ owner: "postgres", result: "text", security_definer: true, config: ['search_path=""'],
      service_execute: true, anon_execute: false, authenticated_execute: false }]);

    const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    const revision = "2026-11-15T00:00:00Z";
    const save = async (n: number, options: { carrier?: string; code?: string; url?: string; status?: string } = {}) =>
      (await db.query<{ result: string }>("SELECT public.ecommerce_update_order_shipment($1,$2,$3,$4,$5,$6,false) AS result",
        [id(n), revision, options.carrier ?? "Correios", options.code ?? "AB123456789BR",
          options.url ?? "https://tracking.example/parcel", options.status ?? "shipped"])).rows[0].result;

    for (const options of [{ carrier: "<b>" }, { code: "<script>" }, { url: "javascript:alert(1)" },
      { url: "data:text/html,x" }, { url: "file:///a" }, { url: "http://example.test" }, { url: "https:///bad" }]) {
      await expect(save(1, options)).rejects.toMatchObject({ code: "23514" });
    }
    expect(await save(1, { status: "unknown" })).toBe("invalid");
    for (const n of [2, 3, 99]) expect(await save(n)).toBe("invalid");
    expect(await save(1)).toBe("saved");
    expect(await save(1)).toBe("conflict");
    const saved = await db.query(`SELECT payment_status, payment_method, shipping_carrier, shipping_cents::int,
      order_status, shipped_at IS NOT NULL AS shipped_at_set FROM ecommerce_orders WHERE id = $1`, [id(1)]);
    expect(saved.rows).toEqual([{ payment_status: "paid", payment_method: "pix", shipping_carrier: "Correios",
      shipping_cents: 994, order_status: "shipped", shipped_at_set: true }]);

    await rejectMigration("", "reject_ddl", /full or partial installation/);
  }, timeout);
});
