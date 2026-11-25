"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authRequest, AuthRequestError, readAccount } from "@/data/auth-api";
import type { AccountDTO } from "@/lib/api-types";
import { useI18n } from "@/lib/use-i18n";
import { Brand } from "./brand";
import { Icon, type IconName } from "./icon";
import { AccountMenuView } from "./account-menu";
import s from "./live-community.module.css";

type Session = { account: AccountDTO | null; ready: boolean; ensureLogin: () => boolean; signOut: () => Promise<void> };
const SessionContext = createContext<Session | null>(null);
export function useLiveSession() { const value = useContext(SessionContext); if (!value) throw new Error("Real community session is missing"); return value; }
const navigation: { href: string; label: string; short: string; icon: IconName }[] = [
  { href: "/live", label: "帖子广场", short: "帖子", icon: "home" }, { href: "/live/trending", label: "热搜话题", short: "热搜", icon: "fire" },
  { href: "/live/people", label: "人物剧场", short: "人物", icon: "people" }, { href: "/live/activity", label: "个人中心", short: "我的", icon: "user" },
];
export function LiveShell({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<AccountDTO | null>(null), [ready, setReady] = useState(false), [error, setError] = useState<unknown>(null), [claimError, setClaimError] = useState(false);
  const pathname = usePathname(), router = useRouter(), { t } = useI18n();
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const account = await readAccount(); if (!active) return; setAccount(account); setError(null); setReady(true);
        try { await authRequest("/api/v1/community/claim", "POST", {}); if (active) setClaimError(false); } catch { if (active) setClaimError(true); }
      } catch (failure) { if (active) { setAccount(null); setReady(true); setError(failure instanceof AuthRequestError && [401, 403].includes(failure.status) ? null : failure); } }
    }
    void refresh(); window.addEventListener("focus", refresh); window.addEventListener("online", refresh); window.addEventListener("inrole:retry", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); window.removeEventListener("inrole:retry", refresh); };
  }, [pathname]);
  function ensureLogin() {
    if (!ready || !account) { router.push(`/live/login?next=${encodeURIComponent(pathname)}`); return false; }
    if (!account.onboardingComplete && pathname !== "/live/onboarding") { router.push(`/live/onboarding?next=${encodeURIComponent(pathname)}`); return false; }
    return true;
  }
  async function signOut() { try { await authRequest("/api/v1/auth/logout", "POST", {}); setAccount(null); router.push("/live/login"); router.refresh(); } catch (error) { setError(error); } }
  const active = (href: string) => href === "/live" ? pathname === "/" || pathname === href || /^\/live\/(posts|compose)/.test(pathname) : href === "/live/trending" ? /^\/live\/(trending|topics)/.test(pathname) : href === "/live/people" ? /^\/live\/(people|rankings|person-posts|request)/.test(pathname) : /^\/live\/(activity|me|wallet|preferences|admin|recovery)/.test(pathname);
  const menu = (compact = false) => <AccountMenuView real user={account} compact={compact} onSignOut={() => void signOut()} />;
  return <SessionContext.Provider value={{ account, ready, ensureLogin, signOut }}><a className="skip-link" href="#main">{t("跳到主要内容")}</a>
    <header className="mobile-header"><Brand compact href="/live" /><div className="mobile-account-controls">{!account && <Link className="button button-small button-outline" href={`/live/login?next=${encodeURIComponent(pathname === "/" ? "/live" : pathname)}`}>{t("登录 / 注册")}</Link>}{menu(true)}</div></header>
    <div className="community-layout live-community"><aside className="sidebar" aria-label={t("桌面主导航")}><Brand href="/live" /><nav className="desktop-navigation" aria-label={t("主导航")}>{navigation.map(item => <Link href={item.href} key={item.href} className={`nav-item ${active(item.href) ? "is-active" : ""}`} aria-current={active(item.href) ? "page" : undefined}><Icon name={item.icon} /><span>{t(item.label)}</span>{active(item.href) && <span className="nav-indicator" />}</Link>)}</nav>
      <Link className="button button-accent sidebar-compose" href="/live/compose"><Icon name="plus" />{t("换个身份发言")}</Link><div className="sidebar-bottom"><div className="sidebar-motto">{t("平凡的你，")}<br />{t("也有不平凡的台词。")}</div>{!account && <div className="sidebar-login"><p>{t("好戏，还差一个你。")}</p><Link href={`/live/register?next=${encodeURIComponent(pathname)}`}>{t("加入入戏")}<Icon name="arrow" size={16} /></Link></div>}{menu()}<p className="sidebar-footnote">{t("用户扮演 · 灵感无界")}</p></div></aside>
      <div className="community-content"><div className="demo-banner live-status"><span className="demo-dot" /><strong>{t("入戏社区")}</strong><span>{t("公共人物 · 每次发言，自由入戏")}</span><Link href="/demo">{t("演示预览")} ↗</Link></div><main id="main" className={s.main}><Failure error={error} />{claimError && <p className="form-alert">{t("今日通宝领取暂未确认")}，<Link href="/live/wallet">{t("查看钱包与流水")}</Link></p>}{children}</main></div></div>
    <nav className="mobile-navigation" aria-label={t("手机主导航")}>{navigation.map(item => <Link href={item.href} key={item.href} className={active(item.href) ? "is-active" : ""} aria-current={active(item.href) ? "page" : undefined}><Icon name={item.icon} size={22} /><span>{t(item.short)}</span></Link>)}</nav>
  </SessionContext.Provider>;
}
export function PageHeading({ title, subtitle, eyebrow = "EVERY VOICE, A NEW ROLE", action }: { title: string; subtitle: string; eyebrow?: string; action?: React.ReactNode }) {
  const { t } = useI18n(); return <header className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{t(title)}<span className="heading-dot">.</span></h1><p>{t(subtitle)}</p></div>{action}</header>;
}
export function Failure({ error }: { error: unknown }) {
  const pathname = usePathname(), { t } = useI18n();
  if (!error) return null;
  return <div className="form-alert live-error" role="alert"><p>{t(error instanceof Error ? error.message : "请求失败，请重试。")}</p>{error instanceof AuthRequestError && <>{error.fields && Object.values(error.fields).map((value, index) => <p key={index}>{t(value)}</p>)}{error.requestId && <small>{t("反馈编号：")}{error.requestId}</small>}{error.status === 401 && <Link href={`/live/login?next=${encodeURIComponent(pathname)}`}>{t("登录 / 注册")}</Link>}{error.status === 409 && <Link href={`/live/onboarding?next=${encodeURIComponent(pathname)}`}>{t("检查喜好引导")}</Link>}{(error.status === 0 || error.status >= 500) && <button type="button" className="button button-outline button-small" onClick={() => window.dispatchEvent(new Event("inrole:retry"))}>重新读取数据</button>}</>}</div>;
}
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState<unknown>(null), [version, setVersion] = useState(0), [loading, setLoading] = useState(true);
  useEffect(() => {
    let controller = new AbortController();
    function read() {
      const current = controller;
      void authRequest<T>(path, "GET", undefined, current.signal).then(value => { if (!current.signal.aborted) { setData(value); setError(null); setLoading(false); } }).catch(error => { if (!current.signal.aborted) { setData(null); setError(error); setLoading(false); } });
    }
    function retry() { controller.abort(); controller = new AbortController(); setLoading(true); read(); }
    read(); window.addEventListener("online", retry); window.addEventListener("focus", retry); window.addEventListener("inrole:retry", retry);
    return () => { controller.abort(); window.removeEventListener("online", retry); window.removeEventListener("focus", retry); window.removeEventListener("inrole:retry", retry); };
  }, [path, version]);
  return { data, error, loading, reload: () => { setLoading(true); setVersion(v => v + 1); } };
}
export const api = (path: string) => `/api/v1/community/${path}`;
