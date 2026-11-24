"use client";
import { useI18n } from "@/lib/use-i18n";

import Link from "next/link";
import { useState } from "react";
import { useDemoContent } from "@/lib/demo-content";
import { useDemoSession } from "@/lib/demo-session";
import { findPerson, formatPostTime } from "@/lib/content-model";
import { PostCard } from "./post-card";
import { PersonAvatar } from "./person-avatar";
import { PostEditor } from "./post-editor";
import { DeleteContentButton } from "./delete-content-button";
import { ContentLoading, ContentNotice } from "./content-notice";
import { useUI } from "./ui-provider";
import { Icon } from "./icon";
import { Modal } from "./modal";

export function PostDetail({ postId }: { postId: string }) {
  const { t } = useI18n();
  const { ready, state, updatedAt } = useDemoContent(); const { user } = useDemoSession();
  if (!ready) return <ContentLoading />;
  const post = state.posts.find((item) => item.id === postId);
  if (!post) return <section className="detail-column"><div className="empty-state"><h1>{t("这出戏，暂时落幕了。")}</h1><p>{t("帖子可能已删除，或不在这台浏览器的演示内容里。")}</p><Link className="button button-outline" href="/">{t("回到帖子广场")}</Link></div></section>;
  const comments = state.comments.filter((comment) => comment.postId === postId).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  return <section className="detail-column"><Link className="back-link" href="/"><Icon name="back" size={17} /> {t(" 帖子广场")}</Link><h1 className="detail-title">{t("这一出戏")}</h1><ContentNotice /><PostCard post={post} detail />
    <section id="comments" className="comments-section" aria-labelledby="comments-title"><div className="comments-heading"><h2 id="comments-title">{t("接上这一句 ")}<span>{comments.length}</span></h2><small>{t("最新在前 · 每条评论都能换身份")}</small></div>
      <CommentEntry key={`${user?.handle ?? "guest"}:${postId}`} postId={postId} />
      <div className="comment-list">{comments.map((comment) => { const person = findPerson(comment.personId)!; return <article className="comment-card" key={comment.id}><Link href={`/people/${person.id}`} aria-label={t(`查看评论人物：${person.name}`)}><PersonAvatar person={person} /></Link><div className="comment-content"><div className="comment-author"><Link href={`/people/${person.id}`}>{person.name}</Link><span className="role-badge">{t("扮演")}</span><Link href={`/users/${comment.handle}`}>@{comment.handle}</Link></div><p>{comment.body}</p><div className="comment-meta"><time dateTime={new Date(comment.createdAt).toISOString()}>{t(formatPostTime(comment.createdAt, updatedAt))}</time>{user?.handle === comment.handle && <DeleteContentButton id={comment.id} kind="comment" />}</div></div></article>; })}{!comments.length && <p className="comments-empty">{t("还没有人接戏。第一句，就由你来说？")}</p>}</div>
    </section></section>;
}

function CommentEntry({ postId }: { postId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false); const { user } = useDemoSession(); const { ensureLogin, notify } = useUI();
  return <><button className="comment-entry" onClick={() => { if (ensureLogin(`/posts/${postId}#comments`)) setOpen(true); }}><Icon name="comment" size={20} /><span>{user ? t("写评论，接上这一句……") : t("登录后写评论，接上这一句……")}</span><span>{t("写评论 ")}<Icon name="arrow" size={15} /></span></button>{open && user?.onboardingComplete && <Modal title={t("接上这一句")} onDismiss={() => setOpen(false)}><PostEditor mode="comment" onRequestPerson={() => setOpen(false)} postId={postId} onPublished={(_, personName) => { setOpen(false); notify(`已以${personName}的身份发表评论。`); }} /></Modal>}</>;
}
