import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { database } from "./database";
import { ApiProblem } from "./errors";
import { cookieToken, tokenHash } from "./session";
import { requireTrustedOrigin } from "./request-security";

export type Actor = { userId: string; role: "USER" | "ADMIN"; blockedUserIds?: string[] };
export type Access = "public" | "user" | "admin";
export { sessionCookieName } from "./session";
export type AuthContext = Actor & { sessionId: string; authVersion: number };
type SessionRow = AuthContext & { status: string; valid: boolean };
const unauthenticated = () => new ApiProblem(401, "UNAUTHENTICATED", "请先登录真实账号。");
function validate(record: SessionRow | undefined): AuthContext {
  if (!record) throw unauthenticated();
  if (record.status !== "ACTIVE") throw new ApiProblem(403, "FORBIDDEN", "当前账号无法执行此操作。");
  if (!record.valid) throw unauthenticated();
  return { userId: record.userId, role: record.role, sessionId: record.sessionId, authVersion: record.authVersion };
}
async function sessionRecord(tx: Prisma.TransactionClient, hash: string) {
  const rows = await tx.$queryRaw<SessionRow[]>`
    SELECT u.id AS "userId",u.role::text AS role,u.status::text AS status,u."authVersion",s.id AS "sessionId",
      (s."revokedAt" IS NULL AND s."expiresAt" > clock_timestamp() AND s."authVersion"=u."authVersion") AS valid
    FROM inrole.auth_sessions s JOIN inrole.app_users u ON u.id=s."userId" WHERE s."tokenHash"=${hash}`;
  return rows[0];
}
export async function authorize(access: Access): Promise<Actor | null> {
  if (access === "public") return null;
  const token = await cookieToken();
  if (!token) throw unauthenticated();
  const context = validate(await sessionRecord(database(), tokenHash(token)));
  if (access === "admin" && context.role !== "ADMIN") throw new ApiProblem(403, "FORBIDDEN", "此操作需要管理员权限。");
  return { userId: context.userId, role: context.role };
}
export async function authorizedTransaction<T>(request: Request, operation: (tx: Prisma.TransactionClient, actor: AuthContext) => Promise<T>): Promise<T> {
  requireTrustedOrigin(request);
  const token = await cookieToken();
  if (!token) throw unauthenticated();
  const hash = tokenHash(token);
  return database().$transaction(async tx => {
    const session = await tx.authSession.findUnique({ where: { tokenHash: hash }, select: { userId: true } });
    if (!session) throw unauthenticated();
    await tx.$queryRaw`SELECT id FROM inrole.app_users WHERE id=${session.userId}::uuid FOR UPDATE`;
    const actor = validate(await sessionRecord(tx, hash));
    return operation(tx, actor);
  }, { maxWait: 5000, timeout: 10000 });
}
export async function authorizeWrite(request: Request): Promise<Actor> {
  requireTrustedOrigin(request);
  return (await authorize("user"))!;
}
export async function optionalActor(): Promise<Actor | null> {
  try {
    const actor = (await authorize("user"))!;
    const blocks = await database().userBlock.findMany({ where: { OR: [{ userId: actor.userId }, { blockedId: actor.userId }] }, select: { userId: true, blockedId: true } });
    return { ...actor, blockedUserIds: blocks.map(row => row.userId === actor.userId ? row.blockedId : row.userId) };
  }
  catch (error) { if (error instanceof ApiProblem && [401, 403].includes(error.status)) return null; throw error; }
}
