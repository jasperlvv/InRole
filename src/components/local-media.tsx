"use client";
import { useI18n } from "@/lib/use-i18n";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { MediaAttachment } from "@/lib/post-rules";
import { readLocalMedia } from "@/lib/media-store";

export function LocalMedia({ item }: { item: MediaAttachment }) {
  const { t } = useI18n();
  const [url, setUrl] = useState(""); const [error, setError] = useState("");
  useEffect(() => {
    let alive = true; let objectUrl = "";
    readLocalMedia(item.id).then((blob) => { if (alive) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }).catch((issue) => { if (alive) setError(issue instanceof Error ? issue.message : "附件读取失败。"); });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item.id]);
  if (error) return <div className="media-unavailable"><strong>{item.kind === "image" ? t("图片") : t("视频")}{t("暂不可用")}</strong><span>{t(error)}</span></div>;
  if (!url) return <div className="media-unavailable" role="status">{t("读取本机附件…")}</div>;
  return item.kind === "image" ? <Image className="attached-image" src={url} width={1200} height={900} unoptimized alt={item.name} onError={() => setError("图片无法解码，请更换 JPG、PNG、WebP 或 GIF 文件。")} /> : <video className="attached-video" src={url} controls playsInline preload="metadata" aria-label={item.name} onError={() => setError("当前浏览器无法播放此视频，请使用兼容的 MP4 或 WebM 编码。")} />;
}
export function PostMedia({ items }: { items?: MediaAttachment[] }) {
  if (!items?.length) return null;
  return <div className={`post-media ${items.length > 1 ? "media-grid" : ""}`}>{items.map((item) => <LocalMedia key={item.id} item={item} />)}</div>;
}
