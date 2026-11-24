"use client";
import { useI18n } from "@/lib/use-i18n";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { submitDemoCharacter, useDemoContent } from "@/lib/demo-content";
import { formatPostTime } from "@/lib/content-model";
import { useProtectedDemo } from "./protected-demo";
import { ContentLoading, ContentNotice } from "./content-notice";
import { Icon } from "./icon";

export function CharacterRequestPage() {
  const { t } = useI18n();
  const { user, available } = useProtectedDemo("/people/request"); const { state, updatedAt } = useDemoContent();
  const [mode, setMode] = useState<"manual" | "url">("manual"); const [name, setName] = useState(""); const [bio, setBio] = useState(""); const [url, setUrl] = useState(""); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const request = useRef<string | null>(null);
  if (!available || !user) return <ContentLoading />;
  const mine = state.characterRequests.filter((item) => item.handle === user.handle).sort((a, b) => b.createdAt - a.createdAt);
  function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setSuccess(""); request.current ??= crypto.randomUUID();
    try { submitDemoCharacter(mode === "manual" ? { name, bio, sourceUrl: "" } : { name: "", bio: "", sourceUrl: url }, request.current); request.current = null; setName(""); setBio(""); setUrl(""); setSuccess("申请已记录在本机待审核列表；接入后台后由管理员审核，不会自动创建公共人物。"); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "申请未能保存，请重试。"); }
  }
  return <section className="request-page"><Link href="/people" className="back-link"><Icon name="back" size={17} /> {t(" 人物剧场")}</Link><header className="page-heading"><div><p className="eyebrow">MAKE ROOM FOR ANOTHER VOICE</p><h1>{t("请 TA 登场")}<span className="heading-dot">.</span></h1><p>{t("找不到想扮演的人物？把这位主角推荐给我们。")}</p></div></header><ContentNotice /><div className="request-layout"><form className="request-form" onSubmit={submit}><div role="tablist" aria-label={t("人物申请方式")}><button type="button" role="tab" aria-selected={mode === "manual"} onClick={() => { setMode("manual"); setError(""); setSuccess(""); }} className={mode === "manual" ? "is-active" : ""}>{t("填写人物资料")}</button><button type="button" role="tab" aria-selected={mode === "url"} onClick={() => { setMode("url"); setError(""); setSuccess(""); }} className={mode === "url" ? "is-active" : ""}>{t("粘贴百科链接")}</button></div>{mode === "manual" ? <><label>{t("人物名称")}<span>{t("最多 60 字")}</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("例如：辛弃疾、阿波罗……")} required /></label><label>{t("基本信息")}<span>{t("最多 1000 字")}</span><textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder={t("TA 是谁？来自什么时代或作品？简单介绍你想让 TA 登场的理由。")} rows={6} required /></label></> : <><label>{t("百科词条网址")}<span>{t("维基百科 / 百度百科")}</span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://zh.wikipedia.org/wiki/…" required /></label><p className="request-hint">{t("只粘贴词条网址即可，管理员以后核对资料。当前不会自动抓取或导入百科内容。")}</p></>}{t(error) && <p className="form-alert" role="alert">{t(error)}</p>}{success && <p className="request-success" role="status">{success}</p>}<div className="request-submit"><span>{t("本机演示 · 待管理员审核")}</span><button className="button button-accent" disabled={mode === "manual" ? !name.trim() || !bio.trim() : !url.trim()}>{t("提交人物申请 ")}<Icon name="arrow" size={16} /></button></div></form><aside className="request-guidance"><span className="request-glyph">请</span><h2>{t("公共人物，大家的舞台。")}</h2><p>{t("申请不是创建专属角色。审核通过后，所有用户都能在每次发言时选择 TA。")}</p><ol><li>{t("推荐人物或提供词条链接")}</li><li>{t("管理员核对名称、资料与头像")}</li><li>{t("加入公共人物库，邀请大家接戏")}</li></ol><small>{t("人物头像由管理员统一上传维护，申请者无需上传。")}</small></aside></div><section className="my-requests" aria-labelledby="my-requests-title"><h2 id="my-requests-title">{t("我的人物申请 ")}<span>{mine.length}</span></h2><p>{t("仅当前演示账号可见，记录保存在本机；尚未发送到真实管理后台。")}</p>{mine.length ? mine.map((item) => <article key={item.id}><div><strong>{item.name || t("百科词条申请")}</strong><span>{t("本机待审核")}</span></div>{item.bio && <p>{item.bio}</p>}{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{t("查看提供的百科词条 ↗")}</a>}<time>{t(formatPostTime(item.createdAt, updatedAt))}</time></article>) : <div className="request-empty">{t("还没有申请。下一位登场人物，由你提名。")}</div>}</section></section>;
}
