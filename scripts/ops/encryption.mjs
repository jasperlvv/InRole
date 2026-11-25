import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { pipeline } from "node:stream/promises";
const magic = Buffer.from("INROLE01");
async function key(file) {
  const bytes = await fs.readFile(file);
  if (bytes.length < 32) throw new Error("Backup key must contain at least 32 bytes of random material");
  return createHash("sha256").update(bytes).digest();
}
export async function encryptFile(source, destination, keyFile) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", await key(keyFile), iv);
  cipher.setAAD(magic);
  await fs.writeFile(destination, Buffer.concat([magic, iv]), { flag: "wx", mode: 0o600 });
  try { await pipeline(createReadStream(source), cipher, createWriteStream(destination, { flags: "a" })); await fs.appendFile(destination, cipher.getAuthTag()); }
  catch (error) { await fs.rm(destination, { force: true }); throw error; }
}
export async function decryptFile(source, destination, keyFile) {
  const handle = await fs.open(source, "r");
  let iv, tag, owned = false;
  try {
    const { size } = await handle.stat(); if (size < 36) throw new Error("Truncated encrypted backup");
    const header = Buffer.alloc(20); await handle.read(header, 0, 20, 0); if (!header.subarray(0, 8).equals(magic)) throw new Error("Unknown backup format");
    iv = header.subarray(8); tag = Buffer.alloc(16); await handle.read(tag, 0, 16, size - 16);
    const cipher = createDecipheriv("aes-256-gcm", await key(keyFile), iv); cipher.setAAD(magic); cipher.setAuthTag(tag);
    const output = await fs.open(destination, "wx", 0o600); owned = true; await output.close();
    await pipeline(createReadStream(source, { start: 20, end: size - 17 }), cipher, createWriteStream(destination, { flags: "w" }));
  } catch (error) { if (owned) await fs.rm(destination, { force: true }); throw error; }
  finally { await handle.close(); }
}
