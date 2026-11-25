import "server-only";
import { authorFilter } from "./blocking";
import { database } from "./database";
import { optionalActor } from "./authorization";
import { communityWrite, availablePerson } from "./community-write";
import { inputObject } from "./request-security";
import { ApiProblem, invalid } from "./errors";
import { text, timelineQuery, timelineCursor } from "./community-input";
import type { ReviewsDTO } from "@/lib/community-types";

export async function reviews(personId: string, parameters: URLSearchParams) {
  if (!await database().person.findFirst({ where: { id: personId, active: true }, select: { id: true } })) throw new ApiProblem(404, "NOT_FOUND", "人物不存在或暂不可用。");
  const query = timelineQuery(parameters, `reviews:${personId}`, []), actor = await optionalActor();
  const where = { personId, visibility: "VISIBLE" as const, user: { status: "ACTIVE" as const } };
  const [summary, rows, mine] = await Promise.all([
    database().personReview.aggregate({ where, _avg: { score: true }, _count: { id: true } }),
    database().personReview.findMany({ where: { ...where, user: authorFilter(actor), ...(query.after ? { OR: [{ createdAt: { lt: query.after.at } }, { createdAt: query.after.at, id: { lt: query.after.id } }] } : {}) }, select: { id: true, score: true, body: true, createdAt: true, user: { select: { handle: true, displayName: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limit + 1 }),
    actor ? database().personReview.findUnique({ where: { userId_personId: { userId: actor.userId, personId } }, select: { score: true, body: true, visibility: true } }) : null,
  ]);
  const items = rows.slice(0, query.limit), hasMore = rows.length > query.limit;
  const data: ReviewsDTO = { average: summary._avg.score, count: summary._count.id, reviews: items.map(row => ({ id: row.id, score: row.score, body: row.body, createdAt: row.createdAt.toISOString(), author: row.user })), mine: mine && mine.visibility !== "DELETED" ? mine : null, nextCursor: hasMore ? timelineCursor(items.at(-1)!, query, `reviews:${personId}`) : null };
  return { data, page: { limit: query.limit, hasMore, nextCursor: hasMore ? timelineCursor(items.at(-1)!, query, `reviews:${personId}`) : null } };
}
export async function saveReview(request: Request, personId: string, remove = false) {
  const body = await inputObject(request, remove ? [] : ["score", "body"]);
  if (!remove && (typeof body.score !== "number" || !Number.isInteger(body.score) || body.score < 1 || body.score > 5)) invalid("score", "评分需为1～5的整数。");
  const content = remove ? "" : text(body.body ?? "", "body", 500);
  return communityWrite(request, "review", async (tx, actor) => {
    await availablePerson(tx, personId);
    const where = { userId_personId: { userId: actor.userId, personId } };
    const existing = await tx.personReview.findUnique({ where });
    if (existing?.visibility === "HIDDEN") throw new ApiProblem(403, "FORBIDDEN", "该评价已由管理员处理，不能重新发布。");
    if (remove) {
      if (existing) await tx.personReview.update({ where, data: { visibility: "DELETED", body: "" }, select: { id: true } });
      return { deleted: true };
    }
    const value = { score: body.score as number, body: content, visibility: "VISIBLE" as const };
    const row = await tx.personReview.upsert({ where, create: { userId: actor.userId, personId, ...value }, update: value, select: { id: true } });
    return { id: row.id };
  });
}
export async function reviewRankings() {
  return database().$queryRaw<{ id: string; name: string; average: number; count: number }[]>`
    SELECT p.id,p.name,AVG(r.score)::double precision AS average,COUNT(*)::integer AS count
    FROM inrole.person_reviews r JOIN inrole.people p ON p.id=r."personId"
    JOIN inrole.interest_tags i ON i.id=p."primaryInterestId" JOIN inrole.app_users u ON u.id=r."userId"
    WHERE r.visibility='VISIBLE' AND p.active AND i.active AND u.status='ACTIVE'
    GROUP BY p.id,p.name HAVING COUNT(*)>=5 ORDER BY AVG(r.score) DESC,COUNT(*) DESC,p.id ASC LIMIT 50`;
}
