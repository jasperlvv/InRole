import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "./authorization";
import { ApiProblem } from "./errors";
export function authorFilter(actor: Actor | null) {
  return { status: "ACTIVE" as const, ...(actor?.blockedUserIds?.length ? { id: { notIn: actor.blockedUserIds } } : {}) };
}
export async function lockPair(tx: Prisma.TransactionClient, first: string, second: string) {
  const pair = [first, second].sort().join(":");
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${pair},0))`;
}
export async function assertInteraction(tx: Prisma.TransactionClient, actorId: string, otherId: string) {
  if (actorId === otherId) return;
  await lockPair(tx, actorId, otherId);
  if (await tx.userBlock.findFirst({ where: { OR: [{ userId: actorId, blockedId: otherId }, { userId: otherId, blockedId: actorId }] }, select: { userId: true } })) {
    throw new ApiProblem(403, "FORBIDDEN", "你与该账号之间存在屏蔽关系，无法互动。");
  }
}
