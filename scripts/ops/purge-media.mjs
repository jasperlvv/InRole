import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
const root = process.env.MEDIA_STORAGE_ROOT;
if (!root || !path.isAbsolute(root)) throw new Error("An absolute private MEDIA_STORAGE_ROOT is required");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
let purged = 0, failed = 0;
try {
  await client.connect();
  const rows = (await client.query("SELECT id,\"storageKey\" FROM inrole.media_assets WHERE status='DELETED' AND bucket='local-private' LIMIT 1000")).rows;
  for (const row of rows) {
    try {
      if (!/^[a-f0-9-]{36}\.(webp|mp4|webm)$/.test(row.storageKey)) throw new Error("Invalid storage key");
      await fs.rm(path.join(root, row.storageKey), { force: true });
      await client.query("UPDATE inrole.media_assets SET bucket='purged' WHERE id=$1 AND status='DELETED'", [row.id]); purged++;
    } catch { failed++; }
  }
  console.log(JSON.stringify({ purged, failed, moreMayRemain: rows.length === 1000 }));
  if (failed) process.exitCode = 1;
} finally { await client.end(); }
