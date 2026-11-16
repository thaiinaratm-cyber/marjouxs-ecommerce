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
const constraint = "ecommerce_order_items_customization_ck";
const legacyCheck = "CHECK ((((category = 'Alianças'::text) AND (quantity = 1) AND (ecommerce_valid_ring_pair(customization) IS TRUE)) OR ((category <> 'Alianças'::text) AND (customization IS NULL))))";
const ringValidatorMd5 = "ebef676d1b0dec8eb0bbc23fa1b448d8";
const sapphire = { type: "stone", stone_color: "azul-safira" };
const emerald = { type: "stone", stone_color: "esmeralda" };
const pair = { type: "ring_pair", ring1: { size: 17, engraving: "QA" }, ring2: { size: 21 } };
const withStone = { ...pair, stone_color: "azul-safira" };
let rpcCases = 0;
const metadata = "SELECT pg_get_functiondef(p.oid) AS definition, to_jsonb(p)-'prosrc' AS attributes, " +
  "pg_get_userbyid(p.proowner) AS owner, pg_get_function_result(p.oid) AS result FROM pg_proc p WHERE p.oid = $1::regprocedure";

async function itemConstraints() {
  return (await db.query(`SELECT conname AS name, convalidated AS validated, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conrelid='public.ecommerce_order_items'::regclass AND contype='c' ORDER BY conname`)).rows;
}

async function ringValidatorDigest() {
  const [row] = (await db.query("SELECT pg_get_functiondef('public.ecommerce_valid_ring_pair(jsonb)'::regprocedure) AS definition")).rows;
  return md5(normalized(row.definition));
}

function insertItem(category, quantity, customization, productId = "structure-fixture") {
  return db.query(`INSERT INTO public.ecommerce_order_items (category,quantity,customization,product_id)
    VALUES ($1,$2,$3::jsonb,$4)`, [category, quantity, customization === undefined ? null : JSON.stringify(customization), productId]);
}

const structureCases = [
  ["normal with SQL NULL", "Anéis", undefined, true, true],
  ["normal with canonical stone", "Anéis", sapphire, false, true],
  ["normal with structural ID not in the commercial list", "Anéis", { ...sapphire, stone_color: "a".repeat(40) }, false, true],
  ["normal with stone missing type", "Anéis", { stone_color: "azul-safira" }, false, false],
  ["normal with unknown type", "Anéis", { ...sapphire, type: "ring_pair" }, false, false],
  ["normal with missing color", "Anéis", { type: "stone" }, false, false],
  ["normal with empty color", "Anéis", { ...sapphire, stone_color: "" }, false, false],
  ["normal with numeric color", "Anéis", { ...sapphire, stone_color: 42 }, false, false],
  ["normal with JSON null color", "Anéis", { ...sapphire, stone_color: null }, false, false],
  ["normal with uppercase color", "Anéis", { ...sapphire, stone_color: "Azul-Safira" }, false, false],
  ["normal with oversized color", "Anéis", { ...sapphire, stone_color: "a".repeat(41) }, false, false],
  ["normal with whitespace suffix", "Anéis", { ...sapphire, stone_color: "azul-safira\n" }, false, false],
  ["normal with unknown key alongside stone", "Anéis", { ...sapphire, extra: true }, false, false],
  ["normal with only an unknown key", "Anéis", { extra: true }, false, false],
  ["normal with JSON null instead of SQL NULL", "Anéis", null, false, false],
  ["normal with scalar", "Anéis", "azul-safira", false, false],
  ["normal with array", "Anéis", [sapphire], false, false],
  ["alliance with unchanged legacy pair", "Alianças", pair, true, true],
  ["alliance with allowed stone shape", "Alianças", withStone, false, true],
  ["alliance with boundary sizes and null engraving", "Alianças", { ...withStone, ring1: { size: 8, engraving: null }, ring2: { size: 35 } }, false, true],
  ["alliance with only standalone custom data", "Alianças", sapphire, false, false],
  ["alliance with legacy missing ring", "Alianças", { type: "ring_pair", ring1: pair.ring1 }, false, false],
  ["alliance with missing ring and stone", "Alianças", { type: "ring_pair", ring1: pair.ring1, stone_color: "cristal" }, false, false],
  ["alliance with unknown top-level key without stone", "Alianças", { ...pair, extra: true }, false, false],
  ["alliance with unknown top-level key and stone", "Alianças", { ...withStone, extra: true }, false, false],
  ["alliance with unknown nested key and stone", "Alianças", { ...withStone, ring1: { ...pair.ring1, extra: true } }, false, false],
  ["alliance with invalid stone ID", "Alianças", { ...withStone, stone_color: "-azul" }, false, false],
  ["alliance with invalid stone type", "Alianças", { ...withStone, stone_color: [] }, false, false],
  ["alliance with legacy out-of-range size", "Alianças", { ...pair, ring1: { size: 7 } }, false, false],
  ["alliance with stone and out-of-range size", "Alianças", { ...withStone, ring2: { size: 36 } }, false, false],
  ["alliance with string size", "Alianças", { ...withStone, ring2: { size: "21" } }, false, false],
  ["alliance with legacy invalid engraving", "Alianças", { ...pair, ring1: { size: 17, engraving: 42 } }, false, false],
  ["alliance with stone and invalid engraving", "Alianças", { ...withStone, ring1: { size: 17, engraving: false } }, false, false],
  ["alliance with stone and null discriminator", "Alianças", { ...withStone, type: null }, false, false],
  ["alliance with invalid legacy quantity", "Alianças", pair, false, false, 2],
  ["alliance with stone and invalid quantity", "Alianças", withStone, false, false, 2]
];

