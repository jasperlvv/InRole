import { readOptions, readRoute } from "@/server/http";
import { database } from "@/server/database";
import { invalid } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = readRoute("user", async (request, actor) => {
  if (new URL(request.url).search) invalid("query", "当前账号由服务端会话确定，不能指定其他账号。");
  const user = await database().user.findUniqueOrThrow({ where: { id: actor!.userId }, select: { handle: true, displayName: true, bio: true, onboardingCompletedAt: true } });
  return { data: { handle: user.handle, displayName: user.displayName, bio: user.bio, onboardingComplete: user.onboardingCompletedAt !== null } };
});
export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const OPTIONS = readOptions;
