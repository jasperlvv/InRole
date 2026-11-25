import "server-only";
import { database } from "./database";
import { authorize } from "./authorization";
import { communityWrite } from "./community-write";
import { inputObject } from "./request-security";
import { ids } from "./community-input";
import { invalid, ApiProblem } from "./errors";
import type { PreferencesDTO, CatalogDTO } from "@/lib/community-types";

export async function catalog(): Promise<CatalogDTO> {
  const [interests, topics] = await Promise.all([
    database().interestTag.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { id: "asc" } }),
    database().topic.findMany({ where: { active: true }, select: { id: true, name: true, description: true }, orderBy: { id: "asc" } }),
  ]);
  return { interests, topics };
}
export async function preferences(): Promise<PreferencesDTO> {
  const actor = (await authorize("user"))!;
  const user = await database().user.findUniqueOrThrow({ where: { id: actor.userId }, select: { onboardingCompletedAt: true, interests: { select: { interestId: true }, orderBy: { interestId: "asc" } }, recentPeople: { select: { personId: true }, orderBy: [{ lastUsedAt: "desc" }, { personId: "asc" }], take: 4 } } });
  return { interestIds: user.interests.map(item => item.interestId), onboardingComplete: user.onboardingCompletedAt !== null, recentPeople: user.recentPeople.map(item => item.personId) };
}
export async function savePreferences(request: Request) {
  const body = await inputObject(request, ["interestIds", "finishOnboarding"]);
  const selected = ids(body.interestIds, "interestIds", 5).sort();
  if (typeof body.finishOnboarding !== "boolean") invalid("finishOnboarding", "需要明确是否完成引导。");
  return communityWrite(request, "preferences", async (tx, actor) => {
    const tags = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM inrole.interest_tags WHERE id=ANY(${selected}::varchar[]) AND active FOR SHARE`;
    if (tags.length !== selected.length) throw new ApiProblem(409, "CONFLICT", "部分兴趣已停用，请刷新后重新选择。");
    await tx.userInterest.deleteMany({ where: { userId: actor.userId } });
    if (selected.length) await tx.userInterest.createMany({ data: selected.map(interestId => ({ userId: actor.userId, interestId })) });
    const user = await tx.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { onboardingCompletedAt: true } });
    if (body.finishOnboarding && !user.onboardingCompletedAt) await tx.user.update({ where: { id: actor.userId }, data: { onboardingCompletedAt: new Date() }, select: { id: true } });
    return { interestIds: selected, onboardingComplete: Boolean(body.finishOnboarding || user.onboardingCompletedAt) };
  }, false);
}