async function testStructure(useLegacy) {
  for (const [label, category, value, legacy, next, quantity = 1] of structureCases) {
    await db.exec("BEGIN");
    try {
      const insert = insertItem(category, quantity, value);
      if (useLegacy ? legacy : next) await insert;
      else await assert.rejects(insert, { code: "23514", constraint }, label);
    } finally {
      await db.exec("ROLLBACK");
    }
  }
}

async function persistedCounts() {
  const [counts] = (await db.query(`SELECT
    (SELECT count(*)::int FROM ecommerce_orders) AS orders,
    (SELECT count(*)::int FROM ecommerce_order_items) AS items,
    (SELECT count(*)::int FROM ecommerce_payment_attempts) AS attempts`)).rows;
  return counts;
}

try {
  await db.exec(readFileSync(new URL("./fixtures/stone-checkout-schema.sql", import.meta.url), "utf8"));
  await db.exec(original.trimEnd() + ";");
  await db.exec("REVOKE ALL ON FUNCTION " + signature + " FROM public; GRANT EXECUTE ON FUNCTION " + signature + " TO service_role;");
  const [before] = (await db.query(metadata, [signature])).rows;
  assert.deepEqual(await itemConstraints(), [{ name: constraint, validated: true, definition: legacyCheck }]);
  assert.equal(await ringValidatorDigest(), ringValidatorMd5);
  await testStructure(true);

  // Represent every row of the audited history by shape; add valid pairs to cover unobserved legacy formats.
  await db.exec(`INSERT INTO ecommerce_order_items (category,quantity,customization,product_id)
    SELECT 'Anéis',1,NULL,'historical-' || n FROM generate_series(1,12) AS n`);
  await insertItem("Alianças", 1, pair, "historical-pair");
  await insertItem("Alianças", 1, { ...pair, ring1: { size: 8, engraving: null }, ring2: { size: 35 } }, "historical-boundary-pair");
  const readHistory = async () => (await db.query(`SELECT category,quantity,customization,product_id
    FROM ecommerce_order_items WHERE product_id LIKE 'historical-%' ORDER BY product_id`)).rows;
  const historyBefore = await readHistory();

  await db.exec(migration);
  const [after] = (await db.query(metadata, [signature])).rows;
  assert.deepEqual(after.attributes, before.attributes);
  assert.equal(after.owner, "postgres");
  assert.equal(md5(normalized(after.definition)), "11f5e1e6523eedfa6cf4dc6a4414269b");
  assert.equal(await ringValidatorDigest(), ringValidatorMd5);
  const installed = await itemConstraints();
  assert.equal(installed.length, 1);
  assert.equal(installed[0].name, constraint);
  assert.equal(installed[0].validated, true);
  assert.match(installed[0].definition, /stone_color/);
  assert.deepEqual(await readHistory(), historyBefore);
  await testStructure(false);
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
  const normal = { product_id: "normal", product_slug: "normal", product_name: "Fixture", product_image: "/item.jpg",
    category: "Anéis", availability: "Disponível", quantity: 1, unit_price_cents: 16000, customization: null };
  const configurable = { ...normal, product_id: "00000000-0000-4000-8000-000000000002", product_slug: "stones" };
  const alliance = { ...normal, product_id: "pair", product_slug: "pair", category: "Alianças", customization: pair };
  let seq = 0;
  function place(item, key = "test-stone-checkout-" + ++seq, hash = "a".repeat(64)) {
    return db.query("SELECT * FROM public.ecommerce_create_checkout($1::jsonb,$2::jsonb,$3,$4)",
      [JSON.stringify(order), JSON.stringify([item]), key, hash]);
  }
  async function rejectAtomically(result, expected) {
    await assert.rejects(result, expected);
    assert.deepEqual(await persistedCounts(), rpcCountsBefore);
    rpcCases++;
  }
  let rpcCountsBefore = await persistedCounts();
  for (const item of [
    { ...normal, customization: sapphire }, configurable, { ...configurable, customization: { ...sapphire, stone_color: "rosa" } },
    { ...normal, customization: { arbitrary: true } },
    { ...configurable, customization: { ...sapphire, option: 1 } },
    { ...configurable, customization: { ...sapphire, stone_color: 42 } },
    { ...configurable, product_slug: "normal", customization: sapphire },
    { ...configurable, product_id: "missing", customization: sapphire },
    { ...configurable, product_id: "inactive", product_slug: "inactive", customization: sapphire },
    { ...configurable, category: "Alianças", customization: { ...pair, stone_color: "azul-safira" } },
    { ...configurable, product_id: "pair-stone", product_slug: "pair-stone", category: "Alianças",
      customization: { ...pair, stone_color: "azul-safira", ring1: { ...pair.ring1, extra: true } } }
  ]) {
    await rejectAtomically(place(item), { code: "22023" });
  }

  const plain = (await place(normal)).rows[0];
  const legacyPair = (await place(alliance)).rows[0];
  rpcCases += 2;
  const key = "test-stone-checkout-original";
  const first = (await place({ ...configurable, customization: sapphire }, key)).rows[0];
  const replay = (await place({ ...configurable, customization: sapphire }, key)).rows[0];
  assert.equal(replay.result_order_id, first.result_order_id);
  assert.equal(replay.result_payment_attempt_id, first.result_payment_attempt_id);
  assert.equal(Number(first.result_total_cents), 16000);
  rpcCountsBefore = await persistedCounts();
  await rejectAtomically(place({ ...configurable, customization: emerald }, key, "b".repeat(64)), { code: "23505" });
  const fresh = (await place({ ...configurable, customization: emerald }, undefined, "b".repeat(64))).rows[0];
  assert.notEqual(first.result_order_id, fresh.result_order_id);
  const paired = (await place({ ...alliance, product_id: "pair-stone", product_slug: "pair-stone",
    customization: { ...pair, stone_color: "azul-safira" } })).rows[0];
  for (const [id, expected] of [[plain.result_order_id, null], [legacyPair.result_order_id, pair],
    [first.result_order_id, sapphire], [fresh.result_order_id, emerald],
    [paired.result_order_id, { ...pair, stone_color: "azul-safira" }]]) {
    const [item] = (await db.query("SELECT customization FROM ecommerce_order_items WHERE order_id=$1", [id])).rows;
    assert.deepEqual(item.customization, expected);
  }
  assert.deepEqual(await persistedCounts(), { orders: 5, items: historyBefore.length + 5, attempts: 5 });
  assert.deepEqual(await readHistory(), historyBefore);
  rpcCases += 4;
  console.log(JSON.stringify({ rpc_cases: rpcCases, constraint_cases_per_version: structureCases.length, historical_fixtures: historyBefore.length,
    before_md5: md5(before.definition), after_md5: md5(after.definition), ring_validator_md5: ringValidatorMd5,
    after_normalized_md5: md5(normalized(after.definition)), exact_block_only: true, metadata_unchanged: true }));
} finally {
  await db.close();
}
