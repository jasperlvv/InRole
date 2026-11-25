"use client";
import { useI18n } from "@/lib/use-i18n";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authHref, handleError, passwordError } from "@/lib/account-rules";
import { loginDemoProfile, registerDemoProfile, useDemoSession } from "@/lib/demo-session";
import { Icon } from "./icon";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const { t } = useI18n();
  const registration = mode === "register";
  const router = useRouter();
  const session = useDemoSession();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<{ handle?: string; password?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  useEffect(() => { if (session.ready && session.user) router.replace(session.user.onboardingComplete ? (next === "/" ? "/demo" : next) : authHref("/onboarding", next)); }, [session.ready, session.user, next, router]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const idIssue = handleError(handle);
    const passwordIssue = passwordError(password);
    if (idIssue || passwordIssue) { setErrors({ handle: idIssue ?? undefined, password: passwordIssue ?? undefined }); return; }
    const issue = registration ? registerDemoProfile(handle) : loginDemoProfile(handle);
    if (issue) { setErrors({ form: issue }); return; }
    setPassword(""); setPending(true);
  }
  return <section className="auth-form-card" aria-labelledby="auth-title"><div className="demo-pill"><span /> {t(" 前端演示体验")}</div><p className="auth-step">{registration ? t("01 / 创建你的开场") : "WELCOME BACK"}</p><h1 id="auth-title">{registration ? t("给想象力一个名字。") : t("欢迎回来，继续入戏。")}</h1><p className="auth-subtitle">{registration ? t("一个 ID，就能拥有无数种可能。") : t("故事还在继续，就等你的一句。")}</p>
    <form onSubmit={submit} noValidate className="account-form"><div className="field-group"><label htmlFor="handle">{t("个人 ID ")}<span>{t("你的公开 @账号")}</span></label><div className={`input-wrap ${errors.handle ? "has-error" : ""}`}><span className="input-prefix">@</span><input id="handle" name="handle" autoComplete="username" autoCapitalize="none" spellCheck={false} value={handle} onChange={(event) => { setHandle(event.target.value); setErrors({}); }} placeholder={t("给自己取个独一无二的 ID")} aria-invalid={Boolean(errors.handle)} aria-describedby="handle-help" disabled={pending} /></div><p className={errors.handle ? "field-error" : "field-help"} id="handle-help">{t(errors.handle) || t("3～20 位英文字母、数字或下划线，不区分大小写。")}</p></div>
      <div className="field-group"><label htmlFor="password">{t("密码")}</label><div className={`input-wrap ${errors.password ? "has-error" : ""}`}><input id="password" name="password" autoComplete={registration ? "new-password" : "current-password"} type={visible ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setErrors({}); }} placeholder={t("输入 8～64 个字符")} aria-invalid={Boolean(errors.password)} aria-describedby="password-help" disabled={pending} /><button type="button" className="password-toggle" aria-label={visible ? t("隐藏密码") : t("显示密码")} aria-pressed={visible} onClick={() => setVisible(!visible)}><Icon name={visible ? "eye-off" : "eye"} size={19} /></button></div><p className={errors.password ? "field-error" : "field-help"} id="password-help">{t(errors.password) || t("演示不会保存或验证密码，请勿填写常用密码。")}</p></div>
      {errors.form && <p className="form-alert" role="alert">{t(errors.form)}</p>}{!session.persistent && <p className="form-alert" role="status">{t("浏览器未允许本地存储，此次体验仅在当前页面有效。")}</p>}
      <button type="submit" className="button button-accent auth-submit" disabled={pending || !session.ready}>{pending ? t("正在进入…") : registration ? t("注册，开启你的故事") : t("登录演示账号")}<Icon name="arrow" size={18} /></button></form>
    <p className="auth-switch">{registration ? t("已经有演示 ID？") : t("还没有自己的开场？")}<Link href={authHref(registration ? "/login" : "/register", next)}>{registration ? t("去登录") : t("注册一个 ID")}<Icon name="arrow" size={13} /></Link></p><div className="demo-explanation"><Icon name="spark" size={17} /><p>{registration ? t("ID 和喜好仅记录在这台浏览器中，尚未创建真实账号。下一步，为你的首页选一点灵感。") : t("请使用本机已注册的演示 ID。密码仅检查格式，不验证身份；真实登录将在后续接入。")}</p></div><p className="auth-browse-note">{t("还没想好？")}<Link href="/demo">{t("不登录，也能看看大家的脑洞。")}</Link></p></section>;
}
