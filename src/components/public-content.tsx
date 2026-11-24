"use client";
import { useI18n } from "@/lib/use-i18n";

import Link from "next/link";
import { useDemoContent } from "@/lib/demo-content";
import { findPerson, type Person, type Topic } from "@/lib/content-model";
import { PostCard } from "./post-card";
import { PersonAvatar } from "./person-avatar";
import { ContentLoading, ContentNotice } from "./content-notice";
import { useUI } from "./ui-provider";
import { Icon } from "./icon";
import { PersonEngagement } from "./person-engagement";
import { useDemoSession } from "@/lib/demo-session";

export function PersonContent({ person }: { person: Person }) {
  const { t } = useI18n();
  const { ready, state } = useDemoContent(); const { openComposer } = useUI();
  return <section className="detail-column"><Link className="back-link" href="/people"><Icon name="back" size={17} /> {t(" 人物剧场")}</Link><header className="person-profile"><PersonAvatar person={person} large /><p className="eyebrow">{t(person.label)} {t(" · 公共人物")}</p><h1>{person.name}</h1><p>{person.bio}</p><button className="button button-accent button-small" onClick={() => openComposer({ personId: person.id })}>{t("以此身份发帖 ")}<Icon name="plus" size={16} /></button><Link href="/rankings" className="profile-coming-note">{t("查看人物排行榜 →")}</Link></header><ContentNotice /><PersonEngagement person={person} /><h2 className="subsection-title">{t("大家以这个身份说过")}</h2>{!ready ? <ContentLoading /> : state.posts.filter((post) => post.personId === person.id).map((post) => <PostCard post={post} key={post.id} />)}{ready && !state.posts.some((post) => post.personId === person.id) && <p className="comments-empty">{t("这个身份的第一句开场白，等你来写。")}</p>}</section>;
}
export function UserContent({ handle }: { handle: string }) {
  const { t } = useI18n();
  const { ready, state } = useDemoContent();
  const { profiles } = useDemoSession(); const profile = profiles.find((item) => item.handle === handle);
  return <section className="detail-column"><Link className="back-link" href="/"><Icon name="back" size={17} /> {t(" 帖子广场")}</Link><header className="person-profile"><span className="account-avatar profile-avatar">{handle.slice(0, 1).toUpperCase()}</span><p className="eyebrow">{t("用户公开主页 · 本机演示")}</p><h1>{profile?.displayName || `@${handle}`}</h1><span className="profile-display-name">@{handle}</span><p>{profile?.bio || t("角色可以很多，想象力始终是自己的。")}</p></header><ContentNotice /><h2 className="subsection-title">{t("TA 的开场白")}</h2>{!ready ? <ContentLoading /> : state.posts.filter((post) => post.handle === handle).map((post) => <PostCard post={post} key={post.id} />)}{ready && !state.posts.some((post) => post.handle === handle) && <p className="comments-empty">{t("这台浏览器里，还没有 TA 的帖子。")}</p>}</section>;
}
export function TopicContent({ topic }: { topic: Topic }) {
  const { t } = useI18n();
  const { ready, state } = useDemoContent(); const { openComposer } = useUI();
  const related = state.posts.filter((post) => post.topicIds.includes(topic.id)).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  const participants = new Set([...related.map((post) => post.handle), ...state.comments.filter((comment) => related.some((post) => post.id === comment.postId)).map((comment) => comment.handle)]).size;
  return <section className="detail-column topic-detail"><Link className="back-link" href="/trending"><Icon name="back" size={17} /> {t(" 热搜话题")}</Link><header className={`topic-cover topic-cover-${topic.tone}`}><span className="topic-cover-glyph" aria-hidden="true">{topic.glyph}</span><p className="eyebrow">ONE TOPIC, A THOUSAND STORIES</p><h1># {topic.name}</h1><p>{t(topic.description)}</p><div className="topic-cover-bottom"><span>{related.length} {t(" 篇帖子 · ")}{participants} {t(" 位发言者 ")}<small>{t("本机演示")}</small></span><button className="button button-accent button-small" onClick={() => openComposer({ topicId: topic.id })}>{t("参与这个话题 ")}<Icon name="plus" size={16} /></button></div></header><ContentNotice /><h2 className="subsection-title">{t("话题里的新故事 ")}<span>{t("最新发布")}</span></h2>{!ready ? <ContentLoading /> : related.map((post) => <PostCard post={post} key={post.id} />)}{ready && !related.length && <div className="empty-state"><h2>{t("这个话题还缺一句开场白。")}</h2><p>{t("选个人物，说说你的想法。")}</p><button className="button button-outline" onClick={() => openComposer({ topicId: topic.id })}>{t("写下第一句")}</button></div>}</section>;
}

export function PersonName({ id }: { id: string }) { return findPerson(id)?.name ?? "人物"; }
