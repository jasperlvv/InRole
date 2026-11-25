import "server-only";
import { ApiProblem, invalid } from "./errors";

export function requireTrustedOrigin(request: Request) {
  let trusted: URL;
  try {
    const raw = process.env.APP_ORIGIN || "";
    trusted = new URL(raw);
    if (!["http:", "https:"].includes(trusted.protocol) || trusted.origin !== raw || trusted.username || trusted.password) throw new Error();
    if (process.env.NODE_ENV === "production" && trusted.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(trusted.hostname)) throw new Error();
  } catch { throw new ApiProblem(503, "SERVICE_UNAVAILABLE", "网站来源尚未正确配置。"); }
  if (request.headers.get("origin") !== trusted.origin || ["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") || "")) throw new ApiProblem(403, "FORBIDDEN", "请求来源不被允许。");
}
export async function requestBytes(request: Request, maximum: number): Promise<Buffer> {
  if (Number(request.headers.get("content-length")) > maximum) throw new ApiProblem(413, "PAYLOAD_TOO_LARGE", "提交内容过大。");
  const reader = request.body?.getReader();
  if (!reader) invalid("body", "缺少请求内容。");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximum) { await reader.cancel(); throw new ApiProblem(413, "PAYLOAD_TOO_LARGE", "提交内容过大。"); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function inputObject(request: Request, allowed: string[], maximum = 16384): Promise<Record<string, unknown>> {
  if (new URL(request.url).search) invalid("query", "此操作不接受查询参数。");
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get("content-type") || "")) throw new ApiProblem(415, "UNSUPPORTED_MEDIA_TYPE", "请提交 JSON 数据。");
  const bytes = await requestBytes(request, maximum);
  let body: unknown;
  try { body = JSON.parse(bytes.toString("utf8")); }
  catch { invalid("body", "JSON 格式不正确。"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) invalid("body", "请求内容必须是对象。");
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some(key => !allowed.includes(key))) invalid("body", "包含不允许的字段。");
  return record;
}
export async function jsonObject(request: Request, allowed: string[], required: string[] = allowed): Promise<Record<string, string>> {
  const record = await inputObject(request, allowed, 2048);
  for (const field of required) if (typeof record[field] !== "string") invalid(field, "此字段必须填写。");
  for (const value of Object.values(record)) if (typeof value !== "string") invalid("body", "字段类型不正确。");
  return record as Record<string, string>;
}
