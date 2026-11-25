import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { database } from "./database";
import { authorize, authorizeWrite, optionalActor } from "./authorization";
import { communityWrite } from "./community-write";
import { requestBytes } from "./request-security";
import { ApiProblem, invalid } from "./errors";
import type { ImageDTO } from "@/lib/community-types";
import { inspectVideo } from "./video";

let jobs = 0;
const maximum = 5 * 1024 * 1024;
function mediaRoot() { return path.resolve(/* turbopackIgnore: true */ process.env.MEDIA_STORAGE_ROOT || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), ".local/share"), "InRole", "media")); }
function mediaPath(key: string) {
  if (!/^[a-f0-9-]{36}\.(webp|mp4|webm)$/.test(key)) throw new ApiProblem(503, "SERVICE_UNAVAILABLE", "媒体存储配置不可用。");
  return path.join(mediaRoot(), key);
}
export async function upload(request: Request): Promise<ImageDTO> {
  await authorizeWrite(request);
  if (new URL(request.url).search) invalid("query", "上传不接受查询参数。");
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("multipart/form-data;")) throw new ApiProblem(415, "UNSUPPORTED_MEDIA_TYPE", "请选择图片文件。");
  if (jobs >= 2) throw new ApiProblem(503, "SERVICE_UNAVAILABLE", "图片处理繁忙，请稍后重试。");
  jobs++;
  let saved: string | null = null;
  try {
    const data = await new Response(new Uint8Array(await requestBytes(request, 30 * 1024 * 1024 + 65536)), { headers: { "Content-Type": type } }).formData();
    if ([...data.keys()].some(key => !["file", "purpose"].includes(key)) || data.getAll("file").length !== 1 || data.getAll("purpose").length > 1) invalid("file", "一次上传一张图片。");
    const file = data.get("file");
    if (!(file instanceof File)) invalid("file", "请选择媒体文件。");
    const video = ["video/mp4", "video/webm"].includes(file.type);
    const purpose = data.get("purpose") || (video ? "POST_VIDEO" : "POST_IMAGE");
    if (!["POST_IMAGE", "POST_VIDEO", "PERSON_AVATAR"].includes(String(purpose)) || (video !== (purpose === "POST_VIDEO"))) invalid("purpose", "媒体用途无效。");
    if (purpose === "PERSON_AVATAR") await authorize("admin");
    if (file.size < 1 || file.size > (video ? 30 * 1024 * 1024 : maximum)) invalid("file", "图片限5MiB，视频限30MiB。");
    const formats: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
    const input = Buffer.from(await file.arrayBuffer());
    let output: { data: Buffer; info: { width: number; height: number; durationMs?: number } };
    if (video) output = { data: input, info: await inspectVideo(input, file.type) };
    else {
    try {
      const image = sharp(input, { limitInputPixels: 16000000, failOn: "warning", animated: false });
      const metadata = await image.metadata();
      if (!metadata.format || formats[metadata.format] !== file.type) throw new Error();
      output = await image.rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    } catch { throw new ApiProblem(415, "UNSUPPORTED_MEDIA_TYPE", "文件无法安全解码，请使用有效的JPG、PNG、WebP或GIF图片。"); }
    if (output.data.byteLength > maximum) invalid("file", "处理后的图片过大。");
    }
    const id = randomUUID(), extension = video ? (file.type === "video/mp4" ? "mp4" : "webm") : "webp", key = `${id}.${extension}`;
    await fs.mkdir(mediaRoot(), { recursive: true });
    saved = mediaPath(key);
    await fs.writeFile(saved, output.data, { flag: "wx" });
    const result = await communityWrite(request, "media", async (tx, actor) => {
      if (purpose === "PERSON_AVATAR" && actor.role !== "ADMIN") throw new ApiProblem(403, "FORBIDDEN", "人物头像仅由管理员维护。");
      await tx.mediaAsset.create({ data: { id, ownerId: actor.userId, purpose: purpose as "POST_IMAGE" | "PERSON_AVATAR" | "POST_VIDEO", status: "READY", bucket: "local-private", storageKey: key, originalName: file.name.slice(0, 255), mime: video ? file.type : "image/webp", byteSize: BigInt(output.data.byteLength), width: output.info.width, height: output.info.height, durationMs: output.info.durationMs } });
      return { id, url: `/api/v1/community/media/${id}`, width: output.info.width, height: output.info.height, kind: video ? "video" as const : "image" as const };
    });
    saved = null;
    return result;
  } finally { jobs--; if (saved) await fs.rm(saved, { force: true }); }
}
export async function readMedia(request: Request, id: string) {
  const row = await database().mediaAsset.findUnique({ where: { id }, select: { status: true, purpose: true, mime: true, bucket: true, storageKey: true, ownerId: true, personAvatars: { where: { active: true, primaryInterest: { active: true } }, select: { id: true }, take: 1 }, postMedia: { select: { post: { select: { visibility: true } } } } } });
  if (!row || row.status !== "READY" || row.bucket !== "local-private") throw new ApiProblem(404, "NOT_FOUND", "媒体不存在或不可用。");
  const viewer = await optionalActor();
  if (row.purpose !== "PERSON_AVATAR" && row.ownerId && viewer?.blockedUserIds?.includes(row.ownerId)) throw new ApiProblem(404, "NOT_FOUND", "媒体不存在或不可用。");
  const publicAvatar = row.purpose === "PERSON_AVATAR" && row.personAvatars.length > 0;
  if (!publicAvatar && (row.postMedia ? row.postMedia.post.visibility !== "VISIBLE" : (await optionalActor())?.userId !== row.ownerId)) throw new ApiProblem(404, "NOT_FOUND", "图片不存在或不可用。");
  let bytes: Buffer;
  try { bytes = await fs.readFile(mediaPath(row.storageKey)); }
  catch { throw new ApiProblem(503, "SERVICE_UNAVAILABLE", "图片暂时无法读取，请稍后重试。"); }
  const headers = { "Content-Type": row.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes" };
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = match?.[1] ? Number(match[1]) : match?.[2] ? Math.max(0, bytes.length - Number(match[2])) : NaN;
    const end = match?.[1] && match?.[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= bytes.length) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${bytes.length}` } });
    return new Response(request.method === "HEAD" ? null : new Uint8Array(bytes.subarray(start, end + 1)), { status: 206, headers: { ...headers, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${bytes.length}` } });
  }
  return new Response(request.method === "HEAD" ? null : new Uint8Array(bytes), { headers: { ...headers, "Content-Length": String(bytes.byteLength) } });
}

export async function purgeDeletedMedia() {
  const rows = await database().mediaAsset.findMany({ where: { status: "DELETED", bucket: "local-private" }, select: { id: true, storageKey: true }, take: 200 });
  let pending = false;
  for (const row of rows) {
    try { await fs.rm(mediaPath(row.storageKey), { force: true }); await database().mediaAsset.updateMany({ where: { id: row.id, status: "DELETED" }, data: { bucket: "purged" } }); }
    catch { pending = true; }
  }
  return { pending: pending || rows.length === 200 };
}
