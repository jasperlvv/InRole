import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { root, fail } from "./common.mjs";

try {
  const file = path.join(root, ".env.local");
  let text = await fs.readFile(file, "utf8");
  const configured = {};
  for (const name of ["SESSION_PASSWORD", "RATE_LIMIT_SECRET", "RECOVERY_CODE_PEPPER"]) {
    const expression = new RegExp(`^${name}=(.*)$`, "m");
    const match = text.match(expression);
    const current = match?.[1].trim().replace(/^['"]|['"]$/g, "");
    if (current && current.length < 32) throw new Error(`${name} is too short; existing value was preserved`);
    configured[name] = current || randomBytes(48).toString("base64url");
    if (!current) text = match ? text.replace(expression, `${name}=${configured[name]}`) : `${text.trim()}\n${name}=${configured[name]}\n`;
  }
  if (new Set(Object.values(configured)).size !== 3) throw new Error("Session, rate-limit and recovery keys must be different");
  if (!/^APP_ORIGIN=.+$/m.test(text)) text = text.replace(/^APP_ORIGIN=.*\r?$/m, "").trim() + "\nAPP_ORIGIN=http://localhost:3000\n";
  await fs.writeFile(file, text, { mode: 0o600 });
  console.log("Configured separate local auth keys and APP_ORIGIN in ignored .env.local. No secret values printed.");
} catch (error) { fail(error); }
