"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { type DemoPost, walletBalance } from "@/lib/content-model";
import { giftDemoPost, useDemoContent } from "@/lib/demo-content";
import { useDemoSession } from "@/lib/demo-session";
import { useI18n } from "@/lib/use-i18n";
import { Icon } from "./icon";
import { Modal } from "./modal";
import { useUI } from "./ui-provider";

function GiftEditor({ post, onDone }: { post: DemoPost; onDone: () => void }) {
  const { t } = useI18n();
  const { state } = useDemoContent();
  const { user } = useDemoSession();
  const { notify } = useUI();
  const [amount, setAmount] = useState("1");
  const [error, setError] = useState("");
  const request = useRef<string | null>(null);
  const locked = useRef(false);
  const balance = user ? walletBalance(state, user.handle) : 0;
  const number = Number(amount);
  const valid = Number.isSafeInteger(number) && number > 0 && number <= balance && user?.handle !== post.handle;
  function changeAmount(value: string) { setAmount(value); setError(""); request.current = null; }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    try {
      request.current ??= crypto.randomUUID();
      giftDemoPost(post.id, number, request.current);
      notify(`已向 @${post.handle} 赠送 ${number} 通宝，双方流水已更新。`);
      onDone();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "赠送未能保存，请重试。"); locked.current = false; }
  }
  return <form className="tip-editor" onSubmit={submit}>
    <div className="gift-recipient"><span className="gift-coin"><Icon name="coin" size={35} /></span><div><strong>@{post.handle}</strong><p>{t("这份支持，送给写下这句台词的人。")}</p></div></div>
    {post.body && <blockquote className="gift-post-excerpt">{Array.from(post.body).slice(0, 100).join("")}{Array.from(post.body).length > 100 ? "…" : ""}</blockquote>}
    <div className="tip-balance"><span>{t("你的模拟余额")}</span><strong>{balance}<small>{t("通宝")}</small></strong><Link href="/me/wallet" onClick={onDone}>{t("查看钱包与流水")}<Icon name="arrow" size={14} /></Link></div>
    <label className="editor-label" htmlFor="post-gift-amount">{t("赠送数量（通宝）")}</label>
    <input id="post-gift-amount" type="number" min="1" max={balance} step="1" inputMode="numeric" value={amount} onChange={(event) => changeAmount(event.target.value)} aria-describedby="post-gift-notice" />
    <div className="tip-presets">{[1, 3, 5, 10].map((value) => <button type="button" key={value} disabled={value > balance} className={number === value ? "is-selected" : ""} onClick={() => changeAmount(String(value))}><Icon name="coin" size={14} /> {value}</button>)}</div>
    <p id="post-gift-notice" className="tip-notice">{t("赠送将扣除你的通宝，并存入贴主账号；确认后不可撤回。通宝无现实价值。")}</p>
    {!valid && <p className="field-error">{t(number > balance ? "余额不足，可以减少数量或查看今日领取状态。" : "请输入正整数数量。")}</p>}
    {error && <p className="form-alert" role="alert">{t(error)}</p>}
    <button type="submit" className="button button-accent auth-submit" disabled={!valid}><Icon name="coin" size={18} />{t(`确认赠送 ${Number.isSafeInteger(number) && number > 0 ? number : 0} 通宝`)}</button>
  </form>;
}

export function PostGift({ post, total, gifted }: { post: DemoPost; total: number; gifted: boolean }) {
  const { t } = useI18n();
  const { user } = useDemoSession();
  const { ensureLogin } = useUI();
  const [open, setOpen] = useState(false);
  const own = user?.handle === post.handle;
  return <><button className={`post-gift-button${gifted ? " has-gifted" : ""}`} disabled={own} title={t(own ? "不能给自己的帖子赠送通宝。" : `给贴主 @${post.handle} 赠送通宝`)} aria-label={t(`给贴主 @${post.handle} 赠送通宝，已收到 ${total} 通宝`)} onClick={() => { if (ensureLogin(`/posts/${post.id}`)) setOpen(true); }}><Icon name="coin" size={18} /><span>{t("赠送")}{total > 0 && <b>{total}</b>}</span></button>
    {open && user && <Modal title={t("赠送通宝")} onDismiss={() => setOpen(false)}><GiftEditor post={post} onDone={() => setOpen(false)} /></Modal>}
  </>;
}
