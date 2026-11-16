import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const [, , packagePath, baselinePath] = process.argv;
assert(packagePath && baselinePath, "Pass the local PGlite package path and the approved before-definition file.");
const { PGlite } = createRequire(import.meta.url)(packagePath);
const original = readFileSync(baselinePath, "utf8");
const normalized = text => text.replace(/\r\n/g, "\n");
const md5 = text => createHash("md5").update(text).digest("hex");
assert.equal(md5(normalized(original)), "2b732ad0c4fa163ba4417ae428f29ee4");

const db = new PGlite();
const migration = readFileSync(new URL("../supabase/migrations/202611160001_product_stone_customization.sql", import.meta.url), "utf8");
const signature = "public.ecommerce_create_checkout(jsonb,jsonb,text,text)";
let cases = 0;
const metadata = "SELECT pg_get_functiondef(p.oid) AS definition, to_jsonb(p)-'prosrc' AS attributes, " +
  "pg_get_userbyid(p.proowner) AS owner, pg_get_function_result(p.oid) AS result FROM pg_proc p WHERE p.oid = $1::regprocedure";

try {
  await db.exec(readFileSync(new URL("./fixtures/stone-checkout-schema.sql", import.meta.url), "utf8"));
  await db.exec(original.trimEnd() + ";");
  await db.exec("REVOKE ALL ON FUNCTION " + signature + " FROM public; GRANT EXECUTE ON FUNCTION " + signature + " TO service_role;");
  const [before] = (await db.query(metadata, [signature])).rows;
  await db.exec(migration);
  const [after] = (await db.query(metadata, [signature])).rows;
  assert.deepEqual(after.attributes, before.attributes);
  assert.equal(after.owner, "postgres");
  const oldBlock = normalized(migration.match(/\$legacy\$([\s\S]*?)\$legacy\$/)[1]);
  const newBlock = normalized(migration.match(/\$stone\$([\s\S]*?)\$stone\$/)[1]);
  assert.equal(normalized(after.definition), normalized(before.definition).replace(oldBlock, newBlock));
  const [acl] = (await db.query("SELECT has_function_privilege('anon',$1::regprocedure,'execute') AS anon, has_function_privilege('authenticated',$1::regprocedure,'execute') AS authenticated, has_function_privilege('service_role',$1::regprocedure,'execute') AS service", [signature])).rows;
  assert.deepEqual(acl, { anon: false, authenticated: false, service: true });
  const [{ total }] = (await db.query("SELECT count(*)::int AS total FROM ecommerce_products WHERE NOT stone_customization_enabled AND cardinality(stone_options)=0")).rows;
  assert.equal(total, 5);
  await assert.rejects(db.exec("UPDATE ecommerce_products SET stone_customization_enabled=true WHERE slug='normal'"), { code: "23514" });
  await db.exec("UPDATE ecommerce_products SET stone_customization_enabled=true, stone_options=ARRAY['azul-safira','esmeralda'] WHERE slug IN ('stones','pair-stone','inactive')");

  const order = { customer_name: "Fixture", customer_phone: "11000000000", customer_email: "qa@example.invalid",
    delivery_method: "pickup", subtotal_cents: 16000, shipping_cents: 0, total_cents: 16000 };
  const sapphire = { type: "stone", stone_color: "azul-safira" };
  const emerald = { type: "stone", stone_color: "esmeralda" };
  const pair = { type: "ring_pair", ring1: { size: 17, engraving: "QA" }, ring2: { size: 21 } };
  const normal = { product_id: "normal", product_slug: "normal", product_name: "Fixture", product_image: "/item.jpg",
    category: "Anéis", availability: "Disponível", quantity: 1, unit_price_cents: 16000, customization: null };
  const configurable = { ...normal, product_id: "00000000-0000-4000-8000-000000000002", product_slug: "stones" };
  const alliance = { ...normal, product_id: "pair", product_slug: "pair", category: "Alianças", customization: pair };
  let seq = 0;
  function place(item, key = "test-stone-checkout-" + ++seq, hash = "a".repeat(64)) {
    return db.query("SELECT * FROM public.ecommerce_create_checkout($1::jsonb,$2::jsonb,$3,$4)",
      [JSON.stringify(order), JSON.stringify([item]), key, hash]);
  }
  for (const item of [
    { ...normal, customization: sapphire }, configurable, { ...configurable, customization: { ...sapphire, stone_color: "rosa" } },
    { ...configurable, customization: { ...sapphire, option: 1 } },
    { ...configurable, customization: { ...sapphire, stone_color: 42 } },
    { ...configurable, product_slug: "normal", customization: sapphire },
    { ...configurable, product_id: "missing", customization: sapphire },
    { ...configurable, product_id: "inactive", product_slug: "inactive", customization: sapphire },
    { ...configurable, category: "Alianças", customization: { ...pair, stone_color: "azul-safira" } },
    { ...configurable, product_id: "pair-stone", product_slug: "pair-stone", category: "Alianças",
      customization: { ...pair, stone_color: "azul-safira", ring1: { ...pair.ring1, extra: true } } }
  ]) {
    await assert.rejects(place(item), { code: "22023" });
    cases++;
  }
  assert.equal((await db.query("SELECT count(*)::int AS n FROM ecommerce_orders")).rows[0].n, 0);

  await place(normal); cases++;
  await place(alliance); cases++;
  const key = "test-stone-checkout-original";
  const first = (await place({ ...configurable, customization: sapphire }, key)).rows[0];
  const replay = (await place({ ...configurable, customization: sapphire }, key)).rows[0];
  assert.equal(replay.result_order_id, first.result_order_id);
  assert.equal(replay.result_payment_attempt_id, first.result_payment_attempt_id);
  assert.equal(Number(first.result_total_cents), 16000);
  await assert.rejects(place({ ...configurable, customization: emerald }, key, "b".repeat(64)), { code: "23505" });
  const fresh = (await place({ ...configurable, customization: emerald }, undefined, "b".repeat(64))).rows[0];
  assert.notEqual(first.result_order_id, fresh.result_order_id);
  const paired = (await place({ ...alliance, product_id: "pair-stone", product_slug: "pair-stone",
    customization: { ...pair, stone_color: "azul-safira" } })).rows[0];
  for (const [id, expected] of [[first.result_order_id, sapphire], [fresh.result_order_id, emerald],
    [paired.result_order_id, { ...pair, stone_color: "azul-safira" }]]) {
    const [item] = (await db.query("SELECT customization FROM ecommerce_order_items WHERE order_id=$1", [id])).rows;
    assert.deepEqual(item.customization, expected);
  }
  assert.equal((await db.query("SELECT count(*)::int AS n FROM ecommerce_payment_attempts")).rows[0].n, 5);
  cases += 5;
  console.log(JSON.stringify({ cases, before_md5: md5(before.definition), after_md5: md5(after.definition),
    after_normalized_md5: md5(normalized(after.definition)), signature, returns: after.result, exact_block_only: true, metadata_unchanged: true }));
} finally {
  await db.close();
}
