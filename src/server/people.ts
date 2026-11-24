import "server-only";
import type { PageInfo, PersonDTO } from "@/lib/api-types";
import { database } from "./database";
import { peopleCursor, type PeopleQuery } from "./contracts";
import { ApiProblem } from "./errors";

const personSelect = { id: true, name: true, aliases: true, bio: true, legacyAvatarPath: true, primaryInterest: { select: { id: true, name: true } } } as const;
function personDTO(person: { id: string; name: string; aliases: string[]; bio: string; legacyAvatarPath: string | null; primaryInterest: { id: string; name: string } }): PersonDTO {
  return { id: person.id, name: person.name, aliases: person.aliases, bio: person.bio, interest: person.primaryInterest, avatarUrl: person.legacyAvatarPath && /^\/people\/[a-z0-9-]+\.(webp|png|jpg)$/.test(person.legacyAvatarPath) ? person.legacyAvatarPath : null };
}
export async function listPeople(query: PeopleQuery): Promise<{ data: PersonDTO[]; page: PageInfo }> {
  const rows = await database().person.findMany({
    where: {
      active: true,
      primaryInterest: { active: true },
      ...(query.after ? { id: { gt: query.after } } : {}),
      ...(query.interest ? { primaryInterestId: query.interest } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" as const } }, { bio: { contains: query.q, mode: "insensitive" as const } }, { aliases: { has: query.q } }] } : {}),
    },
    orderBy: { id: "asc" }, take: query.limit + 1, select: personSelect,
  });
  const hasMore = rows.length > query.limit;
  const items = rows.slice(0, query.limit);
  return { data: items.map(personDTO), page: { limit: query.limit, hasMore, nextCursor: hasMore ? peopleCursor(items.at(-1)!.id, query.filter) : null } };
}
export async function readPerson(id: string): Promise<PersonDTO> {
  const person = await database().person.findFirst({ where: { id, active: true, primaryInterest: { active: true } }, select: personSelect });
  if (!person) throw new ApiProblem(404, "NOT_FOUND", "人物不存在或暂不可用。");
  return personDTO(person);
}
