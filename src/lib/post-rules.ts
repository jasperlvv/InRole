export type MediaAttachment = { id: string; kind: "image" | "video"; name: string; mime: string; size: number };
export type PollDraft = { question: string; options: string[]; durationHours: 24 | 72 | 168 };
export type PostPoll = { question: string; options: { id: string; text: string }[]; endsAt: number };
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm"];
export const IMAGE_LIMIT = 5 * 1024 * 1024;
export const VIDEO_LIMIT = 30 * 1024 * 1024;
export function validateAttachments(items: MediaAttachment[] = []) {
  if (!Array.isArray(items) || items.length > 6) throw new Error("每帖最多 6 张图片，或 1 个视频。");
  const ids = new Set<string>();
  for (const item of items) {
    if (!item || typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || ids.has(item.id) || typeof item.name !== "string" || !item.name || item.name.length > 255 || !Number.isSafeInteger(item.size) || item.size <= 0) throw new Error("附件信息无效，请重新选择文件。");
    ids.add(item.id);
    if (item.kind === "image" ? !IMAGE_TYPES.includes(item.mime) || item.size > IMAGE_LIMIT : item.kind === "video" ? !VIDEO_TYPES.includes(item.mime) || item.size > VIDEO_LIMIT : true) throw new Error("图片支持 JPG/PNG/WebP/GIF，单张不超过 5 MB；视频支持 MP4/WebM，不超过 30 MB。");
  }
  if (items.some((item) => item.kind === "video") && items.length !== 1) throw new Error("视频与图片请分开发帖，每帖最多 1 个视频。");
  return items.map((item) => ({ ...item }));
}
export function normalizePoll(draft: PollDraft): PollDraft {
  if (!draft || typeof draft.question !== "string" || !draft.question.trim() || Array.from(draft.question.trim()).length > 100 || !Array.isArray(draft.options) || draft.options.length < 2 || draft.options.length > 4 || ![24, 72, 168].includes(draft.durationHours)) throw new Error("投票需要 1～100 字问题、2～4 个选项和有效时长。");
  const options = draft.options.map((option) => {
    if (typeof option !== "string" || !option.trim() || Array.from(option.trim()).length > 60) throw new Error("每个投票选项需为 1～60 字。");
    return option.trim();
  });
  if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) throw new Error("投票选项不能重复。");
  return { question: draft.question.trim(), options, durationHours: draft.durationHours };
}
export function normalizeEncyclopediaUrl(input: string) {
  if (!input.trim()) return "";
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error("请输入完整的维基百科或百度百科词条网址。"); }
  const wiki = /^(?:[a-z0-9-]+\.)*wikipedia\.org$/.test(url.hostname) && url.pathname.startsWith("/wiki/") && url.pathname.length > 6;
  const baidu = url.hostname === "baike.baidu.com" && url.pathname.startsWith("/item/") && url.pathname.length > 6;
  if (url.protocol !== "https:" || url.username || url.password || url.port || !(wiki || baidu)) throw new Error("仅接受 https 的维基百科 /wiki/ 或百度百科 /item/ 词条链接。");
  url.search = ""; url.hash = "";
  return url.href;
}
