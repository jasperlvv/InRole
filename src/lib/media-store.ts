"use client";
import { getCurrentDemoUser } from "./demo-session";
import { validateAttachments, type MediaAttachment } from "./post-rules";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error("浏览器不支持本机媒体存储，请改用文字发帖。")); return; }
    const request = indexedDB.open("inrole-demo-media", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("本机媒体存储不可用，请允许浏览器存储后重试。"));
    request.onblocked = () => reject(new Error("媒体存储正被其他页面占用，请关闭旧页面后重试。"));
  });
}
export async function saveLocalMedia(file: File): Promise<MediaAttachment> {
  if (!getCurrentDemoUser()?.onboardingComplete) throw new Error("请先登录，再添加图片或视频。");
  const item: MediaAttachment = { id: crypto.randomUUID(), kind: file.type.startsWith("video/") ? "video" : "image", name: file.name, mime: file.type, size: file.size };
  validateAttachments([item]);
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("files", "readwrite");
      transaction.objectStore("files").put(file, item.id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(new Error("文件没有保存，本机空间可能不足。可移除附件或更换小文件后重试。"));
    });
    return item;
  } finally { db.close(); }
}
export async function readLocalMedia(id: string): Promise<Blob> {
  const db = await database();
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const request = db.transaction("files", "readonly").objectStore("files").get(id);
      request.onsuccess = () => request.result instanceof Blob ? resolve(request.result) : reject(new Error("附件不在这台浏览器中，或本机媒体已被清理。"));
      request.onerror = () => reject(new Error("附件暂时无法读取，请刷新后重试。"));
    });
  } finally { db.close(); }
}
