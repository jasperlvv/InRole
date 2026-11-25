import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { state, databaseUrl, connect, migrate, permissions, run, root, fail } from "./common.mjs";

let admin;
let database;
let created = false;
try {
  const config = await state();
  admin = await connect(databaseUrl(config, "postgres", "inrole_bootstrap"));
  database = `inrole_verify_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(database)} OWNER inrole_migrator`);
  created = true;
  await admin.query(`REVOKE ALL ON DATABASE ${pg.escapeIdentifier(database)} FROM PUBLIC`);
  await admin.query(`GRANT CONNECT ON DATABASE ${pg.escapeIdentifier(database)} TO inrole_app`);
  const direct = databaseUrl(config, database, "inrole_migrator");
  const application = databaseUrl(config, database, "inrole_app");
  const owner = await connect(direct);
  try {
    const initial = await owner.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='inrole'");
    assert.equal(initial.rows[0].count, 0);
    await owner.query("REVOKE ALL ON SCHEMA public FROM PUBLIC");
  } finally { await owner.end(); }
  console.log((await migrate(direct)).trim());
  await permissions(direct);
  const repeated = await migrate(direct);
  console.log(repeated.trim());
  const client = await connect(direct);
  let catalog;
  try {
    const result = await client.query(`SELECT
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='inrole' AND tablename <> '_prisma_migrations') AS tables,
      (SELECT count(*)::int FROM pg_indexes WHERE schemaname='inrole' AND tablename <> '_prisma_migrations') AS indexes,
      (SELECT count(*)::int FROM pg_constraint WHERE connamespace='inrole'::regnamespace AND contype='c') AS checks,
      (SELECT count(*)::int FROM pg_trigger WHERE tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='inrole'::regnamespace) AND NOT tgisinternal) AS triggers,
      (SELECT count(*)::int FROM inrole._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migrations`);
    catalog = result.rows[0];
    assert.equal(catalog.tables, 32);
    const migrationDirectories = (await fs.readdir(path.join(root, "prisma/migrations"), { withFileTypes: true })).filter(item => item.isDirectory());
    assert.equal(catalog.migrations, migrationDirectories.length);
    for (const { tablename } of (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='inrole' AND tablename <> '_prisma_migrations'")).rows) {
      assert.equal((await client.query(`SELECT count(*)::int AS count FROM inrole.${pg.escapeIdentifier(tablename)}`)).rows[0].count, 0, `Expected empty ${tablename}`);
    }
  } finally { await client.end(); }
  console.log(await run(process.execPath, ["--experimental-strip-types", "--test", "tests/db/constraints.test.mjs"], {
    env: { ...process.env, TEST_DIRECT_URL: direct, TEST_DATABASE_URL: application, INROLE_VERIFY_DATABASE: database },
  }));
  const drift = await run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code"], { env: { ...process.env, DIRECT_URL: direct } });
  console.log(drift.trim());
  const report = { date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), postgres: config.version, schema: "inrole", emptyDatabaseRebuilt: true, repeatedDeployPassed: true, catalog, constraintsAndPrivilegesPassed: true, prismaSchemaDrift: false, browserDataImported: false };
  await fs.writeFile(path.join(root, "docs/verification/S07B-result.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} catch (error) { fail(error); }
finally {
  if (admin) {
    if (created && /^inrole_verify_[a-f0-9]{32}$/.test(database)) {
      await admin.query(`DROP DATABASE ${pg.escapeIdentifier(database)} WITH (FORCE)`);
      console.log("Removed only the freshly created verification database.");
    }
    await admin.end();
  }
}
