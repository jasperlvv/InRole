import "server-only";
import { verify } from "@node-rs/argon2";
import fs from "node:fs/promises";
import path from "node:path";
import { authorize, authorizeWrite, authorizedTransaction } from "./authorization";
import { lockPair } from "./blocking";
import { database } from "./database";
import { ApiProblem, invalid } from "./errors";
import { inputObject } from "./request-security";
import { consumeAuthLimit } from "./rate-limit";
import { cookieToken, tokenHash, clearSessionCookie } from "./session";
import { purgeDeletedMedia } from "./media";

export async function blockedUsers() {
  const actor = (await authorize("user"))!;
  const rows = await database().userBlock.findMany({ where: { userId: actor.userId, blocked: { status: "ACTIVE" } }, select: { createdAt: true, blocked: { select: { handle: true, displayName: true } } }, orderBy: { createdAt: "desc" } });
  return rows.map(row => ({ ...row.blocked, createdAt: row.createdAt.toISOString() }));
}
export async function setBlock(request: Request, handle: string, remove: boolean) {
  const actor = await authorizeWrite(request);
  await inputObject(request, []);
  await consumeAuthLimit("profile", actor.userId, request);
  return authorizedTransaction(request, async (tx, current) => {
    const target = await tx.user.findFirst({ where: { handle, status: "ACTIVE" }, select: { id: true } });
    if (!target) throw new ApiProblem(404, "NOT_FOUND", "账号不存在或不可用。");
    if (target.id === current.userId) invalid("handle", "不能屏蔽自己。");
    await lockPair(tx, current.userId, target.id);
    const where = { userId_blockedId: { userId: current.userId, blockedId: target.id } };
    if (remove) await tx.userBlock.deleteMany({ where: where.userId_blockedId });
    else await tx.userBlock.upsert({ where, create: where.userId_blockedId, update: {} });
    return { blocked: !remove };
  });
}
export async function eraseAccount(request: Request) {
  const actor = await authorizeWrite(request), body = await inputObject(request, ["password", "confirmation"]);
  if (typeof body.password !== "string" || body.password.length > 256) invalid("password", "请输入当前密码。");
  if (body.confirmation !== "注销我的账号") invalid("confirmation", "请输入“注销我的账号”确认。");
  await consumeAuthLimit("password", actor.userId, request);
  const token = await cookieToken();
  if (!token) throw new ApiProblem(401, "UNAUTHENTICATED", "请重新登录。");
  await authorizedTransaction(request, async (tx, current) => {
    const credential = await tx.passwordCredential.findUnique({ where: { userId: current.userId }, select: { passwordHash: true } });
    if (!credential || !await verify(credential.passwordHash, body.password as string)) invalid("password", "当前密码不正确。");
    await tx.characterRequest.updateMany({ where: { userId: current.userId, status: "PENDING" }, data: { status: "REJECTED", reviewedAt: new Date() } });
    await tx.$queryRaw`SELECT 1 AS erased FROM inrole.erase_own_account(${current.userId}::uuid,${tokenHash(token)})`;
  });
  await clearSessionCookie();
  let receiptPending = false;
  const receiptRoot = process.env.ERASURE_RECEIPT_DIR;
  if (receiptRoot) {
    try {
      await fs.mkdir(receiptRoot, { recursive: true, mode: 0o700 });
      await fs.writeFile(path.join(receiptRoot, `${actor.userId}.json`), JSON.stringify({ userId: actor.userId, erasedAt: new Date().toISOString() }), { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) { receiptPending = true; console.error(JSON.stringify({ component: "privacy", code: "ERASURE_RECEIPT_PENDING" })); }
    }
  }
  // Deleted media rows are a durable retry queue; a disk failure cannot reactivate them.
  const cleanup = await purgeDeletedMedia().catch(() => ({ pending: true }));
  return { deleted: true, mediaCleanupPending: cleanup.pending, erasureReceiptPending: receiptPending };
}
