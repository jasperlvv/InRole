import "server-only";
import { authorFilter } from "./blocking";
import { database } from "./database";
import { optionalActor } from "./authorization";
import { postSelect, postDTO, withGiftTotals } from "./posts";
import { invalid } from "./errors";

const zero = "00000000-0000-0000-0000-000000000000";
export async function trending(parameters: URLSearchParams) {
  if ([...parameters.keys()].some(key => key !== "window") || parameters.getAll("window").length > 1) invalid("query", "仅支持window参数。");
  const window = parameters.get("window") || "24h";
  if (!["24h", "7d"].includes(window)) invalid("window", "请选择24h或7d。");
  const viewer = await optionalActor();
  const hours = window === "24h" ? 24 : 168;
  const [posts, topics] = await Promise.all([
    database().$queryRaw<{ id: string; score: number }[]>`
      WITH heat AS (
        SELECT p.id,
          (SELECT count(DISTINCT l."userId") FROM inrole.post_likes l JOIN inrole.app_users u ON u.id=l."userId" WHERE l."postId"=p.id AND l."userId"<>p."authorId" AND u.status='ACTIVE' AND l."createdAt">=clock_timestamp()-make_interval(hours=>${hours}))+
          3*(SELECT count(DISTINCT c."authorId") FROM inrole.comments c JOIN inrole.app_users u ON u.id=c."authorId" WHERE c."postId"=p.id AND c."authorId"<>p."authorId" AND c.visibility='VISIBLE' AND u.status='ACTIVE' AND c."createdAt">=clock_timestamp()-make_interval(hours=>${hours})) AS score
        FROM inrole.posts p WHERE p.visibility='VISIBLE'
      ) SELECT id,score::integer FROM heat WHERE score>0 ORDER BY score DESC,id ASC LIMIT 50`,
    database().$queryRaw<{ id: string; name: string; score: number }[]>`
      WITH scores AS (
        SELECT t.id,t.name,
          2*(SELECT count(DISTINCT p."authorId") FROM inrole.post_topics pt JOIN inrole.posts p ON p.id=pt."postId" JOIN inrole.app_users u ON u.id=p."authorId" WHERE pt."topicId"=t.id AND p.visibility='VISIBLE' AND u.status='ACTIVE' AND p."createdAt">=clock_timestamp()-make_interval(hours=>${hours}))+
          (SELECT count(DISTINCT l."userId") FROM inrole.post_topics pt JOIN inrole.posts p ON p.id=pt."postId" JOIN inrole.post_likes l ON l."postId"=p.id JOIN inrole.app_users u ON u.id=l."userId" WHERE pt."topicId"=t.id AND p.visibility='VISIBLE' AND u.status='ACTIVE' AND l."userId"<>p."authorId" AND l."createdAt">=clock_timestamp()-make_interval(hours=>${hours}))+
          3*(SELECT count(DISTINCT c."authorId") FROM inrole.post_topics pt JOIN inrole.posts p ON p.id=pt."postId" JOIN inrole.comments c ON c."postId"=p.id JOIN inrole.app_users u ON u.id=c."authorId" WHERE pt."topicId"=t.id AND p.visibility='VISIBLE' AND c.visibility='VISIBLE' AND u.status='ACTIVE' AND c."authorId"<>p."authorId" AND c."createdAt">=clock_timestamp()-make_interval(hours=>${hours})) AS score
        FROM inrole.topics t WHERE t.active
      ) SELECT id,name,score::integer FROM scores WHERE score>0 ORDER BY score DESC,id ASC LIMIT 50`,
  ]);
  const rows = await database().post.findMany({ where: { id: { in: posts.map(row => row.id) }, visibility: "VISIBLE", author: authorFilter(viewer) }, select: postSelect(viewer) });
  const enriched = await withGiftTotals(rows.map(row => postDTO(row, viewer)));
  return { window, updatedAt: new Date().toISOString(), posts: posts.flatMap(item => { const row = enriched.find(row => row.id === item.id); return row ? [{ post: row, score: item.score }] : []; }), topics };
}
export async function feed(parameters: URLSearchParams) {
  if (parameters.size) invalid("query", "推荐首页不接受查询参数；搜索和翻页请使用最新列表。");
  const actor = await optionalActor(), userId = actor?.userId || zero;
  const ranked = await database().$queryRaw<{ id: string; matched: boolean; score: number }[]>`
    WITH candidates AS (
      SELECT p.id,p."createdAt", EXISTS(
        SELECT 1 FROM inrole.user_interests ui JOIN inrole.interest_tags i ON i.id=ui."interestId" AND i.active
        WHERE ui."userId"=${userId}::uuid AND (ui."interestId"=figure."primaryInterestId" OR EXISTS(SELECT 1 FROM inrole.person_interests pi WHERE pi."personId"=figure.id AND pi."interestId"=ui."interestId") OR EXISTS(SELECT 1 FROM inrole.post_topics pt JOIN inrole.topic_interests ti ON ti."topicId"=pt."topicId" JOIN inrole.topics t ON t.id=pt."topicId" AND t.active WHERE pt."postId"=p.id AND ti."interestId"=ui."interestId"))
      ) AS matched,
      (SELECT count(*) FROM inrole.post_likes l JOIN inrole.app_users u ON u.id=l."userId" WHERE l."postId"=p.id AND l."userId"<>p."authorId" AND u.status='ACTIVE')+
      3*(SELECT count(DISTINCT c."authorId") FROM inrole.comments c JOIN inrole.app_users u ON u.id=c."authorId" WHERE c."postId"=p.id AND c.visibility='VISIBLE' AND c."authorId"<>p."authorId" AND u.status='ACTIVE') AS heat
      FROM inrole.posts p JOIN inrole.people figure ON figure.id=p."personId" WHERE p.visibility='VISIBLE' AND p."authorId"<>ALL(${actor?.blockedUserIds || []}::uuid[]) ORDER BY p."createdAt" DESC,p.id DESC LIMIT 1000
    ) SELECT id,matched,((CASE WHEN matched THEN 6 ELSE 0 END)+ln(1+heat)+4/(1+greatest(0,extract(epoch FROM clock_timestamp()-"createdAt")/86400)))::double precision AS score
      FROM candidates ORDER BY score DESC,"createdAt" DESC,id DESC LIMIT 100`;
  const selected = ranked.slice(0, 20), selectedIds = new Set(selected.map(row => row.id));
  // Reserve up to two slots for discovery outside selected interests.
  const explore = ranked.filter(row => !row.matched && !selectedIds.has(row.id)).slice(0, 2);
  selected.splice(Math.max(0, selected.length - explore.length), explore.length, ...explore);
  const rows = await database().post.findMany({ where: { id: { in: selected.map(row => row.id) }, visibility: "VISIBLE", author: authorFilter(actor) }, select: postSelect(actor) });
  return { algorithmVersion: "interest-fresh-heat-v1", updatedAt: new Date().toISOString(), posts: await withGiftTotals(selected.flatMap(item => { const row = rows.find(row => row.id === item.id); return row ? [postDTO(row, actor)] : []; })) };
}
