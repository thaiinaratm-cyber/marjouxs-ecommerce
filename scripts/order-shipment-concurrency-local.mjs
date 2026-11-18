import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";

const bin = process.argv[2];
assert(bin, "Supply the local PostgreSQL bin directory");
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)));
const tool = (name) => join(resolve(bin), process.platform === "win32" ? name + ".exe" : name);
const data = mkdtempSync(join(tmpdir(), "marjouxs-shipment-"));
const listener = createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const { port } = listener.address();
await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const args = ["-X", "-w", "-qAt", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres"];
const run = (name, argv, input) => {
  const result = spawnSync(tool(name), argv, { input, env, encoding: "utf8", windowsHide: true, timeout: 25000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
const psql = (input) => run("psql", args, input);

function client(sql) {
  const child = spawn(tool("psql"), args, { env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  let output = "", errors = "", failure;
  child.on("error", (error) => { failure = error; });
  child.stdin.on("error", (error) => { failure ??= error; });
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { errors += chunk; });
  child.stdin.write(sql);
  return {
    child, send: (text) => child.stdin.write(text), finish: () => child.stdin.end(),
    async waitFor(marker) {
      for (let i = 0; i < 100; i++) {
        if (output.includes(marker)) return output;
        assert.ifError(failure);
        assert.equal(child.exitCode, null, errors);
        await delay(100);
      }
      throw new Error("Missing psql marker " + marker + ": " + errors);
    }
  };
}

const clients = [];
let server, serverError;
try {
  run("initdb", ["-D", data, "--username=postgres", "--auth=trust", "--encoding=UTF8", "--no-locale"]);
  server = spawn(tool("postgres"), ["-D", data, "-h", "127.0.0.1", "-p", String(port), "-c", "statement_timeout=20000"],
    { env, stdio: "ignore", windowsHide: true });
  server.on("error", (error) => { serverError = error; });
  for (let i = 0; ; i++) {
    assert.ifError(serverError);
    try { if (psql("SELECT 1;") === "1") break; } catch (error) { if (i >= 60 || server.exitCode !== null) throw error; }
    await delay(150);
  }

  const triggers = JSON.parse(read("fixtures/order-shipment-production-triggers.json"));
  psql(read("fixtures/order-shipment-schema.sql") + triggers.map((row) =>
    row.function_ddl + ";\nREVOKE ALL ON FUNCTION " + row.function_name +
    "() FROM PUBLIC, anon, authenticated, service_role;\n" + row.trigger_ddl + ";\n").join(""));
  psql(read("../supabase/migrations/202611160002_order_shipment_tracking.sql"));
  const version = psql("SELECT current_setting('server_version');");
  const query = (code) => `SELECT public.ecommerce_update_order_shipment(
    '00000000-0000-4000-8000-000000000001','2026-11-15T00:00:00Z','Dispatch','${code}',
    'https://tracking.example.test/fixture','shipped',false);`;

  const first = client("BEGIN;\nSET ROLE service_role;\n" + query("WINNER") + "\n\\echo FIRST_HOLDS_LOCK\n");
  clients.push(first);
  assert.match(await first.waitFor("FIRST_HOLDS_LOCK"), /\bsaved\b/);
  const second = client("BEGIN;\nSET application_name='shipment-qa-second';\nSET ROLE service_role;\n" +
    query("STALE") + "\n\\echo SECOND_RESULT\n");
  clients.push(second);
  let waited = false;
  for (let i = 0; i < 35; i++) {
    waited = psql("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='shipment-qa-second' AND wait_event_type='Lock');") === "t";
    if (waited) break;
    await delay(100);
  }
  assert(waited, "The second backend never waited for the first backend's lock");
  const closed = Promise.all(clients.map(connection => once(connection.child, "exit")));
  first.send("COMMIT;\n\\echo FIRST_COMMITTED\n");
  await first.waitFor("FIRST_COMMITTED");
  assert.match(await second.waitFor("SECOND_RESULT"), /\bconflict\b/);
  second.send("COMMIT;\n");
  first.finish();
  second.finish();
  for (const [exitCode] of await closed) assert.equal(exitCode, 0);
  assert.equal(psql("SELECT tracking_code FROM ecommerce_orders WHERE id='00000000-0000-4000-8000-000000000001';"), "WINNER");
  console.log(`PostgreSQL ${version}: secondary backend waited for the row lock and returned conflict; the first mutation was preserved.`);
} finally {
  for (const connection of clients) if (connection.child.exitCode === null) connection.child.kill();
  if (server && server.exitCode === null) {
    try { run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]); }
    catch (error) { server.kill(); throw error; }
  }
}
