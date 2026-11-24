export type PersonDTO = {
  id: string;
  name: string;
  aliases: string[];
  bio: string;
  interest: { id: string; name: string };
  avatarUrl: string | null;
};
export type PageInfo = { limit: number; hasMore: boolean; nextCursor: string | null };
export type ApiMeta = { requestId: string; source: "database"; page?: PageInfo };
export type ApiErrorCode = "BAD_REQUEST" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "METHOD_NOT_ALLOWED" | "CONFLICT" | "RATE_LIMITED" | "SERVICE_UNAVAILABLE" | "INTERNAL_ERROR";
export type ApiResult<T> =
  | { ok: true; data: T; meta: ApiMeta }
  | { ok: false; error: { code: ApiErrorCode; message: string; fields?: Record<string, string> }; meta: { requestId: string } };
