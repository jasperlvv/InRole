"use client";
import { useI18n } from "@/lib/use-i18n";

import { useState } from "react";
import Link from "next/link";
import { interests, logoutDemoProfile } from "@/lib/demo-session";
import { useDemoContent } from "@/lib/demo-content";
import { findPerson, walletBalance, formatPostTime } from "@/lib/content-model";
import { useProtectedDemo } from "./protected-demo";
import { PostCard } from "./post-card";
import { DeleteContentButton } from "./delete-content-button";
import { DemoDataTools } from "./demo-data-tools";
import { ContentLoading, ContentNotice } from "./content-notice";
import { Icon } from "./icon";

export function MePreview() {
  const { t } = useI18n();
  const { available, user } = useProtectedDemo("/me"); const { state, updatedAt } = useDemoContent();
  const [tab, setTab] = useState<"posts" | "comments" | "likes" | "reviews">("posts");
  if (!available || !user) return <ContentLoading />;
  const myPosts = state.posts.filter((post) => post.handle === user.handle);
  const myComments = state.comments.filter((comment) => comment.handle === user.handle).sort((a, b) => b.createdAt - a.createdAt);
  const myReviews = state.reviews.filter((review) => review.handle === user.handle);
  const likedIds = new Set(state.likes.filter((like) => like.handle === user.handle).map((like) => like.postId));
  const likedPosts = state.posts.filter((post) => likedIds.has(post.id));
  const receivedLikes = state.likes.filter((like) => myPosts.some((post) => post.id === like.postId)).length;
  return <section className="personal-preview"><div className="page-heading"><div><p className="eyebrow">YOUR OWN STAGE</p><h1>{t("我的入戏")}<span className="heading-dot">.</span></h1><p>{t("你借用很多名字，但每个想法都属于你。")}</p></div></div><ContentNotice />
    <div className="profile-panel"><div className="profile-title-row"><span className="account-avatar profile-avatar">{(user.displayName || user.handle).slice(0, 1).toUpperCase()}</span><div><h2>{user.displayName || user.handle}</h2><span className="profile-display-name">@{user.handle}</span><span className="demo-pill">{t("本机演示账号")}</span></div></div>{user.bio && <p className="profile-description">{user.bio}</p>}
      <div className="personal-stat-grid"><div><strong>{myPosts.length}</strong><span>{t("我的帖子")}</span></div><div><strong>{myComments.length}</strong><span>{t("我的评论")}</span></div><div><strong>{receivedLikes}</strong><span>{t("获得点赞")}</span></div><div><strong>{myReviews.length}</strong><span>{t("人物评价")}</span></div></div>
      <div className="profile-interests"><h3>{t("你的喜好")}</h3>{user.interests.length ? <div className="interest-chips">{user.interests.map((id) => <span key={id}>{t(interests.find((interest) => interest.id === id)?.label)}</span>)}</div> : <p>{t("你选择了先随便逛逛。每一种故事都向你开放。")}</p>}</div>
      <div className="personal-shortcuts"><Link href="/people/request">{t("人物申请 ")}<Icon name="chevron" size={13} /></Link><Link href="/me/preferences">{t("编辑喜好 ")}<Icon name="chevron" size={13} /></Link><Link href="/me/settings">{t("账号设置 ")}<Icon name="chevron" size={13} /></Link><Link href={`/users/${user.handle}`}>{t("公开主页 ")}<Icon name="chevron" size={13} /></Link></div>
      <div className="personal-wallet-strip"><span>{t("我的模拟余额 ")}<strong>{walletBalance(state, user.handle)}</strong> {t(" 通宝")}</span><Link href="/me/wallet">{t("钱包与流水 ")}<Icon name="arrow" size={14} /></Link></div>
      <button className="logout-button" onClick={logoutDemoProfile}><Icon name="logout" size={16} /> {t(" 退出演示账号")}</button><DemoDataTools />
    </div>
    <div className="personal-tabs" role="tablist" aria-label={t("我的内容类型")}>{([{ id: "posts", label: "我的帖子" }, { id: "comments", label: "我的评论" }, { id: "likes", label: "我的点赞" }, { id: "reviews", label: "我的评价" }] as const).map((item) => <button role="tab" key={item.id} aria-selected={tab === item.id} className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}>{t(item.label)}</button>)}</div>
    {tab === "posts" && (myPosts.length ? myPosts.map((post) => <PostCard post={post} key={post.id} />) : <p className="comments-empty">{t("你的第一句开场白，还在等你。")}</p>)}
    {tab === "likes" && (likedPosts.length ? likedPosts.map((post) => <PostCard post={post} key={post.id} />) : <p className="comments-empty">{t("看到喜欢的帖子，给它一个赞吧。")}</p>)}
    {tab === "comments" && <div className="my-comments-list">{myComments.map((comment) => <article className="my-comment-item" key={comment.id}><div><strong>{findPerson(comment.personId)?.name} · @{user.handle}</strong><span>{t(formatPostTime(comment.createdAt, updatedAt))}</span><DeleteContentButton id={comment.id} kind="comment" /></div><Link href={`/posts/${comment.postId}#comments`}>{comment.body}</Link></article>)}{!myComments.length && <p className="comments-empty">{t("还没有评论，去接上一个有趣的故事吧。")}</p>}</div>}
    {tab === "reviews" && (myReviews.length ? myReviews.map((review) => <article className="personal-review" key={review.id}><Link href={`/people/${review.personId}`}><strong>{findPerson(review.personId)?.name}</strong><span>{"★".repeat(review.score)}</span></Link>{review.body && <p>{review.body}</p>}<small>{t("可以在人物主页修改或删除这份评价。")}</small></article>) : <p className="comments-empty">{t("还没有评价，去人物剧场看看。")}</p>)}
  </section>;
}
