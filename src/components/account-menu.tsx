"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useDemoSession, logoutDemoProfile } from "@/lib/demo-session";
import { useUIPreferences, updateUIPreferences, useSystemDark } from "@/lib/use-ui-preferences";
import { useI18n } from "@/lib/use-i18n";
import { Icon } from "./icon";

export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { user } = useDemoSession();
  return <AccountMenuView compact={compact} user={user} onSignOut={logoutDemoProfile} />;
}
export function AccountMenuView({ compact = false, user, onSignOut, real = false }: { compact?: boolean; user: { handle: string; displayName?: string } | null; onSignOut: () => void; real?: boolean }) {
  const { preferences } = useUIPreferences(); const { t } = useI18n();
  const [open, setOpen] = useState(false); const root = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null); const panel = useRef<HTMLDivElement>(null); const id = useId();
  const systemDark = useSystemDark(); const dark = preferences.theme === "dark" || (preferences.theme === "system" && systemDark);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside); return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function close(focus = false) { setOpen(false); if (focus) trigger.current?.focus(); }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []); const current = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") { event.preventDefault(); close(true); }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items[next]?.focus(); }
    if (event.key === "Tab") close();
  }
  return <div className={`account-menu ${compact ? "account-menu-compact" : ""}`} ref={root}>
    <button ref={trigger} className={compact ? "account-menu-trigger compact-trigger" : "account-shortcut account-menu-trigger"} aria-label={t(user ? "打开账号菜单" : "打开设置菜单")} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }}>
      <span className="account-avatar">{user ? (user.displayName || user.handle).slice(0, 1).toUpperCase() : <Icon name="settings" size={19} />}</span>{!compact && <span><strong>{user ? `@${user.handle}` : t("外观与体验")}</strong><small>{t(user ? "正在体验入戏" : "自定义你的界面")}</small></span>}{!compact && <Icon name="more" size={18} />}
    </button>
    {open && <div className="account-menu-panel" id={id} ref={panel} role="menu" aria-label={t("账号菜单")} onKeyDown={key}>
      <div className="account-menu-heading"><strong>{user?.displayName || user?.handle || t("访客")}</strong><small>{user ? `@${user.handle}` : "InRole"}</small></div>
      {user && <><Link role="menuitem" href={real ? "/live/activity" : "/me"} onClick={() => close()}><Icon name="user" size={17} />{t("个人中心")}</Link><Link role="menuitem" href={`${real ? "/live" : ""}/users/${user.handle}`} onClick={() => close()}><Icon name="people" size={17} />{t("我的公开主页")}</Link><Link role="menuitem" href={real ? "/live/wallet" : "/me/wallet"} onClick={() => close()}><Icon name="wallet" size={17} />{t("钱包与流水")}</Link><Link role="menuitem" href={real ? "/live/preferences" : "/me/preferences"} onClick={() => close()}><Icon name="heart" size={17} />{t("我的喜好")}</Link>{real && <Link role="menuitem" href="/live/me" onClick={() => close()}><Icon name="settings" size={17} />{t("账号设置")}</Link>}<div role="separator" className="menu-separator" /></>}
      <Link role="menuitem" href={real ? "/live/settings" : "/settings"} onClick={() => close()}><Icon name="settings" size={17} />{t("设置")}</Link>
      <button role="menuitem" onClick={() => { updateUIPreferences({ theme: dark ? "light" : "dark" }); close(true); }}><Icon name={dark ? "sun" : "moon"} size={17} />{t(dark ? "切换到浅色模式" : "切换到深色模式")}</button>
      {user && <><div role="separator" className="menu-separator" /><button role="menuitem" className="menu-signout" onClick={() => { close(); onSignOut(); }}><Icon name="logout" size={17} />{t("退出登录")}</button></>}
    </div>}
  </div>;
}
