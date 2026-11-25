import { apiRoute, optionsFor, readRoute } from "@/server/http";
import { database } from "@/server/database";
import { invalid } from "@/server/errors";
import { updateOwnProfile } from "@/server/authentication";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = readRoute("user", async (request, actor) => {
  if (new URL(request.url).search) invalid("query", "当前账号由服务端会话确定，不能指定其他账号。");
  const user = await database().user.findUniqueOrThrow({ where: { id: actor!.userId }, select: { handle: true, displayName: true, bio: true, onboardingCompletedAt: true } });
  return { data: { handle: user.handle, displayName: user.displayName, bio: user.bio, onboardingComplete: user.onboardingCompletedAt !== null } };
});
const unsupported = apiRoute(["GET", "HEAD", "PATCH"], async () => ({ data: null }));
export const POST = unsupported;
export const PUT = unsupported;
export const PATCH = apiRoute(["PATCH"], async request => ({ data: await updateOwnProfile(request) }));
export const DELETE = unsupported;
export const OPTIONS = optionsFor(["GET", "HEAD", "PATCH"]);
