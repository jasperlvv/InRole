"use client";
import { useI18n } from "@/lib/use-i18n";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useDemoContent, saveDemoReview, deleteDemoReview, tipDemoPerson } from "@/lib/demo-content";
import { useDemoSession } from "@/lib/demo-session";
import { characterCount, formatPostTime, personStats, walletBalance, type Person } from "@/lib/content-model";
import { Modal } from "./modal";
import { useUI } from "./ui-provider";
import { Icon } from "./icon";

function ReviewEditor({ person, onDone }: { person: Person; onDone: () => void }) {
  const { t } = useI18n();
  const { state } = useDemoContent(); const { user } = useDemoSession(); const { notify } = useUI();
  const existing = state.reviews.find((item) => item.personId === person.id && item.handle === user?.handle);
  const [score, setScore] = useState(existing?.score ?? 0); const [body, setBody] = useState(existing?.body ?? ""); const [error, setError] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); try { saveDemoReview(person.id, score, body); notify("评分与评价已保存在本机。"); onDone(); } catch (issue) { setError(issue instanceof Error ? issue.message : "保存失败，请重试。"); } }
  return <form onSubmit={submit} className="review-editor"><p>{t("你评价的是公共人物「")}{person.name}{t("」，不是某一位扮演者。")}</p><div className="rating-stars" role="radiogroup" aria-label={t("人物评分")}>{[1, 2, 3, 4, 5].map((value) => <button type="button" role="radio" aria-label={t(`${value}分`)} aria-checked={score === value} key={value} className={value <= score ? "is-selected" : ""} onClick={() => setScore(value)}>★</button>)}</div><span className="rating-selected">{score ? t(`${score} / 5 分`) : t("先选一个分数")}</span><label className="editor-label" htmlFor="review-body">{t("写下你的评价")}<span>{t("可选，最多 500 字")}</span></label><textarea id="review-body" value={body} onChange={(event) => setBody(event.target.value)} placeholder={t("这个人物，给你留下了什么印象？")} rows={4} /><p className="editor-counter"><span>{t("一人一份，可随时修改")}</span><span>{characterCount(body)} / 500</span></p>{t(error) && <p className="form-alert" role="alert">{t(error)}</p>}<button className="button button-accent auth-submit" disabled={!score || characterCount(body.trim()) > 500} type="submit">{existing ? t("更新我的评价") : t("保存评分与评价")}<Icon name="check" size={16} /></button></form>;
}
function TipEditor({ person, onDone }: { person: Person; onDone: () => void }) {
  const { t } = useI18n();
  const { state } = useDemoContent(); const { user } = useDemoSession(); const { notify } = useUI();
  const balance = user ? walletBalance(state, user.handle) : 0;
  const [amount, setAmount] = useState("1"); const [error, setError] = useState(""); const request = useRef<string | null>(null); const locked = useRef(false);
  const number = Number(amount); const valid = Number.isSafeInteger(number) && number > 0 && number <= balance;
  function submit(event: FormEvent) { event.preventDefault(); if (locked.current) return; locked.current = true; try { request.current ??= crypto.randomUUID(); tipDemoPerson(person.id, number, request.current); notify(`已向${person.name}投出 ${number} 通宝，流水已记录。`); onDone(); } catch (issue) { setError(issue instanceof Error ? issue.message : "投币未能保存。"); } finally { locked.current = false; } }
  return <form className="tip-editor" onSubmit={submit}><div className="tip-balance"><span>{t("你的模拟余额")}</span><strong>{balance}<small><Icon name="coin" size={14} /> {t("通宝")}</small></strong><Link href="/me/wallet" onClick={onDone}>{t("查看钱包与流水 ")}<Icon name="arrow" size={14} /></Link></div><label className="editor-label" htmlFor="tip-amount">{t("投给「")}{person.name}{t("」的数量")}</label><input id="tip-amount" type="number" min="1" step="1" inputMode="numeric" value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} /><div className="tip-presets">{[1, 3, 5, 10].map((value) => <button type="button" disabled={value > balance} className={number === value ? "is-selected" : ""} onClick={() => setAmount(String(value))} key={value}><Icon name="coin" size={14} /> {value}</button>)}</div><p className="tip-notice">{t("通宝仅用于娱乐演示，无现实价值。投给公共人物，不进入扮演者的账号；确认后不可撤回。")}</p>{!valid && <p className="field-error">{number > balance ? t("余额不足，可以减少数量或查看今日领取状态。") : t("请输入正整数数量。")}</p>}{t(error) && <p className="form-alert" role="alert">{t(error)}</p>}<button type="submit" className="button button-accent auth-submit" disabled={!valid}><Icon name="coin" size={18} />{t("确认投出 ")}{Number.isSafeInteger(number) && number > 0 ? number : 0} {t(" 通宝")}<Icon name="arrow" size={16} /></button></form>;
}

