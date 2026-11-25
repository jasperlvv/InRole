import "server-only";
import { database } from "./database";
import { authorFilter } from "./blocking";
import { authorize, optionalActor } from "./authorization";
import { communityWrite, idempotentCreate, visiblePost } from "./community-write";
import { inputObject } from "./request-security";
import { slug, uuid, text, digest } from "./community-input";
import { ApiProblem, invalid } from "./errors";
import { normalizeEncyclopediaUrl } from "@/lib/post-rules";
import { postSelect, postDTO, withGiftTotals } from "./posts";

export async function ownActivity() {
  const actor = (await optionalActor()) || (await authorize("user"))!;
  const [posts, comments, reviews, likes, requests] = await Promise.all([
    database().post.findMany({ where: { authorId: actor.userId }, select: { id: true, body: true, visibility: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    database().comment.findMany({ where: { authorId: actor.userId, post: { visibility: "VISIBLE" }, visibility: "VISIBLE" }, select: { id: true, postId: true, body: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    database().personReview.findMany({ where: { userId: actor.userId, visibility: "VISIBLE" }, select: { personId: true, score: true, body: true }, take: 50 }),
    database().postLike.findMany({ where: { userId: actor.userId, post: { visibility: "VISIBLE" } }, select: { postId: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    database().characterRequest.findMany({ where: { userId: actor.userId }, select: { id: true, name: true, sourceUrl: true, status: true, reviewNote: true, approvedPersonId: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const [ownRows, likedRows, receivedLikes] = await Promise.all([
    database().post.findMany({ where: { authorId: actor.userId, visibility: "VISIBLE" }, select: postSelect(actor), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 }),
    database().post.findMany({ where: { visibility: "VISIBLE", author: authorFilter(actor), likes: { some: { userId: actor.userId } } }, select: postSelect(actor), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 }),
    database().postLike.count({ where: { post: { authorId: actor.userId, visibility: "VISIBLE" }, user: { status: "ACTIVE" } } }),
  ]);
  return { posts: posts.map(row => ({ ...row, body: row.visibility === "VISIBLE" ? row.body : "内容不可见" })), comments, reviews, likes, requests, postCards: await withGiftTotals(ownRows.map(row => postDTO(row, actor))), likedPosts: await withGiftTotals(likedRows.map(row => postDTO(row, actor))), receivedLikes };
}
export async function characterRequest(request: Request) {
  const body = await inputObject(request, ["name", "bio", "sourceUrl"]);
  const name = text(body.name ?? "", "name", 60), bio = text(body.bio ?? "", "bio", 1000);
  let sourceUrl: string | null = null;
  if (body.sourceUrl) { try { sourceUrl = normalizeEncyclopediaUrl(text(body.sourceUrl, "sourceUrl", 2000)); } catch { invalid("sourceUrl", "仅接受HTTPS维基百科或百度百科词条链接。"); } }
  if (!sourceUrl && (!name || !bio)) invalid("name", "请填写名称与介绍，或提供百科词条。");
  const dedupeKey = digest(sourceUrl || name.normalize("NFKC").toLowerCase());
  return communityWrite(request, "content", async (tx, actor) => {
    const row = await tx.characterRequest.upsert({ where: { userId_dedupeKey: { userId: actor.userId, dedupeKey } }, create: { userId: actor.userId, name, bio, sourceUrl, dedupeKey }, update: {}, select: { id: true } });
    return row;
  });
}
export async function report(request: Request) {
  const body = await inputObject(request, ["kind", "targetId", "reason"]);
  const kind = text(body.kind, "kind", 10), id = uuid(body.targetId), reason = text(body.reason, "reason", 500, 1);
  if (!["post", "comment", "review"].includes(kind)) invalid("kind", "举报对象无效。");
  return idempotentCreate(request, "report.create.v1", { kind, id, reason }, async (tx, actor, reportId) => {
    if (kind === "post") await visiblePost(tx, id);
    if (kind === "comment" && !await tx.comment.findFirst({ where: { id, visibility: "VISIBLE", post: { visibility: "VISIBLE" } }, select: { id: true } })) throw new ApiProblem(404, "NOT_FOUND", "内容不可见。");
    if (kind === "review" && !await tx.personReview.findFirst({ where: { id, visibility: "VISIBLE" }, select: { id: true } })) throw new ApiProblem(404, "NOT_FOUND", "内容不可见。");
    await tx.contentReport.create({ data: { id: reportId, reporterId: actor.userId, reason, ...(kind === "post" ? { postId: id } : kind === "comment" ? { commentId: id } : { reviewId: id }) } });
  });
}
export async function adminDashboard() {
  await authorize("admin");
  const [requests, reports, users, audit, people, topics] = await Promise.all([
    database().characterRequest.findMany({ where: { status: "PENDING" }, take: 50, orderBy: { createdAt: "asc" }, select: { id: true, name: true, bio: true, sourceUrl: true } }),
    database().contentReport.findMany({ where: { status: "OPEN" }, take: 50, orderBy: { createdAt: "asc" }, select: { id: true, reason: true, postId: true, commentId: true, reviewId: true } }),
    database().user.findMany({ take: 100, orderBy: { createdAt: "desc" }, select: { id: true, handle: true, status: true, role: true } }),
    database().moderationAction.findMany({ take: 50, orderBy: { createdAt: "desc" }, select: { id: true, action: true, targetType: true, targetId: true, reason: true, createdAt: true } }),
    database().person.findMany({ take: 100, orderBy: { id: "asc" }, select: { id: true, name: true, bio: true, active: true, primaryInterestId: true } }),
    database().topic.findMany({ take: 100, orderBy: { id: "asc" }, select: { id: true, name: true, description: true, active: true } }),
  ]);
  return { requests, reports, users, audit, people, topics };
}
export async function administer(request: Request) {
  const body = await inputObject(request, ["action", "targetId", "reason", "value"]);
  const action = text(body.action, "action", 64, 1), targetId = text(body.targetId, "targetId", 100, 1), reason = text(body.reason, "reason", 500, 1);
  const value = body.value && typeof body.value === "object" && !Array.isArray(body.value) ? body.value as Record<string, unknown> : {};
  return communityWrite(request, "content", async (tx, actor) => {
    if (actor.role !== "ADMIN") throw new ApiProblem(403, "FORBIDDEN", "此操作需要管理员权限。");
    let previousState: object | null = null, nextState: object = {};
    if (action === "user.status") {
      const id = uuid(targetId); if (!["ACTIVE", "BANNED"].includes(String(value.status))) invalid("status", "状态不正确。");
      const row = await tx.user.findUniqueOrThrow({ where: { id }, select: { status: true } }); previousState = row;
      await tx.$executeRaw`SELECT inrole.admin_user_status(${actor.userId}::uuid,${id}::uuid,${String(value.status)})`; nextState = { status: value.status };
    } else if (["post.hide", "comment.hide", "review.hide"].includes(action)) {
      const id = uuid(targetId), data = { visibility: "HIDDEN" as const };
      previousState = action === "post.hide" ? await tx.post.findUniqueOrThrow({ where: { id }, select: { visibility: true } }) : action === "comment.hide" ? await tx.comment.findUniqueOrThrow({ where: { id }, select: { visibility: true } }) : await tx.personReview.findUniqueOrThrow({ where: { id }, select: { visibility: true } });
      const row = action === "post.hide" ? await tx.post.update({ where: { id, visibility: { not: "DELETED" } }, data, select: { id: true } }) : action === "comment.hide" ? await tx.comment.update({ where: { id, visibility: { not: "DELETED" } }, data, select: { id: true } }) : await tx.personReview.update({ where: { id, visibility: { not: "DELETED" } }, data, select: { id: true } });
      nextState = { ...row, visibility: "HIDDEN" };
    } else if (action === "report.resolve") {
      if (!["RESOLVED", "DISMISSED"].includes(String(value.status))) invalid("status", "处理状态不正确。");
      await tx.contentReport.update({ where: { id: uuid(targetId) }, data: { status: value.status as "RESOLVED" | "DISMISSED", resolvedAt: new Date() }, select: { id: true } }); nextState = { status: value.status };
    } else if (action === "person.avatar") {
      const id = slug(targetId), mediaId = uuid(value.mediaId);
      if (!await tx.mediaAsset.findFirst({ where: { id: mediaId, ownerId: actor.userId, purpose: "PERSON_AVATAR", status: "READY" }, select: { id: true } })) invalid("mediaId", "请上传有效的管理员人物头像。");
      const sourceUrl = text(value.sourceUrl, "sourceUrl", 2000, 1), sourceAuthor = text(value.sourceAuthor, "sourceAuthor", 200, 1), license = text(value.license, "license", 200, 1);
      let url: URL; try { url = new URL(sourceUrl); if (url.protocol !== "https:" || url.username || url.password) throw new Error(); } catch { invalid("sourceUrl", "请填写HTTPS来源网址。"); }
      await tx.mediaAsset.update({ where: { id: mediaId }, data: { sourceUrl, sourceAuthor, license }, select: { id: true } });
      await tx.person.update({ where: { id }, data: { avatarMediaId: mediaId }, select: { id: true } }); nextState = { mediaId, sourceUrl, sourceAuthor, license };
    } else if (action === "person.save") {
      const id = slug(targetId), name = text(value.name, "name", 60, 1), bio = text(value.bio, "bio", 1000, 1), primaryInterestId = slug(value.interestId, "interestId");
      if (typeof value.active !== "boolean") invalid("active", "请选择是否启用。");
      if (!await tx.interestTag.findFirst({ where: { id: primaryInterestId, active: true }, select: { id: true } })) invalid("interestId", "兴趣无效。");
      previousState = await tx.person.findUnique({ where: { id }, select: { name: true, active: true } });
      const data = { name, bio, primaryInterestId, active: value.active };
      await tx.person.upsert({ where: { id }, create: { id, ...data }, update: data, select: { id: true } }); nextState = data;
    } else if (action === "topic.save") {
      const id = slug(targetId), name = text(value.name, "name", 60, 1), description = text(value.description, "description", 1000);
      if (typeof value.active !== "boolean") invalid("active", "请选择是否启用。");
      const data = { name, description, active: value.active };
      await tx.topic.upsert({ where: { id }, create: { id, ...data }, update: data, select: { id: true } }); nextState = data;
    } else if (action === "request.review") {
      const id = uuid(targetId), approved = value.approved === true, personId = approved ? slug(value.personId) : null;
      if (typeof value.approved !== "boolean") invalid("approved", "请选择审核结果。");
      if (personId && !await tx.person.findFirst({ where: { id: personId, active: true }, select: { id: true } })) invalid("personId", "请先维护审核通过的公共人物。");
      await tx.characterRequest.update({ where: { id, status: "PENDING" }, data: { status: approved ? "APPROVED" : "REJECTED", approvedPersonId: personId, reviewerId: actor.userId, reviewedAt: new Date(), reviewNote: reason }, select: { id: true } }); nextState = { approved, personId };
    } else throw new ApiProblem(400, "BAD_REQUEST", "不支持的管理操作。");
    await tx.moderationAction.create({ data: { actorId: actor.userId, action, targetType: action.split(".")[0], targetId, reason, ...(previousState ? { previousState: JSON.parse(JSON.stringify(previousState)) } : {}), nextState: JSON.parse(JSON.stringify(nextState)) } });
    return { saved: true };
  }, false);
}
