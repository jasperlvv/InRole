"use client";
import { useI18n } from "@/lib/use-i18n";

import { useState } from "react";
import Link from "next/link";
import { useDemoContent, refreshDemoRanking } from "@/lib/demo-content";
import { findPerson, rankPosts, rankTopics } from "@/lib/content-model";
import { PersonAvatar } from "./person-avatar";
import { ContentLoading, ContentNotice } from "./content-notice";
import { Icon } from "./icon";

export function TrendingBoard() {
  const { t } = useI18n();
  const [mode, setMode] = useState<"posts" | "topics">("posts"); const [days, setDays] = useState<1 | 7>(1);
  const { ready, state, updatedAt } = useDemoContent();
  const postRanks = rankPosts(state, days, updatedAt); const topicRanks = rankTopics(state, days, updatedAt);
  const updated = ready ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" }).format(updatedAt) : "—";
  return <section className="trending-section"><header className="page-heading"><div><p className="eyebrow">WHAT EVERYONE IS TALKING ABOUT</p><h1>{t("热搜话题")}<span className="heading-dot">.</span></h1><p>{t("一句好梗，会遇到很多共鸣。")}</p></div><span className="heading-stamp" aria-hidden="true">{t("好戏")}<br />{t("上榜")}</span></header><div className="trending-intro"><Icon name="fire" size={24} /><div><strong>{t("此刻的脑洞，都在这里。")}</strong><p>{t("演示榜单由示例内容与本机互动计算，不代表真实平台热度。")}</p></div></div><ContentNotice />
    <div className="ranking-controls"><div role="tablist" aria-label={t("热搜榜单类型")}><button role="tab" id="rank-posts" aria-selected={mode === "posts"} aria-controls="ranking-results" onClick={() => setMode("posts")} className={mode === "posts" ? "is-active" : ""}>{t("帖子榜")}</button><button role="tab" id="rank-topics" aria-selected={mode === "topics"} aria-controls="ranking-results" onClick={() => setMode("topics")} className={mode === "topics" ? "is-active" : ""}>{t("话题榜")}</button></div><div className="ranking-periods" aria-label={t("榜单时间范围")}><button aria-pressed={days === 1} className={days === 1 ? "is-active" : ""} onClick={() => setDays(1)}>{t("近 24 小时")}</button><button aria-pressed={days === 7} className={days === 7 ? "is-active" : ""} onClick={() => setDays(7)}>{t("近 7 天")}</button></div></div>
    <div className="ranking-meta"><span>{t("更新时间 ")}{updated} {t(" · 北京时间")}</span><button onClick={refreshDemoRanking}>{t("刷新演示榜单 ")}<Icon name="arrow" size={13} /></button></div>
    <div className="ranking-results" id="ranking-results" role="tabpanel" aria-labelledby={mode === "posts" ? "rank-posts" : "rank-topics"} tabIndex={0}>{!ready ? <ContentLoading /> : mode === "posts" ? postRanks.slice(0, 20).map(({ post, score }, index) => { const person = findPerson(post.personId)!; return <Link className="ranking-row" key={post.id} href={`/posts/${post.id}`}><span className={`ranking-position position-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span><div className="ranking-post"><div className="ranking-author"><PersonAvatar person={person} /><strong>{person.name}</strong><span>@{post.handle}</span></div><p>{post.body || post.poll?.question || (post.attachments?.[0]?.kind === "video" ? t("分享了一段视频") : post.attachments?.length ? t("分享了图片") : t("引用了一出好戏"))}</p></div><span className="ranking-score"><Icon name="fire" size={15} /><strong>{score}</strong><small>{t("热度")}</small></span><Icon name="chevron" size={15} /></Link>; }) : topicRanks.slice(0, 20).map(({ topic, score, posts: postCount, participants }, index) => <Link className="ranking-row" key={topic.id} href={`/topics/${topic.id}`}><span className={`ranking-position position-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span><div className="ranking-topic"><h2># {topic.name}</h2><p>{t(topic.description)}</p><small>{postCount} {t(" 篇帖子 · ")}{participants} {t(" 位参与者")}</small></div><span className="ranking-score"><Icon name="fire" size={15} /><strong>{score}</strong><small>{t("热度")}</small></span><Icon name="chevron" size={15} /></Link>)}</div>
    {ready && (mode === "posts" ? !postRanks.length : !topicRanks.length) && <div className="empty-state"><h2>{t("这段时间，还没有热闹开场。")}</h2><p>{t("换个时间范围，或回广场写下一句。")}</p><Link className="button button-outline" href="/">{t("回帖子广场")}</Link></div>}
    <details className="ranking-explanation"><summary>{t("这份演示榜单怎样计算？")}</summary><p>{t("帖子：时间范围内非作者的有效点赞人数 + 3 × 独立评论人数。话题：2 × 独立发帖人数 + 独立点赞人数 + 3 × 独立评论人数，同一账号在话题内分别去重。取消点赞、删除内容会同步更新。")}</p><p>{t("这里展示的是浏览器本地演示。平台自动刷新和真实热度服务将在后端阶段接入。")}</p></details></section>;
}
