"use client";
import { useI18n } from "@/lib/use-i18n";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { Icon, type IconName } from "./icon";
import { useDemoSession } from "@/lib/demo-session";
import { authHref } from "@/lib/account-rules";
import { useUI } from "./ui-provider";
import { AccountMenu } from "./account-menu";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "帖子广场", icon: "home" }, { href: "/trending", label: "热搜话题", icon: "fire" },
  { href: "/people", label: "人物剧场", icon: "people" }, { href: "/me", label: "个人中心", icon: "user" },
];
export function CommunityShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { user } = useDemoSession();
  const { openComposer } = useUI();
  const active = (href: string) => href === "/" ? pathname === "/" || pathname.startsWith("/posts") : href === "/trending" ? pathname.startsWith("/trending") || pathname.startsWith("/topics") : href === "/people" ? pathname.startsWith("/people") || pathname === "/rankings" : pathname.startsWith(href);
  return <><a className="skip-link" href="#main">{t("跳到主要内容")}</a>
    <header className="mobile-header"><Brand compact /><div className="mobile-account-controls">{!user && <Link className="button button-small button-outline" href={authHref("/login", pathname)}>{t("登录 / 注册")}</Link>}<AccountMenu compact /></div></header>
    <div className="community-layout"><aside className="sidebar" aria-label={t("桌面主导航")}><Brand />
      <nav className="desktop-navigation" aria-label={t("主导航")}>{navigation.map((item) => <Link key={item.href} href={item.href} className={active(item.href) ? "nav-item is-active" : "nav-item"} aria-current={active(item.href) ? "page" : undefined}><Icon name={item.icon} /><span>{t(item.label)}</span>{active(item.href) && <span className="nav-indicator" />}</Link>)}</nav>
      <button className="button button-accent sidebar-compose" onClick={() => openComposer()}><Icon name="plus" /> {t(" 换个身份发言")}</button>
      <div className="sidebar-bottom"><div className="sidebar-motto">{t("平凡的你，")}<br />{t("也有不平凡的台词。")}</div>
        {!user && <div className="sidebar-login"><p>{t("好戏，还差一个你。")}</p><Link href={authHref("/register", pathname)}>{t("加入入戏 ")}<Icon name="arrow" size={16} /></Link></div>}<AccountMenu />
        <p className="sidebar-footnote">{t("用户扮演 · 灵感无界")}</p></div>
    </aside><div className="community-content"><div className="demo-banner"><span className="demo-dot" /><strong>{t("前端演示")}</strong><span>{t("示例与本机发言 · 非真实账号 · 不保存密码")}</span><Link href="/live/people">真实人物预览 ↗</Link></div><main id="main">{children}</main></div></div>
    <nav className="mobile-navigation" aria-label={t("手机主导航")}>{navigation.map((item) => <Link href={item.href} key={item.href} className={active(item.href) ? "is-active" : ""} aria-current={active(item.href) ? "page" : undefined}><Icon name={item.icon} size={22} /><span>{item.href === "/" ? t("帖子") : item.href === "/trending" ? t("热搜") : item.href === "/people" ? t("人物") : t("我的")}</span></Link>)}</nav></>;
}
