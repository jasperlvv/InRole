import "server-only";
import { randomUUID } from "node:crypto";
import type { ApiResult, PageInfo } from "@/lib/api-types";
import { authorize, type Access, type Actor } from "./authorization";
import { ApiProblem, toProblem } from "./errors";

type RouteResult<T> = { data: T; page?: PageInfo };
export function readOptions() {
  return new Response(null, { status: 204, headers: { Allow: "GET, HEAD, OPTIONS", "Cache-Control": "no-store", "X-Request-Id": randomUUID() } });
}
export function readRoute<T>(access: Access, handler: (request: Request, actor: Actor | null) => Promise<RouteResult<T>>) {
  return async (request: Request) => {
    const requestId = randomUUID();
    const headers = { "Cache-Control": "no-store", "X-Request-Id": requestId, "X-Content-Type-Options": "nosniff" };
    try {
      if (!["GET", "HEAD"].includes(request.method)) throw new ApiProblem(405, "METHOD_NOT_ALLOWED", "此接口仅支持读取。");
      const actor = await authorize(access);
      const result = await handler(request, actor);
      const body: ApiResult<T> = { ok: true, data: result.data, meta: { requestId, source: "database", ...(result.page ? { page: result.page } : {}) } };
      return new Response(request.method === "HEAD" ? null : JSON.stringify(body), { status: 200, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
    } catch (error) {
      const problem = toProblem(error);
      if (problem.status >= 500) console.error(JSON.stringify({ component: "api", requestId, code: problem.code }));
      const body: ApiResult<never> = { ok: false, error: { code: problem.code, message: problem.message, ...(problem.fields ? { fields: problem.fields } : {}) }, meta: { requestId } };
      return new Response(request.method === "HEAD" ? null : JSON.stringify(body), { status: problem.status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8", ...(problem.status === 405 ? { Allow: "GET, HEAD, OPTIONS" } : {}), ...(problem.status === 503 ? { "Retry-After": "5" } : {}) } });
    }
  };
}
