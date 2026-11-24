import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { spawn } from "node:child_process";
import pg from "pg";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const localRoot = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData/Local"), "InRole", "postgresql-17");
export const stateFile = path.join(localRoot, "state.json");
export const marker = "inrole-local-postgresql-v1";
export function loadEnvironment() {
  const file = path.join(root, ".env.local");
  if (existsSync(file)) loadEnvFile(file);
}
export function redact(value) {
  return String(value).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[database URL redacted]");
}
export async function run(command, args, options = {}) {
  const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], ...options });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) stream?.on("data", chunk => { output += chunk; });
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  if (code !== 0) throw new Error(`${path.basename(command)} failed (${code}): ${redact(output)}`);
  return output;
}
export async function state() {
  const value = JSON.parse(await fs.readFile(stateFile, "utf8"));
  if (value.marker !== marker || !Number.isInteger(value.port) || value.port < 1024 || value.port > 65535) throw new Error("Invalid local database state");
  return value;
}
export function databaseUrl(config, database, account) {
  const url = new URL(`postgresql://127.0.0.1:${config.port}/${database}`);
  url.username = account;
  url.password = config.passwords[account];
  url.searchParams.set("schema", "inrole");
  return url.href;
}
export async function connect(url) {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 4000, statement_timeout: 15000, application_name: "inrole-local-tools" });
  await client.connect();
  return client;
}
export async function migrate(directUrl) {
  return run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: { ...process.env, DIRECT_URL: directUrl } });
}
export async function permissions(directUrl, appRole = "inrole_app") {
  const client = await connect(directUrl);
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('inrole.app_role', $1, true)", [appRole]);
    await client.query(await fs.readFile(path.join(root, "prisma/permissions.sql"), "utf8"));
    await client.query("COMMIT");
  } finally { await client.end(); }
}
export function fail(error) {
  console.error(redact(error.message));
  process.exitCode = 1;
}
