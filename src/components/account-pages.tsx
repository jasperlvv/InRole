"use client";
import { useI18n } from "@/lib/use-i18n";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { interests, updateDemoPreferences, updateDemoPublicProfile, logoutDemoProfile } from "@/lib/demo-session";
import { useDemoContent, ensureDemoDailyCoins } from "@/lib/demo-content";
import { chinaDay, findPerson, walletBalance, transactionDelta, formatPostTime } from "@/lib/content-model";
import { useProtectedDemo } from "./protected-demo";
import { ContentLoading, ContentNotice } from "./content-notice";
import { useUI } from "./ui-provider";
import { Icon } from "./icon";

function PersonalHeading({ title, subtitle }: { title: string; subtitle: string }) {
  const { t } = useI18n(); return <><Link className="back-link" href="/me"><Icon name="back" size={17} /> {t(" 个人中心")}</Link><header className="page-heading"><div><p className="eyebrow">YOUR OWN STAGE</p><h1>{t(title)}<span className="heading-dot">.</span></h1><p>{t(subtitle)}</p></div></header></>; }

export function WalletPage() {
  const { t } = useI18n();
  const { available, user } = useProtectedDemo("/me/wallet"); const { ready, state, updatedAt } = useDemoContent(); const { notify } = useUI(); const [limit, setLimit] = useState(15);
  if (!available || !user || !ready) return <ContentLoading />;
  const entries = state.transactions.filter((item) => item.handle === user.handle || (item.kind === "gift" && item.recipientHandle === user.handle)).sort((a, b) => b.createdAt - a.createdAt);
  const claimed = entries.some((item) => item.kind === "grant" && item.day === chinaDay(updatedAt));
  const received = entries.filter((item) => item.kind === "grant").reduce((sum, item) => sum + item.amount, 0);
  const spent = entries.filter((item) => item.kind === "tip").reduce((sum, item) => sum + item.amount, 0);
  const giftsReceived = entries.filter((item) => item.kind === "gift" && item.recipientHandle === user.handle).reduce((sum, item) => sum + item.amount, 0);
  const giftsSent = entries.filter((item) => item.kind === "gift" && item.handle === user.handle).reduce((sum, item) => sum + item.amount, 0);
  return <section className="account-section">
    <PersonalHeading title={t("我的通宝")} subtitle={t("天圆地方，一枚通宝，一份欣赏。")} /><ContentNotice />
    <div className="wallet-hero"><Icon name="coin" size={48} className="wallet-coin" /><span>{t("模拟余额")}</span><h2>{walletBalance(state, user.handle)}<small>{t("通宝")}</small></h2><div><span>{t("累计领取 ")}{received}</span><Link href="/">{t("去赠送贴主")}<Icon name="arrow" size={16} /></Link></div><div className="wallet-totals"><span>{t("收到赠送")} {giftsReceived}</span><span>{t("赠予贴主")} {giftsSent}</span><span>{t("支持人物")} {spent}</span></div></div>
    <div className="daily-grant"><div><strong>{t("每天一点，给想象力加戏。")}</strong><p>{t("每日首次访问自动领取 10 通宝，以北京时间自然日演示。")}</p></div><button className="button button-outline button-small" disabled={claimed} onClick={() => { try { ensureDemoDailyCoins(); notify("今日 10 通宝已记入本机流水。"); } catch (issue) { notify(issue instanceof Error ? issue.message : "领取失败，请重试。"); } }}>{claimed ? t("今日已领取 10 通宝") : t("领取今日 10 通宝")}</button></div>
    <h2 className="subsection-title">{t("通宝流水 ")}<span>{t("仅本人可见 · 本机演示")}</span></h2>
    <div className="wallet-ledger">{entries.slice(0, limit).map((item) => {
      const delta = transactionDelta(item, user.handle);
      const incoming = delta > 0;
      const title = item.kind === "grant" ? t("每日领取") : item.kind === "tip" ? t(`投给${findPerson(item.personId!)?.name}`) : incoming ? t(`收到 @${item.handle} 的赠送`) : t(`赠予 @${item.recipientHandle}`);
      return <div className="ledger-row" key={item.id}><span className={`ledger-symbol ${item.kind}`}><Icon name="coin" size={22} /></span><div><strong>{title}</strong><small>{t(formatPostTime(item.createdAt, updatedAt))} · {item.day}</small>{item.kind === "gift" && (state.posts.some((post) => post.id === item.postId) ? <Link href={`/posts/${item.postId}`}>{t("查看赠送帖子")} →</Link> : <small>{t("原帖已删除，流水保留")}</small>)}</div><b className={incoming ? "income" : "outgoing"}>{incoming ? "+" : "−"}{item.amount}</b></div>;
    })}{!entries.length && <p className="comments-empty">{t("还没有流水，领取今天的第一份通宝吧。")}</p>}</div>
    {entries.length > limit && <button className="load-more-button" onClick={() => setLimit(limit + 15)}>{t("查看更多流水")}</button>}
    <p className="section-note">{t("通宝无现实价值，可支持人物或赠送贴主，不支持购买或提现。当前余额与赠送仅为本机演示。")}</p>
  </section>;
}

