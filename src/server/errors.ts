import "server-only";
import type { ApiErrorCode } from "@/lib/api-types";

export class ApiProblem extends Error {
  constructor(public status: number, public code: ApiErrorCode, message: string, public fields?: Record<string, string>, public retryAfter?: number) { super(message); }
}
export function invalid(field: string, message: string): never {
  throw new ApiProblem(400, "BAD_REQUEST", "请求参数不正确。", { [field]: message });
}
function failureCodes(value: unknown, depth = 0): string[] {
  if (!value || typeof value !== "object" || depth > 6) return [];
  const record = value as Record<string, unknown>;
  return [record.code, record.originalCode, record.kind].filter((item): item is string => typeof item === "string")
    .concat(["cause", "meta", "driverAdapterError", "error"].flatMap(key => failureCodes(record[key], depth + 1)));
}
export function hasDatabaseCode(error: unknown, code: string) { return failureCodes(error).includes(code); }
export function toProblem(error: unknown): ApiProblem {
  if (error instanceof ApiProblem) return error;
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const codes = failureCodes(error);
  const name = error instanceof Error ? error.name : "";
  // pg may lose the socket between authorization and the transaction; some
  // adapter versions wrap that as a known Prisma error without a SQLSTATE.
  const disconnected = codes.some(value => /^08[A-Z0-9]{3}$/.test(value) || ["EPIPE", "ECONNABORTED"].includes(value))
    || (error instanceof Error && /connection terminated unexpectedly|connection terminated due to connection timeout|client has encountered a connection error|server closed the connection unexpectedly|socket hang up/i.test(error.message));
  if (disconnected) return new ApiProblem(503, "SERVICE_UNAVAILABLE", "数据服务暂时不可用，请稍后重试。");
  if (codes.some(value => ["P1000", "P1001", "P1002", "P1008", "P1010", "P1011", "P1014", "P1017", "P2021", "P2022", "P2024", "P2028", "P2034", "P2037", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "57014", "55P03", "40001", "40P01", "57P01", "42501", "DatabaseNotReachable", "ConnectionClosed", "SocketTimeout", "TlsConnectionError", "AuthenticationFailed", "DatabaseDoesNotExist", "DatabaseAccessDenied", "TooManyConnections"].includes(value)) || ["PrismaClientUnknownRequestError", "PrismaClientInitializationError"].includes(name)) {
    return new ApiProblem(503, "SERVICE_UNAVAILABLE", "数据服务暂时不可用，请稍后重试。");
  }
  if (code === "P2002") return new ApiProblem(409, "CONFLICT", "数据已存在或请求冲突。");
  if (code === "P2025") return new ApiProblem(404, "NOT_FOUND", "内容不存在或不可见。");
  return new ApiProblem(500, "INTERNAL_ERROR", "服务暂时无法完成请求。");
}
