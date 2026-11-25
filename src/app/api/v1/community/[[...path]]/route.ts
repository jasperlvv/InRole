import { blockedUsers, setBlock } from "@/server/account-controls";
import { apiRoute, optionsFor } from "@/server/http";
import { authorizeWrite } from "@/server/authorization";
import { catalog, preferences, savePreferences } from "@/server/preferences";
import * as content from "@/server/posts";
import { reviews, saveReview, reviewRankings } from "@/server/reviews";
import { upload, readMedia } from "@/server/media";
import { slug, uuid } from "@/server/community-input";
import { ApiProblem, invalid } from "@/server/errors";
import { claim, wallet, spend, coinRankings, personCoinStats } from "@/server/wallet";
import { feed, trending } from "@/server/discovery";
import { ownActivity, characterRequest, report, adminDashboard, administer } from "@/server/management";
import { personSources } from "@/server/people";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function methods(path: string[]) {
  const pattern = path.map((value, index) => index % 2 === 1 ? ":id" : value).join("/");
  const options: Record<string, string[]> = { catalog: ["GET"], preferences: ["GET", "PUT"], posts: ["GET", "POST"], "posts/:id": ["GET", "DELETE"], "posts/:id/comments": ["GET", "POST"], "posts/:id/like": ["PUT"], "posts/:id/vote": ["POST"], "comments/:id": ["DELETE"], "people/:id/reviews": ["GET"], "people/:id/review": ["PUT", "DELETE"], rankings: ["GET"], "users/:id": ["GET"], media: ["POST"], "media/:id": ["GET"] };
  Object.assign(options, { feed: ["GET"], trending: ["GET"], wallet: ["GET"], claim: ["POST"], activity: ["GET"], requests: ["POST"], reports: ["POST"], admin: ["GET", "POST"], "people/:id/sources": ["GET"], "people/:id/tip": ["POST"], "posts/:id/gift": ["POST"], "coins/:id": ["GET"] });
  options.blocks = ["GET"]; options["blocks/:id"] = ["PUT", "DELETE"];
  options["people/:id/coins"] = ["GET"];
  const value = options[pattern] || [];
  return value.includes("GET") ? [...value, "HEAD"] : value;
}
async function handle(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path || [], [resource, id, child] = path;
  const allowed = methods(path);
  if (request.method === "OPTIONS") return optionsFor(allowed)();
  if (resource === "media" && path.length === 2 && ["GET", "HEAD"].includes(request.method)) {
    try { return await readMedia(request, uuid(id)); }
    catch (error) { return apiRoute<never>(allowed, async () => { throw error; })(request); }
  }
  return apiRoute<unknown>(allowed, async req => {
    const method = req.method === "HEAD" ? "GET" : req.method;
    if (method !== "GET") await authorizeWrite(req);
    const parameters = new URL(req.url).searchParams;
    if (["catalog", "preferences", "rankings", "media", "activity", "admin"].includes(resource) && parameters.size) invalid("query", "此接口不接受查询参数。");
    if (resource === "blocks" && parameters.size) invalid("query", "不接受查询参数。");
    if (resource === "blocks" && path.length === 2) { if (!/^[a-z0-9_]{3,20}$/.test(id)) invalid("handle", "账号不正确。"); return { data: await setBlock(req, id, method === "DELETE") }; }
    if (path.length === 1) {
      if (resource === "blocks") return { data: await blockedUsers() };
      if (resource === "feed") return { data: await feed(parameters) };
      if (resource === "trending") return { data: await trending(parameters) };
      if (resource === "wallet") return wallet(parameters);
      if (resource === "claim") return { data: await claim(req) };
      if (resource === "activity") return { data: await ownActivity() };
      if (resource === "requests") return { data: await characterRequest(req), status: 201 };
      if (resource === "reports") return { data: await report(req), status: 201 };
      if (resource === "admin") return { data: method === "GET" ? await adminDashboard() : await administer(req) };
      if (resource === "catalog") return { data: await catalog() };
      if (resource === "preferences") return { data: method === "GET" ? await preferences() : await savePreferences(req) };
      if (resource === "rankings") return { data: await reviewRankings() };
      if (resource === "media") return { data: await upload(req), status: 201 };
      if (resource === "posts") return method === "GET" ? content.posts(parameters) : { data: await content.createPost(req), status: 201 };
    }
    if (resource === "posts" && path.length >= 2 && path.length <= 3) {
      const postId = uuid(id);
      if (!child) return { data: method === "GET" ? await content.post(postId) : await content.deletePost(req, postId) };
      if (child === "comments") return method === "GET" ? content.comments(postId, parameters) : { data: await content.createComment(req, postId), status: 201 };
      if (child === "like") return { data: await content.like(req, postId) };
      if (child === "vote") return { data: await content.vote(req, postId) };
      if (child === "gift") return { data: await spend(req, { postId }) };
    }
    if (resource === "comments" && path.length === 2) return { data: await content.deleteComment(req, uuid(id)) };
    if (resource === "people" && path.length === 3) {
      const personId = slug(id);
      if (child === "coins") { if (parameters.size) invalid("query", "不接受查询参数。"); return { data: await personCoinStats(personId) }; }
      if (child === "sources") { if (parameters.size) invalid("query", "不接受查询参数。"); return { data: await personSources(personId) }; }
      if (child === "reviews") return reviews(personId, parameters);
      if (child === "review") return { data: await saveReview(req, personId, method === "DELETE") };
      if (child === "tip") return { data: await spend(req, { personId }) };
    }
    if (resource === "users" && path.length === 2) {
      if (!/^[a-z0-9_]{3,20}$/.test(id) || parameters.size) invalid("handle", "账号不正确。");
      return { data: await content.publicUser(id) };
    }
    if (resource === "coins" && path.length === 2) {
      if (!["today", "all"].includes(id) || parameters.size) invalid("query", "榜单参数无效。");
      return { data: await coinRankings(id === "today") };
    }
    throw new ApiProblem(404, "NOT_FOUND", "接口不存在。");
  })(request);
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;
export const HEAD = handle;
export const OPTIONS = handle;
