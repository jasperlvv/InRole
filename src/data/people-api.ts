import type { ApiResult, PersonDTO, PageInfo } from "@/lib/api-types";

export class ApiRequestError extends Error {
  constructor(public code: string, message: string, public requestId?: string) { super(message); }
}
export const databasePeopleReader = {
  async list(input: { q?: string; cursor?: string; signal: AbortSignal }): Promise<{ items: PersonDTO[]; page: PageInfo }> {
    const parameters = new URLSearchParams({ limit: "12" });
    if (input.q) parameters.set("q", input.q);
    if (input.cursor) parameters.set("cursor", input.cursor);
    let response: Response;
    try { response = await fetch(`/api/v1/people?${parameters}`, { cache: "no-store", credentials: "same-origin", signal: input.signal }); }
    catch (error) {
      if (input.signal.aborted) throw error;
      throw new ApiRequestError("NETWORK_ERROR", "暂时连接不上服务，请检查网络后重试。");
    }
    let result: ApiResult<PersonDTO[]>;
    try { result = await response.json(); }
    catch { throw new ApiRequestError("INVALID_RESPONSE", "服务返回了无法读取的结果，请重试。"); }
    if (!result.ok) throw new ApiRequestError(result.error.code, result.error.message, result.meta?.requestId);
    if (!response.ok || result.meta?.source !== "database" || !Array.isArray(result.data) || !result.meta.page) throw new ApiRequestError("INVALID_RESPONSE", "服务返回了无法读取的结果，请重试。");
    return { items: result.data, page: result.meta.page };
  },
};
