import "server-only";
import { createHash } from "node:crypto";
import { invalid } from "./errors";

export type PeopleQuery = { q: string; interest: string; limit: number; after: string | null; filter: string };
export function peopleQuery(parameters: URLSearchParams): PeopleQuery {
  for (const key of parameters.keys()) {
    if (!["q", "interest", "limit", "cursor"].includes(key)) invalid(key, "不支持的参数。");
    if (parameters.getAll(key).length !== 1) invalid(key, "参数不能重复。");
  }
  const q = (parameters.get("q") || "").trim();
  const interest = parameters.get("interest") || "";
  const rawLimit = parameters.get("limit") ?? "20";
  if (Array.from(q).length > 80) invalid("q", "关键词最多 80 个字符。");
  if (interest && !/^[a-z0-9-]{1,64}$/.test(interest)) invalid("interest", "分类 ID 不正确。");
  if (!/^[1-9]\d?$/.test(rawLimit) || Number(rawLimit) > 50) invalid("limit", "每页数量需为 1～50 的整数。");
  const filter = createHash("sha256").update(JSON.stringify({ q, interest })).digest("hex");
  let after: string | null = null;
  if (parameters.has("cursor")) {
    const raw = parameters.get("cursor")!;
    try {
      if (!/^[A-Za-z0-9_-]{1,768}$/.test(raw)) throw new Error();
      const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
      if (parsed.v !== 1 || parsed.scope !== "people" || parsed.filter !== filter || typeof parsed.id !== "string" || !/^[a-z0-9-]{1,64}$/.test(parsed.id) || Object.keys(parsed).sort().join(",") !== "filter,id,scope,v") throw new Error();
      after = parsed.id;
    } catch { invalid("cursor", "分页游标无效，或与当前筛选条件不匹配。"); }
  }
  return { q, interest, limit: Number(rawLimit), after, filter };
}
export function peopleCursor(id: string, filter: string) {
  return Buffer.from(JSON.stringify({ v: 1, scope: "people", id, filter })).toString("base64url");
}
export function idempotencyKey(request: Request): string {
  const value = request.headers.get("idempotency-key") || "";
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(value)) invalid("Idempotency-Key", "需要 16～100 位字母、数字、下划线或连字符的幂等键。");
  return value;
}
