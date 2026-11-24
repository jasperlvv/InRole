import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { portraitSources } from "../../src/lib/portrait-sources.ts";
import { root, loadEnvironment, connect, fail } from "./common.mjs";

loadEnvironment();
let client;
try {
  const url = new URL(process.env.DIRECT_URL);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/inrole_dev") throw new Error("Catalog seed is restricted to the local development database");
  const catalog = JSON.parse(await fs.readFile(path.join(root, "prisma/catalog.json"), "utf8"));
  client = await connect(url.href);
  await client.query("BEGIN");
  for (const interest of catalog.interests) await client.query("INSERT INTO inrole.interest_tags (id,name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING", [interest.id, interest.name]);
  for (const person of catalog.people) {
    const result = await client.query('INSERT INTO inrole.people (id,name,aliases,bio,"primaryInterestId","legacyAvatarPath","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now()) ON CONFLICT (id) DO NOTHING RETURNING id', [person.id, person.name, person.aliases, person.bio, person.primaryInterestId, person.legacyAvatarPath]);
    if (!result.rowCount) continue;
    const source = portraitSources.find(item => item.id === person.id);
    if (!source) throw new Error("Missing catalog portrait attribution");
    await client.query('INSERT INTO inrole.person_sources (id,"personId",title,"sourceUrl",author,license,"licenseUrl",modifications) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), person.id, source.title, source.sourcePage, source.author, source.license, source.licenseUrl, source.changes]);
    await client.query('INSERT INTO inrole.person_interests ("personId","interestId") VALUES ($1,$2) ON CONFLICT DO NOTHING', [person.id, person.primaryInterestId]);
  }
  await client.query("COMMIT");
  console.log("Public catalog prepared: at most 3 people, interests and attribution only. Existing records preserved; no accounts, posts or wallets imported.");
} catch (error) { if (client) await client.query("ROLLBACK"); fail(error); }
finally { await client?.end(); }
