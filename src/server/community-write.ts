import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { authorizeWrite, authorizedTransaction, type AuthContext } from "./authorization";
import { ApiProblem } from "./errors";
import { consumeAuthLimit } from "./rate-limit";
import { idempotencyKey } from "./contracts";
import { assertInteraction } from "./blocking";
import { digest } from "./community-input";

export async function communityWrite<T>(request: Request, action: "content" | "preferences" | "media" | "review" | "vote", callback: (tx: Prisma.TransactionClient, actor: AuthContext) => Promise<T>, onboarding = true) {
  const actor = await authorizeWrite(request);
  await consumeAuthLimit(action, actor.userId, request);
  return authorizedTransaction(request, async (tx, current) => {
    if (onboarding) {
      const user = await tx.user.findUniqueOrThrow({ where: { id: current.userId }, select: { onboardingCompletedAt: true } });
      if (!user.onboardingCompletedAt) throw new ApiProblem(409, "CONFLICT", "请先完成或跳过喜好选择。");
    }
    return callback(tx, current);
  });
}
export async function idempotentCreate(request: Request, scope: string, payload: unknown, callback: (tx: Prisma.TransactionClient, actor: AuthContext, id: string) => Promise<void>) {
  const key = idempotencyKey(request), payloadHash = digest(payload);
  return communityWrite(request, "content", async (tx, actor) => {
    const where = { userId_scope_key: { userId: actor.userId, scope, key } };
    const previous = await tx.writeRequest.findUnique({ where });
    if (previous) {
      if (previous.payloadHash !== payloadHash || previous.status !== "COMPLETED" || !previous.resultId) throw new ApiProblem(409, "CONFLICT", "相同请求标记已用于不同内容，或请求尚未完成。");
      return { id: previous.resultId };
    }
    const id = randomUUID();
    const record = await tx.writeRequest.create({ data: { userId: actor.userId, scope, key, payloadHash } });
    await callback(tx, actor, id);
    await tx.writeRequest.update({ where: { id: record.id }, data: { status: "COMPLETED", resultId: id, resultType: scope, completedAt: new Date() } });
    return { id };
  });
}
export async function availablePerson(tx: Prisma.TransactionClient, personId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT p.id FROM inrole.people p JOIN inrole.interest_tags i ON i.id=p."primaryInterestId" WHERE p.id=${personId} AND p.active AND i.active FOR SHARE OF p,i`;
  if (!rows.length) throw new ApiProblem(409, "CONFLICT", "人物当前不可用于新的互动。");
}
export async function visiblePost(tx: Prisma.TransactionClient, postId: string, exclusive = false, actorId?: string) {
  const rows = exclusive
    ? await tx.$queryRaw<{ id: string; authorId: string }[]>`SELECT id,"authorId" FROM inrole.posts WHERE id=${postId}::uuid AND visibility='VISIBLE' FOR UPDATE`
    : await tx.$queryRaw<{ id: string; authorId: string }[]>`SELECT id,"authorId" FROM inrole.posts WHERE id=${postId}::uuid AND visibility='VISIBLE' FOR SHARE`;
  if (!rows.length) throw new ApiProblem(404, "NOT_FOUND", "帖子不存在或不可见。");
  if (actorId) await assertInteraction(tx, actorId, rows[0].authorId);
  return rows[0];
}
export async function rememberPerson(tx: Prisma.TransactionClient, userId: string, personId: string) {
  await tx.userRecentPerson.upsert({ where: { userId_personId: { userId, personId } }, create: { userId, personId }, update: { lastUsedAt: new Date() } });
  const entries = await tx.userRecentPerson.findMany({ where: { userId }, orderBy: [{ lastUsedAt: "desc" }, { personId: "asc" }], skip: 4, select: { personId: true } });
  if (entries.length) await tx.userRecentPerson.deleteMany({ where: { userId, personId: { in: entries.map(item => item.personId) } } });
}
