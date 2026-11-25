import "server-only";
import { randomUUID } from "node:crypto";
import { hash, verify, type Options } from "@node-rs/argon2";
import type { AccountDTO } from "@/lib/api-types";
import { normalizeHandle, handleError, passwordError } from "@/lib/account-rules";
import { database } from "./database";
import { ApiProblem, invalid, hasDatabaseCode } from "./errors";
import { authorizeWrite, authorizedTransaction } from "./authorization";
import { cookieToken, tokenHash, prepareSession, createSession, setSessionCookie, clearSessionCookie } from "./session";
import { requireTrustedOrigin, jsonObject } from "./request-security";
import { consumeAuthLimit } from "./rate-limit";

const hashOptions = Object.freeze<Options>({ algorithm: 2, version: 1, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
let dummyHash: Promise<string> | undefined;
const loginFailure = () => new ApiProblem(401, "UNAUTHENTICATED", "ID 或密码错误。");
const accountSelect = { handle: true, displayName: true, bio: true, onboardingCompletedAt: true } as const;
export function accountDTO(user: { handle: string; displayName: string; bio: string; onboardingCompletedAt: Date | null }): AccountDTO {
  return { handle: user.handle, displayName: user.displayName, bio: user.bio, onboardingComplete: user.onboardingCompletedAt !== null };
}
async function credentials(request: Request) {
  requireTrustedOrigin(request);
  const body = await jsonObject(request, ["handle", "password"]);
  const handle = normalizeHandle(body.handle);
  const handleIssue = handleError(handle);
  const passwordIssue = passwordError(body.password);
  if (handleIssue) invalid("handle", handleIssue);
  if (passwordIssue) invalid("password", passwordIssue);
  return { handle, password: body.password };
}
export async function register(request: Request): Promise<AccountDTO> {
  const input = await credentials(request);
  await consumeAuthLimit("register", input.handle, request);
  const session = await prepareSession();
  const passwordHash = await hash(input.password, hashOptions);
  const id = randomUUID();
  const user = await database().$transaction(async tx => {
    const rows = await tx.$queryRaw<{ handle: string; displayName: string; bio: string; onboardingCompletedAt: Date | null }[]>`
      INSERT INTO inrole.app_users (id,handle,"displayName","updatedAt")
      VALUES (${id}::uuid,${input.handle},${input.handle},clock_timestamp())
      RETURNING handle,"displayName",bio,"onboardingCompletedAt"`;
    await tx.passwordCredential.create({ data: { userId: id, passwordHash } });
    await tx.$executeRaw`INSERT INTO inrole.wallets ("userId","updatedAt") VALUES (${id}::uuid,clock_timestamp())`;
    await createSession(tx, id, 1, session.hash);
    await tx.$queryRaw`SELECT inrole.claim_daily(${id}::uuid)`;
    return accountDTO(rows[0]);
  }, { maxWait: 5000, timeout: 10000 }).catch(error => {
    if (hasDatabaseCode(error, "P2002") || hasDatabaseCode(error, "23505")) throw new ApiProblem(409, "CONFLICT", "这个 ID 已被使用。如果刚刚注册过，请尝试登录。", { handle: "请选择其他 ID。" });
    throw error;
  });
  await setSessionCookie(session.sealed);
  return user;
}
export async function login(request: Request): Promise<AccountDTO> {
  const input = await credentials(request);
  await consumeAuthLimit("login", input.handle, request);
  dummyHash ??= hash("inrole-unavailable-account-placeholder", hashOptions);
  const fallback = await dummyHash;
  const snapshot = await database().user.findUnique({ where: { handle: input.handle }, select: { id: true, status: true, authVersion: true, credential: { select: { passwordHash: true } } } });
  const valid = await verify(snapshot?.credential?.passwordHash || fallback, input.password);
  if (!valid || !snapshot?.credential || snapshot.status !== "ACTIVE") throw loginFailure();
  const prepared = await prepareSession();
  const previousToken = await cookieToken();
  const user = await database().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM inrole.app_users WHERE id=${snapshot.id}::uuid FOR UPDATE`;
    const current = await tx.user.findUnique({ where: { id: snapshot.id }, select: { ...accountSelect, status: true, authVersion: true, credential: { select: { passwordHash: true } } } });
    if (!current || current.status !== "ACTIVE" || current.authVersion !== snapshot.authVersion || current.credential?.passwordHash !== snapshot.credential!.passwordHash) throw loginFailure();
    if (previousToken) await tx.$executeRaw`UPDATE inrole.auth_sessions SET "revokedAt"=clock_timestamp() WHERE "userId"=${snapshot.id}::uuid AND "tokenHash"=${tokenHash(previousToken)} AND "revokedAt" IS NULL`;
    await createSession(tx, snapshot.id, current.authVersion, prepared.hash);
    await tx.$queryRaw`SELECT inrole.claim_daily(${snapshot.id}::uuid)`;
    return accountDTO(current);
  }, { maxWait: 5000, timeout: 10000 });
  await setSessionCookie(prepared.sealed);
  return user;
}
export async function logout(request: Request) {
  requireTrustedOrigin(request);
  await jsonObject(request, []);
  const token = await cookieToken();
  if (token) await database().$transaction(async tx => {
    const session = await tx.authSession.findUnique({ where: { tokenHash: tokenHash(token) }, select: { id: true, userId: true } });
    if (!session) return;
    await tx.$queryRaw`SELECT id FROM inrole.app_users WHERE id=${session.userId}::uuid FOR UPDATE`;
    const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    await tx.authSession.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: clock.now } });
  });
  await clearSessionCookie();
  return { signedOut: true };
}
export async function changePassword(request: Request) {
  const actor = await authorizeWrite(request);
  const body = await jsonObject(request, ["oldPassword", "newPassword"]);
  for (const field of ["oldPassword", "newPassword"]) {
    const issue = passwordError(body[field]);
    if (issue) invalid(field, issue);
  }
  if (body.oldPassword === body.newPassword) invalid("newPassword", "新密码需与旧密码不同。");
  await consumeAuthLimit("password", actor.userId, request);
  const passwordHash = await hash(body.newPassword, hashOptions);
  await authorizedTransaction(request, async (tx, current) => {
    const credential = await tx.passwordCredential.findUnique({ where: { userId: current.userId }, select: { passwordHash: true } });
    if (!credential || !await verify(credential.passwordHash, body.oldPassword)) invalid("oldPassword", "旧密码不正确。");
    const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    await tx.passwordCredential.update({ where: { userId: current.userId }, data: { passwordHash, changedAt: clock.now } });
    await tx.user.update({ where: { id: current.userId }, data: { authVersion: { increment: 1 } }, select: { id: true } });
  });
  await clearSessionCookie();
  return { signedOut: true, passwordChanged: true };
}
export async function updateOwnProfile(request: Request): Promise<AccountDTO> {
  const actor = await authorizeWrite(request);
  const body = await jsonObject(request, ["displayName", "bio"], []);
  if (!Object.keys(body).length) invalid("body", "请填写要更新的资料。");
  if (body.displayName !== undefined && (Array.from(body.displayName.trim()).length < 1 || Array.from(body.displayName.trim()).length > 20)) invalid("displayName", "昵称需为 1～20 个字符。");
  if (body.bio !== undefined && Array.from(body.bio).length > 200) invalid("bio", "简介最多 200 个字符。");
  await consumeAuthLimit("profile", actor.userId, request);
  return authorizedTransaction(request, async (tx, current) => accountDTO(await tx.user.update({ where: { id: current.userId }, data: { ...(body.displayName !== undefined ? { displayName: body.displayName.trim() } : {}), ...(body.bio !== undefined ? { bio: body.bio } : {}) }, select: accountSelect })));
}
