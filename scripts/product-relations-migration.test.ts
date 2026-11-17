import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const sql = readFileSync(new URL("../supabase/migrations/202611170002_product_relations.sql", import.meta.url), "utf8");
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const fixture = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE TABLE ecommerce_products (id uuid PRIMARY KEY, slug text UNIQUE, name text,
  is_active boolean, stock_status text, version integer NOT NULL);
ALTER TABLE ecommerce_products ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON ecommerce_products TO service_role;
`;

it("uses guarded installation, restricted permissions, atomic ordered edits and live eligibility", async () => {
  const db = new PGlite();
  try {
    await db.exec(fixture);
    await db.exec("ALTER TABLE ecommerce_products DISABLE ROW LEVEL SECURITY;");
    await expect(db.exec(sql)).rejects.toThrow(/RLS enabled/);
    await db.exec("ROLLBACK;");
    const names = async () => (await db.query("SELECT to_regclass('public.ecommerce_product_relations')::text AS tbl")).rows;
    expect(await names()).toEqual([{ tbl: null }]);
    await db.exec("ALTER TABLE ecommerce_products ENABLE ROW LEVEL SECURITY; CREATE INDEX ecommerce_product_relations_target_idx ON ecommerce_products (id);");
    await expect(db.exec(sql)).rejects.toThrow(/partial installation/);
    await db.exec("ROLLBACK;");
    expect(await names()).toEqual([{ tbl: null }]);
    await db.exec("DROP INDEX ecommerce_product_relations_target_idx;");
    await db.exec(sql);
    await expect(db.exec(sql)).rejects.toThrow(/partial installation/);
    await db.exec("ROLLBACK;");

    const { rows: grants } = await db.query(`SELECT r,
      has_table_privilege(r,'ecommerce_product_relations','SELECT') AS can_read,
      has_table_privilege(r,'ecommerce_product_relations','INSERT') AS direct_insert,
      has_function_privilege(r,'ecommerce_set_product_relations(uuid,bigint,uuid[],uuid[])','EXECUTE') AS can_set,
      has_function_privilege(r,'ecommerce_get_product_recommendations(text,text[])','EXECUTE') AS can_get
      FROM unnest(ARRAY['anon','authenticated','service_role']) AS roles(r)`);
    expect(grants).toEqual([
      { r: "anon", can_read: false, direct_insert: false, can_set: false, can_get: false },
      { r: "authenticated", can_read: false, direct_insert: false, can_set: false, can_get: false },
      { r: "service_role", can_read: true, direct_insert: false, can_set: true, can_get: true }
    ]);
    for (let n = 1; n < 13; n++) {
      await db.query("INSERT INTO ecommerce_products VALUES ($1,$2,$2,$3,$4,1)",
        [id(n), "p" + n, n !== 4, n === 5 ? "unavailable" : "available"]);
    }

    const asService = async <T>(fn: () => Promise<T>) => {
      await db.exec("SET ROLE service_role;");
      try { return await fn(); } finally { await db.exec("RESET ROLE;"); }
    };
    const set = (expected: number[], related: number[], version = 1) => asService(async () =>
      (await db.query<{ result: string }>(
        "SELECT ecommerce_set_product_relations($1,$2,$3,$4) AS result", [id(1),version,expected.map(id),related.map(id)])).rows[0].result);
    const read = (number = 1) => asService(async () => (await db.query(
      "SELECT * FROM ecommerce_get_product_recommendations($1,$2)", ["p"+number, ["p1","p2","p3","p4","p5"]])).rows);
    expect(await read()).toEqual([
      { mode: "automatic", related_slug: "p2" }, { mode: "automatic", related_slug: "p3" }
    ]);
    for (const invalid of [[1], [2,2], [4], [5], [99], [2,3,4,5,6,7,8,9,10]]) expect(await set([], invalid)).toBe("invalid");
    expect(await set([], [3])).toBe("saved");
    expect(await set([], [2])).toBe("conflict");
    expect(await read()).toEqual([{ mode: "manual", related_slug: "p3" }]);
    expect((await read(3)).every(row => (row as { mode: string }).mode === "automatic")).toBe(true);
    expect(await set([3], [2,3])).toBe("saved");
    expect(await set([2,3], [3,2])).toBe("saved");
    expect(await set([2,3], [2])).toBe("conflict");
    expect(await set([3,2], [2], 99)).toBe("conflict");
    expect((await read()).map(row => (row as { related_slug: string }).related_slug)).toEqual(["p3","p2"]);
    expect((await db.query("SELECT version FROM ecommerce_products WHERE slug='p1'")).rows).toEqual([{version:1}]);
    await db.exec("UPDATE ecommerce_products SET is_active=false WHERE slug='p3';");
    expect(await read()).toEqual([{ mode: "manual", related_slug: null }, { mode: "manual", related_slug: "p2" }]);
    expect(await set([3,2], [3])).toBe("invalid");
    expect(await set([3,2], [2])).toBe("saved");
    await db.exec("DELETE FROM ecommerce_products WHERE slug='p2';");
    expect(await read()).toEqual([]);
    expect((await db.query("SELECT slug FROM ecommerce_products WHERE slug='p1'")).rows).toEqual([{slug:"p1"}]);
  } finally { await db.close(); }
}, 90_000);
