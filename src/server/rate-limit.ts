import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { database } from "./database";
import { ApiProblem } from "./errors";
import { sessionPassword } from "./session";

type Action = "register" | "login" | "password" | "profile" | "content" | "preferences" | "media" | "review" | "vote" | "recovery";
export async function consumeAuthLimit(action: Action, identity: string, request: Request) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32 || secret === sessionPassword()) throw new ApiProblem(503, "SERVICE_UNAVAILABLE", "账号限流服务尚未正确配置。");
  const header = process.env.TRUSTED_CLIENT_IP_HEADER || "";
  let client = "shared";
  if (header) {
    if (!["x-real-ip", "cf-connecting-ip", "x-vercel-forwarded-for"].includes(header)) throw new ApiProblem(503, "SERVICE_UNAVAILABLE", "访问来源配置不可用。");
    const value = request.headers.get(header)?.trim() || "";
    if (!isIP(value)) throw new ApiProblem(503, "SERVICE_UNAVAILABLE", "无法确认可信代理提供的访问来源。");
    client = value;
  }
  const globalLimit = action === "register" ? { seconds: 3600, max: 60 } : { seconds: 60, max: 120 };
  const policies = [
    { scope: `auth.${action}.global.v1`, identity: "global", ...globalLimit },
    { scope: `auth.${action}.account.v1`, identity, seconds: action === "register" ? 3600 : 900, max: action === "register" ? 3 : action === "password" ? 5 : ["login", "recovery"].includes(action) ? 8 : action === "media" ? 10 : 30 },
    ...(header ? [{ scope: `auth.${action}.client.v1`, identity: client, seconds: action === "register" ? 3600 : 900, max: action === "register" ? 10 : 30 }] : []),
  ];
  await database().$transaction(async tx => {
    const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    let cleanup = false;
    for (const policy of policies) {
      const key = createHmac("sha256", secret).update(`${policy.scope}\0${policy.identity}`).digest("hex");
      const start = new Date(Math.floor(clock.now.getTime() / (policy.seconds * 1000)) * policy.seconds * 1000);
      const end = new Date(start.getTime() + policy.seconds * 1000);
      const rows = await tx.$queryRaw<{ count: number }[]>`
        INSERT INTO inrole.rate_limit_buckets (scope,"keyHash","windowStart",count,"expiresAt")
        VALUES (${policy.scope},${key},${start},1,${end})
        ON CONFLICT (scope,"keyHash","windowStart") DO UPDATE
          SET count = inrole.rate_limit_buckets.count + 1 WHERE inrole.rate_limit_buckets.count < ${policy.max}
        RETURNING count`;
      if (!rows.length) throw new ApiProblem(429, "RATE_LIMITED", "尝试过于频繁，请稍后再试。", undefined, Math.max(1, Math.ceil((end.getTime() - clock.now.getTime()) / 1000)));
      if (policy.identity === "global" && rows[0].count === 1) cleanup = true;
    }
    if (cleanup) await tx.$executeRaw`
      WITH expired AS (
        SELECT scope,"keyHash","windowStart" FROM inrole.rate_limit_buckets
        WHERE "expiresAt" < ${clock.now} ORDER BY "expiresAt" LIMIT 1000 FOR UPDATE SKIP LOCKED
      ) DELETE FROM inrole.rate_limit_buckets b USING expired e
        WHERE b.scope=e.scope AND b."keyHash"=e."keyHash" AND b."windowStart"=e."windowStart"`;
  }, { maxWait: 5000, timeout: 10000 });
}
