import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { PostDTO, CommentDTO, PostInput, FigureDTO } from "@/lib/community-types";
import type { Actor } from "./authorization";
import { authorFilter } from "./blocking";
import { optionalActor } from "./authorization";
import { database } from "./database";
import { ApiProblem, invalid } from "./errors";
import { inputObject } from "./request-security";
import { ids, text, slug, uuid, timelineQuery, timelineCursor } from "./community-input";
import { communityWrite, idempotentCreate, availablePerson, rememberPerson, visiblePost } from "./community-write";

const zero = "00000000-0000-0000-0000-000000000000";
const authorSelect = { handle: true, displayName: true } as const;
const figureSelect = { id: true, name: true, legacyAvatarPath: true, avatarMediaId: true } as const;
export function figureDTO(person: { id: string; name: string; legacyAvatarPath: string | null; avatarMediaId: string | null }): FigureDTO {
  return { id: person.id, name: person.name, avatarUrl: person.avatarMediaId ? `/api/v1/community/media/${person.avatarMediaId}` : person.legacyAvatarPath && /^\/people\/[a-z0-9-]+\.(webp|png|jpg)$/.test(person.legacyAvatarPath) ? person.legacyAvatarPath : null };
}
export function postSelect(viewer: Actor | null) {
  return {
    id: true, authorId: true, body: true, createdAt: true,
    author: { select: authorSelect }, person: { select: figureSelect },
    topics: { where: { topic: { active: true } }, select: { topic: { select: { id: true, name: true } } }, orderBy: { topicId: "asc" as const } },
    media: { where: { media: { status: "READY" as const } }, select: { media: { select: { id: true, width: true, height: true, purpose: true } } }, orderBy: { position: "asc" as const } },
    likes: { where: { userId: viewer?.userId || zero }, select: { userId: true } },
    _count: { select: { likes: { where: { user: { status: "ACTIVE" as const } } }, comments: { where: { visibility: "VISIBLE" as const } } } },
    poll: { select: { question: true, endsAt: true, sealed: true, options: { orderBy: { position: "asc" as const }, select: { id: true, text: true, _count: { select: { votes: { where: { user: { status: "ACTIVE" as const } } } } } } }, votes: { where: { userId: viewer?.userId || zero }, select: { optionId: true } } } },
    quotePost: { select: { authorId: true, id: true, body: true, visibility: true, author: { select: authorSelect }, person: { select: figureSelect } } },
  } satisfies Prisma.PostSelect;
}
type PostRow = Prisma.PostGetPayload<{ select: ReturnType<typeof postSelect> }>;
export function postDTO(row: PostRow, viewer: Actor | null): PostDTO {
  const poll = row.poll;
  return {
    id: row.id, body: row.body, createdAt: row.createdAt.toISOString(), author: row.author, person: figureDTO(row.person),
    topics: row.topics.map(item => item.topic), images: row.media.map(({ media }) => ({ id: media.id, width: media.width, height: media.height, kind: media.purpose === "POST_VIDEO" ? "video" : "image", url: `/api/v1/community/media/${media.id}` })),
    likes: row._count.likes, comments: row._count.comments, liked: Boolean(viewer && row.likes.length), mine: viewer?.userId === row.authorId, receivedCoins: "0",
    quote: row.quotePost ? (row.quotePost.visibility !== "VISIBLE" || viewer?.blockedUserIds?.includes(row.quotePost.authorId)) ? { id: row.quotePost.id, unavailable: true } : { id: row.quotePost.id, unavailable: false, body: row.quotePost.body, author: row.quotePost.author, person: figureDTO(row.quotePost.person) } : null,
    poll: poll?.sealed ? { question: poll.question, endsAt: poll.endsAt.toISOString(), closed: poll.endsAt.getTime() <= Date.now(), options: poll.options.map(item => ({ id: item.id, text: item.text, votes: item._count.votes })), totalVotes: poll.options.reduce((sum, item) => sum + item._count.votes, 0), myOptionId: viewer ? poll.votes[0]?.optionId || null : null } : null,
  };
}
export async function withGiftTotals(items: PostDTO[]): Promise<PostDTO[]> {
  if (!items.length) return items;
  const totals = await database().coinOperation.groupBy({ by: ["postId"], where: { kind: "POST_GIFT", postId: { in: items.map(row => row.id) } }, _sum: { amount: true } });
  return items.map(row => ({ ...row, receivedCoins: (totals.find(item => item.postId === row.id)?._sum.amount ?? BigInt(0)).toString() }));
}
export async function posts(parameters: URLSearchParams) {
  const query = timelineQuery(parameters, "posts");
  const viewer = await optionalActor();
  if (query.topic && !await database().topic.findFirst({ where: { id: query.topic, active: true }, select: { id: true } })) throw new ApiProblem(404, "NOT_FOUND", "话题不存在或暂不可用。");
  const where: Prisma.PostWhereInput = {
    visibility: "VISIBLE", ...(query.topic ? { topics: { some: { topicId: query.topic } } } : {}), ...(query.person ? { personId: query.person } : {}), author: { ...authorFilter(viewer), ...(query.author ? { handle: query.author } : {}) },
    AND: [
      ...(query.after ? [{ OR: [{ createdAt: { lt: query.after.at } }, { createdAt: query.after.at, id: { lt: query.after.id } }] }] : []),
      ...(query.q ? [{ OR: [{ body: { contains: query.q, mode: "insensitive" as const } }, { person: { name: { contains: query.q, mode: "insensitive" as const } } }, { author: { handle: { contains: query.q, mode: "insensitive" as const } } }, { topics: { some: { topic: { active: true, name: { contains: query.q, mode: "insensitive" as const } } } } }, { poll: { question: { contains: query.q, mode: "insensitive" as const } } }] }] : []),
    ],
  };
  const rows = await database().post.findMany({ where, select: postSelect(viewer), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limit + 1 });
  const items = rows.slice(0, query.limit), hasMore = rows.length > query.limit;
  return { data: await withGiftTotals(items.map(row => postDTO(row, viewer))), page: { limit: query.limit, hasMore, nextCursor: hasMore ? timelineCursor(items.at(-1)!, query, "posts") : null } };
}
export async function post(id: string): Promise<PostDTO> {
  const viewer = await optionalActor();
  const row = await database().post.findFirst({ where: { id, visibility: "VISIBLE", author: authorFilter(viewer) }, select: postSelect(viewer) });
  if (!row) throw new ApiProblem(404, "NOT_FOUND", "帖子不存在或不可见。");
  return (await withGiftTotals([postDTO(row, viewer)]))[0];
}
export async function createPost(request: Request) {
  const body = await inputObject(request, ["personId", "body", "topicIds", "mediaIds", "quotePostId", "poll"]);
  const input: PostInput = { personId: slug(body.personId, "personId"), body: text(body.body, "body", 500), topicIds: ids(body.topicIds ?? [], "topicIds", 3).sort(), mediaIds: ids(body.mediaIds ?? [], "mediaIds", 6, "uuid"), quotePostId: body.quotePostId ? uuid(body.quotePostId) : null, poll: null };
  if (body.quotePostId !== undefined && body.quotePostId !== null && !body.quotePostId) invalid("quotePostId", "引用标识不正确。");
  if (body.poll !== undefined && body.poll !== null) {
    if (typeof body.poll !== "object" || Array.isArray(body.poll)) invalid("poll", "投票格式不正确。");
    const poll = body.poll as Record<string, unknown>;
    if (Object.keys(poll).some(key => !["question", "options", "durationDays"].includes(key)) || !Array.isArray(poll.options) || poll.options.length < 2 || poll.options.length > 4 || ![1, 3, 7].includes(Number(poll.durationDays)) || typeof poll.durationDays !== "number") invalid("poll", "投票需2～4个选项，有效期1、3或7天。");
    const options = poll.options.map(value => text(value, "option", 60, 1));
    if (new Set(options.map(value => value.normalize("NFKC").toLocaleLowerCase())).size !== options.length) invalid("poll", "投票选项不能重复。");
    input.poll = { question: text(poll.question, "question", 100, 1), options, durationDays: poll.durationDays as number };
  }
  if (!input.body && !input.mediaIds.length && !input.quotePostId && !input.poll) invalid("body", "请添加正文、图片、投票或引用。");
  return idempotentCreate(request, "post.create.v1", input, async (tx, actor, id) => {
    await availablePerson(tx, input.personId);
    if (input.quotePostId) await visiblePost(tx, input.quotePostId, false, actor.userId);
    const topics = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM inrole.topics WHERE id=ANY(${input.topicIds}::varchar[]) AND active FOR SHARE`;
    if (topics.length !== input.topicIds.length) throw new ApiProblem(409, "CONFLICT", "话题已停用或不存在。");
    const media = await tx.mediaAsset.findMany({ where: { id: { in: input.mediaIds }, ownerId: actor.userId, purpose: { in: ["POST_IMAGE", "POST_VIDEO"] }, status: "READY", postMedia: null }, select: { id: true, purpose: true } });
    if (media.some(item => item.purpose === "POST_VIDEO") && media.length !== 1) invalid("mediaIds", "视频与图片请分开发帖，每帖最多1个视频。");
    if (media.length !== input.mediaIds.length) throw new ApiProblem(409, "CONFLICT", "图片不可用、已绑定其他帖子或不属于你。");
    const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    await tx.post.create({ data: { id, authorId: actor.userId, personId: input.personId, body: input.body, quotePostId: input.quotePostId, createdAt: clock.now, topics: { create: input.topicIds.map(topicId => ({ topicId })) }, media: { create: input.mediaIds.map((mediaId, position) => ({ mediaId, position })) } } });
    if (input.poll) {
      await tx.poll.create({ data: { postId: id, question: input.poll.question, createdAt: clock.now, endsAt: new Date(clock.now.getTime() + input.poll.durationDays * 86400000) } });
      await tx.pollOption.createMany({ data: input.poll.options.map((option, position) => ({ postId: id, text: option, normalizedText: option.normalize("NFKC").toLocaleLowerCase(), position })) });
      await tx.poll.update({ where: { postId: id }, data: { sealed: true }, select: { postId: true } });
    }
    await rememberPerson(tx, actor.userId, input.personId);
  });
}
export async function deletePost(request: Request, id: string) {
  return communityWrite(request, "content", async (tx, actor) => {
    const row = await tx.post.findUnique({ where: { id }, select: { authorId: true, visibility: true } });
    if (!row) throw new ApiProblem(404, "NOT_FOUND", "帖子不存在。");
    if (row.authorId !== actor.userId) throw new ApiProblem(403, "FORBIDDEN", "只能删除自己的帖子。");
    if (row.visibility === "HIDDEN") throw new ApiProblem(403, "FORBIDDEN", "该内容已由管理员处理。");
    await tx.post.update({ where: { id }, data: { visibility: "DELETED", body: "" }, select: { id: true } });
    return { id };
  });
}
export async function comments(postId: string, parameters: URLSearchParams) {
  const viewer = await optionalActor();
  if (!await database().post.findFirst({ where: { id: postId, visibility: "VISIBLE", author: authorFilter(viewer) }, select: { id: true } })) throw new ApiProblem(404, "NOT_FOUND", "帖子不存在或不可见。");
  const query = timelineQuery(parameters, `comments:${postId}`, []);
  const rows = await database().comment.findMany({ where: { postId, visibility: "VISIBLE", author: authorFilter(viewer), post: { visibility: "VISIBLE" }, ...(query.after ? { OR: [{ createdAt: { lt: query.after.at } }, { createdAt: query.after.at, id: { lt: query.after.id } }] } : {}) }, include: { author: { select: authorSelect }, person: { select: figureSelect } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limit + 1 });
  const items = rows.slice(0, query.limit), hasMore = rows.length > query.limit;
  const data: CommentDTO[] = items.map(row => ({ id: row.id, body: row.body, createdAt: row.createdAt.toISOString(), author: row.author, person: figureDTO(row.person), mine: row.authorId === viewer?.userId }));
  return { data, page: { limit: query.limit, hasMore, nextCursor: hasMore ? timelineCursor(items.at(-1)!, query, `comments:${postId}`) : null } };
}
export async function createComment(request: Request, postId: string) {
  const body = await inputObject(request, ["personId", "body"]);
  const input = { postId, personId: slug(body.personId, "personId"), body: text(body.body, "body", 500, 1) };
  return idempotentCreate(request, "comment.create.v1", input, async (tx, actor, id) => {
    await visiblePost(tx, postId, false, actor.userId); await availablePerson(tx, input.personId);
    await tx.comment.create({ data: { id, postId, authorId: actor.userId, personId: input.personId, body: input.body } });
    await rememberPerson(tx, actor.userId, input.personId);
  });
}
export async function deleteComment(request: Request, id: string) {
  return communityWrite(request, "content", async (tx, actor) => {
    const row = await tx.comment.findUnique({ where: { id }, select: { authorId: true, visibility: true, postId: true } });
    if (!row) throw new ApiProblem(404, "NOT_FOUND", "评论不存在。");
    if (row.authorId !== actor.userId) throw new ApiProblem(403, "FORBIDDEN", "只能删除自己的评论。");
    if (row.visibility === "HIDDEN") throw new ApiProblem(403, "FORBIDDEN", "该内容已由管理员处理。");
    await tx.comment.update({ where: { id }, data: { visibility: "DELETED", body: "[已删除]" }, select: { id: true } });
    return { id };
  });
}
export async function like(request: Request, id: string) {
  const body = await inputObject(request, ["liked"]);
  if (typeof body.liked !== "boolean") invalid("liked", "需要明确点赞状态。");
  return communityWrite(request, "content", async (tx, actor) => {
    await visiblePost(tx, id, false, actor.userId);
    if (body.liked) await tx.postLike.upsert({ where: { userId_postId: { userId: actor.userId, postId: id } }, create: { userId: actor.userId, postId: id }, update: {} });
    else await tx.postLike.deleteMany({ where: { userId: actor.userId, postId: id } });
    return { liked: body.liked };
  });
}
export async function vote(request: Request, id: string) {
  const body = await inputObject(request, ["optionId"]), optionId = uuid(body.optionId, "optionId");
  return communityWrite(request, "vote", async (tx, actor) => {
    await visiblePost(tx, id, false, actor.userId);
    const rows = await tx.$queryRaw<{ postId: string }[]>`SELECT "postId" FROM inrole.polls WHERE "postId"=${id}::uuid AND sealed AND "endsAt">clock_timestamp() FOR SHARE`;
    if (!rows.length) throw new ApiProblem(409, "CONFLICT", "投票已截止或不可用。");
    if (!await tx.pollOption.findFirst({ where: { id: optionId, postId: id }, select: { id: true } })) invalid("optionId", "选项不属于这份投票。");
    const existing = await tx.pollVote.findUnique({ where: { userId_postId: { userId: actor.userId, postId: id } } });
    if (existing && existing.optionId !== optionId) throw new ApiProblem(409, "CONFLICT", "你已投票，不能改选。");
    if (!existing) await tx.pollVote.create({ data: { userId: actor.userId, postId: id, optionId } });
    return { optionId };
  });
}
export async function publicUser(handle: string) {
  const user = await database().user.findFirst({ where: { handle, status: "ACTIVE" }, select: { handle: true, displayName: true, bio: true } });
  if (!user) throw new ApiProblem(404, "NOT_FOUND", "用户不存在或暂不可用。");
  return user;
}
