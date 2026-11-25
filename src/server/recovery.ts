import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { normalizeHandle, handleError, passwordError } from "@/lib/account-rules";
import { authorizeWrite, authorizedTransaction } from "./authorization";
import { database } from "./database";
import { inputObject, requireTrustedOrigin } from "./request-security";
import { consumeAuthLimit } from "./rate-limit";
import { ApiProblem, invalid } from "./errors";
import { text } from "./community-input";
function codeHash(code: string) {
  const pepper = process.env.RECOVERY_CODE_PEPPER;
  if (!pepper || pepper.length < 32 || [process.env.SESSION_PASSWORD, process.env.RATE_LIMIT_SECRET].includes(pepper)) throw new ApiProblem(503, "SERVICE_UNAVAILABLE", "账号恢复服务尚未配置。");
  return createHmac("sha256", pepper).update(code.replaceAll("-", "").toLowerCase()).digest("hex");
}
export async function generateCodes(request: Request) {
  const actor = await authorizeWrite(request), body = await inputObject(request, ["password"]);
  if (typeof body.password !== "string" || passwordError(body.password)) invalid("password", "密码长度需为8～64字符。");
  const password = body.password;
  await consumeAuthLimit("password", actor.userId, request);
  const snapshot = await database().passwordCredential.findUniqueOrThrow({ where: { userId: actor.userId } });
  if (!await verify(snapshot.passwordHash, password)) throw new ApiProblem(401, "UNAUTHENTICATED", "密码错误，未更改恢复码。");
  const codes = Array.from({ length: 8 }, () => randomBytes(16).toString("hex").match(/.{8}/g)!.join("-"));
  const hashes = codes.map(code => codeHash(code));
  return authorizedTransaction(request, async (tx, current) => {
    const credential = await tx.passwordCredential.findUniqueOrThrow({ where: { userId: current.userId } });
    if (credential.passwordHash !== snapshot.passwordHash) throw new ApiProblem(409, "CONFLICT", "密码已变化，请重新验证。");
    await tx.recoveryCode.deleteMany({ where: { userId: current.userId } });
    await tx.recoveryCode.createMany({ data: hashes.map(codeHash => ({ userId: current.userId, codeHash })) });
    return { codes };
  });
}
export async function recoverAccount(request: Request) {
  requireTrustedOrigin(request);
  const body = await inputObject(request, ["handle", "code", "newPassword"], 2048), handle = normalizeHandle(text(body.handle, "handle", 40));
  if (handleError(handle)) invalid("handle", "请输入正确的个人ID。");
  const code = text(body.code, "code", 100, 1);
  if (typeof body.newPassword !== "string" || passwordError(body.newPassword)) invalid("newPassword", "密码长度需为8～64字符。");
  const password = body.newPassword;
  await consumeAuthLimit("recovery", handle, request);
  const hashedCode = codeHash(code), failure = () => new ApiProblem(401, "UNAUTHENTICATED", "ID或恢复码无效。");
  const user = await database().user.findUnique({ where: { handle }, select: { id: true, status: true, recoveryCodes: { where: { codeHash: hashedCode, usedAt: null }, select: { id: true } } } });
  if (!user || user.status !== "ACTIVE" || !user.recoveryCodes.length) throw failure();
  const passwordHash = await hash(password, { algorithm: 2, version: 1, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
  await database().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM inrole.app_users WHERE id=${user.id}::uuid FOR UPDATE`;
    const current = await tx.user.findUnique({ where: { id: user.id }, select: { status: true } });
    if (current?.status !== "ACTIVE") throw failure();
    const used = await tx.recoveryCode.updateMany({ where: { id: user.recoveryCodes[0].id, userId: user.id, codeHash: hashedCode, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw failure();
    await tx.passwordCredential.update({ where: { userId: user.id }, data: { passwordHash, changedAt: new Date() }, select: { userId: true } });
    await tx.user.update({ where: { id: user.id }, data: { authVersion: { increment: 1 } }, select: { id: true } });
  });
  return { recovered: true };
}