export function PersonEngagement({ person }: { person: Person }) {
  const { t } = useI18n();
  const { ready, state, updatedAt } = useDemoContent(); const { user } = useDemoSession(); const { ensureLogin, notify } = useUI();
  const [dialog, setDialog] = useState<"review" | "tip" | "delete" | null>(null); const [error, setError] = useState("");
  const stats = personStats(state, person.id, updatedAt); const reviews = state.reviews.filter((item) => item.personId === person.id).sort((a, b) => b.updatedAt - a.updatedAt);
  const own = reviews.find((item) => item.handle === user?.handle);
  function open(kind: "review" | "tip") { if (ensureLogin(`/people/${person.id}`)) setDialog(kind); }
  function remove() { if (!own) return; try { deleteDemoReview(own.id); setDialog(null); notify("你的评价已删除，人物评分已更新。"); } catch (issue) { setError(issue instanceof Error ? issue.message : "删除失败。"); } }
  if (!ready) return null;
  return <section className="person-engagement" aria-label={t("人物评分与投币")}><div className="person-stat-grid"><div><span>{t("综合评分")}</span><strong>{stats.average?.toFixed(1) ?? "—"}<small>{stats.average === null ? t("暂无评分") : "/ 5"}</small></strong><p>{stats.count} {t(" 人评分")}</p></div><div><span>{t("今日收到")}</span><strong>{stats.today}<small>{t("通宝")}</small></strong><p>{t("公共人物收币")}</p></div><div><span>{t("累计收到")}</span><strong>{stats.total}<small>{t("通宝")}</small></strong><p>{t("本机模拟统计")}</p></div></div><div className="person-engagement-actions"><button className="button button-outline" onClick={() => open("review")}>★ {own ? t("修改我的评价") : t("为 TA 评分")}</button><button className="button button-accent" onClick={() => open("tip")}>{t("投通宝支持 ")}<Icon name="arrow" size={16} /></button><Link href="/rankings">{t("人物排行榜 ")}<Icon name="chevron" size={15} /></Link></div><div className="reviews-heading"><h2>{t("大家怎样看 TA ")}<span>{reviews.length}</span></h2><small>{t("评价人物，不评价扮演者")}</small></div><div className="reviews-list">{reviews.map((review) => <article className="review-card" key={review.id}><div className="review-topline"><Link href={`/users/${review.handle}`}>@{review.handle}</Link><span aria-label={t(`${review.score}分`)}>{"★".repeat(review.score)}<i>{"☆".repeat(5 - review.score)}</i></span>{review.handle === user?.handle && <button className="delete-content-button" onClick={() => setDialog("delete")}>{t("删除我的评价")}</button>}</div>{review.body && <p>{review.body}</p>}<small>{t(formatPostTime(review.updatedAt, updatedAt))}</small></article>)}{!reviews.length && <p className="comments-empty">{t("还没有评价，你愿意写下第一份印象吗？")}</p>}</div>
    {dialog === "review" && <Modal title={t(`评价${person.name}`)} onDismiss={() => setDialog(null)}><ReviewEditor person={person} onDone={() => setDialog(null)} /></Modal>}
    {dialog === "tip" && <Modal title={t(`投币给${person.name}`)} onDismiss={() => setDialog(null)}><TipEditor person={person} onDone={() => setDialog(null)} /></Modal>}
    {dialog === "delete" && <Modal title={t("删除自己的评价？")} onDismiss={() => setDialog(null)}><p className="confirm-description">{t("删除后，评分和评价会一起移除，人物平均分与人数同步更新。")}</p>{t(error) && <p className="form-alert" role="alert">{t(error)}</p>}<div className="confirm-actions"><button className="button button-outline" onClick={() => setDialog(null)}>{t("保留评价")}</button><button className="button button-danger" onClick={remove}>{t("确认删除评价")}</button></div></Modal>}
  </section>;
}
