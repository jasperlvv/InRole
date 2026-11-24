"use client";
import { useI18n } from "@/lib/use-i18n";

import { useState } from "react";
import { findPerson, type DemoPost } from "@/lib/content-model";
import { useDemoContent } from "@/lib/demo-content";
import { Modal } from "./modal";
import { useUI } from "./ui-provider";
import { Icon } from "./icon";

export function SharePost({ post }: { post: DemoPost }) {
  const { t } = useI18n();
  const { state } = useDemoContent(); const quoted = state.posts.find((item) => item.id === post.quotePostId);
  const [open, setOpen] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const { ensureLogin, notify } = useUI();
  const text = `${findPerson(post.personId)?.name} · @${post.handle}\n${post.body}${post.attachments?.length ? `\n[${post.attachments[0].kind === "video" ? "视频" : `${post.attachments.length} 张图片`}，附件仅在本机]` : ""}${post.poll ? `\n投票：${post.poll.question}\n${post.poll.options.map((item) => item.text).join(" / ")}` : ""}${quoted ? `\n引用 ${findPerson(quoted.personId)?.name} · @${quoted.handle}：${quoted.body.slice(0, 200) || quoted.poll?.question || "媒体帖子"}` : ""}\n—— 入戏 InRole · 用户扮演`;
  async function copy(linkOnly = false) {
    setError("");
    try { await navigator.clipboard.writeText(linkOnly ? `${location.origin}/posts/${post.id}` : text); notify(linkOnly ? "已复制本机链接；其他设备目前无法读取本机演示内容。" : "已复制分享文案，可粘贴到微信、QQ或其他平台。"); }
    catch { setError("无法访问剪贴板，请长按或选中下方内容手动复制。"); }
  }
  async function nativeShare() {
    setError("");
    if (!navigator.share) { setError("当前浏览器没有系统分享，请使用复制文案。分享目标由设备上安装的应用决定。"); return; }
    setBusy(true);
    try { await navigator.share({ title: "入戏 InRole · 这一出戏", text }); }
    catch (issue) { if (!(issue instanceof DOMException && issue.name === "AbortError")) setError("系统分享未完成，请使用复制文案。你可以自行选择微信或QQ等目标。"); }
    finally { setBusy(false); }
  }
  return <><button type="button" className="post-share-button" aria-label={t("分享这条帖子")} onClick={() => { if (ensureLogin(`/posts/${post.id}`)) { setError(""); setOpen(true); } }}><Icon name="share" size={17} /><span>{t("分享")}</span></button>{open && <Modal title={t("把这出戏分享出去")} onDismiss={() => setOpen(false)}><p className="share-description">{t("把文案带去微信、QQ，或使用设备的系统分享。")}</p><div className="share-options"><button className="button button-accent" onClick={() => void copy()}>{t("复制文案到微信 / QQ")}</button><button className="button button-outline" disabled={busy} onClick={() => void nativeShare()}>{busy ? t("等待系统选择…") : t("打开系统分享")}</button></div><label className="share-copy-label" htmlFor={`share-${post.id}`}>{t("分享文案")}</label><textarea id={`share-${post.id}`} className="share-text" value={text} readOnly rows={5} /><p className="share-demo-note">{t("当前帖子与附件仅保存在本机。分享文案可阅读；链接暂不能让其他设备读取这些内容。上线后再接入公开链接和平台分享卡片。")}</p><button className="text-action" onClick={() => void copy(true)}>{t("复制本机演示链接")}</button>{t(error) && <p role="alert" className="form-alert">{t(error)}</p>}</Modal>}</>;
}
