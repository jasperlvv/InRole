"use client";
import { useI18n } from "@/lib/use-i18n";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { findPerson, findTopic, formatPostTime, postStats, type DemoPost } from "@/lib/content-model";
import { likeDemoPost, useDemoContent } from "@/lib/demo-content";
import { useDemoSession } from "@/lib/demo-session";
import { useUI } from "./ui-provider";
import { DeleteContentButton } from "./delete-content-button";
import { Icon } from "./icon";
import { PersonAvatar } from "./person-avatar";
import { ReportButton } from "./report-button";
import { PostMedia } from "./local-media";
import { PostPoll } from "./post-poll";
import { QuotedPost } from "./quoted-post";
import { SharePost } from "./share-post";
import { PostGift } from "./post-gift";

export function PostCard({ post, detail = false }: { post: DemoPost; detail?: boolean }) {
  const { t } = useI18n();
  const person = findPerson(post.personId)!;
  const { user } = useDemoSession(); const { state, updatedAt } = useDemoContent();
  const { ensureLogin, notify, openComposer } = useUI(); const router = useRouter();
  const stats = postStats(state, post.id, user?.handle);
  function like() {
    if (!ensureLogin(`/posts/${post.id}`)) return;
    try { likeDemoPost(post.id, !stats.liked); }
    catch (issue) { notify(issue instanceof Error ? issue.message : "点赞未能保存，请重试。"); }
  }
  return <article className={`post-card ${detail ? "post-card-detail" : ""}`}><div className="post-topline">
    <Link href={`/people/${person.id}`} aria-label={t(`查看人物：${person.name}`)}><PersonAvatar person={person} /></Link>
    <div className="post-identity"><div><Link className="person-name" href={`/people/${person.id}`}>{person.name}</Link><span className="role-badge">{t("扮演")}</span></div><p><Link href={`/users/${post.handle}`}>@{post.handle}</Link><span>·</span><time dateTime={new Date(post.createdAt).toISOString()}>{t(formatPostTime(post.createdAt, updatedAt))}</time></p></div>
    {user?.handle === post.handle ? <DeleteContentButton id={post.id} kind="post" /> : <ReportButton kind="post" targetId={post.id} next={`/posts/${post.id}`} />}</div>
    {detail ? post.body && <p className="post-body">{post.body}</p> : <Link href={`/posts/${post.id}`} className="post-body-link" aria-label={t(`阅读${person.name}的帖子`)}><p className="post-body">{post.body || (post.poll ? t("发起了一个投票") : post.attachments?.[0]?.kind === "video" ? t("分享了一段视频") : post.attachments?.length ? t("分享了图片") : t("引用了一出好戏"))}</p></Link>}
    <PostMedia items={post.attachments} />
    {post.poll && <PostPoll post={post} />}
    {post.quotePostId && <QuotedPost postId={post.quotePostId} />}
    <div className="post-topic-links">{post.topicIds.map((id) => <Link key={id} href={`/topics/${id}`} className="topic-tag"># {findTopic(id)?.name}</Link>)}</div><div className="post-actions">
      <button aria-label={`${t(stats.liked ? "取消点赞" : "点赞")} ${person.name} · ${stats.likes} ${t("赞")}`} aria-pressed={stats.liked} className={stats.liked ? "is-liked" : ""} onClick={like}><Icon name="heart" size={18} /><span>{stats.likes}</span></button>
      <button aria-label={t(`评论${person.name}的帖子，${stats.comments}条评论`)} onClick={() => router.push(`/posts/${post.id}#comments`)}><Icon name="comment" size={18} /><span>{stats.comments}</span></button>
      <PostGift post={post} total={stats.gifts} gifted={stats.gifted} />
      <button aria-label={t("引用这条帖子")} onClick={() => { if (ensureLogin(`/posts/${post.id}`)) openComposer({ quotePostId: post.id }); }}><Icon name="quote" size={17} /><span>{t("引用")}</span></button>
      <SharePost post={post} />
      <Link href={`/posts/${post.id}`} className="discussion-link">{t("看看这出戏 ")}<Icon name="arrow" size={15} /></Link></div></article>;
}
