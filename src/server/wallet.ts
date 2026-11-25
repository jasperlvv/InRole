import "server-only";
import { database } from "./database";
import { authorize, authorizedTransaction } from "./authorization";
import { communityWrite, availablePerson, visiblePost } from "./community-write";
import { inputObject } from "./request-security";
import { digest, timelineQuery, timelineCursor } from "./community-input";
import { idempotencyKey } from "./contracts";
import { ApiProblem, invalid, hasDatabaseCode } from "./errors";

export async function claim(request: Request) {
  await inputObject(request, []);
  return authorizedTransaction(request, async (tx, actor) => {
    const [result] = await tx.$queryRaw<{ id: string }[]>`SELECT inrole.claim_daily(${actor.userId}::uuid) AS id`;
    return result;
  });
}
export async function wallet(parameters: URLSearchParams) {
  const actor = (await authorize("user"))!, query = timelineQuery(parameters, "wallet", []);
  const [wallet, entries, grants, totals] = await Promise.all([
    database().wallet.findUniqueOrThrow({ where: { userId: actor.userId }, select: { balance: true } }),
    database().coinEntry.findMany({ where: { userId: actor.userId, ...(query.after ? { OR: [{ createdAt: { lt: query.after.at } }, { createdAt: query.after.at, id: { lt: query.after.id } }] } : {}) }, include: { operation: { select: { kind: true, postId: true, personId: true, createdAt: true, actor: { select: { handle: true } }, recipient: { select: { handle: true } }, person: { select: { name: true } } } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limit + 1 }),
    database().$queryRaw<{ day: string; claimed: boolean }[]>`SELECT to_char(clock_timestamp() AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS day, EXISTS(SELECT 1 FROM inrole.coin_operations WHERE "actorId"=${actor.userId}::uuid AND "grantDay"=(clock_timestamp() AT TIME ZONE 'Asia/Shanghai')::date) AS claimed`,
    database().$queryRaw<{ grants: bigint; tips: bigint; sent: bigint; received: bigint }[]>`SELECT coalesce(sum(amount) FILTER (WHERE kind='DAILY_GRANT'),0)::bigint AS grants,coalesce(sum(amount) FILTER (WHERE kind='PERSON_TIP'),0)::bigint AS tips,coalesce(sum(amount) FILTER (WHERE kind='POST_GIFT' AND "actorId"=${actor.userId}::uuid),0)::bigint AS sent,coalesce(sum(amount) FILTER (WHERE kind='POST_GIFT' AND "recipientId"=${actor.userId}::uuid),0)::bigint AS received FROM inrole.coin_operations WHERE "actorId"=${actor.userId}::uuid OR "recipientId"=${actor.userId}::uuid`,
  ]);
  const items = entries.slice(0, query.limit), hasMore = entries.length > query.limit;
  const nextCursor = hasMore ? timelineCursor(items.at(-1)!, query, "wallet") : null;
  return { data: { balance: wallet.balance.toString(), day: grants[0].day, claimed: grants[0].claimed, totals: Object.fromEntries(Object.entries(totals[0]).map(([key, value]) => [key, value.toString()])), entries: items.map(item => ({ id: item.id, delta: item.delta.toString(), ...item.operation, createdAt: item.createdAt.toISOString() })), nextCursor }, page: { limit: query.limit, hasMore, nextCursor } };
}
export async function spend(request: Request, target: { personId: string } | { postId: string }) {
  const body = await inputObject(request, ["amount"]);
  if (typeof body.amount !== "number" || !Number.isSafeInteger(body.amount) || body.amount < 1 || body.amount > 1000000) invalid("amount", "数量需为1～1000000的整数。");
  const amount = body.amount, key = idempotencyKey(request), payloadHash = digest({ ...target, amount });
  try {
    return await communityWrite(request, "content", async (tx, actor) => {
      const where = { userId_scope_key: { userId: actor.userId, scope: "coins.spend.v1", key } };
      const previous = await tx.writeRequest.findUnique({ where });
      if (previous) {
        if (previous.payloadHash !== payloadHash || previous.status !== "COMPLETED") throw new ApiProblem(409, "CONFLICT", "请求标记已用于其他参数。");
        return { id: previous.resultId };
      }
      const personId = "personId" in target ? target.personId : null, postId = "postId" in target ? target.postId : null;
      if (personId) await availablePerson(tx, personId);
      if (postId && (await visiblePost(tx, postId, false, actor.userId)).authorId === actor.userId) throw new ApiProblem(409, "CONFLICT", "不能给自己的帖子赠送通宝。");
      const record = await tx.writeRequest.create({ data: { userId: actor.userId, scope: "coins.spend.v1", key, payloadHash } });
      const [result] = await tx.$queryRaw<{ id: string }[]>`SELECT inrole.spend_coins(${actor.userId}::uuid,${personId}::varchar,${postId}::uuid,${BigInt(amount)},${record.id}::uuid) AS id`;
      await tx.writeRequest.update({ where: { id: record.id }, data: { status: "COMPLETED", resultId: result.id, resultType: "coin", completedAt: new Date() } });
      return result;
    });
  } catch (error) { if (hasDatabaseCode(error, "P0002")) throw new ApiProblem(409, "CONFLICT", "通宝余额不足。"); throw error; }
}
export async function coinRankings(today: boolean) {
  const rows = await database().$queryRaw<{ id: string; name: string; amount: bigint }[]>`SELECT p.id,p.name,SUM(c.amount)::bigint AS amount FROM inrole.coin_operations c JOIN inrole.people p ON p.id=c."personId" JOIN inrole.interest_tags i ON i.id=p."primaryInterestId" WHERE c.kind='PERSON_TIP' AND p.active AND i.active AND (${!today} OR c."createdAt">=date_trunc('day',clock_timestamp() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai') GROUP BY p.id,p.name ORDER BY amount DESC,p.id LIMIT 50`;
  return rows.map(row => ({ ...row, amount: row.amount.toString() }));
}
export async function personCoinStats(personId: string) {
  const [row] = await database().$queryRaw<{ total: bigint; today: bigint }[]>`SELECT coalesce(sum(amount),0)::bigint AS total,coalesce(sum(amount) FILTER (WHERE "createdAt">=date_trunc('day',clock_timestamp() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai'),0)::bigint AS today FROM inrole.coin_operations WHERE kind='PERSON_TIP' AND "personId"=${personId}`;
  return { total: row.total.toString(), today: row.today.toString() };
}
