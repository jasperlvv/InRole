import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { encryptFile, decryptFile } from "../scripts/ops/encryption.mjs";
test("backup encryption restores binary data and rejects tampering or wrong keys without leaving plaintext", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "inrole-crypto-"));
  const p = name => path.join(root, name);
  try {
    const original = randomBytes(150000); await fs.writeFile(p("source"), original); await fs.writeFile(p("key"), randomBytes(48)); await fs.writeFile(p("wrong"), randomBytes(48));
    await encryptFile(p("source"), p("backup"), p("key")); await decryptFile(p("backup"), p("restored"), p("key")); assert.deepEqual(await fs.readFile(p("restored")), original);
    await assert.rejects(decryptFile(p("backup"), p("wrong-output"), p("wrong"))); await assert.rejects(fs.stat(p("wrong-output")));
    const changed = await fs.readFile(p("backup")); changed[100] ^= 1; await fs.writeFile(p("tampered"), changed);
    await assert.rejects(decryptFile(p("tampered"), p("tampered-output"), p("key"))); await assert.rejects(fs.stat(p("tampered-output")));
    await assert.rejects(decryptFile(p("backup"), p("restored"), p("key"))); assert.deepEqual(await fs.readFile(p("restored")), original);
    await assert.rejects(encryptFile(p("source"), p("backup"), p("key"))); await decryptFile(p("backup"), p("again"), p("key")); assert.deepEqual(await fs.readFile(p("again")), original);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
