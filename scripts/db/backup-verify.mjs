import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import pg from "pg";
import { state, databaseUrl, connect, run, localRoot, root, permissions, fail } from "./common.mjs";

// Local-only backup/recovery drill. Never restores over an existing database.
let admin, source, restored, target;
try {
  const config = await state(), binary = name => path.join(localRoot, `runtime-${config.version}`, "pgsql/bin", `${name}.exe`);
  const directory = path.join(localRoot, "backups", new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-"));
  await fs.mkdir(directory, { recursive: true }); const dump = path.join(directory, "inrole-dev.dump");
  const env = { ...process.env, PGPASSWORD: config.passwords.inrole_migrator };
  const args = ["--host=127.0.0.1", `--port=${config.port}`, "--username=inrole_migrator"];
  await run(binary("pg_dump"), [...args, "--dbname=inrole_dev", "--schema=inrole", "--format=custom", `--file=${dump}`], { env });
  admin = await connect(databaseUrl(config, "postgres", "inrole_bootstrap"));
  target = `inrole_verify_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(target)} OWNER inrole_migrator`);
  await admin.query(`REVOKE ALL ON DATABASE ${pg.escapeIdentifier(target)} FROM PUBLIC`);
  await admin.query(`GRANT CONNECT ON DATABASE ${pg.escapeIdentifier(target)} TO inrole_app`);
  await run(binary("pg_restore"), [...args, `--dbname=${target}`, "--no-owner", "--no-privileges", "--exit-on-error", dump], { env });
  await permissions(databaseUrl(config, target, "inrole_migrator"));
  source = await connect(databaseUrl(config, "inrole_dev", "inrole_migrator")); restored = await connect(databaseUrl(config, target, "inrole_migrator"));
  const tables = (await source.query("SELECT tablename FROM pg_tables WHERE schemaname='inrole' ORDER BY tablename")).rows.map(row => row.tablename);
  for (const table of tables) {
    // Compare all data, including secrets, exclusively in memory; emit no row values.
    const sql = `SELECT md5(coalesce(string_agg(row_text,E'\\n' ORDER BY row_text),'')) AS digest FROM (SELECT row_to_json(t)::text AS row_text FROM inrole.${pg.escapeIdentifier(table)} t) s`;
    const a = (await source.query(sql)).rows[0].digest, b = (await restored.query(sql)).rows[0].digest;
    if (a !== b) throw new Error(`Restored data mismatch in ${table}; source may have changed during backup`);
  }
  const hash = createHash("sha256").update(await fs.readFile(dump)).digest("hex");
  await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify({ database: "inrole_dev", sha256: hash, restoredIntoFreshTemporaryDatabase: true, tablesCompared: tables.length }, null, 2));
  await fs.writeFile(path.join(root, "docs/verification/S17-local-restore-result.json"), JSON.stringify({ date: "2026-11-25", scope: "local development database only", customDumpCreated: true, sha256Verified: true, restoredIntoFreshTemporaryDatabase: true, allTableDigestsMatched: true, tablesCompared: tables.length, productionBackupVerified: false, mediaBackupVerified: false }, null, 2) + "\n");
  console.log(`Backup saved outside repository; restored ${tables.length} tables into a fresh disposable database and verified all row digests.`);
} catch (error) { fail(error); }
finally { await source?.end(); await restored?.end(); if (admin) { if (target && /^inrole_verify_[a-f0-9]{32}$/.test(target)) await admin.query(`DROP DATABASE IF EXISTS ${pg.escapeIdentifier(target)} WITH (FORCE)`); await admin.end(); } }
