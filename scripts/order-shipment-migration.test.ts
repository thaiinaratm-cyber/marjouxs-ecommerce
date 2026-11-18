import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migration = readFileSync(new URL(
  "../supabase/migrations/202611160002_order_shipment_tracking.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fixture = readFileSync(new URL("fixtures/order-shipment-schema.sql", import.meta.url), "utf8");
const productionTriggers = JSON.parse(readFileSync(new URL("fixtures/order-shipment-production-triggers.json", import.meta.url), "utf8")) as Array<{
  name: string; function_name: string; trigger_ddl: string; function_ddl: string; md5: string;
}>;
const signature = "public.ecommerce_update_order_shipment(uuid,timestamptz,text,text,text,text,boolean)";
const reviewedSha256 = "c09f57f56efa5f44fbd32a0c04e774df20e188d6cc6f9ef96303edf5550f3dba";
const timeout = 60_000;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

it("matches the reviewed release SQL (line endings normalized)", () => {
  expect(createHash("sha256").update(migration).digest("hex")).toBe(reviewedSha256);
});

describe("shipment migration on isolated PostgreSQL", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(fixture);
    for (const t of productionTriggers) {
      await db.exec(t.function_ddl);
      await db.exec(`REVOKE ALL ON FUNCTION ${t.function_name}() FROM PUBLIC, anon, authenticated, service_role;`);
      await db.exec(t.trigger_ddl + ";");
    }
    expect(await triggerState()).toEqual(productionTriggers.map(t => ({ trigger_ddl: t.trigger_ddl, md5: t.md5 })));
  }, timeout);
  afterAll(async () => { await db?.close(); }, timeout);

  const schemaState = async () => (await db.query(`
    SELECT
      to_regprocedure($1) IS NOT NULL AS rpc,
      to_regprocedure('public.ecommerce_orders_touch_updated_at()') IS NOT NULL AS touch,
      (SELECT count(*)::int FROM pg_attribute
        WHERE attrelid = 'public.ecommerce_orders'::regclass AND NOT attisdropped
          AND attname IN ('dispatch_carrier','tracking_code','tracking_url','shipping_status',
            'shipped_at','in_transit_at','delivered_at')) AS columns,
      (SELECT count(*)::int FROM pg_constraint
        WHERE conrelid = 'public.ecommerce_orders'::regclass
          AND conname IN ('ecommerce_orders_tracking_format_ck','ecommerce_orders_shipping_status_ck',
            'ecommerce_orders_shipment_scope_ck')) AS constraints
  `, [signature])).rows[0];

  const triggerState = async () => (await db.query(`
    SELECT pg_get_triggerdef(t.oid, false) AS trigger_ddl, md5(pg_get_functiondef(t.tgfoid)) AS md5
    FROM pg_trigger t WHERE t.tgrelid = 'public.ecommerce_orders'::regclass AND NOT t.tgisinternal ORDER BY t.tgname
  `)).rows;

  async function rejectMigration(setup: string, probe: "reject_ddl" | "fail_after_rebind" | "fail_after_alter", error: RegExp) {
    const before = await schemaState();
    const triggersBefore = await triggerState();
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
    expect(await triggerState()).toEqual(triggersBefore);
  }

  it.each<[string, string, RegExp]>([
    ["wrong executor", "SET LOCAL ROLE authenticated;", /run as postgres/],
    ["table missing", "ALTER TABLE ecommerce_orders RENAME TO fixture_orders;", /does not exist/],
    ["owner mismatch", "ALTER TABLE ecommerce_orders OWNER TO authenticated;", /expected orders owned by postgres/],
    ["missing base column", "ALTER TABLE ecommerce_orders DROP COLUMN updated_at;", /missing\/incompatible orders columns: updated_at/],
    ["wrong base type", "ALTER TABLE ecommerce_orders ALTER COLUMN shipping_carrier TYPE integer USING NULL::integer;", /missing\/incompatible orders columns: shipping_carrier/],
    ["insufficient timestamp precision", "ALTER TABLE ecommerce_orders ALTER COLUMN updated_at TYPE timestamptz(3);", /missing\/incompatible orders columns: updated_at/],
    ["RLS disabled", "ALTER TABLE ecommerce_orders DISABLE ROW LEVEL SECURITY;", /RLS enabled/],
    ["existing policy", "CREATE POLICY fixture_read ON ecommerce_orders FOR SELECT TO authenticated USING (true);", /no policies/],
    ["partial install", "ALTER TABLE ecommerce_orders ADD COLUMN tracking_url text;", /full or partial installation/],
    ["existing RPC", "CREATE FUNCTION public.ecommerce_update_order_shipment(uuid,timestamptz,text,text,text,text,boolean) RETURNS text LANGUAGE sql AS $$ SELECT 'fixture'::text $$;", /full or partial installation/],
    ["existing constraint", "ALTER TABLE ecommerce_orders ADD CONSTRAINT ecommerce_orders_shipment_scope_ck CHECK (true);", /full or partial installation/],
    ["existing dedicated touch function", "CREATE FUNCTION public.ecommerce_orders_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;", /full or partial installation/],
    ["unreviewed UPDATE trigger", "CREATE TRIGGER fixture_touch BEFORE UPDATE ON ecommerce_orders FOR EACH ROW EXECUTE FUNCTION public.fixture_touch_order();", /changed orders triggers\/functions:.*fixture_touch/],
    ["unreviewed disabled INSERT trigger", "CREATE TRIGGER fixture_other BEFORE INSERT ON ecommerce_orders FOR EACH ROW EXECUTE FUNCTION public.fixture_touch_order(); ALTER TABLE ecommerce_orders DISABLE TRIGGER fixture_other;", /changed orders triggers\/functions:.*fixture_other/],
    ["missing touch trigger", "DROP TRIGGER ecommerce_orders_10_touch_updated_at ON ecommerce_orders;", /changed orders triggers\/functions:.*touch_updated_at/],
    ["disabled protection trigger", "ALTER TABLE ecommerce_orders DISABLE TRIGGER ecommerce_orders_90_protect_paid;", /changed orders triggers\/functions:.*protect_paid/],
    ["incorrect touch function binding", "CREATE OR REPLACE TRIGGER ecommerce_orders_10_touch_updated_at BEFORE UPDATE ON ecommerce_orders FOR EACH ROW EXECUTE FUNCTION public.fixture_touch_order();", /changed orders triggers\/functions:.*touch_updated_at/],
    ["unexpected WHEN clause", "CREATE OR REPLACE TRIGGER ecommerce_orders_10_touch_updated_at BEFORE UPDATE ON ecommerce_orders FOR EACH ROW WHEN (true) EXECUTE FUNCTION public.ecommerce_touch_updated_at();", /changed orders triggers\/functions:.*touch_updated_at/],
    ["unexpected UPDATE OF", "CREATE OR REPLACE TRIGGER ecommerce_orders_10_touch_updated_at BEFORE UPDATE OF updated_at ON ecommerce_orders FOR EACH ROW EXECUTE FUNCTION public.ecommerce_touch_updated_at();", /changed orders triggers\/functions:.*touch_updated_at/],
    ["changed timestamp body", "CREATE OR REPLACE FUNCTION public.ecommerce_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $$ BEGIN RETURN NEW; END $$;", /changed orders triggers\/functions:.*touch_updated_at/],
    ["changed paid protection body", "CREATE OR REPLACE FUNCTION public.ecommerce_protect_paid_order() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$ BEGIN RETURN NEW; END $$;", /changed orders triggers\/functions:.*protect_paid/],
    ["changed function privileges", "GRANT EXECUTE ON FUNCTION public.ecommerce_protect_paid_order() TO service_role;", /changed orders triggers\/functions:.*protect_paid/],
    ["incompatible service role", "ALTER ROLE service_role NOBYPASSRLS;", /service_role or inherited/],
    ["inherited application access", "GRANT service_role TO authenticated;", /service_role or inherited/]
  ])("rejects %s before any DDL", async (_name, setup, error) => {
    await rejectMigration(setup, "reject_ddl", error);
  }, timeout);

  it("rolls back the trigger rebind, function and any partially installed logistics schema", async () => {
    await rejectMigration("", "fail_after_rebind", /Fixture: abort after trigger rebind/);
    await rejectMigration("", "fail_after_alter", /Fixture: abort after ALTER TABLE/);
    expect(await schemaState()).toEqual({ rpc: false, touch: false, columns: 0, constraints: 0 });
  }, timeout);

  it("reproduces reuse of a consumed updated_at on the exact pre-migration trigger", async () => {
    await db.exec("BEGIN;");
    try {
      const first = (await db.query<{ version: string }>(`UPDATE ecommerce_orders SET order_status = 'shipped'
        WHERE id = $1 RETURNING updated_at::text AS version`, [id(1)])).rows[0].version;
      const second = () => db.query<{ version: string }>(`UPDATE ecommerce_orders SET order_status = 'completed'
        WHERE id = $1 AND updated_at = $2 RETURNING updated_at::text AS version`, [id(1), first]);
      expect((await second()).rows).toEqual([{ version: first }]);
    } finally { await db.exec("ROLLBACK;"); }
  }, timeout);

  it("installs on the expected schema and preserves the existing RPC behavior and grants", async () => {
    await db.exec("SET fixture.shipment_probe = 'check_lock';");
    try { await db.exec(migration); } finally { await db.exec("RESET fixture.shipment_probe;"); }
    expect(await schemaState()).toEqual({ rpc: true, touch: true, columns: 7, constraints: 3 });
    const rebound = await triggerState();
    expect(rebound[0]).toMatchObject({ trigger_ddl: productionTriggers[0].trigger_ddl.replace(
      "ecommerce_touch_updated_at()", "ecommerce_orders_touch_updated_at()") });
    expect(rebound[1]).toEqual({ trigger_ddl: productionTriggers[1].trigger_ddl, md5: productionTriggers[1].md5 });
    expect((await db.query(`SELECT md5(pg_get_functiondef('public.ecommerce_touch_updated_at()'::regprocedure)) AS md5`)).rows)
      .toEqual([{ md5: productionTriggers[0].md5 }]);
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

    const revision = "2026-11-15T00:00:00Z";
    const save = async (n: number, options: { carrier?: string; code?: string; url?: string; status?: string; version?: string; confirmed?: boolean } = {}) =>
      (await db.query<{ result: string }>("SELECT public.ecommerce_update_order_shipment($1,$2,$3,$4,$5,$6,$7) AS result",
        [id(n), options.version ?? revision, options.carrier ?? "Dispatch", options.code ?? "AB123456789BR",
          options.url ?? "https://tracking.example/parcel", options.status ?? "shipped", options.confirmed ?? false])).rows[0].result;
    const snapshot = async (row: number) => (await db.query<{
      version: string; shipped: string | null; transit: string | null; delivered: string | null;
      operational: string; shipping: string | null; carrier: string;
    }>(`SELECT updated_at::text AS version, shipped_at::text AS shipped, in_transit_at::text AS transit,
        delivered_at::text AS delivered, order_status AS operational, shipping_status AS shipping,
        dispatch_carrier AS carrier FROM ecommerce_orders WHERE id = $1`, [id(row)])).rows[0];
    const advanced = async (before: string, after: string) => (await db.query<{ advanced: boolean }>(
      "SELECT $2::timestamptz > $1::timestamptz AS advanced", [before, after])).rows[0].advanced;

    for (const options of [{ carrier: "<b>" }, { code: "<script>" }, { url: "javascript:alert(1)" },
      { url: "data:text/html,x" }, { url: "file:///a" }, { url: "http://example.test" }, { url: "https:///bad" }]) {
      await expect(save(1, options)).rejects.toMatchObject({ code: "23514" });
    }
    expect(await save(1, { status: "unknown" })).toBe("invalid");
    for (const n of [2, 3, 99]) expect(await save(n)).toBe("invalid");
    await db.exec("BEGIN;");
    try {
      expect(await save(1, { status: "preparing" })).toBe("saved");
      const preparing = await snapshot(1);
      expect(preparing).toMatchObject({ operational: "preparing", shipping: null, shipped: null, carrier: "Dispatch" });
      expect(await advanced(revision, preparing.version)).toBe(true);
      expect(await save(1)).toBe("conflict");
      expect(await save(1, { version: preparing.version })).toBe("saved");
      const shipped = await snapshot(1);
      expect(await advanced(preparing.version, shipped.version)).toBe(true);
      expect(await save(1, { version: preparing.version, status: "in_transit" })).toBe("conflict");
      expect(await save(1, { version: shipped.version, status: "in_transit" })).toBe("saved");
      const transit = await snapshot(1);
      expect(await advanced(shipped.version, transit.version)).toBe(true);
      expect(await save(1, { version: transit.version, status: "delivered" })).toBe("invalid");
      expect(await save(1, { version: transit.version, status: "delivered", confirmed: true })).toBe("saved");
      const delivered = await snapshot(1);
      expect(delivered).toMatchObject({ operational: "completed", shipping: "delivered" });
      expect(delivered.delivered).not.toBeNull();
      expect(await advanced(transit.version, delivered.version)).toBe(true);
      expect(await save(1, { version: delivered.version, status: "shipped" })).toBe("invalid");
      expect(await save(1, { version: delivered.version, status: "delivered", code: "XY987654321BR" })).toBe("saved");
      const edited = await snapshot(1);
      expect([edited.shipped, edited.transit, edited.delivered]).toEqual([shipped.shipped, transit.transit, delivered.delivered]);
      expect(edited).toMatchObject({ operational: "completed", shipping: "delivered" });
      await db.exec("COMMIT;");
    } catch (error) {
      await db.exec("ROLLBACK;");
      throw error;
    }
    const saved = await db.query(`SELECT payment_status, payment_method, shipping_carrier, shipping_cents::int,
      order_status, shipped_at IS NOT NULL AS shipped_at_set FROM ecommerce_orders WHERE id = $1`, [id(1)]);
    expect(saved.rows).toEqual([{ payment_status: "paid", payment_method: "pix", shipping_carrier: "Correios",
      shipping_cents: 994, order_status: "completed", shipped_at_set: true }]);

    const future = "2099-01-01T00:00:00.000001Z";
    await db.query(`INSERT INTO ecommerce_orders (id,public_token,order_number,delivery_method,payment_status,order_status,updated_at,shipping_cents,total_cents)
      VALUES ($1,$2,'MJ-FIXTURE-FUTURE','shipping','paid','preparing',$3,0,100)`, [id(4), id(14), future]);
    expect(await save(4, { version: future })).toBe("saved");
    // Six-digit precision and the old version win even if the caller supplies an unrelated timestamp.
    expect(await advanced(future, (await snapshot(4)).version)).toBe(true);
    const futureVersion = (await snapshot(4)).version;
    await db.query("UPDATE ecommerce_orders SET updated_at = '2199-01-01' WHERE id = $1", [id(4)]);
    expect((await db.query("SELECT updated_at = $2::timestamptz + interval '1 microsecond' AS ok FROM ecommerce_orders WHERE id=$1",
      [id(4), futureVersion])).rows).toEqual([{ ok: true }]);
    await db.query(`INSERT INTO ecommerce_orders (id,public_token,order_number,delivery_method,payment_status,order_status,updated_at,shipping_cents,total_cents)
      VALUES ($1,$2,'MJ-FIXTURE-INFINITE','shipping','paid','preparing','infinity',0,100)`, [id(5), id(15)]);
    await expect(save(5, { version: "infinity" })).rejects.toMatchObject({ code: "22008" });
    expect(await snapshot(5)).toMatchObject({ version: "infinity", operational: "preparing", shipped: null });

    for (const sql of [
      "UPDATE ecommerce_orders SET total_cents=total_cents+100 WHERE id=$1",
      "UPDATE ecommerce_orders SET payment_status='pending' WHERE id=$1",
      "UPDATE ecommerce_orders SET payment_method='credit_card' WHERE id=$1",
      "UPDATE ecommerce_orders SET shipping_street='Another address' WHERE id=$1",
      "UPDATE ecommerce_orders SET shipping_carrier='Repriced' WHERE id=$1",
      "UPDATE ecommerce_orders SET order_number='MJ-FIXTURE-EDIT' WHERE id=$1",
      "DELETE FROM ecommerce_orders WHERE id=$1"
    ]) await expect(db.query(sql, [id(1)])).rejects.toMatchObject({ code: "55000" });
    expect((await db.query(`SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS definer,
      proconfig AS config, proacl::text[] AS acl
      FROM pg_proc p WHERE p.oid='public.ecommerce_orders_touch_updated_at()'::regprocedure`)).rows)
      .toEqual([{ owner: "postgres", definer: false, config: ['search_path=""'], acl: ["postgres=X/postgres"] }]);

    await rejectMigration("", "reject_ddl", /full or partial installation/);
  }, timeout);
});
