import { apiRoute, optionsFor } from "@/server/http";
import { eraseAccount } from "@/server/account-controls";
const allowed = ["POST"];
const handle = apiRoute(allowed, async request => ({ data: await eraseAccount(request) }));
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const OPTIONS = optionsFor(allowed);
