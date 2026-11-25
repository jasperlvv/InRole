import "server-only";
import { createHash } from "node:crypto";
import { invalid } from "./errors";

export function text(value: unknown, field: string, maximum: number, minimum = 0) {
  if (typeof value !== "string" || Array.from(value).length > maximum || Array.from(value.trim()).length < minimum) invalid(field, `${field} 长度需为 ${minimum}～${maximum} 个字符。`);
  return value.trim();
}
export function slug(value: unknown, field = "id") {
  if (typeof value !== "string" || !/^[a-z0-9-]{1,64}$/.test(value)) invalid(field, "标识不正确。");
  return value;
}
export function uuid(value: unknown, field = "id") {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) invalid(field, "标识不正确。");
  return value.toLowerCase();
}
export function ids(value: unknown, field: string, maximum: number, kind: "uuid" | "slug" = "slug") {
  if (!Array.isArray(value) || value.length > maximum) invalid(field, `最多选择 ${maximum} 项。`);
  const result = value.map(item => kind === "uuid" ? uuid(item, field) : slug(item, field));
  if (new Set(result).size !== result.length) invalid(field, "不能重复选择。");
  return result;
}
export const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export type TimelineQuery = { q: string; topic: string; person: string; author: string; limit: number; filter: string; after: { id: string; at: Date } | null };
export function timelineQuery(parameters: URLSearchParams, scope: string, filters: string[] = ["q", "topic", "person", "author"]): TimelineQuery {
  for (const key of parameters.keys()) if (![...filters, "limit", "cursor"].includes(key) || parameters.getAll(key).length !== 1) invalid(key, "参数不支持或重复。");
  const q = text(parameters.get("q") || "", "q", 80);
  const topic = parameters.get("topic") || "", person = parameters.get("person") || "", author = parameters.get("author") || "";
  if (topic) slug(topic); if (person) slug(person);
  if (author && !/^[a-z0-9_]{3,20}$/.test(author)) invalid("author", "账号不正确。");
  const raw = parameters.get("limit") ?? "20";
  if (!/^[1-9]\d?$/.test(raw) || Number(raw) > 50) invalid("limit", "每页数量需为 1～50。");
  const filter = digest({ q, topic, person, author });
  let after: TimelineQuery["after"] = null;
  if (parameters.has("cursor")) {
    try {
      const rawCursor = parameters.get("cursor")!;
      if (!/^[A-Za-z0-9_-]{1,768}$/.test(rawCursor)) throw new Error();
      const value = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8"));
      if (value.v !== 1 || value.scope !== scope || value.filter !== filter || typeof value.at !== "string" || new Date(value.at).toISOString() !== value.at) throw new Error();
      after = { id: uuid(value.id), at: new Date(value.at) };
    } catch { invalid("cursor", "分页游标无效或筛选条件已变化。"); }
  }
  return { q, topic, person, author, limit: Number(raw), filter, after };
}
export function timelineCursor(row: { id: string; createdAt: Date }, query: TimelineQuery, scope: string) {
  return Buffer.from(JSON.stringify({ v: 1, scope, filter: query.filter, id: row.id, at: row.createdAt.toISOString() })).toString("base64url");
}
