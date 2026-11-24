import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { createServer } from "node:net";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createWriteStream } from "node:fs";
import pg from "pg";
import { root, localRoot, stateFile, marker, state, databaseUrl, connect, run, migrate, permissions, fail } from "./common.mjs";

const version = "17.12";
const filename = `postgresql-${version}-1-windows-x64-binaries.zip`;
const checksum = "a2cd8a774389347b70be7748ac4a37ef43cb6ee539c5fc3e85ae264b15e4a04c";
const runtime = path.join(localRoot, `runtime-${version}`);
const binary = name => path.join(runtime, "pgsql/bin", `${name}.exe`);
const dataPath = path.join(localRoot, "data");
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function install() {
  if (existsSync(binary("postgres"))) {
    const actual = await run(binary("postgres"), ["--version"]);
    if (!actual.includes(` ${version}`)) throw new Error("Unexpected local PostgreSQL version");
    return;
  }
  const archive = path.join(root, ".tmp/postgres-download", filename);
  await fs.mkdir(path.dirname(archive), { recursive: true });
  if (!existsSync(archive)) {
    console.log(`Downloading official PostgreSQL ${version} binaries...`);
    const response = await fetch(`https://get.enterprisedb.com/postgresql/${filename}`, { signal: AbortSignal.timeout(900000) });
    if (!response.ok) throw new Error(`PostgreSQL download failed: ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
  }
  const hash = createHash("sha256").update(await fs.readFile(archive)).digest("hex");
  if (hash !== checksum) throw new Error("PostgreSQL archive checksum mismatch; remove only the failed download before retrying");
  await fs.mkdir(runtime, { recursive: true });
  await run("tar.exe", ["-xf", archive, "-C", runtime, "pgsql/bin", "pgsql/lib", "pgsql/share"]);
  console.log(`Verified official PostgreSQL ${version} archive and extracted runtime.`);
}
async function start() {
  const config = await state();
  try { await run(binary("pg_ctl"), ["status", "-D", dataPath]); }
  catch { await run(binary("pg_ctl"), ["start", "-D", dataPath, "-l", path.join(localRoot, "postgres.log"), "-w", "-t", "30"], { stdio: "ignore" }); }
  const client = await connect(databaseUrl(config, "postgres", "inrole_bootstrap"));
  await client.end();
  console.log(`Local PostgreSQL ready at 127.0.0.1:${config.port}.`);
  return config;
}
async function setup() {
  if (process.platform !== "win32") throw new Error("This helper installs the Windows runtime; use your PostgreSQL installation on other systems");
  await fs.mkdir(localRoot, { recursive: true });
  if (!existsSync(stateFile)) {
    if (existsSync(path.join(dataPath, "PG_VERSION"))) throw new Error("Existing database has no matching state; refusing to reinitialize it");
    const config = { marker, version, checksum, port: await freePort(), passwords: Object.fromEntries(["inrole_bootstrap", "inrole_migrator", "inrole_app"].map(name => [name, randomBytes(32).toString("base64url")])) };
    await fs.writeFile(stateFile, JSON.stringify(config, null, 2), { mode: 0o600, flag: "wx" });
  }
  const config = await state();
  await install();
  if (!existsSync(path.join(dataPath, "PG_VERSION"))) {
    const passwordFile = path.join(localRoot, "init-password.tmp");
    await fs.writeFile(passwordFile, config.passwords.inrole_bootstrap, { mode: 0o600 });
    try { await run(binary("initdb"), ["-D", dataPath, "--username=inrole_bootstrap", `--pwfile=${passwordFile}`, "--encoding=UTF8", "--no-locale", "--auth-local=scram-sha-256", "--auth-host=scram-sha-256"]); }
    finally { await fs.rm(passwordFile, { force: true }); }
    await fs.appendFile(path.join(dataPath, "postgresql.conf"), `\nlisten_addresses = '127.0.0.1'\nport = ${config.port}\ntimezone = 'UTC'\npassword_encryption = 'scram-sha-256'\nlog_statement = 'none'\nlog_min_error_statement = 'panic'\n`);
  }
  await start();
  const admin = await connect(databaseUrl(config, "postgres", "inrole_bootstrap"));
  try {
    for (const role of ["inrole_migrator", "inrole_app"]) {
      const found = await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role]);
      if (!found.rowCount) await admin.query(`CREATE ROLE ${pg.escapeIdentifier(role)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD ${pg.escapeLiteral(config.passwords[role])}`);
    }
    for (const database of ["inrole_dev", "inrole_test"]) {
      const found = await admin.query("SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1", [database]);
      if (found.rowCount && found.rows[0].owner !== "inrole_migrator") throw new Error("Existing database owner differs; refusing to modify it");
      if (!found.rowCount) await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(database)} OWNER inrole_migrator`);
      await admin.query(`REVOKE ALL ON DATABASE ${pg.escapeIdentifier(database)} FROM PUBLIC`);
      await admin.query(`GRANT CONNECT ON DATABASE ${pg.escapeIdentifier(database)} TO inrole_app`);
      const direct = databaseUrl(config, database, "inrole_migrator");
      const owner = await connect(direct);
      try { await owner.query("REVOKE ALL ON SCHEMA public FROM PUBLIC"); } finally { await owner.end(); }
      console.log((await migrate(direct)).trim());
      await permissions(direct);
    }
  } finally { await admin.end(); }
  const variables = {
    DATABASE_URL: databaseUrl(config, "inrole_dev", "inrole_app"), DIRECT_URL: databaseUrl(config, "inrole_dev", "inrole_migrator"),
    TEST_DATABASE_URL: databaseUrl(config, "inrole_test", "inrole_app"), TEST_DIRECT_URL: databaseUrl(config, "inrole_test", "inrole_migrator"),
  };
  const envFile = path.join(root, ".env.local");
  let previous = existsSync(envFile) ? await fs.readFile(envFile, "utf8") : "";
  for (const [name, value] of Object.entries(variables)) {
    const match = previous.match(new RegExp(`^${name}=(.*)$`, "m"));
    if (match && match[1].trim().replace(/^['"]|['"]$/g, "") !== value) throw new Error(`Existing ${name} differs; credentials were preserved`);
    if (!match) previous += `\n${name}=${value}\n`;
  }
  await fs.writeFile(envFile, previous.trim() + "\n", { mode: 0o600 });
  console.log("Development and test migrations applied. Ignored .env.local configured. No seed or browser data imported.");
}
try {
  const action = process.argv[2];
  if (action === "setup") await setup();
  else if (action === "start") await start();
  else if (action === "stop") { await state(); console.log((await run(binary("pg_ctl"), ["stop", "-D", dataPath, "-m", "fast", "-w", "-t", "30"])).trim()); }
  else if (action === "status") { await state(); console.log((await run(binary("pg_ctl"), ["status", "-D", dataPath])).trim()); }
  else throw new Error("Usage: local.mjs setup|start|stop|status");
} catch (error) { fail(error); }
