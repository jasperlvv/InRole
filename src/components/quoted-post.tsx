"use client";
import { useI18n } from "@/lib/use-i18n";

import Link from "next/link";
import { useDemoContent } from "@/lib/demo-content";
import { findPerson } from "@/lib/content-model";

export function QuotedPost({ postId }: { postId: string }) {
  const { t } = useI18n();
  const { state } = useDemoContent(); const post = state.posts.find((item) => item.id === postId);
  if (!post) return <div className="quoted-post quote-missing">{t("引用的帖子已删除，或不在这台浏览器中。")}</div>;
  return <Link href={`/posts/${post.id}`} className="quoted-post"><small>{t("引用的开场白")}</small><strong>{findPerson(post.personId)?.name} · @{post.handle}</strong><p>{post.body || post.poll?.question || (post.attachments?.[0]?.kind === "video" ? "一段视频" : "一组图片")}</p><span>{t("查看原帖 →")}</span></Link>;
}
