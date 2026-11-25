import type { ApiResult, AccountDTO, ApiMeta } from "@/lib/api-types";

export class AuthRequestError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>, public retryAfter?: number, public requestId?: string) { super(message); }
}
export async function authEnvelope<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal, extraHeaders?: Record<string, string>): Promise<{ data: T; meta: ApiMeta }> {
  let response: Response;
  try {
    const multipart = body instanceof FormData;
    const timeout = AbortSignal.timeout(multipart ? 30000 : 15000);
    response = await fetch(path, { method, cache: "no-store", credentials: "same-origin", signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headers: { ...(body !== undefined && !multipart ? { "Content-Type": "application/json" } : {}), ...extraHeaders }, ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}) });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AuthRequestError(0, "NETWORK_ERROR", "暂时连接不上服务，请重试。操作结果请以重新登录后显示的账号状态为准。");
  }
  let result: ApiResult<T>;
  try { result = await response.json(); }
  catch { throw new AuthRequestError(response.status, "INVALID_RESPONSE", "服务返回异常，请稍后再试。"); }
  if (!result?.ok) throw new AuthRequestError(response.status, result?.error?.code || "INVALID_RESPONSE", result?.error?.message || "请求失败，请重试。", result?.error?.fields, Number(response.headers.get("retry-after")) || undefined, result?.meta?.requestId);
  if (!response.ok || result.meta.source !== "database") throw new AuthRequestError(response.status, "INVALID_RESPONSE", "服务返回异常，请稍后再试。");
  return { data: result.data, meta: result.meta };
}
export async function authRequest<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal, extraHeaders?: Record<string, string>): Promise<T> { return (await authEnvelope<T>(path, method, body, signal, extraHeaders)).data; }
export const readAccount = (signal?: AbortSignal) => authRequest<AccountDTO>("/api/v1/me", "GET", undefined, signal);
