import { readOptions, readRoute } from "@/server/http";
import { readPerson } from "@/server/people";
import { invalid } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ personId: string }> }) {
  return readRoute("public", async () => {
    const { personId } = await context.params;
    if (!/^[a-z0-9-]{1,64}$/.test(personId)) invalid("personId", "人物 ID 不正确。");
    if (new URL(request.url).search) invalid("query", "此接口不支持查询参数。");
    return { data: await readPerson(personId) };
  })(request);
}
const unsupported = readRoute("public", async () => ({ data: null }));
export const POST = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
export const OPTIONS = readOptions;
