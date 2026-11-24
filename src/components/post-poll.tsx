"use client";
import { useI18n } from "@/lib/use-i18n";

import { useEffect, useState } from "react";
import { type DemoPost } from "@/lib/content-model";
import { useDemoContent, voteDemoPoll } from "@/lib/demo-content";
import { useDemoSession } from "@/lib/demo-session";
import { useUI } from "./ui-provider";

export function PostPoll({ post }: { post: DemoPost }) {
  const { t } = useI18n();
  const { state, updatedAt } = useDemoContent(); const { user } = useDemoSession(); const { ensureLogin, notify } = useUI();
  const [showResults, setShowResults] = useState(false); const [clock, setClock] = useState(updatedAt);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const poll = post.poll; if (!poll) return null;
  const votes = state.pollVotes.filter((vote) => vote.postId === post.id); const mine = votes.find((vote) => vote.handle === user?.handle);
  const ended = Math.max(updatedAt, clock) >= poll.endsAt; const results = showResults || Boolean(mine) || ended;
  function vote(optionId: string) { if (!ensureLogin(`/posts/${post.id}`)) return; try { voteDemoPoll(post.id, optionId); notify("你的选择已保存在本机，每个账号一票。"); } catch (issue) { notify(issue instanceof Error ? issue.message : "投票未保存。"); } }
  return <section className="post-poll" aria-label={t("帖子投票")}><div className="poll-heading"><span>{t("单选投票")}</span><strong>{poll.question}</strong></div><div className="poll-options">{poll.options.map((option) => { const count = votes.filter((vote) => vote.optionId === option.id).length; const percent = votes.length ? Math.round(count / votes.length * 100) : 0; return <button key={option.id} className={mine?.optionId === option.id ? "is-selected" : ""} onClick={() => vote(option.id)} disabled={Boolean(mine) || ended} aria-label={`${option.text}${mine?.optionId === option.id ? "，我的选择" : ""}`}><span className="poll-bar" style={{ width: results ? `${percent}%` : "0%" }} /><span>{option.text}{mine?.optionId === option.id && " ✓"}</span>{results && <small>{percent}% · {count} {t(" 票")}</small>}</button>; })}</div><div className="poll-meta"><span>{votes.length} {t(" 人参与 · ")}{ended ? t("已结束") : mine ? t("你已投票") : t("一人一票")}</span>{!results && <button type="button" onClick={() => setShowResults(true)}>{t("查看结果")}</button>}<span>{new Date(poll.endsAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} {t(" 截止")}</span></div></section>;
}
