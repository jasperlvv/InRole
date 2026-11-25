import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { encryptFile, decryptFile } from "./encryption.mjs";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "inrole-ops-"));
await fs.chmod(root, 0o700);
const mode = process.argv[2], keyFile = process.env.BACKUP_KEY_FILE || "/run/secrets/backup_key";
async function run(command, args, options = {}) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let out = ""; child.stdout.on("data", b => { out += b; }); child.stderr.resume();
    child.once("error", reject); child.once("close", code => code === 0 ? resolve(out.trim()) : reject(new Error(`${command} failed (${code}); inspect restricted environment without printing credentials`)));
  });
  return result;
}
const sql = (query, extra = []) => run("psql", ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", ...extra, "-c", query]);
async function fingerprints(extra = []) {
  const tables = (await sql("SELECT tablename FROM pg_tables WHERE schemaname='inrole' ORDER BY tablename", extra)).split("\n").filter(Boolean);
  const result = {};
  for (const table of tables) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new Error("Unexpected database object name");
    result[table] = await sql(`SELECT md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text),'')) FROM inrole."${table}" t`, extra);
  }
  return result;
}
async function mediaFingerprints(directory) {
  const result = {};
  for (const file of (await fs.readdir(directory)).sort()) {
    if (!/^[a-f0-9-]{36}\.(webp|mp4|webm)$/.test(file)) throw new Error("Unexpected file in private media storage");
    const bytes = await fs.readFile(path.join(directory, file));
    result[file] = createHash("sha256").update(bytes).digest("hex");
  }
  return result;
}
try {
  if (mode === "backup") {
    if (process.env.APP_STOPPED_FOR_BACKUP !== "yes") throw new Error("Stop application writes before taking a consistent database/media snapshot");
    await run("pg_dump", ["--format=custom", "--schema=inrole", "--file=" + path.join(root, "database.dump")]);
    await run("tar", ["-czf", path.join(root, "media.tar.gz"), "-C", "/media", "."]);
    const erased = await sql("SELECT id FROM inrole.app_users WHERE status='CLOSED' ORDER BY id");
    await fs.writeFile(path.join(root, "erased-accounts.txt"), erased + "\n", { mode: 0o600 });
    await fs.mkdir("/erasures", { recursive: true });
    for (const id of erased.split("\n").filter(Boolean)) {
      if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid erasure receipt");
      try { await fs.writeFile(path.join("/erasures", id + ".json"), JSON.stringify({ userId: id }), { flag: "wx", mode: 0o600 }); } catch (error) { if (error.code !== "EEXIST") throw error; }
    }
    await fs.writeFile(path.join(root, "manifest.json"), JSON.stringify({ createdAt: new Date().toISOString(), database: process.env.PGDATABASE, appStopped: true, schema: "inrole", format: 1, tableDigests: await fingerprints(), mediaDigests: await mediaFingerprints("/media") }));
    const archive = path.join(root, "snapshot.tar");
    await run("tar", ["-cf", archive, "-C", root, "database.dump", "media.tar.gz", "erased-accounts.txt", "manifest.json"]);
    await fs.mkdir("/backups", { recursive: true, mode: 0o700 });
    const filename = "inrole-" + new Date().toISOString().replaceAll(":", "-") + ".enc";
    await encryptFile(archive, path.join("/backups", filename), keyFile);
    console.log("Authenticated encrypted database/media snapshot created: " + filename);
  } else if (mode === "restore") {
    if (process.env.ERASURE_JOURNAL_CONFIRMED !== "yes") throw new Error("Restore requires the current deletion journal, including requests newer than the snapshot");
    const filename = process.argv[3];
    if (!/^inrole-[0-9T.Z-]+\.enc$/.test(filename || "")) throw new Error("Pass a snapshot filename from /backups");
    if ((await fs.readdir("/restore-media")).length) throw new Error("Restore media target must be an empty, separate volume");
    const archive = path.join(root, "snapshot.tar");
    await decryptFile(path.join("/backups", filename), archive, keyFile);
    const members = (await run("tar", ["-tf", archive])).split("\n").sort();
    if (members.join(",") !== ["database.dump", "erased-accounts.txt", "manifest.json", "media.tar.gz"].join(",")) throw new Error("Unexpected snapshot members");
    await run("tar", ["-xf", archive, "-C", root, "--no-same-owner", "--no-same-permissions"]);
    const mediaMembers = (await run("tar", ["-tzf", path.join(root, "media.tar.gz")])).split("\n");
    if (mediaMembers.some(name => name !== "./" && !/^\.\/[a-f0-9-]{36}\.(webp|mp4|webm)$/.test(name))) throw new Error("Unexpected media archive paths");
    const database = "inrole_restore_" + randomUUID().replaceAll("-", "");
    await sql('CREATE DATABASE "' + database + '" OWNER inrole_migrator', ["-d", "postgres"]);
    await sql('REVOKE ALL ON DATABASE "' + database + '" FROM PUBLIC; GRANT CONNECT ON DATABASE "' + database + '" TO inrole_app', ["-d", "postgres"]);
    await run("pg_restore", ["--dbname=" + database, "--no-owner", "--no-privileges", "--role=inrole_migrator", "--exit-on-error", path.join(root, "database.dump")]);
    const extra = ["-d", database], manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
    if (JSON.stringify(await fingerprints(extra)) !== JSON.stringify(manifest.tableDigests)) throw new Error("Restored table digests differ from the snapshot; do not promote");
    await run("psql", ["-X", "-v", "ON_ERROR_STOP=1", ...extra, "-c", "SET ROLE inrole_migrator; SELECT set_config('inrole.app_role','inrole_app',false)", "-f", "/ops/permissions.sql"]);
    await run("tar", ["-xzf", path.join(root, "media.tar.gz"), "-C", "/restore-media", "--no-same-owner", "--no-same-permissions"]);
    if (JSON.stringify(await mediaFingerprints("/restore-media")) !== JSON.stringify(manifest.mediaDigests)) throw new Error("Restored media hashes differ; do not promote");
    // Apply newer deletion receipts from the separate live journal, never overwrite it from an old archive.
    for (const file of await fs.readdir("/erasures")) {
      if (!/^[a-f0-9-]{36}\.json$/.test(file)) throw new Error("Unexpected privacy journal entry");
      const { userId } = JSON.parse(await fs.readFile(path.join("/erasures", file), "utf8"));
      if (!/^[a-f0-9-]{36}$/.test(userId)) throw new Error("Invalid privacy journal entry");
      const hash = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
      await sql(`BEGIN; DO $$ DECLARE v integer; BEGIN SELECT "authVersion" INTO v FROM inrole.app_users WHERE id='${userId}' AND status<>'CLOSED' FOR UPDATE; IF FOUND THEN UPDATE inrole.app_users SET status='ACTIVE' WHERE id='${userId}'; INSERT INTO inrole.auth_sessions (id,"userId","tokenHash","authVersion","createdAt","lastSeenAt","expiresAt") VALUES (gen_random_uuid(),'${userId}','${hash}',v,clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '1 hour'); PERFORM inrole.erase_own_account('${userId}','${hash}'); END IF; END $$; COMMIT;`, extra);
    }
    const deleted = (await sql("SELECT \"storageKey\" FROM inrole.media_assets WHERE status='DELETED' AND bucket='local-private'", extra)).split("\n").filter(Boolean);
    for (const key of deleted) { if (!/^[a-f0-9-]{36}\.(webp|mp4|webm)$/.test(key)) throw new Error("Invalid media key"); await fs.rm(path.join("/restore-media", key), { force: true }); }
    await run("chown", ["-R", "1000:1000", "/restore-media"]);
    // Promotion requires business checks and ownership correction described in the runbook.
    console.log("Restored and verified " + Object.keys(manifest.tableDigests).length + " table digests into fresh database " + database + "; reconciled available later erasures into separate media volume. Production was not overwritten. Verify the journal is current before promotion.");
  } else throw new Error("Choose backup or restore");
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await fs.rm(root, { recursive: true, force: true }); }
