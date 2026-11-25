import { apiRoute, optionsFor } from "@/server/http";
import { generateCodes } from "@/server/recovery";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = apiRoute(["POST"], async request => ({ data: await generateCodes(request) }));
export const OPTIONS = optionsFor(["POST"]);
