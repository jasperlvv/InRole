// 验证公共目录导入工具：临时库、真实迁移、演练/写入/幂等/拒绝路径。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import pg from "pg";
import { root, state, databaseUrl, connect, migrate, permissions, redact, fail } from "./common.mjs";

const results = [];
let bootstrap, owner, created = false, database = null;
async function scenario(name, action) { await action(); results.push(name); console.log(`PASS ${name}`); }

try {
  const config = await state();
  bootstrap = await connect(databaseUrl(config, "postgres", "inrole_bootstrap"));
  database = `inrole_catalog_${randomUUID().replaceAll("-", "")}`;
  await bootstrap.query(`CREATE DATABASE ${pg.escapeIdentifier(database)} OWNER inrole_migrator`); created = true;
  await bootstrap.query(`REVOKE ALL ON DATABASE ${pg.escapeIdentifier(database)} FROM PUBLIC`);
  await bootstrap.query(`GRANT CONNECT ON DATABASE ${pg.escapeIdentifier(database)} TO inrole_app`);
  const direct = databaseUrl(config, database, "inrole_migrator"), appRole = databaseUrl(config, database, "inrole_app");
  owner = await connect(direct); await owner.query("REVOKE ALL ON SCHEMA public FROM PUBLIC");
  await migrate(direct); await permissions(direct);

  const catalog = JSON.parse(await fs.readFile(path.join(root, "prisma/catalog.json"), "utf8"));
  const counts = async () => (await owner.query('SELECT (SELECT count(*)::integer FROM inrole.people) AS people, (SELECT count(*)::integer FROM inrole.interest_tags) AS interests, (SELECT count(*)::integer FROM inrole.topics) AS topics, (SELECT count(*)::integer FROM inrole.person_sources) AS sources, (SELECT count(*)::integer FROM inrole.person_interests) AS links')).rows[0];
  const empty = { people: 0, interests: 0, topics: 0, sources: 0, links: 0 };
  assert.deepEqual(await counts(), empty, "临时库应当是空的");

  async function importer(args, env = {}) {
    const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/db/import-catalog.mjs", ...args], { cwd: root, windowsHide: true, env: { ...process.env, DIRECT_URL: direct, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { output += redact(chunk); });
    const code = await new Promise(resolve => child.once("close", resolve));
    return { code, output };
  }

  await scenario("dry run reports the plan against a migrated but empty database", async () => {
    const run = await importer(["--pack", "prisma/catalog.json"]);
    assert.equal(run.code, 0, run.output);
    assert.match(run.output, new RegExp(`人物新增 ${catalog.people.length}`));
    assert.match(run.output, /演练结束，没有写入/);
    assert.deepEqual(await counts(), empty);
  });

  await scenario("validation-only mode never needs a database", async () => {
    const run = await importer(["--check", "--reviewed-at", "2026-11-26", "--reviewed-by", "verify"]);
    assert.equal(run.code, 0, run.output);
    assert.match(run.output, /校验通过/);
  });

  await scenario("apply without confirmation or review metadata is refused before writing", async () => {
    const noConfirm = await importer(["--apply", "--reviewed-at", "2026-11-26", "--reviewed-by", "verify"]);
    assert.equal(noConfirm.code, 1);
    assert.match(noConfirm.output, /--confirm-reviewed/);
    const noReview = await importer(["--apply", "--confirm-reviewed"]);
    assert.equal(noReview.code, 1);
    assert.match(noReview.output, /reviewedAt/);
    assert.deepEqual(await counts(), empty);
  });

  await scenario("confirmed apply inserts catalogue, attribution and interest links", async () => {
    const run = await importer(["--apply", "--confirm-reviewed", "--reviewed-at", "2026-11-26", "--reviewed-by", "verify"]);
    assert.equal(run.code, 0, run.output);
    assert.deepEqual(await counts(), { people: catalog.people.length, interests: catalog.interests.length, topics: catalog.topics.length, sources: catalog.people.length, links: catalog.people.length });
    const relative = run.output.match(/回执：(.+?)（/)?.[1];
    assert.ok(relative, `回执路径未打印：${run.output}`);
    const receipt = JSON.parse(await fs.readFile(path.resolve(root, relative), "utf8"));
    assert.equal(receipt.target.database, database);
    assert.equal(receipt.inserted.people, catalog.people.length);
    assert.equal(receipt.pack.reviewedBy, "verify");
    assert.ok(!/postgres:\/\//.test(JSON.stringify(receipt)), "回执不得包含连接串");
    const rows = (await owner.query('SELECT p.id,p.name,s.title FROM inrole.people p JOIN inrole.person_sources s ON s."personId"=p.id')).rows;
    assert.equal(rows.length, catalog.people.length);
    assert.ok(rows.every(row => row.title && row.name));
  });

  await scenario("re-running the same pack is idempotent and never rewrites reviewed rows", async () => {
    const before = await counts();
    await owner.query("UPDATE inrole.people SET bio='管理员改过的简介' WHERE id='libai'");
    const run = await importer(["--apply", "--confirm-reviewed", "--reviewed-at", "2026-11-26", "--reviewed-by", "verify"]);
    assert.equal(run.code, 0, run.output);
    assert.deepEqual(await counts(), before);
    assert.equal((await owner.query("SELECT bio FROM inrole.people WHERE id='libai'")).rows[0].bio, "管理员改过的简介");
  });

  await scenario("a pack with a person missing attribution is rejected before any write", async () => {
    const broken = JSON.parse(JSON.stringify(catalog));
    broken.people.push({ id: "no-source", name: "无署名人物", bio: "简介", primaryInterestId: "science", legacyAvatarPath: null });
    const file = path.join(root, ".tmp/catalog", `broken-${randomUUID()}.json`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(broken));
    const before = await counts();
    const run = await importer(["--pack", file, "--apply", "--confirm-reviewed", "--reviewed-at", "2026-11-26", "--reviewed-by", "verify"]);
    await fs.rm(file, { force: true });
    assert.equal(run.code, 1);
    assert.match(run.output, /person\.source/);
    assert.deepEqual(await counts(), before);
  });

  await scenario("the application role cannot import catalogue and leaves no partial rows", async () => {
    const before = await counts();
    const run = await importer(["--apply", "--confirm-reviewed", "--reviewed-at", "2026-11-26", "--reviewed-by", "verify"], { DIRECT_URL: appRole });
    assert.equal(run.code, 1);
    assert.match(run.output, /permission denied|权限/);
    assert.deepEqual(await counts(), before);
  });

  await scenario("the tool refuses a development database without an explicit override", async () => {
    const run = await importer(["--pack", "prisma/catalog.json"], { DIRECT_URL: databaseUrl(config, "inrole_dev", "inrole_migrator") });
    assert.equal(run.code, 1);
    assert.match(run.output, /开发\/验证库/);
  });

  console.log(`Catalog import verification passed: ${results.length} scenarios`);
} catch (error) { fail(error); }
finally {
  await owner?.end();
  if (bootstrap) {
    if (created && database) await bootstrap.query(`DROP DATABASE ${pg.escapeIdentifier(database)} WITH (FORCE)`);
    await bootstrap.end();
  }
}