function PreferencesEditor({ selected: initial }: { selected: string[] }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(initial); const [error, setError] = useState(""); const { notify } = useUI();
  function save() { try { updateDemoPreferences(selected); setError(""); notify("喜好已保存在本机，后续推荐会使用这些线索。"); } catch (issue) { setError(issue instanceof Error ? issue.message : "保存失败。"); } }
  return <><div className="interest-grid preferences-grid">{interests.map((interest) => { const checked = selected.includes(interest.id); const disabled = !checked && selected.length >= 5; return <label className={`interest-option ${checked ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`} key={interest.id}><input type="checkbox" checked={checked} disabled={disabled} onChange={() => setSelected(checked ? selected.filter((id) => id !== interest.id) : [...selected, interest.id])} /><span className="interest-symbol" aria-hidden="true">{interest.symbol}</span><strong>{t(interest.label)}</strong><small>{t(interest.description)}</small><span className="interest-check" aria-hidden="true">{checked && <Icon name="check" size={12} />}</span></label>; })}</div><p className="selection-count">{t("已选择 ")}<strong>{selected.length}</strong> / 5 <span>{t("也可清空，保持开放的好奇心")}</span></p>{t(error) && <p className="form-alert" role="alert">{t(error)}</p>}<button className="button button-accent" onClick={save}>{t("保存喜好 ")}<Icon name="check" size={16} /></button></>;
}
export function PreferencesPage() {
  const { t } = useI18n();
  const { available, user } = useProtectedDemo("/me/preferences");
  if (!available || !user) return <ContentLoading />;
  return <section className="account-section"><PersonalHeading title={t("我的喜好")} subtitle={t("选择 0～5 项兴趣，随时可以改变。它们不会限定你的扮演身份。")} /><PreferencesEditor key={user.handle} selected={user.interests} /></section>;
}
function ProfileEditor({ initialName, initialBio, handle }: { initialName: string; initialBio: string; handle: string }) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName); const [bio, setBio] = useState(initialBio); const [error, setError] = useState(""); const { notify } = useUI();
  function save(event: FormEvent) { event.preventDefault(); try { updateDemoPublicProfile(name, bio); setError(""); notify("公开资料已保存在本机。"); } catch (issue) { setError(issue instanceof Error ? issue.message : "保存失败。"); } }
  return <form className="settings-form" onSubmit={save}><div className="field-group"><label htmlFor="profile-handle">{t("个人 ID")}<span>{t("第一版不可修改")}</span></label><div className="input-wrap"><input id="profile-handle" value={`@${handle}`} readOnly /></div></div><div className="field-group"><label htmlFor="profile-name">{t("显示昵称")}<span>{t("1～20 个字符")}</span></label><div className="input-wrap"><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} /></div></div><label className="editor-label" htmlFor="profile-bio">{t("个人简介")}<span>{t("最多 200 个字符")}</span></label><textarea id="profile-bio" value={bio} onChange={(event) => setBio(event.target.value)} rows={4} placeholder={t("用一句话，介绍有趣的自己。")} />{t(error) && <p className="form-alert" role="alert">{t(error)}</p>}<button className="button button-accent" type="submit">{t("保存资料 ")}<Icon name="check" size={16} /></button></form>;
}
export function SettingsPage() {
  const { t } = useI18n();
  const { available, user } = useProtectedDemo("/me/settings");
  if (!available || !user) return <ContentLoading />;
  return <section className="account-section"><PersonalHeading title={t("账号设置")} subtitle={t("公开的是你的想法，私有的是你的账号资料。")} /><Link className="button button-outline" href="/settings"><Icon name="settings" size={17} />{t("外观与体验")}<Icon name="arrow" size={15} /></Link><ProfileEditor key={user.handle} handle={user.handle} initialName={user.displayName || user.handle} initialBio={user.bio || ""} /><div className="settings-auth-note"><strong>{t("关于演示密码")}</strong><p>{t("当前不会保存或验证密码。修改密码与账号找回会在真实认证阶段接入。")}</p></div><button className="logout-button" onClick={logoutDemoProfile}><Icon name="logout" size={16} /> {t(" 退出演示账号")}</button></section>;
}
