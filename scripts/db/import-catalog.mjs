// 公共目录（人物/兴趣/话题/署名）导入工具，面向正式库。
// 用法：
//   node --experimental-strip-types scripts/db/import-catalog.mjs --check
//   node --experimental-strip-types scripts/db/import-catalog.mjs --pack prisma/catalog.json
//   node --experimental-strip-types scripts/db/import-catalog.mjs --pack prisma/catalog.json --apply --confirm-reviewed
// 安全约定：默认只演练；正式写入需要 --apply 与 --confirm-reviewed；读取 .env.local 前不会覆盖已有环境变量。
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { connect, fail, loadEnvironment, root } from "./common.mjs";
import { portraitSources } from "../../src/lib/portrait-sources.ts";
import { PACK_VERSION, packDigest, validatePack } from "./catalog-pack.mjs";

const DEVELOPMENT_DATABASES = new Set(["inrole_dev", "inrole_test"]);
const args = process.argv.slice(2);
const has = name => args.includes(`--${name}`);
const value = name => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };
const apply = has("apply"), checkOnly = has("check"), confirmed = has("confirm-reviewed"), allowDevelopment = has("allow-development");
const packPath = path.resolve(root, value("pack") || "prisma/catalog.json");

function target(url) {
  const parsed = new URL(url);
  return { host: parsed.hostname, port: parsed.port, database: decodeURIComponent(parsed.pathname.replace(/^\//, "")), user: decodeURIComponent(parsed.username) };
}
function isDevelopment(database) {
  return DEVELOPMENT_DATABASES.has(database) || database.startsWith("inrole_verify_");
}
function printIssues(issues, label) {
  for (const issue of issues.slice(0, 40)) console.log(`  ${label} [${issue.code}] ${issue.message}`);
  if (issues.length > 40) console.log(`  ${label} 另有 ${issues.length - 40} 条未显示`);
}

let client;
try {
  const raw = JSON.parse(await fs.readFile(packPath, "utf8"));
  // 审核信息可以写在数据包里，也可以由执行者在命令行显式声明（两者都会进入回执）。
  if (!raw.reviewedAt && value("reviewed-at")) raw.reviewedAt = value("reviewed-at");
  if (!raw.reviewedBy && value("reviewed-by")) raw.reviewedBy = value("reviewed-by");
  const digest = packDigest(raw);
  const validation = validatePack(raw, { sources: portraitSources, requireReview: apply || checkOnly });
  const pack = validation.pack;

  console.log(`数据包：${path.relative(root, packPath)}`);
  console.log(`摘要：sha256 ${digest}`);
  console.log(`版本：${pack.version}${pack.reviewedAt ? ` 审核：${pack.reviewedAt}${pack.reviewedBy ? ` / ${pack.reviewedBy}` : ""}` : ""}`);
  console.log(`内容：兴趣 ${pack.interests.length} · 话题 ${pack.topics.length} · 人物 ${pack.people.length}`);
  if (validation.warnings.length) { console.log("提示："); printIssues(validation.warnings, "WARN"); }
  if (!validation.ok) {
    console.log("校验失败：");
    printIssues(validation.errors, "ERROR");
    throw new Error(`数据包校验未通过（${validation.errors.length} 项错误），没有写入数据库。`);
  }
  if (pack.version !== PACK_VERSION) throw new Error("数据包版本不匹配。");
  if (checkOnly) { console.log("\n校验通过（--check 未连接数据库）。"); process.exit(0); }

  if (!process.env.DIRECT_URL) loadEnvironment();
  if (!process.env.DIRECT_URL) throw new Error("需要迁移拥有者连接 DIRECT_URL；应用连接串不能执行目录导入。");
  const info = target(process.env.DIRECT_URL);
  if (isDevelopment(info.database) && !allowDevelopment) throw new Error(`目标库 ${info.database} 是开发/验证库；正式导入请指向正式库，本机导入请使用 npm run db:seed:catalog。`);
  if (apply && !confirmed) throw new Error("--apply 需要同时提供 --confirm-reviewed，确认目录素材已经人工审核。");

  console.log(`\n目标：${info.user}@${info.host}:${info.port || "5432"}/${info.database} (schema inrole)`);
  client = await connect(process.env.DIRECT_URL);

  // 1) 目标库已有内容（只读检查，不改动）
  const existingInterests = new Set((await client.query("SELECT id FROM inrole.interest_tags")).rows.map(row => row.id));
  const existingTopics = new Set((await client.query("SELECT id FROM inrole.topics")).rows.map(row => row.id));
  const existingPeople = new Set((await client.query("SELECT id FROM inrole.people")).rows.map(row => row.id));

  const knownInterests = new Set([...existingInterests, ...pack.interests.map(item => item.id)]);
  const missing = [];
  for (const person of pack.people) {
    for (const interestId of [person.primaryInterestId, ...person.interestIds]) if (!knownInterests.has(interestId)) missing.push(`${person.id} → ${interestId}`);
  }
  for (const topic of pack.topics) if (topic.interestId && !knownInterests.has(topic.interestId)) missing.push(`topic ${topic.id} → ${topic.interestId}`);
  if (missing.length) throw new Error(`目标库缺少兴趣标签：${[...new Set(missing)].join("、")}。请先在数据包中补充 interests。`);

  const newInterests = pack.interests.filter(item => !existingInterests.has(item.id));
  const newTopics = pack.topics.filter(item => !existingTopics.has(item.id));
  const newPeople = pack.people.filter(item => !existingPeople.has(item.id));
  const skippedPeople = pack.people.filter(item => existingPeople.has(item.id));

  console.log(`\n计划：兴趣新增 ${newInterests.length} / 已存在 ${pack.interests.length - newInterests.length}`);
  console.log(`      话题新增 ${newTopics.length} / 已存在 ${pack.topics.length - newTopics.length}`);
  console.log(`      人物新增 ${newPeople.length} / 已存在 ${skippedPeople.length}`);
  console.log(`      署名 ${newPeople.length} 条（只随新人物写入，不覆盖既有记录）`);
  if (newPeople.length) console.log(`      将创建：${newPeople.map(item => item.id).join(" ")}`);
  if (skippedPeople.length) console.log(`      已存在将跳过：${skippedPeople.map(item => item.id).join(" ")}`);

  if (!apply) {
    console.log("\n演练结束，没有写入。正式导入请加 --apply --confirm-reviewed。");
    process.exit(0);
  }

  // 2) 单事务写入；只做 INSERT ... ON CONFLICT DO NOTHING，绝不覆盖人工修改。
  const inserted = { interests: 0, topics: 0, topicLinks: 0, people: 0, sources: 0, personLinks: 0 };
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('inrole.catalog.import'))");
    for (const interest of pack.interests) {
      const row = await client.query("INSERT INTO inrole.interest_tags(id,name) VALUES($1,$2) ON CONFLICT (id) DO NOTHING RETURNING id", [interest.id, interest.name]);
      inserted.interests += row.rowCount;
    }
    for (const topic of pack.topics) {
      const row = await client.query("INSERT INTO inrole.topics(id,name,description) VALUES($1,$2,$3) ON CONFLICT (id) DO NOTHING RETURNING id", [topic.id, topic.name, topic.description]);
      inserted.topics += row.rowCount;
      if (topic.interestId) {
        const link = await client.query('INSERT INTO inrole.topic_interests("topicId","interestId") VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING "topicId"', [topic.id, topic.interestId]);
        inserted.topicLinks += link.rowCount;
      }
    }
    for (const person of pack.people) {
      const row = await client.query('INSERT INTO inrole.people(id,name,aliases,bio,"primaryInterestId","legacyAvatarPath","updatedAt") VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT (id) DO NOTHING RETURNING id', [person.id, person.name, person.aliases, person.bio, person.primaryInterestId, person.legacyAvatarPath]);
      if (!row.rowCount) continue;
      inserted.people += 1;
      const source = person.source;
      await client.query('INSERT INTO inrole.person_sources(id,"personId",title,"sourceUrl",author,license,"licenseUrl",modifications) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), person.id, source.title, source.sourcePage, source.author, source.license, source.licenseUrl, source.changes]);
      inserted.sources += 1;
      const interests = [person.primaryInterestId, ...person.interestIds];
      for (const interestId of interests) {
        const link = await client.query('INSERT INTO inrole.person_interests("personId","interestId") VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING "personId"', [person.id, interestId]);
        inserted.personLinks += link.rowCount;
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  // 3) 写入后核对：数据包里每个人都应在库中，且都有署名。
  const counts = (await client.query('SELECT (SELECT count(*)::integer FROM inrole.people) AS people, (SELECT count(*)::integer FROM inrole.interest_tags) AS interests, (SELECT count(*)::integer FROM inrole.topics) AS topics, (SELECT count(*)::integer FROM inrole.person_sources) AS sources')).rows[0];
  const absent = (await client.query("SELECT unnest($1::varchar[]) AS id EXCEPT SELECT id FROM inrole.people", [pack.people.map(item => item.id)])).rows;
  if (absent.length) throw new Error(`写入后缺少人物：${absent.map(row => row.id).join(" ")}`);
  const unattributed = (await client.query('SELECT p.id FROM inrole.people p WHERE p.id = ANY($1::varchar[]) AND NOT EXISTS (SELECT 1 FROM inrole.person_sources s WHERE s."personId"=p.id)', [pack.people.map(item => item.id)])).rows;
  if (unattributed.length) throw new Error(`写入后缺少署名：${unattributed.map(row => row.id).join(" ")}`);

  console.log(`\n写入完成：兴趣 +${inserted.interests}，话题 +${inserted.topics}（关联 ${inserted.topicLinks}），人物 +${inserted.people}，署名 +${inserted.sources}，人物兴趣关联 ${inserted.personLinks}`);
  console.log(`库内合计：人物 ${counts.people} · 兴趣 ${counts.interests} · 话题 ${counts.topics} · 署名 ${counts.sources}`);

  // 4) 回执：谁在什么时候导入了哪个版本，供事后审计。
  const receipt = {
    at: new Date().toISOString(),
    target: { host: info.host, port: info.port || "5432", database: info.database, user: info.user },
    pack: { path: path.relative(root, packPath), digest, version: pack.version, reviewedAt: pack.reviewedAt, reviewedBy: pack.reviewedBy },
    requested: { interests: pack.interests.length, topics: pack.topics.length, people: pack.people.length },
    inserted,
    skippedPeople: skippedPeople.map(item => item.id),
    totals: counts,
  };
  const receiptDir = path.resolve(root, process.env.CATALOG_RECEIPT_DIR || value("receipt-dir") || ".tmp/catalog");
  const stamp = receipt.at.replaceAll(":", "-").replace("Z", "");
  await fs.mkdir(receiptDir, { recursive: true });
  let receiptPath = path.join(receiptDir, `import-${stamp}.json`);
  for (let attempt = 1; ; attempt += 1) {
    try { await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" }); break; }
    catch (error) {
      if (error?.code !== "EEXIST" || attempt > 5) throw error;
      receiptPath = path.join(receiptDir, `import-${stamp}-${attempt}.json`);
    }
  }
  console.log(`回执：${path.relative(root, receiptPath)}（含目标库与摘要，不含凭据；请与发布记录一并归档）`);
} catch (error) {
  fail(error instanceof Error ? error : new Error(String(error)));
} finally {
  await client?.end();
}
