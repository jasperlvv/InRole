import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { ApiProblem } from "./errors";

const globalDatabase = globalThis as unknown as { inroleDatabase?: PrismaClient };
export function database() {
  if (globalDatabase.inroleDatabase) return globalDatabase.inroleDatabase;
  const value = process.env.DATABASE_URL;
  if (!value) throw new ApiProblem(503, "SERVICE_UNAVAILABLE", "数据服务尚未配置。");
  try {
    const parsed = new URL(value);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || !parsed.username || ["inrole_migrator", "inrole_bootstrap"].includes(parsed.username)) throw new Error("Invalid runtime connection");
  } catch { throw new ApiProblem(503, "SERVICE_UNAVAILABLE", "数据服务配置不可用。"); }
  globalDatabase.inroleDatabase = new PrismaClient({ adapter: new PrismaPg({ connectionString: value, max: 5, connectionTimeoutMillis: 2000, idleTimeoutMillis: 10000, statement_timeout: 5000 }) });
  return globalDatabase.inroleDatabase;
}
