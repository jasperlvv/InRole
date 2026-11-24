"use client";
import { useI18n } from "@/lib/use-i18n";

import { useState } from "react";
import Link from "next/link";
import { people, findTopic, rankTopics } from "@/lib/content-model";
import { useDemoContent } from "@/lib/demo-content";
import { useDemoSession } from "@/lib/demo-session";
import { authHref } from "@/lib/account-rules";
import { Icon } from "./icon";
import { PostCard } from "./post-card";
import { PersonAvatar } from "./person-avatar";
import { ContentLoading, ContentNotice } from "./content-notice";
import { useUI } from "./ui-provider";

export function Feed() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"recommended" | "latest">("recommended");
  const [filter, setFilter] = useState("all"); const [search, setSearch] = useState("");
  const { user } = useDemoSession(); const { ready, state, updatedAt } = useDemoContent();
  const { openComposer } = useUI();
  const filtered = state.posts.filter((post) => (filter === "all" || post.topicIds.includes(filter)) && `${post.body}${post.poll?.question ?? ""}${post.poll?.options.map((option) => option.text).join("") ?? ""}${post.topicIds.map((id) => findTopic(id)?.name).join("")}${people.find((p) => p.id === post.personId)?.name}${post.handle}`.toLowerCase().includes(search.trim().toLowerCase()));
  const visible = tab === "latest" ? [...filtered].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)) : filtered;
  const topicRanks = rankTopics(state, 1, updatedAt).slice(0, 3);
  return <div className="feed-layout"><section className="feed-column" aria-label={t("帖子广场")}>
    <header className="page-heading"><div><p className="eyebrow">THE PUBLIC STAGE</p><h1>{t("帖子广场")}<span className="heading-dot">.</span></h1><p>{t("古今同框，脑洞开场。")}</p></div><span className="heading-stamp" aria-hidden="true">{t("人人")}<br />{t("有戏")}</span></header>
    <section className="plaza-search" aria-label={t("广场搜索")}><div><strong>{t("找一句话，遇见一出戏。")}</strong><span>{t("台词 · 人物 · 话题 · @账号")}</span></div><form role="search" aria-label={t("搜索帖子")} onSubmit={(event) => event.preventDefault()}><Icon name="search" size={20} /><label className="sr-only" htmlFor="plaza-search-input">{t("搜索帖子关键词")}</label><input id="plaza-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("搜关键词，看看大家怎么说")} type="search" />{search && <button type="button" className="search-clear" aria-label={t("清空搜索")} onClick={() => setSearch("")}><Icon name="close" size={16} /></button>}<button type="submit" className="button button-accent button-small">{t("搜索")}</button></form>{search.trim() && <p role="status">{t("找到 ")}{visible.length} {t(" 条与「")}{search.trim()}{t("」相关的帖子")}<button onClick={() => { setSearch(""); setFilter("all"); }}>{t("清空条件")}</button></p>}</section>
    {!search.trim() && <section className="welcome-card" aria-labelledby="welcome-title"><div><span className="welcome-kicker"><Icon name="spark" size={14} /> {t(" 换个身份，遇见不同")}</span><h2 id="welcome-title">{t("大人物，也有小情绪。")}</h2><p>{user ? t(`欢迎入戏，@${user.handle}。今天想用谁的口吻说话？`) : t("今天做自己，还是替古人说两句？")}</p><Link href={user ? "/people" : authHref("/register")} className="welcome-cta">{user ? t("逛逛人物剧场") : t("领取你的开场白")}<Icon name="arrow" size={16} /></Link></div><span className="welcome-art" aria-hidden="true"><span>秦</span><span>悟</span><span>白</span><i>{t("一人千面")}</i></span></section>}
    {!search.trim() && <button className="composer-preview composer-entry" onClick={() => openComposer()}><span className="account-avatar"><Icon name="user" size={20} /></span><span>{user ? t("下一场好戏，由你开场。") : t("选个身份，分享你的奇思妙想……")}</span><span className="button button-accent button-small">{t("去发言")}</span></button>}
    <ContentNotice />
    <div className="feed-toolbar"><div role="tablist" aria-label={t("帖子排序")}><button role="tab" aria-selected={tab === "recommended"} aria-controls="feed-list" id="tab-recommended" onClick={() => setTab("recommended")} className={tab === "recommended" ? "is-active" : ""}>{t("为你推荐")}</button><button role="tab" aria-selected={tab === "latest"} aria-controls="feed-list" id="tab-latest" onClick={() => setTab("latest")} className={tab === "latest" ? "is-active" : ""}>{t("最新发布")}</button></div><span>{t("灵感不设限")}</span></div>
    <div className="topic-filters" aria-label={t("帖子话题筛选")}>{[{ id: "all", name: "全部" }, { id: "history-work", name: "历史打工人" }, { id: "gods-work", name: "神仙也打工" }, { id: "ancient-moments", name: "古人的朋友圈" }].map((topic) => <button key={topic.id} aria-pressed={filter === topic.id} className={filter === topic.id ? "is-active" : ""} onClick={() => setFilter(topic.id)}>{topic.id !== "all" && "# "}{t(topic.name)}</button>)}</div>
    <div id="feed-list" role="tabpanel" aria-labelledby={tab === "recommended" ? "tab-recommended" : "tab-latest"} tabIndex={0}>{!ready ? <ContentLoading /> : visible.length ? visible.map((post) => <PostCard key={post.id} post={post} />) : <div className="empty-state"><Icon name="search" size={30} /><h2>{t("这出戏还没开场")}</h2><p>{t("试试其他关键词，或看看全部话题。")}</p><button className="button button-outline" onClick={() => { setSearch(""); setFilter("all"); }}>{t("查看全部帖子")}</button></div>}</div><p className="feed-end">{t("— 看完了这几出好戏，轮到你开场 —")}</p>
  </section><aside className="right-rail" aria-label={t("社区发现")}><div className="rail-intro"><span className="rail-live-dot" /> {t(" 此刻，灵感正在发生")}</div>
    <section className="rail-card"><div className="rail-heading"><h2><Icon name="fire" size={19} /> {t(" 正在聊什么")}</h2><span>{t("演示 · 24h")}</span></div><div className="rail-topics">{topicRanks.map(({ topic, score }, index) => <Link key={topic.id} href={`/topics/${topic.id}`}><span className={`rank-number rank-${index}`}>{index + 1}</span><div><strong># {t(topic.name)}</strong><p>{topic.description.slice(0, 14)}…</p></div><span className="topic-heat">{score}</span></Link>)}</div><Link href="/trending" className="rail-footer-link">{t("去热搜看看 ")}<Icon name="arrow" size={15} /></Link></section>
    <section className="rail-card"><div className="rail-heading"><h2><Icon name="people" size={19} /> {t(" 灵魂有趣，身份随意")}</h2></div><div className="rail-people">{people.slice(0, 4).map((person) => <Link key={person.id} href={`/people/${person.id}`}><PersonAvatar person={person} /><span><strong>{person.name}</strong><small>{t(person.label)}</small></span><Icon name="chevron" size={15} /></Link>)}</div><Link href="/people" className="rail-footer-link">{t("发现更多人物 ")}<Icon name="arrow" size={15} /></Link></section>
    <div className="rail-quote"><span aria-hidden="true">“</span><p>{t("名字借给你，")}<br />{t("故事由你写。")}</p><small>EVERY VOICE, A NEW ROLE.</small></div><p className="rail-fineprint">{t("示例与本机发言均为人物扮演。")}<br />{t("尊重创作，也尊重每一种不同。")}</p></aside></div>;
}
