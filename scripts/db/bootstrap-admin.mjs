import { loadEnvironment, connect, fail } from "./common.mjs";
loadEnvironment();
let client;
try {
  const handle = process.argv[2];
  if (!/^[a-z0-9_]{3,20}$/.test(handle || "")) throw new Error("Usage: node scripts/db/bootstrap-admin.mjs existing_handle");
  if (!process.env.DIRECT_URL) throw new Error("A migration-owner DIRECT_URL is required");
  client = await connect(process.env.DIRECT_URL);
  const row = await client.query("UPDATE inrole.app_users SET role='ADMIN',\"authVersion\"=\"authVersion\"+1,\"updatedAt\"=now() WHERE handle=$1 AND status='ACTIVE' RETURNING id", [handle]);
  if (row.rowCount !== 1) throw new Error("Active account not found; create an account using registration first");
  console.log("Administrator provisioned using owner credentials. Old sessions revoked; sign in again.");
} catch (error) { fail(error); } finally { await client?.end(); }
