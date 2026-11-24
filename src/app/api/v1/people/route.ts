import { readOptions, readRoute } from "@/server/http";
import { peopleQuery } from "@/server/contracts";
import { listPeople } from "@/server/people";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = readRoute("public", async request => listPeople(peopleQuery(new URL(request.url).searchParams)));
export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const OPTIONS = readOptions;
